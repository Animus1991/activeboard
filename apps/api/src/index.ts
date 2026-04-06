import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { serve } from '@hono/node-server';

import auth from './routes/auth.js';
import waitlist from './routes/waitlist.js';
import games from './routes/games.js';
import rooms from './routes/rooms.js';
import { initializeWebSocket } from './lib/gameSync.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Health check
app.get('/', (c) => c.json({
  name: 'TableForge API',
  version: '0.1.0',
  status: 'healthy',
  timestamp: new Date().toISOString(),
}));

app.get('/health', (c) => c.json({ status: 'ok' }));

// API Routes
app.route('/api/auth', auth);
app.route('/api/waitlist', waitlist);
app.route('/api/games', games);
app.route('/api/rooms', rooms);

// 404 handler
app.notFound((c) => c.json({
  success: false,
  error: 'Not Found',
  path: c.req.path,
}, 404));

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
  }, 500);
});

// Start server
const port = parseInt(process.env.PORT || '3001', 10);

console.log(`
╔════════════════════════════════════════════╗
║         TableForge API Server              ║
╠════════════════════════════════════════════╣
║  VR-First Remote Wargaming Platform        ║
╚════════════════════════════════════════════╝

🚀 Server starting on port ${port}...
📡 Environment: ${process.env.NODE_ENV || 'development'}
`);

const server = serve({
  fetch: app.fetch,
  port,
});

// Initialize WebSocket server
// @ts-expect-error - Hono's serve returns a compatible server type
initializeWebSocket(server);

console.log(`✅ Server running at http://localhost:${port}`);
console.log(`🔌 WebSocket available at ws://localhost:${port}/ws/game`);

export default app;
