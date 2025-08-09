const express = require("express")
const { database } = require("../database")
const logger = require("../logger")

const router = express.Router()

// Get current data for a device
router.get("/devices/:id/current", async (req, res) => {
  try {
    const deviceId = req.params.id
    const currentData = {}

    // Get latest system data
    const systemData = await database.get(
      `
      SELECT value_json, timestamp FROM snmp_data 
      WHERE device_id = ? AND metric_type = 'system'
      ORDER BY timestamp DESC LIMIT 1
    `,
      [deviceId],
    )

    if (systemData) {
      currentData.system = {
        ...JSON.parse(systemData.value_json),
        timestamp: systemData.timestamp,
      }
    }

    // Get latest CPU data
    const cpuData = await database.get(
      `
      SELECT value_json, timestamp FROM snmp_data 
      WHERE device_id = ? AND metric_type = 'cpu'
      ORDER BY timestamp DESC LIMIT 1
    `,
      [deviceId],
    )

    if (cpuData) {
      currentData.cpu = {
        ...JSON.parse(cpuData.value_json),
        timestamp: cpuData.timestamp,
      }
    }

    // Get latest environmental data
    const envData = await database.get(
      `
      SELECT value_json, timestamp FROM snmp_data 
      WHERE device_id = ? AND metric_type = 'environmental'
      ORDER BY timestamp DESC LIMIT 1
    `,
      [deviceId],
    )

    if (envData) {
      currentData.environmental = {
        ...JSON.parse(envData.value_json),
        timestamp: envData.timestamp,
      }
    }

    // Get interface data
    const interfaces = await database.all(
      `
      SELECT interface_name, admin_status, oper_status, last_updated
      FROM interface_data 
      WHERE device_id = ?
      ORDER BY interface_index
    `,
      [deviceId],
    )

    currentData.interfaces = interfaces.map((iface) => ({
      name: iface.interface_name,
      admin_status: iface.admin_status,
      oper_status: iface.oper_status,
      last_updated: iface.last_updated,
    }))

    res.json(currentData)
  } catch (error) {
    logger.error("Error fetching current data:", error)
    res.status(500).json({ error: "Failed to fetch current data" })
  }
})

// Get historical data for a device
router.get("/devices/:id/history", async (req, res) => {
  try {
    const deviceId = req.params.id
    const hours = Number.parseInt(req.query.hours) || 24
    const metricType = req.query.type || "cpu"

    // Calculate start time
    const startTime = new Date()
    startTime.setHours(startTime.getHours() - hours)

    const data = await database.all(
      `
      SELECT value_json, timestamp FROM snmp_data 
      WHERE device_id = ? AND metric_type = ? AND timestamp >= ?
      ORDER BY timestamp ASC
    `,
      [deviceId, metricType, startTime.toISOString()],
    )

    const formattedData = data.map((record) => ({
      timestamp: record.timestamp,
      value: JSON.parse(record.value_json),
    }))

    res.json(formattedData)
  } catch (error) {
    logger.error("Error fetching historical data:", error)
    res.status(500).json({ error: "Failed to fetch historical data" })
  }
})

// Get device statistics
router.get("/devices/:id/stats", async (req, res) => {
  try {
    const deviceId = req.params.id
    const hours = Number.parseInt(req.query.hours) || 24
    const metricType = req.query.type || "cpu"

    const startTime = new Date()
    startTime.setHours(startTime.getHours() - hours)

    const data = await database.all(
      `
      SELECT value_json FROM snmp_data 
      WHERE device_id = ? AND metric_type = ? AND timestamp >= ?
      ORDER BY timestamp ASC
    `,
      [deviceId, metricType, startTime.toISOString()],
    )

    if (data.length === 0) {
      return res.json({ message: "No data available for the specified period" })
    }

    // Extract values based on metric type
    const values = []
    data.forEach((record) => {
      const parsed = JSON.parse(record.value_json)
      switch (metricType) {
        case "cpu":
          if (parsed.cpu_5min !== undefined) values.push(parsed.cpu_5min)
          break
        case "environmental":
          if (parsed.temperature_value !== undefined) values.push(parsed.temperature_value)
          break
      }
    })

    if (values.length === 0) {
      return res.json({ message: "No valid data points found" })
    }

    // Calculate statistics
    const stats = {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((sum, val) => sum + val, 0) / values.length,
      latest: values[values.length - 1],
    }

    res.json(stats)
  } catch (error) {
    logger.error("Error calculating statistics:", error)
    res.status(500).json({ error: "Failed to calculate statistics" })
  }
})

module.exports = router
