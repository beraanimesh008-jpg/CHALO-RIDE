// server.ts
import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// server/db.ts
import "dotenv/config";
import mysql from "mysql2/promise";
function getDbConfig() {
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "u691798054_chalo_toto",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "u691798054_chalo_toto"
  };
}
var pool = null;
var isMysqlActive = false;
var schemaReady = false;
var lastDbError = null;
async function getDbPool() {
  if (pool && isMysqlActive) return pool;
  const config = getDbConfig();
  console.log(`[DB] Connecting to MySQL... (Host: ${config.host}:${config.port}, Database: ${config.database}, User: ${config.user})`);
  try {
    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 1e4,
      connectTimeout: 1e4
    });
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    isMysqlActive = true;
    lastDbError = null;
    console.log("[DB] MySQL connected");
    return pool;
  } catch (err) {
    pool = null;
    isMysqlActive = false;
    lastDbError = err.message || String(err);
    console.error(`[DB] MySQL connection error: ${err.message} (code: ${err.code || "UNKNOWN"})`);
    console.warn(`[DB] Please verify your DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in .env or Hostinger environment variables.`);
    return null;
  }
}
function isMysqlConnected() {
  return isMysqlActive;
}
function isSchemaInitialized() {
  return schemaReady;
}
function getLastDbError() {
  return lastDbError;
}
async function checkDbConnection() {
  try {
    const currentPool = await getDbPool();
    if (!currentPool) {
      return { connected: false, error: lastDbError || "Could not establish connection to MySQL database" };
    }
    const connection = await currentPool.getConnection();
    await connection.ping();
    connection.release();
    isMysqlActive = true;
    return { connected: true };
  } catch (err) {
    isMysqlActive = false;
    lastDbError = err.message || String(err);
    return { connected: false, error: err.message };
  }
}
async function initializeDatabaseSchema() {
  const currentPool = await getDbPool();
  if (!currentPool) {
    console.warn("[DB] Skipping schema initialization: MySQL connection not established.");
    return false;
  }
  console.log("[DB] Initializing database schema...");
  const tableDefinitions = [
    // 1. Users Table (Customer, Driver, Admin profiles)
    {
      name: "users",
      sql: `CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        google_id VARCHAR(128),
        name VARCHAR(255),
        mobile VARCHAR(32),
        email VARCHAR(255),
        photo_url TEXT,
        role VARCHAR(32) DEFAULT 'customer',
        total_trips INT DEFAULT 0,
        status VARCHAR(32) DEFAULT 'active',
        data_json LONGTEXT,
        created_at BIGINT,
        updated_at BIGINT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    },
    // 2. Drivers Table (Realtime GPS belongs strictly in Firebase Realtime DB)
    {
      name: "drivers",
      sql: `CREATE TABLE IF NOT EXISTS drivers (
        id VARCHAR(64) PRIMARY KEY,
        google_id VARCHAR(128),
        name VARCHAR(255),
        mobile VARCHAR(32),
        email VARCHAR(255),
        photo_url TEXT,
        aadhaar_number VARCHAR(32),
        vehicle_type VARCHAR(64),
        vehicle_image TEXT,
        upi_id VARCHAR(128),
        approval_status VARCHAR(32) DEFAULT 'pending',
        online_status TINYINT(1) DEFAULT 0,
        wallet_balance DECIMAL(10, 2) DEFAULT 0.00,
        commission_due DECIMAL(10, 2) DEFAULT 0.00,
        total_trips INT DEFAULT 0,
        total_earnings DECIMAL(10, 2) DEFAULT 0.00,
        data_json LONGTEXT,
        created_at BIGINT,
        updated_at BIGINT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    },
    // 3. Rides Table
    {
      name: "rides",
      sql: `CREATE TABLE IF NOT EXISTS rides (
        id VARCHAR(64) PRIMARY KEY,
        customer_id VARCHAR(64),
        driver_id VARCHAR(64),
        pickup_address TEXT,
        pickup_lat DOUBLE,
        pickup_lng DOUBLE,
        dest_address TEXT,
        dest_lat DOUBLE,
        dest_lng DOUBLE,
        passenger_count INT DEFAULT 1,
        distance_km DOUBLE DEFAULT 0,
        fare DECIMAL(10, 2) DEFAULT 0.00,
        payment_method VARCHAR(32) DEFAULT 'cash',
        payment_status VARCHAR(32) DEFAULT 'pending',
        ride_status VARCHAR(32) DEFAULT 'requested',
        otp VARCHAR(16),
        requested_at BIGINT,
        accepted_at BIGINT,
        started_at BIGINT,
        completed_at BIGINT,
        cancelled_at BIGINT,
        data_json LONGTEXT,
        created_at BIGINT,
        updated_at BIGINT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    },
    // 4. Ride Offers Table
    {
      name: "ride_offers",
      sql: `CREATE TABLE IF NOT EXISTS ride_offers (
        id VARCHAR(64) PRIMARY KEY,
        ride_id VARCHAR(64),
        driver_id VARCHAR(64),
        driver_name VARCHAR(255),
        driver_phone VARCHAR(32),
        offer_fare DECIMAL(10, 2) DEFAULT 0.00,
        status VARCHAR(32) DEFAULT 'pending',
        created_at BIGINT,
        INDEX idx_ride_id (ride_id),
        INDEX idx_driver_id (driver_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    },
    // 5. Wallets Table
    {
      name: "wallets",
      sql: `CREATE TABLE IF NOT EXISTS wallets (
        driver_id VARCHAR(64) PRIMARY KEY,
        balance DECIMAL(10, 2) DEFAULT 0.00,
        pending_commission DECIMAL(10, 2) DEFAULT 0.00,
        total_earned DECIMAL(10, 2) DEFAULT 0.00,
        is_blocked TINYINT(1) DEFAULT 0,
        data_json LONGTEXT,
        updated_at BIGINT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    },
    // 6. Commission Transactions Table
    {
      name: "commission_transactions",
      sql: `CREATE TABLE IF NOT EXISTS commission_transactions (
        id VARCHAR(64) PRIMARY KEY,
        driver_id VARCHAR(64),
        ride_id VARCHAR(64),
        amount DECIMAL(10, 2) DEFAULT 0.00,
        type VARCHAR(32),
        description TEXT,
        timestamp BIGINT,
        created_at BIGINT,
        INDEX idx_comm_driver (driver_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    },
    // 7. Payments Table
    {
      name: "payments",
      sql: `CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(64) PRIMARY KEY,
        ride_id VARCHAR(64),
        driver_id VARCHAR(64),
        user_id VARCHAR(64),
        amount DECIMAL(10, 2) DEFAULT 0.00,
        payment_method VARCHAR(32),
        status VARCHAR(32),
        transaction_id VARCHAR(128),
        created_at BIGINT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    },
    // 8. Service Areas Table
    {
      name: "service_areas",
      sql: `CREATE TABLE IF NOT EXISTS service_areas (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255),
        bengali_name VARCHAR(255),
        enabled TINYINT(1) DEFAULT 1,
        polygon_json LONGTEXT,
        updated_at BIGINT,
        updated_by VARCHAR(64)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    },
    // 9. Notifications Table
    {
      name: "notifications",
      sql: `CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64),
        title VARCHAR(255),
        message TEXT,
        type VARCHAR(32),
        is_read TINYINT(1) DEFAULT 0,
        created_at BIGINT,
        INDEX idx_notif_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    },
    // 10. App Settings Table
    {
      name: "app_settings",
      sql: `CREATE TABLE IF NOT EXISTS app_settings (
        id VARCHAR(64) PRIMARY KEY,
        settings_json LONGTEXT,
        updated_at BIGINT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    },
    // 11. Complaints / Support Tickets Table
    {
      name: "complaints",
      sql: `CREATE TABLE IF NOT EXISTS complaints (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64),
        user_name VARCHAR(255),
        user_role VARCHAR(32),
        subject VARCHAR(255),
        description TEXT,
        status VARCHAR(32) DEFAULT 'open',
        created_at BIGINT,
        updated_at BIGINT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    },
    // 12. Coupons Table
    {
      name: "coupons",
      sql: `CREATE TABLE IF NOT EXISTS coupons (
        id VARCHAR(64) PRIMARY KEY,
        code VARCHAR(64) UNIQUE,
        discount_type VARCHAR(32),
        discount_value DECIMAL(10, 2),
        expires_at BIGINT,
        created_at BIGINT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    }
  ];
  try {
    for (const table of tableDefinitions) {
      await currentPool.execute(table.sql);
      console.log(`[DB] ${table.name} table ready`);
    }
    schemaReady = true;
    console.log("[DB] Database schema initialization completed successfully");
    return true;
  } catch (err) {
    schemaReady = false;
    lastDbError = err.message || String(err);
    console.error(`[DB] Schema initialization error: ${err.message}`);
    return false;
  }
}

// server/repository.ts
var defaultPolygon = [
  { lat: 22.065, lng: 88.375 },
  { lat: 22.015, lng: 88.512 },
  { lat: 21.865, lng: 88.485 },
  { lat: 21.725, lng: 88.41 },
  { lat: 21.71, lng: 88.24 },
  { lat: 21.84, lng: 88.15 },
  { lat: 21.95, lng: 88.22 }
];
var memoryStore = {
  users: /* @__PURE__ */ new Map(),
  rides: /* @__PURE__ */ new Map(),
  wallets: /* @__PURE__ */ new Map(),
  commission_transactions: [],
  notifications: [],
  coupons: [],
  complaints: [],
  app_settings: /* @__PURE__ */ new Map([
    ["global", {
      commissionRate: 10,
      commissionBlockLimit: 100,
      supportPhone: "+91 98765 43210",
      updatedAt: Date.now()
    }]
  ]),
  service_areas: /* @__PURE__ */ new Map([
    ["primary_boundary", {
      id: "primary_boundary",
      name: "ChaLo Sundarban Operating Zone",
      bengaliName: "\u099A\u09B2\u09CB \u09B8\u09C1\u09A8\u09CD\u09A6\u09B0\u09AC\u09A8 \u09B8\u09BE\u09B0\u09CD\u09AD\u09BF\u09B8 \u098F\u09B2\u09BE\u0995\u09BE",
      enabled: true,
      polygon: defaultPolygon,
      updatedAt: Date.now(),
      updatedBy: "system"
    }]
  ])
};
async function getUserById(id) {
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
        const [rows] = await pool2.execute("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
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
    } catch (err) {
      console.error("[MySQL Repo] getUserById error:", err.message);
    }
  }
  return memoryStore.users.get(id) || null;
}
async function upsertUser(id, data) {
  const now = Date.now();
  const existing = await getUserById(id) || {};
  const merged = { ...existing, ...data, uid: id, id, updatedAt: now };
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
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
        await pool2.execute(userSql, [
          id,
          merged.googleId || merged.google_id || null,
          merged.name || merged.displayName || "User",
          merged.mobile || merged.phone || null,
          merged.email || null,
          merged.photoUrl || merged.photoURL || null,
          merged.role || "customer",
          merged.totalTrips || merged.total_trips || 0,
          merged.status || "active",
          JSON.stringify(merged),
          merged.createdAt || now,
          now
        ]);
        if (merged.role === "driver") {
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
          await pool2.execute(driverSql, [
            id,
            merged.googleId || null,
            merged.name || "Driver",
            merged.mobile || null,
            merged.email || null,
            merged.photoUrl || null,
            merged.aadhaarNumber || merged.aadhaar_number || null,
            merged.vehicleType || merged.vehicle_type || "Toto",
            merged.vehicleImage || merged.vehicle_image || null,
            merged.upiId || merged.upi_id || null,
            merged.approvalStatus || merged.approval_status || "pending",
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
    } catch (err) {
      console.error("[MySQL Repo] upsertUser error:", err.message);
    }
  }
  memoryStore.users.set(id, merged);
  return merged;
}
async function listUsers(role) {
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
        let query = "SELECT * FROM users";
        const params = [];
        if (role) {
          query += " WHERE role = ?";
          params.push(role);
        }
        query += " ORDER BY created_at DESC";
        const [rows] = await pool2.execute(query, params);
        return rows.map((u) => {
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
    } catch (err) {
      console.error("[MySQL Repo] listUsers error:", err.message);
    }
  }
  let list = Array.from(memoryStore.users.values());
  if (role) {
    list = list.filter((u) => u.role === role);
  }
  return list;
}
async function getRideById(id) {
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
        const [rows] = await pool2.execute("SELECT * FROM rides WHERE id = ? LIMIT 1", [id]);
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
    } catch (err) {
      console.error("[MySQL Repo] getRideById error:", err.message);
    }
  }
  return memoryStore.rides.get(id) || null;
}
async function upsertRide(ride) {
  const id = ride.id || `ride_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const existing = await getRideById(id) || {};
  const merged = {
    ...existing,
    ...ride,
    id,
    createdAt: ride.createdAt || existing.createdAt || now,
    updatedAt: now
  };
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
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
        await pool2.execute(sql, [
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
          merged.paymentMethod || "cash",
          merged.paymentStatus || "pending",
          merged.status || "requested",
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
    } catch (err) {
      console.error("[MySQL Repo] upsertRide error:", err.message);
    }
  }
  memoryStore.rides.set(id, merged);
  return merged;
}
async function listRides(filter) {
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
        const conditions = [];
        const params = [];
        if (filter.userId) {
          conditions.push("customer_id = ?");
          params.push(filter.userId);
        }
        if (filter.driverId) {
          conditions.push("driver_id = ?");
          params.push(filter.driverId);
        }
        if (filter.status) {
          const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
          conditions.push(`ride_status IN (${statuses.map(() => "?").join(",")})`);
          params.push(...statuses);
        }
        let sql = "SELECT * FROM rides";
        if (conditions.length > 0) {
          sql += " WHERE " + conditions.join(" AND ");
        }
        sql += " ORDER BY created_at DESC";
        if (filter.limit && filter.limit > 0) {
          sql += ` LIMIT ${Number(filter.limit)}`;
        }
        const [rows] = await pool2.execute(sql, params);
        return rows.map((r) => {
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
    } catch (err) {
      console.error("[MySQL Repo] listRides error:", err.message);
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
async function deleteRide(id) {
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
        await pool2.execute("DELETE FROM rides WHERE id = ?", [id]);
      }
    } catch (err) {
      console.error("[MySQL Repo] deleteRide error:", err.message);
    }
  }
  return memoryStore.rides.delete(id);
}
async function getWalletByDriverId(driverId) {
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
      const pool2 = await getDbPool();
      if (pool2) {
        const [rows] = await pool2.execute("SELECT * FROM wallets WHERE driver_id = ? LIMIT 1", [driverId]);
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
    } catch (err) {
      console.error("[MySQL Repo] getWalletByDriverId error:", err.message);
    }
  }
  return memoryStore.wallets.get(driverId) || defaultWallet;
}
async function upsertWallet(driverId, wallet) {
  const existing = await getWalletByDriverId(driverId);
  const now = Date.now();
  const merged = { ...existing, ...wallet, driverId, updatedAt: now };
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
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
        await pool2.execute(sql, [
          driverId,
          merged.balance || 0,
          merged.pendingCommission || 0,
          merged.totalEarned || 0,
          merged.isBlocked ? 1 : 0,
          JSON.stringify(merged),
          now
        ]);
      }
    } catch (err) {
      console.error("[MySQL Repo] upsertWallet error:", err.message);
    }
  }
  memoryStore.wallets.set(driverId, merged);
  return merged;
}
async function listWallets() {
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
        const [rows] = await pool2.execute("SELECT * FROM wallets");
        return rows.map((w) => {
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
    } catch (err) {
      console.error("[MySQL Repo] listWallets error:", err.message);
    }
  }
  return Array.from(memoryStore.wallets.values());
}
async function createCommissionTransaction(tx) {
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
      const pool2 = await getDbPool();
      if (pool2) {
        const sql = `
          INSERT INTO commission_transactions (id, driver_id, ride_id, amount, type, description, timestamp, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await pool2.execute(sql, [
          id,
          item.driverId || item.driver_id,
          item.rideId || item.ride_id || null,
          item.amount || 0,
          item.type || "ride_deduction",
          item.description || "",
          item.timestamp,
          item.createdAt
        ]);
      }
    } catch (err) {
      console.error("[MySQL Repo] createCommissionTransaction error:", err.message);
    }
  }
  memoryStore.commission_transactions.push(item);
  return item;
}
async function listCommissionTransactions(driverId, limit) {
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
        let sql = "SELECT * FROM commission_transactions";
        const params = [];
        if (driverId) {
          sql += " WHERE driver_id = ?";
          params.push(driverId);
        }
        sql += " ORDER BY timestamp DESC";
        if (limit && limit > 0) {
          sql += ` LIMIT ${Number(limit)}`;
        }
        const [rows] = await pool2.execute(sql, params);
        return rows.map((r) => ({
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
    } catch (err) {
      console.error("[MySQL Repo] listCommissionTransactions error:", err.message);
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
async function getServiceArea(id) {
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
        const [rows] = await pool2.execute("SELECT * FROM service_areas WHERE id = ? LIMIT 1", [id]);
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
    } catch (err) {
      console.error("[MySQL Repo] getServiceArea error:", err.message);
    }
  }
  return memoryStore.service_areas.get(id) || memoryStore.service_areas.get("primary_boundary");
}
async function upsertServiceArea(id, area) {
  const now = Date.now();
  const existing = await getServiceArea(id) || {};
  const merged = { ...existing, ...area, id, updatedAt: now };
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
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
        await pool2.execute(sql, [
          id,
          merged.name || "ChaLo Service Area",
          merged.bengaliName || "\u099A\u09B2\u09CB \u09B8\u09BE\u09B0\u09CD\u09AD\u09BF\u09B8 \u098F\u09B2\u09BE\u0995\u09BE",
          merged.enabled ? 1 : 0,
          JSON.stringify(merged.polygon || defaultPolygon),
          now,
          merged.updatedBy || "admin"
        ]);
      }
    } catch (err) {
      console.error("[MySQL Repo] upsertServiceArea error:", err.message);
    }
  }
  memoryStore.service_areas.set(id, merged);
  return merged;
}
async function getAppSettings(id) {
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
        const [rows] = await pool2.execute("SELECT * FROM app_settings WHERE id = ? LIMIT 1", [id]);
        if (rows && rows.length > 0) {
          const s = rows[0];
          return s.settings_json ? JSON.parse(s.settings_json) : {};
        }
      }
    } catch (err) {
      console.error("[MySQL Repo] getAppSettings error:", err.message);
    }
  }
  return memoryStore.app_settings.get(id) || memoryStore.app_settings.get("global");
}
async function upsertAppSettings(id, settings) {
  const now = Date.now();
  const existing = await getAppSettings(id) || {};
  const merged = { ...existing, ...settings, updatedAt: now };
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
        const sql = `
          INSERT INTO app_settings (id, settings_json, updated_at)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
            settings_json = VALUES(settings_json),
            updated_at = VALUES(updated_at)
        `;
        await pool2.execute(sql, [id, JSON.stringify(merged), now]);
      }
    } catch (err) {
      console.error("[MySQL Repo] upsertAppSettings error:", err.message);
    }
  }
  memoryStore.app_settings.set(id, merged);
  return merged;
}
async function listNotifications(limit) {
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
        let sql = "SELECT * FROM notifications ORDER BY created_at DESC";
        if (limit && limit > 0) sql += ` LIMIT ${Number(limit)}`;
        const [rows] = await pool2.execute(sql);
        return rows.map((n) => ({
          id: n.id,
          userId: n.user_id,
          title: n.title,
          message: n.message,
          type: n.type,
          isRead: Boolean(n.is_read),
          createdAt: n.created_at
        }));
      }
    } catch (err) {
      console.error("[MySQL Repo] listNotifications error:", err.message);
    }
  }
  let list = [...memoryStore.notifications];
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (limit && limit > 0) list = list.slice(0, limit);
  return list;
}
async function createNotification(notif) {
  const id = notif.id || `notif_${Date.now()}`;
  const now = Date.now();
  const item = { ...notif, id, createdAt: notif.createdAt || now };
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
        const sql = `
          INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await pool2.execute(sql, [
          id,
          item.userId || null,
          item.title || "Notification",
          item.message || "",
          item.type || "info",
          item.isRead ? 1 : 0,
          item.createdAt
        ]);
      }
    } catch (err) {
      console.error("[MySQL Repo] createNotification error:", err.message);
    }
  }
  memoryStore.notifications.push(item);
  return item;
}
async function listComplaints() {
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
        const [rows] = await pool2.execute("SELECT * FROM complaints ORDER BY created_at DESC");
        return rows.map((c) => ({
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
    } catch (err) {
      console.error("[MySQL Repo] listComplaints error:", err.message);
    }
  }
  return memoryStore.complaints;
}
async function createComplaint(complaint) {
  const id = complaint.id || `ticket_${Date.now()}`;
  const now = Date.now();
  const item = { ...complaint, id, createdAt: now, updatedAt: now };
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
        const sql = `
          INSERT INTO complaints (id, user_id, user_name, user_role, subject, description, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await pool2.execute(sql, [
          id,
          item.userId || null,
          item.userName || "Anonymous",
          item.userRole || "customer",
          item.subject || "",
          item.description || "",
          item.status || "open",
          now,
          now
        ]);
      }
    } catch (err) {
      console.error("[MySQL Repo] createComplaint error:", err.message);
    }
  }
  memoryStore.complaints.push(item);
  return item;
}
async function updateComplaint(id, updates) {
  const now = Date.now();
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
        const sql = "UPDATE complaints SET status = ?, updated_at = ? WHERE id = ?";
        await pool2.execute(sql, [updates.status || "resolved", now, id]);
      }
    } catch (err) {
      console.error("[MySQL Repo] updateComplaint error:", err.message);
    }
  }
  const index = memoryStore.complaints.findIndex((c) => c.id === id);
  if (index >= 0) {
    memoryStore.complaints[index] = { ...memoryStore.complaints[index], ...updates, updatedAt: now };
    return memoryStore.complaints[index];
  }
  return null;
}
async function listCoupons() {
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
        const [rows] = await pool2.execute("SELECT * FROM coupons ORDER BY created_at DESC");
        return rows.map((c) => ({
          id: c.id,
          code: c.code,
          discountType: c.discount_type,
          discountValue: Number(c.discount_value),
          expiresAt: c.expires_at,
          createdAt: c.created_at
        }));
      }
    } catch (err) {
      console.error("[MySQL Repo] listCoupons error:", err.message);
    }
  }
  return memoryStore.coupons;
}
async function createCoupon(coupon) {
  const id = coupon.id || `coupon_${Date.now()}`;
  const now = Date.now();
  const item = { ...coupon, id, createdAt: now };
  if (isMysqlConnected()) {
    try {
      const pool2 = await getDbPool();
      if (pool2) {
        const sql = `
          INSERT INTO coupons (id, code, discount_type, discount_value, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        await pool2.execute(sql, [
          id,
          item.code,
          item.discountType || "flat",
          item.discountValue || 0,
          item.expiresAt || null,
          now
        ]);
      }
    } catch (err) {
      console.error("[MySQL Repo] createCoupon error:", err.message);
    }
  }
  memoryStore.coupons.push(item);
  return item;
}

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
app.use(express.json({ limit: "10mb" }));
var sseClients = /* @__PURE__ */ new Set();
function broadcastChange(collection, action, id, data) {
  const payload = JSON.stringify({ collection, action, id, data, timestamp: Date.now() });
  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}

`);
    } catch {
      sseClients.delete(client);
    }
  }
}
app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  sseClients.add(res);
  req.on("close", () => {
    sseClients.delete(res);
  });
});
app.get("/api/health", async (_req, res) => {
  const dbStatus = await checkDbConnection();
  if (dbStatus.connected) {
    if (!isSchemaInitialized()) {
      await initializeDatabaseSchema();
    }
    res.json({
      success: true,
      server: "ok",
      database: "ok",
      tablesReady: isSchemaInitialized(),
      storage: "hostinger_mysql",
      activeSseClients: sseClients.size,
      timestamp: Date.now()
    });
  } else {
    const config = getDbConfig();
    res.status(503).json({
      success: false,
      server: "ok",
      database: "error",
      error: dbStatus.error,
      host: config.host,
      port: config.port,
      databaseName: config.database,
      user: config.user,
      hint: "Please check DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in Hostinger environment or .env file",
      storage: "hostinger_nodejs_fallback",
      timestamp: Date.now()
    });
  }
});
app.get("/api/init-db", async (_req, res) => {
  const success = await initializeDatabaseSchema();
  if (success) {
    res.json({
      success: true,
      message: "All 12 tables created and verified successfully in MySQL",
      tablesCount: 12
    });
  } else {
    res.status(500).json({
      success: false,
      message: "Database schema initialization failed",
      error: getLastDbError()
    });
  }
});
app.get("/api/users/:uid", async (req, res) => {
  try {
    const user = await getUserById(req.params.uid);
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/users/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const updated = await upsertUser(uid, req.body);
    broadcastChange("users", "set", uid, updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/users", async (req, res) => {
  try {
    const { role } = req.query;
    const list = await listUsers(role);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/rides/:id", async (req, res) => {
  try {
    const ride = await getRideById(req.params.id);
    if (ride) {
      res.json(ride);
    } else {
      res.status(404).json({ error: "Ride not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/rides", async (req, res) => {
  try {
    const { userId, driverId, status, limit: limitStr } = req.query;
    const limit = limitStr ? parseInt(limitStr, 10) : void 0;
    const list = await listRides({
      userId,
      driverId,
      status,
      limit
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/rides", async (req, res) => {
  try {
    const ride = await upsertRide(req.body);
    broadcastChange("rides", "set", ride.id, ride);
    res.status(201).json(ride);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put("/api/rides/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const ride = await upsertRide({ ...req.body, id });
    broadcastChange("rides", "set", id, ride);
    res.json(ride);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete("/api/rides/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await deleteRide(id);
    broadcastChange("rides", "delete", id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/wallets/:driverId", async (req, res) => {
  try {
    const wallet = await getWalletByDriverId(req.params.driverId);
    res.json(wallet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/wallets/:driverId", async (req, res) => {
  try {
    const { driverId } = req.params;
    const updated = await upsertWallet(driverId, req.body);
    broadcastChange("wallets", "set", driverId, updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/wallets", async (_req, res) => {
  try {
    const list = await listWallets();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/commission_transactions", async (req, res) => {
  try {
    const { driverId, limit: limitStr } = req.query;
    const limit = limitStr ? parseInt(limitStr, 10) : void 0;
    const list = await listCommissionTransactions(driverId, limit);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/commission_transactions", async (req, res) => {
  try {
    const tx = await createCommissionTransaction(req.body);
    broadcastChange("commission_transactions", "set", tx.id, tx);
    res.status(201).json(tx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/notifications", async (req, res) => {
  try {
    const { limit: limitStr } = req.query;
    const limit = limitStr ? parseInt(limitStr, 10) : void 0;
    const list = await listNotifications(limit);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/notifications", async (req, res) => {
  try {
    const notif = await createNotification(req.body);
    broadcastChange("notifications", "set", notif.id, notif);
    res.status(201).json(notif);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/coupons", async (_req, res) => {
  try {
    const list = await listCoupons();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/coupons", async (req, res) => {
  try {
    const coupon = await createCoupon(req.body);
    broadcastChange("coupons", "set", coupon.id, coupon);
    res.status(201).json(coupon);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/complaints", async (_req, res) => {
  try {
    const list = await listComplaints();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/complaints", async (req, res) => {
  try {
    const complaint = await createComplaint(req.body);
    broadcastChange("complaints", "set", complaint.id, complaint);
    res.status(201).json(complaint);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put("/api/complaints/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await updateComplaint(id, req.body);
    if (updated) {
      broadcastChange("complaints", "set", id, updated);
      res.json(updated);
    } else {
      res.status(404).json({ error: "Complaint not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/app_settings/:id", async (req, res) => {
  try {
    const settings = await getAppSettings(req.params.id);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/app_settings/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const settings = await upsertAppSettings(id, req.body);
    broadcastChange("app_settings", "set", id, settings);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/service_areas/:id", async (req, res) => {
  try {
    const area = await getServiceArea(req.params.id);
    res.json(area);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/service_areas/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const area = await upsertServiceArea(id, req.body);
    broadcastChange("service_areas", "set", id, area);
    res.json(area);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.all("/api/*", (req, res) => {
  res.status(404).json({
    error: "API endpoint not found",
    method: req.method,
    path: req.path
  });
});
var isProd = process.env.NODE_ENV === "production";
async function startServer() {
  const schemaInitialized = await initializeDatabaseSchema();
  if (schemaInitialized) {
    console.log("[Server] Hostinger MySQL connection and schema verification complete.");
  } else {
    console.warn("[Server] Operating with fallback mode. Provide valid MySQL credentials in Hostinger to activate live MySQL tables.");
  }
  const distPath = path.join(__dirname, "dist");
  const hasDist = fs.existsSync(distPath);
  if (isProd || hasDist) {
    console.log('[Server] Serving production static files from "dist" directory');
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        return next();
      }
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Frontend build not found. Run npm run build.");
      }
    });
  } else {
    console.log("[Server] Starting in development mode with Vite middleware");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }
  const PORT = Number(process.env.PORT || 3e3);
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Chalo Server] Hostinger Node.js Backend running at http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("[Chalo Server] Fatal startup error:", err);
  process.exit(1);
});
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
