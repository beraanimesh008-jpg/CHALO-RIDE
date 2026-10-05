/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import mysql from 'mysql2/promise';

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
}

// Read database credentials exclusively from environment variables
const dbConfig: DbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'u691798054_chalo_toto',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'u691798054_chalo_toto',
};

let pool: mysql.Pool | null = null;
let isMysqlActive = false;

// Initialize MySQL Connection Pool
export async function getDbPool(): Promise<mysql.Pool | null> {
  if (pool) return pool;

  try {
    pool = mysql.createPool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });

    // Test connection
    const connection = await pool.getConnection();
    connection.release();
    isMysqlActive = true;
    console.log(`[Hostinger MySQL] Successfully connected to database: ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port}`);
    return pool;
  } catch (err: any) {
    pool = null;
    isMysqlActive = false;
    console.warn(`[Hostinger MySQL] Connection attempt failed: ${err.message}.`);
    console.warn(`[Hostinger MySQL] Fallback mode active. Provide valid DB_HOST, DB_USER, DB_PASSWORD, DB_NAME to enable live MySQL storage.`);
    return null;
  }
}

export function isMysqlConnected(): boolean {
  return isMysqlActive;
}

/**
 * Initializes required tables in the Hostinger MySQL database safely.
 * Uses CREATE TABLE IF NOT EXISTS without dropping any tables.
 */
export async function initializeDatabaseSchema(): Promise<boolean> {
  const currentPool = await getDbPool();
  if (!currentPool) {
    console.warn('[Hostinger MySQL] Database schema initialization skipped: MySQL connection not available.');
    return false;
  }

  const tableDefinitions = [
    // 1. Users Table (Customers, Admins, Drivers)
    `CREATE TABLE IF NOT EXISTS users (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 2. Drivers Table
    `CREATE TABLE IF NOT EXISTS drivers (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 3. Rides Table (Realtime GPS belongs strictly in Firebase Realtime DB)
    `CREATE TABLE IF NOT EXISTS rides (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 4. Ride Offers Table
    `CREATE TABLE IF NOT EXISTS ride_offers (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 5. Wallets Table
    `CREATE TABLE IF NOT EXISTS wallets (
      driver_id VARCHAR(64) PRIMARY KEY,
      balance DECIMAL(10, 2) DEFAULT 0.00,
      pending_commission DECIMAL(10, 2) DEFAULT 0.00,
      total_earned DECIMAL(10, 2) DEFAULT 0.00,
      is_blocked TINYINT(1) DEFAULT 0,
      data_json LONGTEXT,
      updated_at BIGINT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 6. Commission Transactions Table
    `CREATE TABLE IF NOT EXISTS commission_transactions (
      id VARCHAR(64) PRIMARY KEY,
      driver_id VARCHAR(64),
      ride_id VARCHAR(64),
      amount DECIMAL(10, 2) DEFAULT 0.00,
      type VARCHAR(32),
      description TEXT,
      timestamp BIGINT,
      created_at BIGINT,
      INDEX idx_comm_driver (driver_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 7. Payments Table
    `CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(64) PRIMARY KEY,
      ride_id VARCHAR(64),
      driver_id VARCHAR(64),
      user_id VARCHAR(64),
      amount DECIMAL(10, 2) DEFAULT 0.00,
      payment_method VARCHAR(32),
      status VARCHAR(32),
      transaction_id VARCHAR(128),
      created_at BIGINT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 8. Service Areas Table
    `CREATE TABLE IF NOT EXISTS service_areas (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255),
      bengali_name VARCHAR(255),
      enabled TINYINT(1) DEFAULT 1,
      polygon_json LONGTEXT,
      updated_at BIGINT,
      updated_by VARCHAR(64)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 9. Notifications Table
    `CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64),
      title VARCHAR(255),
      message TEXT,
      type VARCHAR(32),
      is_read TINYINT(1) DEFAULT 0,
      created_at BIGINT,
      INDEX idx_notif_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 10. App Settings Table
    `CREATE TABLE IF NOT EXISTS app_settings (
      id VARCHAR(64) PRIMARY KEY,
      settings_json LONGTEXT,
      updated_at BIGINT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 11. Complaints / Support Tickets Table
    `CREATE TABLE IF NOT EXISTS complaints (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64),
      user_name VARCHAR(255),
      user_role VARCHAR(32),
      subject VARCHAR(255),
      description TEXT,
      status VARCHAR(32) DEFAULT 'open',
      created_at BIGINT,
      updated_at BIGINT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 12. Coupons Table
    `CREATE TABLE IF NOT EXISTS coupons (
      id VARCHAR(64) PRIMARY KEY,
      code VARCHAR(64) UNIQUE,
      discount_type VARCHAR(32),
      discount_value DECIMAL(10, 2),
      expires_at BIGINT,
      created_at BIGINT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  ];

  try {
    for (const sql of tableDefinitions) {
      await currentPool.execute(sql);
    }
    console.log('[Hostinger MySQL] Schema initialization succeeded. All 12 tables verified.');
    return true;
  } catch (err: any) {
    console.error('[Hostinger MySQL] Schema initialization error:', err.message);
    return false;
  }
}
