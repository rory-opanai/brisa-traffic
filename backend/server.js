import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// In-memory current timings (baseline)
let currentTimings = {
  stadiumExit: { green: 45, red: 90 },
  mainline: { green: 60, red: 60 },
  northGate: { green: 30, red: 90 },
  southGate: { green: 60, red: 60 },
  eastGate: { green: 45, red: 75 },
  westGate: { green: 50, red: 70 },
  perimeterNW: { green: 40, red: 80 },
  perimeterSE: { green: 55, red: 65 },
};

// SSE client registry
const sseClients = new Set();
const broadcastTimings = () => {
  const payload = `data: ${JSON.stringify(currentTimings)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch { /* noop */ }
  }
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// POST /api/optimize-signals
// Expects JSON with current signal timings
// Responds with mocked optimized timings
app.post('/api/optimize-signals', (req, res) => {
  const current = req.body || {};
  // For demo purposes, ignore input and return fixed optimized values
  const optimized = {
    stadiumExit: { green: 90, red: 45 },
    mainline: { green: 60, red: 60 }
  };

  // Simple logging for visibility
  console.log('Received optimization request:', JSON.stringify(current));
  console.log('Responding with optimized timings:', JSON.stringify(optimized));

  res.json(optimized);
});

// GET current timings
app.get('/api/signals', (_req, res) => {
  res.json(currentTimings);
});

// POST updated timings (for Custom GPT Action)
app.post('/api/signals', (req, res) => {
  const next = req.body || {};
  if (typeof next !== 'object') return res.status(400).json({ error: 'Invalid payload' });
  currentTimings = { ...currentTimings, ...next };
  console.log('Updated timings via POST /api/signals:', JSON.stringify(currentTimings));
  broadcastTimings();
  res.json({ ok: true });
});

// SSE stream for live timing updates
app.get('/api/signals/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // CORS for SSE
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders?.();

  // Send initial state
  res.write(`data: ${JSON.stringify(currentTimings)}\n\n`);
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
    try { res.end(); } catch { /* noop */ }
  });
});

app.listen(PORT, () => {
  console.log(`Brisa Traffic Demo backend running on http://localhost:${PORT}`);
});
