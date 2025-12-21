import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { initDb, pool } from './db';
import { requireAuth } from './auth';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', service: 'proveniq-ledger' });
});

app.post('/v1/ledger/entries', requireAuth, async (req: Request, res: Response) => {
  try {
    const { app: sourceApp, event_type, payload, correlation_id } = req.body || {};
    if (!sourceApp || !event_type || !payload || !correlation_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const id = randomUUID();
    await pool.query(
      `INSERT INTO ledger_entries (id, app, event_type, correlation_id, payload) VALUES ($1, $2, $3, $4, $5)`,
      [id, sourceApp, event_type, correlation_id, payload]
    );
    res.status(202).json({ id, status: 'accepted' });
  } catch (err) {
    console.error('[LEDGER] ingest error', err);
    res.status(500).json({ error: 'Failed to ingest entry' });
  }
});

app.get('/v1/ledger/entries/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await pool.query(
      `SELECT id, app, event_type, correlation_id, payload, created_at FROM ledger_entries WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[LEDGER] fetch error', err);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

if (require.main === module) {
  initDb().then(() => {
    app.listen(PORT, () => {
      console.log(`[LEDGER] listening on port ${PORT}`);
    });
  }).catch(err => {
    console.error('[LEDGER] failed to init DB', err);
    process.exit(1);
  });
}

export default app;
