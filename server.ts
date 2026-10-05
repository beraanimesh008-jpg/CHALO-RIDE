/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

// Persistent Storage Directory
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'chalo_database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-Memory Database Schema
interface ChaloDatabase {
  users: Record<string, any>;
  rides: Record<string, any>;
  wallets: Record<string, any>;
  commission_transactions: any[];
  notifications: any[];
  coupons: any[];
  complaints: any[];
  app_settings: Record<string, any>;
  service_areas: Record<string, any>;
}

// Initial Database Seeding
const defaultPolygon = [
  { lat: 22.065, lng: 88.375 },
  { lat: 22.015, lng: 88.512 },
  { lat: 21.865, lng: 88.485 },
  { lat: 21.725, lng: 88.410 },
  { lat: 21.710, lng: 88.240 },
  { lat: 21.840, lng: 88.150 },
  { lat: 21.950, lng: 88.220 }
];

const initialDatabase: ChaloDatabase = {
  users: {},
  rides: {},
  wallets: {},
  commission_transactions: [],
  notifications: [],
  coupons: [],
  complaints: [],
  app_settings: {
    global: {
      commissionRate: 10,
      commissionBlockLimit: 100,
      supportPhone: '+91 98765 43210',
      updatedAt: Date.now()
    }
  },
  service_areas: {
    primary_boundary: {
      id: 'primary_boundary',
      name: 'ChaLo Sundarban Operating Zone',
      bengaliName: 'চলো সুন্দরবন সার্ভিস এলাকা',
      enabled: true,
      polygon: defaultPolygon,
      updatedAt: Date.now(),
      updatedBy: 'system'
    }
  }
};

let dbData: ChaloDatabase = { ...initialDatabase };

// Load persistent data from disk
if (fs.existsSync(DB_FILE)) {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    dbData = {
      ...initialDatabase,
      ...parsed,
      app_settings: { ...initialDatabase.app_settings, ...(parsed.app_settings || {}) },
      service_areas: { ...initialDatabase.service_areas, ...(parsed.service_areas || {}) }
    };
  } catch (err) {
    console.warn('[Hostinger DB] Failed to parse existing data file, initializing fresh:', err);
  }
} else {
  fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
}

// Debounced Disk Persistence
let saveTimer: NodeJS.Timeout | null = null;
function persistDb() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Hostinger DB] Failed to persist data to disk:', err);
    }
  }, 500);
}

// Server-Sent Events (SSE) for Real-Time Synchronization across Customers, Drivers, and Admin
const sseClients = new Set<Response>();

function broadcastChange(collection: string, action: 'set' | 'delete', id: string, data?: any) {
  persistDb();
  const payload = JSON.stringify({ collection, action, id, data, timestamp: Date.now() });
  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ----------------------------------------------------
// REST API ENDPOINTS FOR HOSTINGER BACKEND
// ----------------------------------------------------

// SSE Stream Endpoint
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.add(res);
  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    storage: 'hostinger_nodejs_json',
    activeSseClients: sseClients.size,
    totalRides: Object.keys(dbData.rides).length,
    totalUsers: Object.keys(dbData.users).length,
    timestamp: Date.now()
  });
});

// 1. USERS API (Customers, Drivers, Admins)
app.get('/api/users/:uid', (req: Request, res: Response) => {
  const user = dbData.users[req.params.uid];
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

app.post('/api/users/:uid', (req: Request, res: Response) => {
  const { uid } = req.params;
  const existing = dbData.users[uid] || {};
  const updated = {
    ...existing,
    ...req.body,
    uid,
    updatedAt: Date.now()
  };
  dbData.users[uid] = updated;
  broadcastChange('users', 'set', uid, updated);
  res.json(updated);
});

app.get('/api/users', (req: Request, res: Response) => {
  const { role } = req.query;
  let list = Object.values(dbData.users);
  if (role) {
    list = list.filter((u: any) => u.role === role);
  }
  res.json(list);
});

// 2. RIDES API
app.get('/api/rides/:id', (req: Request, res: Response) => {
  const ride = dbData.rides[req.params.id];
  if (ride) {
    res.json(ride);
  } else {
    res.status(404).json({ error: 'Ride not found' });
  }
});

app.get('/api/rides', (req: Request, res: Response) => {
  const { userId, driverId, status, limit: limitStr } = req.query;
  let list = Object.values(dbData.rides);

  if (userId) {
    list = list.filter((r: any) => r.userId === userId);
  }
  if (driverId) {
    list = list.filter((r: any) => r.driverId === driverId);
  }
  if (status) {
    const statuses = Array.isArray(status) ? status : [status as string];
    list = list.filter((r: any) => statuses.includes(r.status));
  }

  // Sort newest first
  list.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

  if (limitStr) {
    const limitNum = parseInt(limitStr as string, 10);
    if (!isNaN(limitNum) && limitNum > 0) {
      list = list.slice(0, limitNum);
    }
  }

  res.json(list);
});

app.post('/api/rides', (req: Request, res: Response) => {
  const id = req.body.id || `ride_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const ride = {
    ...req.body,
    id,
    createdAt: req.body.createdAt || now,
    updatedAt: now
  };
  dbData.rides[id] = ride;
  broadcastChange('rides', 'set', id, ride);
  res.status(201).json(ride);
});

app.put('/api/rides/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = dbData.rides[id];
  if (!existing) {
    const ride = { ...req.body, id, updatedAt: Date.now() };
    dbData.rides[id] = ride;
    broadcastChange('rides', 'set', id, ride);
    return res.json(ride);
  }
  const updated = {
    ...existing,
    ...req.body,
    id,
    updatedAt: Date.now()
  };
  dbData.rides[id] = updated;
  broadcastChange('rides', 'set', id, updated);
  res.json(updated);
});

app.delete('/api/rides/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  if (dbData.rides[id]) {
    delete dbData.rides[id];
    broadcastChange('rides', 'delete', id);
  }
  res.json({ success: true });
});

// 3. WALLETS API
app.get('/api/wallets/:driverId', (req: Request, res: Response) => {
  const wallet = dbData.wallets[req.params.driverId] || {
    driverId: req.params.driverId,
    balance: 0,
    pendingCommission: 0,
    totalEarned: 0,
    isBlocked: false,
    updatedAt: Date.now()
  };
  res.json(wallet);
});

app.post('/api/wallets/:driverId', (req: Request, res: Response) => {
  const { driverId } = req.params;
  const existing = dbData.wallets[driverId] || {};
  const updated = {
    ...existing,
    ...req.body,
    driverId,
    updatedAt: Date.now()
  };
  dbData.wallets[driverId] = updated;
  broadcastChange('wallets', 'set', driverId, updated);
  res.json(updated);
});

app.get('/api/wallets', (_req: Request, res: Response) => {
  res.json(Object.values(dbData.wallets));
});

// 4. COMMISSION TRANSACTIONS API
app.get('/api/commission_transactions', (req: Request, res: Response) => {
  const { driverId, limit: limitStr } = req.query;
  let list = [...dbData.commission_transactions];
  if (driverId) {
    list = list.filter((tx) => tx.driverId === driverId);
  }
  list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  if (limitStr) {
    const limitNum = parseInt(limitStr as string, 10);
    if (!isNaN(limitNum) && limitNum > 0) {
      list = list.slice(0, limitNum);
    }
  }
  res.json(list);
});

app.post('/api/commission_transactions', (req: Request, res: Response) => {
  const id = req.body.id || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const tx = {
    ...req.body,
    id,
    timestamp: req.body.timestamp || Date.now()
  };
  dbData.commission_transactions.push(tx);
  broadcastChange('commission_transactions', 'set', id, tx);
  res.status(201).json(tx);
});

// 5. NOTIFICATIONS API
app.get('/api/notifications', (req: Request, res: Response) => {
  const { limit: limitStr } = req.query;
  let list = [...dbData.notifications];
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (limitStr) {
    const limitNum = parseInt(limitStr as string, 10);
    if (!isNaN(limitNum) && limitNum > 0) {
      list = list.slice(0, limitNum);
    }
  }
  res.json(list);
});

app.post('/api/notifications', (req: Request, res: Response) => {
  const id = req.body.id || `notif_${Date.now()}`;
  const notif = {
    ...req.body,
    id,
    createdAt: req.body.createdAt || Date.now()
  };
  dbData.notifications.push(notif);
  broadcastChange('notifications', 'set', id, notif);
  res.status(201).json(notif);
});

// 6. COUPONS API
app.get('/api/coupons', (_req: Request, res: Response) => {
  res.json(dbData.coupons);
});

app.post('/api/coupons', (req: Request, res: Response) => {
  const id = req.body.id || `coupon_${Date.now()}`;
  const coupon = { ...req.body, id, createdAt: Date.now() };
  dbData.coupons.push(coupon);
  broadcastChange('coupons', 'set', id, coupon);
  res.status(201).json(coupon);
});

// 7. COMPLAINTS API
app.get('/api/complaints', (_req: Request, res: Response) => {
  res.json(dbData.complaints);
});

app.post('/api/complaints', (req: Request, res: Response) => {
  const id = req.body.id || `ticket_${Date.now()}`;
  const complaint = { ...req.body, id, createdAt: Date.now() };
  dbData.complaints.push(complaint);
  broadcastChange('complaints', 'set', id, complaint);
  res.status(201).json(complaint);
});

app.put('/api/complaints/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = dbData.complaints.findIndex((c) => c.id === id);
  if (index >= 0) {
    dbData.complaints[index] = { ...dbData.complaints[index], ...req.body, updatedAt: Date.now() };
    broadcastChange('complaints', 'set', id, dbData.complaints[index]);
    res.json(dbData.complaints[index]);
  } else {
    res.status(404).json({ error: 'Complaint ticket not found' });
  }
});

// 8. APP SETTINGS API
app.get('/api/app_settings/:id', (req: Request, res: Response) => {
  const settings = dbData.app_settings[req.params.id] || dbData.app_settings.global;
  res.json(settings);
});

app.post('/api/app_settings/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  dbData.app_settings[id] = { ...(dbData.app_settings[id] || {}), ...req.body, updatedAt: Date.now() };
  broadcastChange('app_settings', 'set', id, dbData.app_settings[id]);
  res.json(dbData.app_settings[id]);
});

// 9. SERVICE AREAS API
app.get('/api/service_areas/:id', (req: Request, res: Response) => {
  const area = dbData.service_areas[req.params.id] || dbData.service_areas.primary_boundary;
  res.json(area);
});

app.post('/api/service_areas/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  dbData.service_areas[id] = { ...(dbData.service_areas[id] || {}), ...req.body, updatedAt: Date.now() };
  broadcastChange('service_areas', 'set', id, dbData.service_areas[id]);
  res.json(dbData.service_areas[id]);
});

// Static files / Vite middleware
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
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
