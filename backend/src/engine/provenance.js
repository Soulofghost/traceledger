import { db } from '../db.js';
import crypto from 'node:crypto';
import { ethers } from 'ethers';

export class ProvenanceManager {
  registerBatch({ id, productName, sku, originLocation, manufacturerAddress, isColdChain = false, minTempCelsius = null, maxTempCelsius = null }) {
    if (!id || !productName || !sku || !originLocation || !manufacturerAddress) {
      throw new Error('Missing required batch registration parameters.');
    }

    const batchId = id.trim().toUpperCase();
    const existing = db.prepare('SELECT id FROM batches WHERE id = ?').get(batchId);
    if (existing) {
      throw new Error(`Batch ID "${batchId}" is already registered in ledger.`);
    }

    db.prepare(`
      INSERT INTO batches (
        id, product_name, sku, origin_location, manufacturer_address,
        current_custodian, status, is_cold_chain, min_temp_celsius, max_temp_celsius, is_compromised
      ) VALUES (?, ?, ?, ?, ?, ?, 'MANUFACTURED', ?, ?, ?, 0)
    `).run(
      batchId,
      productName.trim(),
      sku.trim().toUpperCase(),
      originLocation.trim(),
      manufacturerAddress.toLowerCase(),
      manufacturerAddress.toLowerCase(),
      isColdChain ? 1 : 0,
      minTempCelsius !== null ? Number(minTempCelsius) : null,
      maxTempCelsius !== null ? Number(maxTempCelsius) : null
    );

    return this.getBatchDetails(batchId);
  }

  getBatchDetails(batchId) {
    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId.toUpperCase());
    if (!batch) return null;

    const transfers = db.prepare('SELECT * FROM transfers WHERE batch_id = ? ORDER BY timestamp ASC').all(batch.id);
    const telematics = db.prepare('SELECT * FROM telematics WHERE batch_id = ? ORDER BY timestamp DESC LIMIT 50').all(batch.id);

    return {
      ...batch,
      is_cold_chain: Boolean(batch.is_cold_chain),
      is_compromised: Boolean(batch.is_compromised),
      transfers,
      telematics
    };
  }

  listBatches() {
    const batches = db.prepare('SELECT * FROM batches ORDER BY created_at DESC').all();
    return batches.map(b => {
      const transferCount = db.prepare('SELECT count(*) as count FROM transfers WHERE batch_id = ?').get(b.id).count;
      return {
        ...b,
        is_cold_chain: Boolean(b.is_cold_chain),
        is_compromised: Boolean(b.is_compromised),
        transferCount
      };
    });
  }

  transferCustody(batchId, callerAddress, toCustodian, location, recordedTemp = null, proofHash = null) {
    const b = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId.toUpperCase());
    if (!b) throw new Error('Batch not found in ledger.');
    if (b.status === 'DELIVERED') throw new Error('Batch is already finalized and delivered.');

    if (b.current_custodian.toLowerCase() !== callerAddress.toLowerCase()) {
      throw new Error(`Unauthorized custody transfer: caller "${callerAddress}" is not the current custodian "${b.current_custodian}".`);
    }

    let isCompromised = b.is_compromised;
    let compromiseReason = b.compromise_reason;

    // Check cold-chain temperature thresholds
    if (b.is_cold_chain && recordedTemp !== null) {
      const temp = Number(recordedTemp);
      if ((b.min_temp_celsius !== null && temp < b.min_temp_celsius) ||
          (b.max_temp_celsius !== null && temp > b.max_temp_celsius)) {
        isCompromised = 1;
        compromiseReason = `Thermal breach during handoff at ${location}: recorded ${temp}°C outside safe bounds [${b.min_temp_celsius}°C, ${b.max_temp_celsius}°C]`;
      }
    }

    const nextStatus = isCompromised ? 'COMPROMISED' : 'IN_TRANSIT';

    db.prepare(`
      UPDATE batches
      SET current_custodian = ?, status = ?, is_compromised = ?, compromise_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(toCustodian.toLowerCase(), nextStatus, isCompromised, compromiseReason, b.id);

    // Record immutable custody transfer
    const trId = 'tr-' + crypto.randomUUID().slice(0, 8);
    const hash = proofHash || ethers.keccak256(ethers.toUtf8Bytes(`${b.id}-${b.current_custodian}-${toCustodian}-${Date.now()}`));

    db.prepare(`
      INSERT INTO transfers (id, batch_id, from_custodian, to_custodian, location, temperature_celsius, proof_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(trId, b.id, b.current_custodian, toCustodian.toLowerCase(), location, recordedTemp, hash);

    return this.getBatchDetails(b.id);
  }

  recordTelematics(batchId, callerAddress, temperatureCelsius, location) {
    const b = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId.toUpperCase());
    if (!b) throw new Error('Batch not found.');
    if (b.current_custodian.toLowerCase() !== callerAddress.toLowerCase()) {
      throw new Error('Only current custodian IoT gateway can log telematics.');
    }

    const temp = Number(temperatureCelsius);
    let isAlert = 0;

    if (b.is_cold_chain) {
      if ((b.min_temp_celsius !== null && temp < b.min_temp_celsius) ||
          (b.max_temp_celsius !== null && temp > b.max_temp_celsius)) {
        isAlert = 1;
        db.prepare(`
          UPDATE batches
          SET is_compromised = 1, status = 'COMPROMISED',
              compromise_reason = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(`IoT telematics alarm at ${location}: ${temp}°C`, b.id);
      }
    }

    const telId = 'tel-' + crypto.randomUUID().slice(0, 8);
    db.prepare(`
      INSERT INTO telematics (id, batch_id, temperature_celsius, location, is_alert)
      VALUES (?, ?, ?, ?, ?)
    `).run(telId, b.id, temp, location, isAlert);

    return this.getBatchDetails(b.id);
  }

  markDelivered(batchId, callerAddress) {
    const b = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId.toUpperCase());
    if (!b) throw new Error('Batch not found.');
    if (b.current_custodian.toLowerCase() !== callerAddress.toLowerCase()) {
      throw new Error('Only the final receiving custodian can mark batch delivered.');
    }

    db.prepare("UPDATE batches SET status = 'DELIVERED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(b.id);
    return this.getBatchDetails(b.id);
  }

  verifyBatchCertificate(batchId) {
    const details = this.getBatchDetails(batchId);
    if (!details) return null;

    // Cryptographic audit proof digest
    const stateString = `${details.id}|${details.manufacturer_address}|${details.current_custodian}|${details.transfers.length}|${details.is_compromised}`;
    const provenanceProofDigest = ethers.keccak256(ethers.toUtf8Bytes(stateString));

    return {
      batchId: details.id,
      productName: details.product_name,
      sku: details.sku,
      origin: details.origin_location,
      manufacturer: details.manufacturer_address,
      currentCustodian: details.current_custodian,
      status: details.status,
      isAuthentic: !details.is_compromised,
      totalHandovers: details.transfers.length,
      provenanceProofDigest,
      verifiedTimestamp: new Date().toISOString()
    };
  }
}

export const provenanceManager = new ProvenanceManager();
