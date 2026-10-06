/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  initializeDatabaseSchema,
  isMysqlConnected,
  isSchemaInitialized,
  checkDbConnection,
  getLastDbError,
  getDbConfig
} from './server/db.ts';
import * as repo from './server/repository.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

// Server-Sent Events (SSE) for Live Synchronization across Customers, Drivers, and Admin
const sseClients = new Set<Response>();

function broadcastChange(collection: string, action: 'set' | 'delete', id: string, data?: any) {
  const payload = JSON.stringify({ collection, action, id, data, timestamp: Date.now() });
  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
      if (typeof (client as any).flush === 'function') {
        (client as any).flush();
      }
    } catch {
      sseClients.delete(client);
    }
  }
}

// 10-second keep-alive ping to prevent proxy/Cloud Run connection drops
setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(': ping\n\n');
      if (typeof (client as any).flush === 'function') {
        (client as any).flush();
      }
    } catch {
      sseClients.delete(client);
    }
  }
}, 10000);

// ----------------------------------------------------
// REST API ENDPOINTS FOR HOSTINGER BACKEND + MYSQL
// ----------------------------------------------------

// SSE Stream Endpoint
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Send initial connected payload immediately to establish open state
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
  if (typeof (res as any).flush === 'function') {
    (res as any).flush();
  }

  sseClients.add(res);
  req.on('close', () => {
    sseClients.delete(res);
  });
});

/**
 * Health Check Endpoint
 * Directly tests the real MySQL connection and returns database status.
 */
app.get('/api/health', async (_req: Request, res: Response) => {
  const dbStatus = await checkDbConnection();

  if (dbStatus.connected) {
    // If connected but tables haven't been created yet, run schema initialization
    if (!isSchemaInitialized()) {
      await initializeDatabaseSchema();
    }

    res.json({
      success: true,
      server: 'ok',
      database: 'ok',
      tablesReady: isSchemaInitialized(),
      storage: 'hostinger_mysql',
      activeSseClients: sseClients.size,
      timestamp: Date.now()
    });
  } else {
    const config = getDbConfig();
    res.status(503).json({
      success: false,
      server: 'ok',
      database: 'error',
      error: dbStatus.error,
      host: config.host,
      port: config.port,
      databaseName: config.database,
      user: config.user,
      hint: 'Please check DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in Hostinger environment or .env file',
      storage: 'hostinger_nodejs_fallback',
      timestamp: Date.now()
    });
  }
});

/**
 * Manual/Direct Schema Initialization Endpoint
 * Allows testing or re-running table creation at any time from browser or curl
 */
app.get('/api/init-db', async (_req: Request, res: Response) => {
  const success = await initializeDatabaseSchema();
  if (success) {
    res.json({
      success: true,
      message: 'All 12 tables created and verified successfully in MySQL',
      tablesCount: 12
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'Database schema initialization failed',
      error: getLastDbError()
    });
  }
});

// 1. USERS API (Customers, Drivers, Admins)
app.get('/api/users/:uid', async (req: Request, res: Response) => {
  try {
    const user = await repo.getUserById(req.params.uid);
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/:uid', async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    const updated = await repo.upsertUser(uid, req.body);
    broadcastChange('users', 'set', uid, updated);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', async (req: Request, res: Response) => {
  try {
    const { role } = req.query;
    const list = await repo.listUsers(role as string | undefined);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. RIDES API
app.get('/api/rides/:id', async (req: Request, res: Response) => {
  try {
    const ride = await repo.getRideById(req.params.id);
    if (ride) {
      res.json(ride);
    } else {
      res.status(404).json({ error: 'Ride not found' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rides', async (req: Request, res: Response) => {
  try {
    const { userId, driverId, status, limit: limitStr } = req.query;
    const limit = limitStr ? parseInt(limitStr as string, 10) : undefined;
    const list = await repo.listRides({
      userId: userId as string | undefined,
      driverId: driverId as string | undefined,
      status: status as any,
      limit
    });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rides', async (req: Request, res: Response) => {
  try {
    const ride = await repo.upsertRide(req.body);
    broadcastChange('rides', 'set', ride.id, ride);
    res.status(201).json(ride);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/rides/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ride = await repo.upsertRide({ ...req.body, id });
    broadcastChange('rides', 'set', id, ride);
    res.json(ride);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/rides/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await repo.deleteRide(id);
    broadcastChange('rides', 'delete', id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. WALLETS API
app.get('/api/wallets/:driverId', async (req: Request, res: Response) => {
  try {
    const wallet = await repo.getWalletByDriverId(req.params.driverId);
    res.json(wallet);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/wallets/:driverId', async (req: Request, res: Response) => {
  try {
    const { driverId } = req.params;
    const updated = await repo.upsertWallet(driverId, req.body);
    broadcastChange('wallets', 'set', driverId, updated);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/wallets', async (_req: Request, res: Response) => {
  try {
    const list = await repo.listWallets();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. COMMISSION TRANSACTIONS API
app.get('/api/commission_transactions', async (req: Request, res: Response) => {
  try {
    const { driverId, limit: limitStr } = req.query;
    const limit = limitStr ? parseInt(limitStr as string, 10) : undefined;
    const list = await repo.listCommissionTransactions(driverId as string | undefined, limit);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/commission_transactions', async (req: Request, res: Response) => {
  try {
    const tx = await repo.createCommissionTransaction(req.body);
    broadcastChange('commission_transactions', 'set', tx.id, tx);
    res.status(201).json(tx);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. NOTIFICATIONS API
app.get('/api/notifications', async (req: Request, res: Response) => {
  try {
    const { limit: limitStr } = req.query;
    const limit = limitStr ? parseInt(limitStr as string, 10) : undefined;
    const list = await repo.listNotifications(limit);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications', async (req: Request, res: Response) => {
  try {
    const notif = await repo.createNotification(req.body);
    broadcastChange('notifications', 'set', notif.id, notif);
    res.status(201).json(notif);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. COUPONS API
app.get('/api/coupons', async (_req: Request, res: Response) => {
  try {
    const list = await repo.listCoupons();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/coupons', async (req: Request, res: Response) => {
  try {
    const coupon = await repo.createCoupon(req.body);
    broadcastChange('coupons', 'set', coupon.id, coupon);
    res.status(201).json(coupon);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. COMPLAINTS API
app.get('/api/complaints', async (_req: Request, res: Response) => {
  try {
    const list = await repo.listComplaints();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/complaints', async (req: Request, res: Response) => {
  try {
    const complaint = await repo.createComplaint(req.body);
    broadcastChange('complaints', 'set', complaint.id, complaint);
    res.status(201).json(complaint);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/complaints/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await repo.updateComplaint(id, req.body);
    if (updated) {
      broadcastChange('complaints', 'set', id, updated);
      res.json(updated);
    } else {
      res.status(404).json({ error: 'Complaint not found' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. APP SETTINGS API
app.get('/api/app_settings/:id', async (req: Request, res: Response) => {
  try {
    const settings = await repo.getAppSettings(req.params.id);
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/app_settings/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const settings = await repo.upsertAppSettings(id, req.body);
    broadcastChange('app_settings', 'set', id, settings);
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. SERVICE AREAS API
app.get('/api/service_areas/:id', async (req: Request, res: Response) => {
  try {
    const area = await repo.getServiceArea(req.params.id);
    res.json(area);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/service_areas/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const area = await repo.upsertServiceArea(id, req.body);
    broadcastChange('service_areas', 'set', id, area);
    res.json(area);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Explicit API 404 handler: NEVER send /api/* to index.html
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'API endpoint not found',
    method: req.method,
    path: req.path
  });
});

// Static files / Vite middleware
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  // Step 1: Initialize Database Connection & Schema in MySQL
  // This explicitly runs immediately when the server boots
  const schemaInitialized = await initializeDatabaseSchema();
  if (schemaInitialized) {
    console.log('[Server] Hostinger MySQL connection and schema verification complete.');
  } else {
    console.warn('[Server] Operating with fallback mode. Provide valid MySQL credentials in Hostinger to activate live MySQL tables.');
  }

  // Step 2: Configure static files in production or Vite middleware in dev
  const distPath = path.join(__dirname, 'dist');
  const hasDist = fs.existsSync(distPath);

  if (isProd || hasDist) {
    console.log('[Server] Serving production static files from "dist" directory');
    app.use(express.static(distPath));

    // Catch-all for non-API routes: SPA fallback to index.html
    app.get('*', (req: Request, res: Response, next) => {
      // Safeguard: Never serve index.html for any /api/ requests
      if (req.path.startsWith('/api')) {
        return next();
      }
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Frontend build not found. Run npm run build.');
      }
    });
  } else {
    console.log('[Server] Starting in development mode with Vite middleware');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Chalo Server] Hostinger Node.js Backend running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Chalo Server] Fatal startup error:', err);
  process.exit(1);
});
