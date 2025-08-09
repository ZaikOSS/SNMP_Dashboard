const sqlite3 = require("sqlite3").verbose()
const path = require("path")
const fs = require("fs")
const logger = require("./logger")

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, "data", "snmp_data.db")

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

class Database {
  constructor() {
    this.db = null
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          logger.error("Error opening database:", err)
          reject(err)
        } else {
          logger.info(`Connected to SQLite database at ${DB_PATH}`)
          resolve()
        }
      })
    })
  }

  async initializeTables() {
    const queries = [
      // Device info table
      `CREATE TABLE IF NOT EXISTS device_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_address TEXT UNIQUE NOT NULL,
        hostname TEXT,
        device_type TEXT DEFAULT 'router',
        community TEXT DEFAULT 'public',
        status TEXT DEFAULT 'unknown',
        last_seen DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // SNMP data table
      `CREATE TABLE IF NOT EXISTS snmp_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER NOT NULL,
        metric_type TEXT NOT NULL,
        oid TEXT,
        value_json TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES device_info (id) ON DELETE CASCADE
      )`,

      // Interface data table
      `CREATE TABLE IF NOT EXISTS interface_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER NOT NULL,
        interface_index INTEGER NOT NULL,
        interface_name TEXT,
        admin_status TEXT,
        oper_status TEXT,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES device_info (id) ON DELETE CASCADE,
        UNIQUE(device_id, interface_index)
      )`,

      // Create indexes for better performance
      `CREATE INDEX IF NOT EXISTS idx_snmp_data_device_timestamp 
       ON snmp_data(device_id, timestamp)`,

      `CREATE INDEX IF NOT EXISTS idx_snmp_data_metric_type 
       ON snmp_data(metric_type)`,

      `CREATE INDEX IF NOT EXISTS idx_interface_data_device 
       ON interface_data(device_id)`,
    ]

    for (const query of queries) {
      await this.run(query)
    }
  }

  run(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function (err) {
        if (err) {
          logger.error("Database run error:", err)
          reject(err)
        } else {
          resolve({ id: this.lastID, changes: this.changes })
        }
      })
    })
  }

  get(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) {
          logger.error("Database get error:", err)
          reject(err)
        } else {
          resolve(row)
        }
      })
    })
  }

  all(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          logger.error("Database all error:", err)
          reject(err)
        } else {
          resolve(rows)
        }
      })
    })
  }

  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            logger.error("Error closing database:", err)
          } else {
            logger.info("Database connection closed")
          }
          resolve()
        })
      } else {
        resolve()
      }
    })
  }
}

const database = new Database()

async function initializeDatabase() {
  await database.connect()
  await database.initializeTables()
  return database
}

module.exports = {
  database,
  initializeDatabase,
}
