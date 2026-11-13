import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '../data');
mkdirSync(DATA_DIR, { recursive: true });

const dbPath = process.env.TRACELEDGER_DB || join(DATA_DIR, 'traceledger.db');
export const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      product_name TEXT NOT NULL,
      sku TEXT NOT NULL,
      origin_location TEXT NOT NULL,
      manufacturer_address TEXT NOT NULL,
      current_custodian TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('MANUFACTURED', 'QUALITY_APPROVED', 'IN_TRANSIT', 'CUSTOMS_CLEARED', 'DELIVERED', 'COMPROMISED')),
      is_cold_chain INTEGER NOT NULL DEFAULT 0,
      min_temp_celsius REAL,
      max_temp_celsius REAL,
      is_compromised INTEGER NOT NULL DEFAULT 0,
      compromise_reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      from_custodian TEXT NOT NULL,
      to_custodian TEXT NOT NULL,
      location TEXT NOT NULL,
      temperature_celsius REAL,
      proof_hash TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS telematics (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      temperature_celsius REAL NOT NULL,
      location TEXT NOT NULL,
      is_alert INTEGER NOT NULL DEFAULT 0,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
    );
  `);

  const count = db.prepare('SELECT count(*) as count FROM batches').get().count;
  if (count === 0) {
    seedDemoProvenanceData();
  }
}

function seedDemoProvenanceData() {
  const insertBatch = db.prepare(`
    INSERT INTO batches (id, product_name, sku, origin_location, manufacturer_address, current_custodian, status, is_cold_chain, min_temp_celsius, max_temp_celsius, is_compromised)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTransfer = db.prepare(`
    INSERT INTO transfers (id, batch_id, from_custodian, to_custodian, location, temperature_celsius, proof_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTelematics = db.prepare(`
    INSERT INTO telematics (id, batch_id, temperature_celsius, location, is_alert)
    VALUES (?, ?, ?, ?, ?)
  `);

  const mfgZurich = '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b';
  const carrierDHL = '0x8b0d9e2f3a4c5b6a7c8d9e0f1a2b3c4d5e6f7a8b';
  const customsBoston = '0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d';
  const hospitalMassGen = '0x9c1e0f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e';

  // Batch 1: Cold-Chain mRNA Vaccine Lot
  insertBatch.run(
    'LOT-MRNA-99420',
    'Lyophilized Lipid Nanoparticle mRNA Vaccine',
    'SKU-VAC-8800',
    'Zurich High-Containment Biomanufacturing Facility, Switzerland',
    mfgZurich,
    customsBoston,
    'CUSTOMS_CLEARED',
    1,
    -80.0,
    -20.0,
    0
  );

  insertTransfer.run(
    'tr-101',
    'LOT-MRNA-99420',
    mfgZurich,
    carrierDHL,
    'Zurich Airport (ZRH) Cold Storage Freight Dock',
    -74.5,
    '0x7a9c8b3d4f1e56a2b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1'
  );

  insertTransfer.run(
    'tr-102',
    'LOT-MRNA-99420',
    carrierDHL,
    customsBoston,
    'Boston Logan International (BOS) US Customs Free-Zone',
    -72.1,
    '0x8b0d9e2f3a4c5b6a7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b'
  );

  insertTelematics.run('tel-1', 'LOT-MRNA-99420', -75.0, 'ZRH Cargo Bay 4', 0);
  insertTelematics.run('tel-2', 'LOT-MRNA-99420', -73.2, 'Transatlantic Air Cargo Flight LH422', 0);
  insertTelematics.run('tel-3', 'LOT-MRNA-99420', -71.8, 'BOS Terminal E Inbound Vault', 0);

  // Batch 2: Aerospace Titanium Discs
  insertBatch.run(
    'LOT-AERO-7710',
    'Single-Crystal Nickel-Titanium Turbine Blisk',
    'SKU-TURB-550',
    'Sheffield Advanced Metallurgy Foundry, UK',
    '0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97',
    '0xDAFEA492D9c6733ae3d56b7Ed1ADB60692c98Bc5',
    'IN_TRANSIT',
    0,
    null,
    null,
    0
  );

  insertTransfer.run(
    'tr-201',
    'LOT-AERO-7710',
    '0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97',
    '0xDAFEA492D9c6733ae3d56b7Ed1ADB60692c98Bc5',
    'Sheffield Quality Inspection Laboratory #3',
    22.0,
    '0x9c1e0f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e'
  );

  // Batch 3: High-Purity Silicon Semiconductor Wafers
  insertBatch.run(
    'LOT-SEMI-300MM',
    '300mm Ultra-Pure Silicon Epitaxial Wafers',
    'SKU-WFR-300',
    'Dresden Semiconductor Fabrication Facility, Germany',
    '0x28C6c06298d514Db089934071355E5743bf21d60',
    hospitalMassGen,
    'DELIVERED',
    0,
    null,
    null,
    0
  );
}
