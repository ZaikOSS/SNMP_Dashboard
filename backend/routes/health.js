const express = require("express");
const { database } = require("../database");
const logger = require("../logger");

const router = express.Router();

// Health check endpoint
router.get("/", async (req, res) => {
  try {
    // Check database connectivity
    await database.get("SELECT 1");

    // Get basic stats
    const deviceCount = await database.get(
      "SELECT COUNT(*) as count FROM device_info"
    );
    const onlineDevices = await database.get(
      "SELECT COUNT(*) as count FROM device_info WHERE status = 'online'"
    );
    const recentDataCount = await database.get(
      "SELECT COUNT(*) as count FROM snmp_data WHERE timestamp >= datetime('now', '-1 hour')"
    );

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      stats: {
        totalDevices: deviceCount.count,
        onlineDevices: onlineDevices.count,
        recentDataPoints: recentDataCount.count,
      },
    });
  } catch (error) {
    logger.error("Health check failed:", error);
    res.status(500).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Detailed system status
router.get("/status", async (req, res) => {
  try {
    // Database stats
    const dbStats = await database.all(`
      SELECT 
        'devices' as table_name, COUNT(*) as count 
      FROM device_info
      UNION ALL
      SELECT 
        'snmp_data' as table_name, COUNT(*) as count 
      FROM snmp_data
      UNION ALL
      SELECT 
        'interface_data' as table_name, COUNT(*) as count 
      FROM interface_data
    `);

    // Device status breakdown
    const deviceStatus = await database.all(`
      SELECT status, COUNT(*) as count 
      FROM device_info 
      GROUP BY status
    `);

    // Recent activity
    const recentActivity = await database.all(`
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as data_points
      FROM snmp_data 
      WHERE timestamp >= datetime('now', '-7 days')
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `);

    // System uptime (approximate based on oldest data)
    const oldestData = await database.get(`
      SELECT MIN(timestamp) as oldest 
      FROM snmp_data
    `);

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: {
        tables: dbStats.reduce((acc, stat) => {
          acc[stat.table_name] = stat.count;
          return acc;
        }, {}),
      },
      devices: {
        status: deviceStatus.reduce((acc, stat) => {
          acc[stat.status] = stat.count;
          return acc;
        }, {}),
      },
      activity: {
        recent: recentActivity,
        oldestData: oldestData.oldest,
      },
    });
  } catch (error) {
    logger.error("Status check failed:", error);
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

module.exports = router;
