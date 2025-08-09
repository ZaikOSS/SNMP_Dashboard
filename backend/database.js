const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const logger = require("./logger");

const DB_PATH =
  process.env.DATABASE_PATH || path.join(__dirname, "instance", "snmp_data.db");

// Ensure the instance directory exists
const instanceDir = path.dirname(DB_PATH);
if (!fs.existsSync(instanceDir)) {
  fs.mkdirSync(instanceDir, { recursive: true });
}

class Database {
  constructor() {
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          logger.error("Error opening database:", err);
          reject(err);
        } else {
          logger.info(`Connected to SQLite database at ${DB_PATH}`);
          this.initializeTables()
            .then(() => resolve())
            .catch(reject);
        }
      });
    });
  }

  async initializeTables() {
    const tables = [
      // Device information table with enhanced SNMP support
      `
      CREATE TABLE IF NOT EXISTS device_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_address TEXT UNIQUE NOT NULL,
        hostname TEXT,
        device_type TEXT DEFAULT 'router',
        community TEXT DEFAULT 'public',
        snmp_version TEXT DEFAULT '2c',
        snmp_port INTEGER DEFAULT 161,
        snmpv3_username TEXT,
        snmpv3_auth_protocol TEXT DEFAULT 'MD5',
        snmpv3_auth_password TEXT,
        snmpv3_priv_protocol TEXT DEFAULT 'DES',
        snmpv3_priv_password TEXT,
        snmpv3_security_level TEXT DEFAULT 'authPriv',
        status TEXT DEFAULT 'unknown',
        last_seen DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
      `,

      // SNMP data table for storing collected metrics
      `
      CREATE TABLE IF NOT EXISTS snmp_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER NOT NULL,
        metric_type TEXT NOT NULL,
        value_json TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES device_info (id) ON DELETE CASCADE
      )
      `,

      // Enhanced interface data table
      `
      CREATE TABLE IF NOT EXISTS interface_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER NOT NULL,
        interface_index INTEGER NOT NULL,
        interface_name TEXT NOT NULL,
        interface_description TEXT,
        admin_status TEXT DEFAULT 'unknown',
        oper_status TEXT DEFAULT 'unknown',
        interface_speed BIGINT DEFAULT 0,
        interface_type TEXT DEFAULT 'unknown',
        in_octets BIGINT DEFAULT 0,
        out_octets BIGINT DEFAULT 0,
        in_packets BIGINT DEFAULT 0,
        out_packets BIGINT DEFAULT 0,
        in_errors INTEGER DEFAULT 0,
        out_errors INTEGER DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES device_info (id) ON DELETE CASCADE,
        UNIQUE(device_id, interface_index)
      )
      `,
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Create indexes for better performance
    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_snmp_data_device_timestamp ON snmp_data(device_id, timestamp)",
      "CREATE INDEX IF NOT EXISTS idx_snmp_data_metric_type ON snmp_data(metric_type)",
      "CREATE INDEX IF NOT EXISTS idx_interface_data_device ON interface_data(device_id)",
      "CREATE INDEX IF NOT EXISTS idx_device_status ON device_info(status)",
    ];

    for (const index of indexes) {
      await this.run(index);
    }

    logger.info("Database tables initialized successfully");
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) {
          logger.error("Database run error:", err);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          logger.error("Database get error:", err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error("Database all error:", err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            logger.error("Error closing database:", err);
            reject(err);
          } else {
            logger.info("Database connection closed");
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

const database = new Database();

// Initialize database connection
async function initializeDatabase() {
  await database.connect();
}

module.exports = { database, initializeDatabase };
