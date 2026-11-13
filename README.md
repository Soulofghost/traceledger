# TraceLedger | Blockchain Supply-Chain Tracking & Cryptographic Provenance Platform

[![CI Pipeline](https://github.com/Soulofghost/traceledger/actions/workflows/ci.yml/badge.svg)](https://github.com/Soulofghost/traceledger/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Solidity 0.8.20](https://img.shields.io/badge/Solidity-0.8.20-blueviolet.svg)](https://soliditylang.org/)
[![Node.js v22+](https://img.shields.io/badge/Node.js-v22%2B-brightgreen.svg)](https://nodejs.org/)
[![Ethers.js v6](https://img.shields.io/badge/Ethers.js-v6.13-blue.svg)](https://docs.ethers.org/)
[![SQLite WAL](https://img.shields.io/badge/SQLite-WAL%20Engine-orange.svg)](https://www.sqlite.org/)

---

## 1. Project Introduction

**TraceLedger** is an enterprise-grade blockchain provenance and supply chain custody platform combining EVM smart contracts (`SupplyChainProvenance.sol`) with real-time IoT cold-chain sensor monitoring and an embedded SQLite Write-Ahead Logging (WAL) ledger. Designed for pharmaceutical distribution, aerospace component tracking, and high-value manufacturing, TraceLedger enforces verifiable multi-custodian handovers and automated thermal excursion alarms.

---

## 2. Problem Statement

Complex multi-tiered global logistics networks face systemic provenance and safety vulnerabilities:
- **Counterfeiting & Gray Market Diversion:** Lack of cryptographic provenance allows counterfeit components or diverted pharmaceuticals to enter authorized distribution channels.
- **Cold-Chain Excursions:** Temperature-sensitive vaccines and biologics risk spoilage during inter-modal transit without immutable audit trails to identify responsible parties.
- **Siloed Paper & ERP Systems:** Traditional bills of lading (BoL) and freight manifests are easily forged or altered retroactively.

---

## 3. Proposed Solution

TraceLedger delivers an immutable, cryptographically signed chain of custody:
- **Cryptographic Handoff Invariants:** Only the active verified custodian can transfer custody to a subsequent logistics provider or customs authority.
- **Autonomous Cold-Chain Auditing:** Automated evaluation of IoT temperature telematics against pre-configured batch safety thresholds (`minTempCelsius` and `maxTempCelsius`).
- **Verifiable Proof Digest:** End-to-end Keccak-256 state hashing allowing retailers, clinics, and regulators to verify authenticity in real-time.

---

## 4. Key Features

- **Multi-Participant Custody Protocol:** Sequential signing across manufacturers, freight forwarders, customs free-zones, and final healthcare clinics.
- **Cold-Chain Guardrails:** In-transit sensor readings outside allowable thermal boundaries immediately transition batch status to `COMPROMISED`.
- **IoT Telemetry Stream:** Ingestion of periodic temperature and GPS coordinates from connected transponders.
- **Verifiable Provenance Certificate:** One-click generation of public cryptographic certificates containing root digest hashes.
- **Granular Lot Metadata:** Tracking of SKUs, origin facility names, manufacturing dates, and custodian public addresses.

---

## 5. Architecture Diagram

```mermaid
flowchart TD
    Mfg["Manufacturer (Zurich Facility)"]
    Carrier["Logistics Carrier (Air Cargo)"]
    Customs["Customs Inspection (BOS Port)"]
    Clinic["Receiving Clinic / Retailer"]
    Contract["SupplyChainProvenance.sol"]
    API["Express REST API (/api/v1)"]
    Ledger[("SQLite WAL Ledger (traceledger.db)")]

    Mfg -->|1. Register Batch & Cold-Chain Bounds| Contract
    Mfg -->|2. Transfer Custody (Signed Hash)| Contract
    Carrier -->|3. Record In-Transit IoT Telematics| Contract
    Carrier -->|4. Transfer Custody| Customs
    Customs -->|5. Final Handover & Delivery| Clinic

    Contract -->|Emit Verification Events| API
    API -->|Synchronize Status & Audits| Ledger
```

---

## 6. Technology Stack

- **Smart Contract Language:** Solidity 0.8.20
- **Contract Engine:** Ethers.js v6.13
- **Runtime:** Node.js v22+
- **Web Framework:** Express.js 4.19
- **Database Engine:** `node:sqlite` (SQLite 3 WAL)
- **Frontend Architecture:** Vanilla ES6 SPA, HTML5, CSS Variables, Plus Jakarta Sans & JetBrains Mono typography
- **DevOps:** Docker, Docker Compose, GitHub Actions CI
- **Automated Testing:** Node native test runner (`node:test`, `node:assert/strict`)

---

## 7. Folder Structure

```
traceledger/
├── .github/
│   └── workflows/
│       └── ci.yml
├── contracts/
│   └── SupplyChainProvenance.sol
├── backend/
│   ├── src/
│   │   ├── engine/
│   │   │   └── provenance.js
│   │   ├── routes/
│   │   │   └── provenanceRoutes.js
│   │   ├── db.js
│   │   └── server.js
│   ├── tests/
│   │   └── provenance.test.js
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── app.js
│   ├── index.html
│   └── style.css
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── LICENSE
└── README.md
```

---

## 8. Installation Instructions

### Prerequisites
- Node.js 22.x or later
- npm or yarn

### Setup Steps
```bash
git clone https://github.com/Soulofghost/traceledger.git
cd traceledger/backend
npm install
npm start
```

Access the application in your browser at `http://localhost:8010`.

---

## 9. Environment Configuration

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `8010` | HTTP service port |
| `TRACELEDGER_DB` | `./backend/data/traceledger.db` | SQLite database file location |
| `NODE_ENV` | `development` | Runtime environment mode |

---

## 10. Database Setup

Database schema, tables, and demonstration cold-chain lots are initialized automatically upon launch via `initDb()`:
```javascript
import { initDb } from './src/db.js';
initDb();
```

---

## 11. API Documentation

### Primary Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Service health status check |
| `GET` | `/api/v1/batches` | List all tracked product lots |
| `POST` | `/api/v1/batches` | Register new manufactured lot |
| `GET` | `/api/v1/batches/:id` | Full provenance timeline & telematics |
| `POST` | `/api/v1/batches/:id/transfer` | Authorize custody handover |
| `POST` | `/api/v1/batches/:id/telematics` | Ingest IoT sensor reading |
| `POST` | `/api/v1/batches/:id/deliver` | Mark final delivery to recipient |
| `GET` | `/api/v1/batches/:id/verify` | Cryptographic certificate with Keccak-256 digest |

---

## 12. Application Interface Overview

TraceLedger features a clinical, cleanroom-grade dashboard:
- **Batch Catalog Sidebar:** Instant filtering of active consignments with status badges.
- **Chain of Custody Timeline:** Visual handover sequence displaying timestamp, GPS location, from/to addresses, and proof hashes.
- **IoT Telemetry Table:** Live telemetry pings with instant thermal breach alerts.
- **Certificate Verification Modal:** Verifiable Keccak-256 root digest seal for regulatory compliance.

---

## 13. Testing Instructions

Execute the automated test suite using the Node.js test runner:

```bash
cd backend
npm test
```

Expected output:
```
▶ TraceLedger Supply Chain Provenance Engine Tests
  ✔ Database seeds initial supply chain batches and transfers
  ✔ registerBatch creates new batch record with custody initialized to manufacturer
  ✔ transferCustody updates current custodian and logs immutable transfer proof
  ✔ transferCustody rejects handovers from non-custodians
  ✔ Cold-chain temperature excursion triggers COMPROMISED state
  ✔ IoT telematics anomaly detection
  ✔ verifyBatchCertificate generates verifiable cryptographic proof
✔ TraceLedger Supply Chain Provenance Engine Tests (31ms)
ℹ tests 7
ℹ pass 7
ℹ fail 0
```

---

## 14. Security Considerations

- **Strict Custodian Mutual Exclusion:** State transitions strictly reject signatures from non-custodian addresses.
- **Immutable Transfer Proofs:** Each handover generates a deterministic Keccak-256 digest linking batch ID, previous custodian, new custodian, and timestamp.
- **Sensor Tamper Detection:** Sensor readings breaching temperature boundaries irreversibly flag the lot as `COMPROMISED`.

---

## 15. Deployment Instructions

### Docker Deployment
```bash
docker compose up -d --build
```
Access the application at `http://localhost:8010`.

---

## 16. Known Limitations

- Embedded simulation mode uses high-performance SQLite WAL; on-chain mainnet/testnet deployment requires configuring an RPC node URL and custodian private key signers.

---

## 17. Future Roadmap

- [ ] Hardware cryptographic module (HSM) integration for automated warehouse scanner signing.
- [ ] GS1 EPCIS standard compatibility for legacy ERP integration.
- [ ] Automated smart contract insurance payout upon verified cold-chain failure.
- [ ] Zero-knowledge proof (ZKP) verification to shield proprietary supplier pricing while proving compliance.

---

## 18. License

SPDX-License-Identifier: MIT
Copyright (c) 2026 Alvin MS (@Soulofghost). All rights reserved.
