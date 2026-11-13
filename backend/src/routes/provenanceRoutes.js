import express from 'express';
import { provenanceManager } from '../engine/provenance.js';

export const router = express.Router();

// List Batches
router.get('/batches', (req, res) => {
  try {
    const list = provenanceManager.listBatches();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register Batch
router.post('/batches', (req, res) => {
  try {
    const batch = provenanceManager.registerBatch(req.body);
    res.status(201).json(batch);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Batch Details
router.get('/batches/:batchId', (req, res) => {
  try {
    const details = provenanceManager.getBatchDetails(req.params.batchId);
    if (!details) return res.status(404).json({ error: 'Batch not found in provenance ledger.' });
    res.json(details);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Transfer Custody
router.post('/batches/:batchId/transfer', (req, res) => {
  const { caller_address, to_custodian, location, temperature_celsius, proof_hash } = req.body;
  if (!caller_address || !to_custodian || !location) {
    return res.status(400).json({ error: 'caller_address, to_custodian, and location are required.' });
  }

  try {
    const updated = provenanceManager.transferCustody(
      req.params.batchId,
      caller_address,
      to_custodian,
      location,
      temperature_celsius,
      proof_hash
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Record IoT Telematics
router.post('/batches/:batchId/telematics', (req, res) => {
  const { caller_address, temperature_celsius, location } = req.body;
  if (!caller_address || temperature_celsius === undefined || !location) {
    return res.status(400).json({ error: 'caller_address, temperature_celsius, and location are required.' });
  }

  try {
    const updated = provenanceManager.recordTelematics(
      req.params.batchId,
      caller_address,
      temperature_celsius,
      location
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mark Delivered
router.post('/batches/:batchId/deliver', (req, res) => {
  const { caller_address } = req.body;
  if (!caller_address) return res.status(400).json({ error: 'caller_address is required.' });

  try {
    const updated = provenanceManager.markDelivered(req.params.batchId, caller_address);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Public Cryptographic Provenance Verification
router.get('/batches/:batchId/verify', (req, res) => {
  try {
    const certificate = provenanceManager.verifyBatchCertificate(req.params.batchId);
    if (!certificate) return res.status(404).json({ error: 'Batch not found.' });
    res.json(certificate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
