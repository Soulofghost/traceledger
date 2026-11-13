import test, { describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { db, initDb } from '../src/db.js';
import { provenanceManager } from '../src/engine/provenance.js';

describe('TraceLedger Supply Chain Provenance Engine Tests', () => {
  before(() => {
    initDb();
    db.exec("DELETE FROM telematics WHERE batch_id IN ('LOT-CRYO-001', 'LOT-COLD-BIO-77', 'LOT-IOT-TEST')");
    db.exec("DELETE FROM transfers WHERE batch_id IN ('LOT-CRYO-001', 'LOT-COLD-BIO-77', 'LOT-IOT-TEST')");
    db.exec("DELETE FROM batches WHERE id IN ('LOT-CRYO-001', 'LOT-COLD-BIO-77', 'LOT-IOT-TEST')");
  });

  const mfg = '0x1111111111111111111111111111111111111111';
  const carrier1 = '0x2222222222222222222222222222222222222222';
  const carrier2 = '0x3333333333333333333333333333333333333333';
  const distributor = '0x4444444444444444444444444444444444444444';

  test('Database seeds initial supply chain batches and transfers', () => {
    const batches = provenanceManager.listBatches();
    assert.ok(batches.length >= 3, 'Should have at least 3 seeded batches');

    const vaccineBatch = provenanceManager.getBatchDetails('LOT-MRNA-99420');
    assert.ok(vaccineBatch);
    assert.equal(vaccineBatch.is_cold_chain, true);
    assert.ok(vaccineBatch.transfers.length >= 2, 'Should have transfer records');
    assert.ok(vaccineBatch.telematics.length >= 3, 'Should have telematics records');
  });

  test('registerBatch creates new batch record with custody initialized to manufacturer', () => {
    const newLot = provenanceManager.registerBatch({
      id: 'LOT-CRYO-001',
      productName: 'Cryogenic Precision Bearings',
      sku: 'SKU-BRG-900',
      originLocation: 'Stockholm Precision Works, Sweden',
      manufacturerAddress: mfg,
      isColdChain: false
    });

    assert.equal(newLot.id, 'LOT-CRYO-001');
    assert.equal(newLot.current_custodian, mfg.toLowerCase());
    assert.equal(newLot.status, 'MANUFACTURED');
    assert.equal(newLot.is_compromised, false);

    // Duplicate ID prevention
    assert.throws(() => {
      provenanceManager.registerBatch({
        id: 'LOT-CRYO-001',
        productName: 'Duplicate',
        sku: 'SKU-00',
        originLocation: 'Nowhere',
        manufacturerAddress: mfg
      });
    }, /already registered/);
  });

  test('transferCustody updates current custodian and logs immutable transfer proof', () => {
    const lotId = 'LOT-CRYO-001';

    // Transfer from manufacturer to carrier 1
    const updated = provenanceManager.transferCustody(
      lotId,
      mfg,
      carrier1,
      'Stockholm Freight Terminal A',
      21.5
    );

    assert.equal(updated.current_custodian, carrier1.toLowerCase());
    assert.equal(updated.status, 'IN_TRANSIT');
    assert.equal(updated.transfers.length, 1);
    assert.equal(updated.transfers[0].from_custodian, mfg.toLowerCase());
    assert.equal(updated.transfers[0].to_custodian, carrier1.toLowerCase());
    assert.ok(updated.transfers[0].proof_hash.startsWith('0x'));
  });

  test('transferCustody rejects handovers from non-custodians', () => {
    const lotId = 'LOT-CRYO-001';
    // Current custodian is carrier1. Trying to transfer from mfg must fail.
    assert.throws(() => {
      provenanceManager.transferCustody(
        lotId,
        mfg,
        carrier2,
        'Unauthorized Handoff Hub',
        22.0
      );
    }, /Unauthorized custody transfer/);
  });

  test('Cold-chain temperature excursion triggers COMPROMISED state', () => {
    // Register sensitive cold chain batch (-80C to -20C)
    const coldLot = provenanceManager.registerBatch({
      id: 'LOT-COLD-BIO-77',
      productName: 'Live Attenuated Viral Vector',
      sku: 'SKU-VIR-10',
      originLocation: 'Basel Lab A, Switzerland',
      manufacturerAddress: mfg,
      isColdChain: true,
      minTempCelsius: -80.0,
      maxTempCelsius: -20.0
    });

    assert.equal(coldLot.is_compromised, false);

    // Handover with severe thermal violation (+5.0C instead of <= -20C)
    const breached = provenanceManager.transferCustody(
      coldLot.id,
      mfg,
      carrier1,
      'Refrigeration Failure Ramp',
      5.0
    );

    assert.equal(breached.is_compromised, true);
    assert.equal(breached.status, 'COMPROMISED');
    assert.ok(breached.compromise_reason.includes('Thermal breach'));
  });

  test('IoT telematics anomaly detection', () => {
    const lot = provenanceManager.registerBatch({
      id: 'LOT-IOT-TEST',
      productName: 'Active Sensor Vaccine Pack',
      sku: 'SKU-IOT-V',
      originLocation: 'Munich, Germany',
      manufacturerAddress: mfg,
      isColdChain: true,
      minTempCelsius: -50.0,
      maxTempCelsius: -15.0
    });

    // In-range telemetry ping
    const good = provenanceManager.recordTelematics(lot.id, mfg, -35.0, 'Air Cargo Hold');
    assert.equal(good.telematics.length, 1);
    assert.equal(good.telematics[0].is_alert, 0);
    assert.equal(good.is_compromised, false);

    // Out-of-range telemetry ping (-5.0C)
    const bad = provenanceManager.recordTelematics(lot.id, mfg, -5.0, 'Uninsulated Van');
    assert.equal(bad.is_compromised, true);
    assert.equal(bad.status, 'COMPROMISED');
  });

  test('verifyBatchCertificate generates verifiable cryptographic proof', () => {
    const cert = provenanceManager.verifyBatchCertificate('LOT-MRNA-99420');
    assert.ok(cert);
    assert.equal(cert.batchId, 'LOT-MRNA-99420');
    assert.equal(cert.isAuthentic, true);
    assert.ok(cert.provenanceProofDigest.startsWith('0x'));
    assert.equal(cert.provenanceProofDigest.length, 66);
  });
});

