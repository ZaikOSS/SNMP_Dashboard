const express = require("express")
const { database } = require("../database")
const { collector } = require("../snmpCollector")
const logger = require("../logger")

const router = express.Router()

// Health check endpoint
router.get("/", async (req, res) => {
  try {
    // Check database connectivity
    await database.get("SELECT 1")

    // Get system stats
    const deviceCount = await database.get("SELECT COUNT(*) as count FROM device_info")
    const onlineDevices = await database.get('SELECT COUNT(*) as count FROM device_info WHERE status = "online"')
    const recentData = await database.get(
      'SELECT COUNT(*) as count FROM snmp_data WHERE timestamp > datetime("now", "-1 hour")',
    )

    const healthStatus = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      collector_running: collector.isRunning,
      stats: {
        total_devices: deviceCount.count,
        online_devices: onlineDevices.count,
        recent_data_points: recentData.count,
      },
    }

    res.json(healthStatus)
  } catch (error) {
    logger.error("Health check failed:", error)
    res.status(500).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
    })
  }
})

// Get system information
router.get("/info", async (req, res) => {
  try {
    const info = {
      version: process.env.npm_package_version || "1.0.0",
      node_version: process.version,
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      environment: process.env.NODE_ENV || "development",
    }

    res.json(info)
  } catch (error) {
    logger.error("Error getting system info:", error)
    res.status(500).json({ error: "Failed to get system information" })
  }
})

module.exports = router
