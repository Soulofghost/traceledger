import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { initDb } from './db.js';
import { router as provenanceRouter } from './routes/provenanceRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8010;

// Initialize Database
initDb();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/v1', provenanceRouter);

app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'TraceLedger Provenance Engine',
    version: '1.0.0',
    contracts: 'SupplyChainProvenance.sol'
  });
});

// Serve Frontend SPA
const frontendPath = join(__dirname, '../../frontend');
if (existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.sendFile(join(frontendPath, 'index.html'));
  });
}

export const server = app.listen(PORT, () => {
  console.log(`[TraceLedger] Supply-Chain Provenance Server running at http://localhost:${PORT}`);
});

export default app;
