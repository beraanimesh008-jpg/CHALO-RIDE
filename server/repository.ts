/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDbPool, isMysqlConnected } from './db.js';

// Default Service Area polygon for Sundarban
const defaultPolygon = [
  { lat: 22.065, lng: 88.375 },
  { lat: 22.015, lng: 88.512 },
  { lat: 21.865, lng: 88.485 },
  { lat: 21.725, lng: 88.410 },
  { lat: 21.710, lng: 88.240 },
  { lat: 21.840, lng: 88.150 },
  { lat: 21.950, lng: 88.220 }
];

// Fallback in-memory cache for development preview if MySQL is unreachable
const memoryStore = {
  users: new Map<string, any>(),
  rides: new Map<string, any>(),
  wallets: new Map<string, any>(),
  commission_transactions: [] as any[],
  notifications: [] as any[],
  coupons: [] as any[],
  complaints: [] as any[],
  app_settings: new Map<string, any>([
    ['global', {
      commissionRate: 10,
      commissionBlockLimit: 100,
      supportPhone: '+91 98765 43210',
      updatedAt: Date.now()
    }]
  ]),
  service_areas: new Map<string, any>([
    ['primary_boundary', {
      id: 'primary_boundary',
      name: 'ChaLo Sundarban Operating Zone',
      bengaliName: 'চলো সুন্দরবন সার্ভিস এলাকা',
      enabled: true,
      polygon: defaultPolygon,
      updatedAt: Date.now(),
      updatedBy: 'system'
    }]
  ])
};

// ==========================================
// 1. USERS & DRIVERS
// ==========================================
export async function getUserById(id: string): Promise<any | null> {
  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        const [rows]: any = await pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
        if (rows && rows.length > 0) {
          const user = rows[0];
          const extra = user.data_json ? JSON.parse(user.data_json) : {};
          return {
            ...extra,
            uid: user.id,
            id: user.id,
            name: user.name,
            mobile: user.mobile,
            email: user.email,
            photoUrl: user.photo_url,
            role: user.role,
            totalTrips: user.total_trips,
            status: user.status,
            createdAt: user.created_at,
            updatedAt: user.updated_at
          };
        }
      }
    } catch (err: any) {
      console.error('[MySQL Repo] getUserById error:', err.message);
    }
  }
  return memoryStore.users.get(id) || null;
}

export async function upsertUser(id: string, data: any): Promise<any> {
  const now = Date.now();
  const existing = (await getUserById(id)) || {};
  const merged = { ...existing, ...data, uid: id, id, updatedAt: now };

  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        // Save to users table
        const userSql = `
          INSERT INTO users (id, google_id, name, mobile, email, photo_url, role, total_trips, status, data_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            google_id = VALUES(google_id),
            name = VALUES(name),
            mobile = VALUES(mobile),
            email = VALUES(email),
            photo_url = VALUES(photo_url),
            role = VALUES(role),
            total_trips = VALUES(total_trips),
            status = VALUES(status),
            data_json = VALUES(data_json),
            updated_at = VALUES(updated_at)
        `;
        await pool.execute(userSql, [
          id,
          merged.googleId || merged.google_id || null,
          merged.name || merged.displayName || 'User',
          merged.mobile || merged.phone || null,
          merged.email || null,
          merged.photoUrl || merged.photoURL || null,
          merged.role || 'customer',
          merged.totalTrips || merged.total_trips || 0,
          merged.status || 'active',
          JSON.stringify(merged),
          merged.createdAt || now,
          now
        ]);

        // If user is a driver, also maintain the dedicated drivers table (NO GPS coordinates here)
        if (merged.role === 'driver') {
          const driverSql = `
            INSERT INTO drivers (
              id, google_id, name, mobile, email, photo_url, aadhaar_number,
              vehicle_type, vehicle_image, upi_id, approval_status, online_status,
              wallet_balance, commission_due, total_trips, total_earnings, data_json, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              name = VALUES(name),
              mobile = VALUES(mobile),
              email = VALUES(email),
              photo_url = VALUES(photo_url),
              aadhaar_number = VALUES(aadhaar_number),
              vehicle_type = VALUES(vehicle_type),
              vehicle_image = VALUES(vehicle_image),
              upi_id = VALUES(upi_id),
              approval_status = VALUES(approval_status),
              online_status = VALUES(online_status),
              wallet_balance = VALUES(wallet_balance),
              commission_due = VALUES(commission_due),
              total_trips = VALUES(total_trips),
              total_earnings = VALUES(total_earnings),
              data_json = VALUES(data_json),
              updated_at = VALUES(updated_at)
          `;
          await pool.execute(driverSql, [
            id,
            merged.googleId || null,
            merged.name || 'Driver',
            merged.mobile || null,
            merged.email || null,
            merged.photoUrl || null,
            merged.aadhaarNumber || merged.aadhaar_number || null,
            merged.vehicleType || merged.vehicle_type || 'Toto',
            merged.vehicleImage || merged.vehicle_image || null,
            merged.upiId || merged.upi_id || null,
            merged.approvalStatus || merged.approval_status || 'pending',
            merged.isOnline || merged.online ? 1 : 0,
            merged.walletBalance || 0,
            merged.commissionDue || 0,
            merged.totalTrips || 0,
            merged.totalEarnings || 0,
            JSON.stringify(merged),
            merged.createdAt || now,
            now
          ]);
        }
      }
    } catch (err: any) {
      console.error('[MySQL Repo] upsertUser error:', err.message);
    }
  }

  memoryStore.users.set(id, merged);
  return merged;
}

export async function listUsers(role?: string): Promise<any[]> {
  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        let query = 'SELECT * FROM users';
        const params: any[] = [];
        if (role) {
          query += ' WHERE role = ?';
          params.push(role);
        }
        query += ' ORDER BY created_at DESC';
        const [rows]: any = await pool.execute(query, params);
        return rows.map((u: any) => {
          const extra = u.data_json ? JSON.parse(u.data_json) : {};
          return {
            ...extra,
            uid: u.id,
            id: u.id,
            name: u.name,
            mobile: u.mobile,
            email: u.email,
            photoUrl: u.photo_url,
            role: u.role,
            totalTrips: u.total_trips,
            status: u.status,
            createdAt: u.created_at,
            updatedAt: u.updated_at
          };
        });
      }
    } catch (err: any) {
      console.error('[MySQL Repo] listUsers error:', err.message);
    }
  }

  let list = Array.from(memoryStore.users.values());
  if (role) {
    list = list.filter((u) => u.role === role);
  }
  return list;
}

// ==========================================
// 2. RIDES & RIDE OFFERS
// ==========================================
export async function getRideById(id: string): Promise<any | null> {
  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        const [rows]: any = await pool.execute('SELECT * FROM rides WHERE id = ? LIMIT 1', [id]);
        if (rows && rows.length > 0) {
          const r = rows[0];
          const extra = r.data_json ? JSON.parse(r.data_json) : {};
          return {
            ...extra,
            id: r.id,
            userId: r.customer_id,
            customerId: r.customer_id,
            driverId: r.driver_id,
            pickup: extra.pickup || { address: r.pickup_address, lat: r.pickup_lat, lng: r.pickup_lng },
            destination: extra.destination || { address: r.dest_address, lat: r.dest_lat, lng: r.dest_lng },
            passengerCount: r.passenger_count,
            distance: r.distance_km,
            fare: Number(r.fare),
            paymentMethod: r.payment_method,
            paymentStatus: r.payment_status,
            status: r.ride_status,
            otp: r.otp,
            requestedAt: r.requested_at,
            acceptedAt: r.accepted_at,
            startedAt: r.started_at,
            completedAt: r.completed_at,
            cancelledAt: r.cancelled_at,
            createdAt: r.created_at,
            updatedAt: r.updated_at
          };
        }
      }
    } catch (err: any) {
      console.error('[MySQL Repo] getRideById error:', err.message);
    }
  }
  return memoryStore.rides.get(id) || null;
}

export async function upsertRide(ride: any): Promise<any> {
  const id = ride.id || `ride_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const existing = (await getRideById(id)) || {};
  const merged = {
    ...existing,
    ...ride,
    id,
    createdAt: ride.createdAt || existing.createdAt || now,
    updatedAt: now
  };

  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        const pickupAddr = merged.pickup?.address || merged.pickupAddress || null;
        const pickupLat = merged.pickup?.lat ?? null;
        const pickupLng = merged.pickup?.lng ?? null;
        const destAddr = merged.destination?.address || merged.destAddress || null;
        const destLat = merged.destination?.lat ?? null;
        const destLng = merged.destination?.lng ?? null;

        const sql = `
          INSERT INTO rides (
            id, customer_id, driver_id, pickup_address, pickup_lat, pickup_lng,
            dest_address, dest_lat, dest_lng, passenger_count, distance_km,
            fare, payment_method, payment_status, ride_status, otp,
            requested_at, accepted_at, started_at, completed_at, cancelled_at,
            data_json, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            customer_id = VALUES(customer_id),
            driver_id = VALUES(driver_id),
            pickup_address = VALUES(pickup_address),
            pickup_lat = VALUES(pickup_lat),
            pickup_lng = VALUES(pickup_lng),
            dest_address = VALUES(dest_address),
            dest_lat = VALUES(dest_lat),
            dest_lng = VALUES(dest_lng),
            passenger_count = VALUES(passenger_count),
            distance_km = VALUES(distance_km),
            fare = VALUES(fare),
            payment_method = VALUES(payment_method),
            payment_status = VALUES(payment_status),
            ride_status = VALUES(ride_status),
            otp = VALUES(otp),
            requested_at = VALUES(requested_at),
            accepted_at = VALUES(accepted_at),
            started_at = VALUES(started_at),
            completed_at = VALUES(completed_at),
            cancelled_at = VALUES(cancelled_at),
            data_json = VALUES(data_json),
            updated_at = VALUES(updated_at)
        `;

        await pool.execute(sql, [
          id,
          merged.userId || merged.customerId || null,
          merged.driverId || null,
          pickupAddr,
          pickupLat,
          pickupLng,
          destAddr,
          destLat,
          destLng,
          merged.passengerCount || 1,
          merged.distance || 0,
          merged.fare || 0,
          merged.paymentMethod || 'cash',
          merged.paymentStatus || 'pending',
          merged.status || 'requested',
          merged.otp || null,
          merged.requestedAt || merged.createdAt,
          merged.acceptedAt || null,
          merged.startedAt || null,
          merged.completedAt || null,
          merged.cancelledAt || null,
          JSON.stringify(merged),
          merged.createdAt,
          now
        ]);
      }
    } catch (err: any) {
      console.error('[MySQL Repo] upsertRide error:', err.message);
    }
  }

  memoryStore.rides.set(id, merged);
  return merged;
}

export async function listRides(filter: {
  userId?: string;
  driverId?: string;
  status?: string | string[];
  limit?: number;
}): Promise<any[]> {
  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        const conditions: string[] = [];
        const params: any[] = [];

        if (filter.userId) {
          conditions.push('customer_id = ?');
          params.push(filter.userId);
        }
        if (filter.driverId) {
          conditions.push('driver_id = ?');
          params.push(filter.driverId);
        }
        if (filter.status) {
          const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
          conditions.push(`ride_status IN (${statuses.map(() => '?').join(',')})`);
          params.push(...statuses);
        }

        let sql = 'SELECT * FROM rides';
        if (conditions.length > 0) {
          sql += ' WHERE ' + conditions.join(' AND ');
        }
        sql += ' ORDER BY created_at DESC';

        if (filter.limit && filter.limit > 0) {
          sql += ` LIMIT ${Number(filter.limit)}`;
        }

        const [rows]: any = await pool.execute(sql, params);
        return rows.map((r: any) => {
          const extra = r.data_json ? JSON.parse(r.data_json) : {};
          return {
            ...extra,
            id: r.id,
            userId: r.customer_id,
            customerId: r.customer_id,
            driverId: r.driver_id,
            pickup: extra.pickup || { address: r.pickup_address, lat: r.pickup_lat, lng: r.pickup_lng },
            destination: extra.destination || { address: r.dest_address, lat: r.dest_lat, lng: r.dest_lng },
            passengerCount: r.passenger_count,
            distance: r.distance_km,
            fare: Number(r.fare),
            paymentMethod: r.payment_method,
            paymentStatus: r.payment_status,
            status: r.ride_status,
            otp: r.otp,
            createdAt: r.created_at,
            updatedAt: r.updated_at
          };
        });
      }
    } catch (err: any) {
      console.error('[MySQL Repo] listRides error:', err.message);
    }
  }

  let list = Array.from(memoryStore.rides.values());
  if (filter.userId) {
    list = list.filter((r) => r.userId === filter.userId || r.customerId === filter.userId);
  }
  if (filter.driverId) {
    list = list.filter((r) => r.driverId === filter.driverId);
  }
  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    list = list.filter((r) => statuses.includes(r.status));
  }
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (filter.limit && filter.limit > 0) {
    list = list.slice(0, filter.limit);
  }
  return list;
}

export async function deleteRide(id: string): Promise<boolean> {
  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        await pool.execute('DELETE FROM rides WHERE id = ?', [id]);
      }
    } catch (err: any) {
      console.error('[MySQL Repo] deleteRide error:', err.message);
    }
  }
  return memoryStore.rides.delete(id);
}

// ==========================================
// 3. WALLETS & COMMISSION TRANSACTIONS
// ==========================================
export async function getWalletByDriverId(driverId: string): Promise<any> {
  const defaultWallet = {
    driverId,
    balance: 0,
    pendingCommission: 0,
    totalEarned: 0,
    isBlocked: false,
    updatedAt: Date.now()
  };

  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        const [rows]: any = await pool.execute('SELECT * FROM wallets WHERE driver_id = ? LIMIT 1', [driverId]);
        if (rows && rows.length > 0) {
          const w = rows[0];
          const extra = w.data_json ? JSON.parse(w.data_json) : {};
          return {
            ...defaultWallet,
            ...extra,
            driverId: w.driver_id,
            balance: Number(w.balance),
            pendingCommission: Number(w.pending_commission),
            totalEarned: Number(w.total_earned),
            isBlocked: Boolean(w.is_blocked),
            updatedAt: w.updated_at
          };
        }
      }
    } catch (err: any) {
      console.error('[MySQL Repo] getWalletByDriverId error:', err.message);
    }
  }

  return memoryStore.wallets.get(driverId) || defaultWallet;
}

export async function upsertWallet(driverId: string, wallet: any): Promise<any> {
  const existing = await getWalletByDriverId(driverId);
  const now = Date.now();
  const merged = { ...existing, ...wallet, driverId, updatedAt: now };

  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        const sql = `
          INSERT INTO wallets (driver_id, balance, pending_commission, total_earned, is_blocked, data_json, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            balance = VALUES(balance),
            pending_commission = VALUES(pending_commission),
            total_earned = VALUES(total_earned),
            is_blocked = VALUES(is_blocked),
            data_json = VALUES(data_json),
            updated_at = VALUES(updated_at)
        `;
        await pool.execute(sql, [
          driverId,
          merged.balance || 0,
          merged.pendingCommission || 0,
          merged.totalEarned || 0,
          merged.isBlocked ? 1 : 0,
          JSON.stringify(merged),
          now
        ]);
      }
    } catch (err: any) {
      console.error('[MySQL Repo] upsertWallet error:', err.message);
    }
  }

  memoryStore.wallets.set(driverId, merged);
  return merged;
}

export async function listWallets(): Promise<any[]> {
  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        const [rows]: any = await pool.execute('SELECT * FROM wallets');
        return rows.map((w: any) => {
          const extra = w.data_json ? JSON.parse(w.data_json) : {};
          return {
            ...extra,
            driverId: w.driver_id,
            balance: Number(w.balance),
            pendingCommission: Number(w.pending_commission),
            totalEarned: Number(w.total_earned),
            isBlocked: Boolean(w.is_blocked),
            updatedAt: w.updated_at
          };
        });
      }
    } catch (err: any) {
      console.error('[MySQL Repo] listWallets error:', err.message);
    }
  }
  return Array.from(memoryStore.wallets.values());
}

export async function createCommissionTransaction(tx: any): Promise<any> {
  const id = tx.id || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const item = {
    ...tx,
    id,
    timestamp: tx.timestamp || now,
    createdAt: now
  };

  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        const sql = `
          INSERT INTO commission_transactions (id, driver_id, ride_id, amount, type, description, timestamp, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await pool.execute(sql, [
          id,
          item.driverId || item.driver_id,
          item.rideId || item.ride_id || null,
          item.amount || 0,
          item.type || 'ride_deduction',
          item.description || '',
          item.timestamp,
          item.createdAt
        ]);
      }
    } catch (err: any) {
      console.error('[MySQL Repo] createCommissionTransaction error:', err.message);
    }
  }

  memoryStore.commission_transactions.push(item);
  return item;
}

export async function listCommissionTransactions(driverId?: string, limit?: number): Promise<any[]> {
  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        let sql = 'SELECT * FROM commission_transactions';
        const params: any[] = [];
        if (driverId) {
          sql += ' WHERE driver_id = ?';
          params.push(driverId);
        }
        sql += ' ORDER BY timestamp DESC';
        if (limit && limit > 0) {
          sql += ` LIMIT ${Number(limit)}`;
        }
        const [rows]: any = await pool.execute(sql, params);
        return rows.map((r: any) => ({
          id: r.id,
          driverId: r.driver_id,
          rideId: r.ride_id,
          amount: Number(r.amount),
          type: r.type,
          description: r.description,
          timestamp: r.timestamp,
          createdAt: r.created_at
        }));
      }
    } catch (err: any) {
      console.error('[MySQL Repo] listCommissionTransactions error:', err.message);
    }
  }

  let list = [...memoryStore.commission_transactions];
  if (driverId) {
    list = list.filter((t) => t.driverId === driverId);
  }
  list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  if (limit && limit > 0) {
    list = list.slice(0, limit);
  }
  return list;
}

// ==========================================
// 4. SERVICE AREAS & APP SETTINGS
// ==========================================
export async function getServiceArea(id: string): Promise<any> {
  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        const [rows]: any = await pool.execute('SELECT * FROM service_areas WHERE id = ? LIMIT 1', [id]);
        if (rows && rows.length > 0) {
          const s = rows[0];
          return {
            id: s.id,
            name: s.name,
            bengaliName: s.bengali_name,
            enabled: Boolean(s.enabled),
            polygon: s.polygon_json ? JSON.parse(s.polygon_json) : defaultPolygon,
            updatedAt: s.updated_at,
            updatedBy: s.updated_by
          };
        }
      }
    } catch (err: any) {
      console.error('[MySQL Repo] getServiceArea error:', err.message);
    }
  }

  return memoryStore.service_areas.get(id) || memoryStore.service_areas.get('primary_boundary');
}

export async function upsertServiceArea(id: string, area: any): Promise<any> {
  const now = Date.now();
  const existing = (await getServiceArea(id)) || {};
  const merged = { ...existing, ...area, id, updatedAt: now };

  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        const sql = `
          INSERT INTO service_areas (id, name, bengali_name, enabled, polygon_json, updated_at, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            bengali_name = VALUES(bengali_name),
            enabled = VALUES(enabled),
            polygon_json = VALUES(polygon_json),
            updated_at = VALUES(updated_at),
            updated_by = VALUES(updated_by)
        `;
        await pool.execute(sql, [
          id,
          merged.name || 'ChaLo Service Area',
          merged.bengaliName || 'চলো সার্ভিস এলাকা',
          merged.enabled ? 1 : 0,
          JSON.stringify(merged.polygon || defaultPolygon),
          now,
          merged.updatedBy || 'admin'
        ]);
      }
    } catch (err: any) {
      console.error('[MySQL Repo] upsertServiceArea error:', err.message);
    }
  }

  memoryStore.service_areas.set(id, merged);
  return merged;
}

export async function getAppSettings(id: string): Promise<any> {
  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        const [rows]: any = await pool.execute('SELECT * FROM app_settings WHERE id = ? LIMIT 1', [id]);
        if (rows && rows.length > 0) {
          const s = rows[0];
          return s.settings_json ? JSON.parse(s.settings_json) : {};
        }
      }
    } catch (err: any) {
      console.error('[MySQL Repo] getAppSettings error:', err.message);
    }
  }

  return memoryStore.app_settings.get(id) || memoryStore.app_settings.get('global');
}

export async function upsertAppSettings(id: string, settings: any): Promise<any> {
  const now = Date.now();
  const existing = (await getAppSettings(id)) || {};
  const merged = { ...existing, ...settings, updatedAt: now };

  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        const sql = `
          INSERT INTO app_settings (id, settings_json, updated_at)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
            settings_json = VALUES(settings_json),
            updated_at = VALUES(updated_at)
        `;
        await pool.execute(sql, [id, JSON.stringify(merged), now]);
      }
    } catch (err: any) {
      console.error('[MySQL Repo] upsertAppSettings error:', err.message);
    }
  }

  memoryStore.app_settings.set(id, merged);
  return merged;
}

// ==========================================
// 5. NOTIFICATIONS, COMPLAINTS, COUPONS
// ==========================================
export async function listNotifications(limit?: number): Promise<any[]> {
  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        let sql = 'SELECT * FROM notifications ORDER BY created_at DESC';
        if (limit && limit > 0) sql += ` LIMIT ${Number(limit)}`;
        const [rows]: any = await pool.execute(sql);
        return rows.map((n: any) => ({
          id: n.id,
          userId: n.user_id,
          title: n.title,
          message: n.message,
          type: n.type,
          isRead: Boolean(n.is_read),
          createdAt: n.created_at
        }));
      }
    } catch (err: any) {
      console.error('[MySQL Repo] listNotifications error:', err.message);
    }
  }

  let list = [...memoryStore.notifications];
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (limit && limit > 0) list = list.slice(0, limit);
  return list;
}

export async function createNotification(notif: any): Promise<any> {
  const id = notif.id || `notif_${Date.now()}`;
  const now = Date.now();
  const item = { ...notif, id, createdAt: notif.createdAt || now };

  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        const sql = `
          INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await pool.execute(sql, [
          id,
          item.userId || null,
          item.title || 'Notification',
          item.message || '',
          item.type || 'info',
          item.isRead ? 1 : 0,
          item.createdAt
        ]);
      }
    } catch (err: any) {
      console.error('[MySQL Repo] createNotification error:', err.message);
    }
  }

  memoryStore.notifications.push(item);
  return item;
}

export async function listComplaints(): Promise<any[]> {
  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        const [rows]: any = await pool.execute('SELECT * FROM complaints ORDER BY created_at DESC');
        return rows.map((c: any) => ({
          id: c.id,
          userId: c.user_id,
          userName: c.user_name,
          userRole: c.user_role,
          subject: c.subject,
          description: c.description,
          status: c.status,
          createdAt: c.created_at,
          updatedAt: c.updated_at
        }));
      }
    } catch (err: any) {
      console.error('[MySQL Repo] listComplaints error:', err.message);
    }
  }
  return memoryStore.complaints;
}

export async function createComplaint(complaint: any): Promise<any> {
  const id = complaint.id || `ticket_${Date.now()}`;
  const now = Date.now();
  const item = { ...complaint, id, createdAt: now, updatedAt: now };

  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        const sql = `
          INSERT INTO complaints (id, user_id, user_name, user_role, subject, description, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await pool.execute(sql, [
          id,
          item.userId || null,
          item.userName || 'Anonymous',
          item.userRole || 'customer',
          item.subject || '',
          item.description || '',
          item.status || 'open',
          now,
          now
        ]);
      }
    } catch (err: any) {
      console.error('[MySQL Repo] createComplaint error:', err.message);
    }
  }

  memoryStore.complaints.push(item);
  return item;
}

export async function updateComplaint(id: string, updates: any): Promise<any | null> {
  const now = Date.now();

  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        const sql = 'UPDATE complaints SET status = ?, updated_at = ? WHERE id = ?';
        await pool.execute(sql, [updates.status || 'resolved', now, id]);
      }
    } catch (err: any) {
      console.error('[MySQL Repo] updateComplaint error:', err.message);
    }
  }

  const index = memoryStore.complaints.findIndex((c) => c.id === id);
  if (index >= 0) {
    memoryStore.complaints[index] = { ...memoryStore.complaints[index], ...updates, updatedAt: now };
    return memoryStore.complaints[index];
  }
  return null;
}

export async function listCoupons(): Promise<any[]> {
  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        const [rows]: any = await pool.execute('SELECT * FROM coupons ORDER BY created_at DESC');
        return rows.map((c: any) => ({
          id: c.id,
          code: c.code,
          discountType: c.discount_type,
          discountValue: Number(c.discount_value),
          expiresAt: c.expires_at,
          createdAt: c.created_at
        }));
      }
    } catch (err: any) {
      console.error('[MySQL Repo] listCoupons error:', err.message);
    }
  }
  return memoryStore.coupons;
}

export async function createCoupon(coupon: any): Promise<any> {
  const id = coupon.id || `coupon_${Date.now()}`;
  const now = Date.now();
  const item = { ...coupon, id, createdAt: now };

  if (isMysqlConnected()) {
    try {
      const pool = await getDbPool();
      if (pool) {
        const sql = `
          INSERT INTO coupons (id, code, discount_type, discount_value, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        await pool.execute(sql, [
          id,
          item.code,
          item.discountType || 'flat',
          item.discountValue || 0,
          item.expiresAt || null,
          now
        ]);
      }
    } catch (err: any) {
      console.error('[MySQL Repo] createCoupon error:', err.message);
    }
  }

  memoryStore.coupons.push(item);
  return item;
}
