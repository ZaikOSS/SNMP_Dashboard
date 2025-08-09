const express = require("express");
const { database } = require("../database");
const logger = require("../logger");

const router = express.Router();

// Get system data for a device
router.get("/system/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { hours = 24 } = req.query;

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - Number.parseInt(hours));

    const data = await database.all(
      `SELECT value_json, timestamp 
       FROM snmp_data 
       WHERE device_id = ? AND metric_type = 'system' AND timestamp >= ?
       ORDER BY timestamp DESC`,
      [deviceId, cutoffTime.toISOString()]
    );

    const processedData = data.map((row) => ({
      ...JSON.parse(row.value_json),
      timestamp: row.timestamp,
    }));

    res.json(processedData);
  } catch (error) {
    logger.error("Error fetching system data:", error);
    res.status(500).json({ error: "Failed to fetch system data" });
  }
});

// Get CPU data for a device
router.get("/cpu/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { hours = 24 } = req.query;

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - Number.parseInt(hours));

    const data = await database.all(
      `SELECT value_json, timestamp 
       FROM snmp_data 
       WHERE device_id = ? AND metric_type = 'cpu' AND timestamp >= ?
       ORDER BY timestamp ASC`,
      [deviceId, cutoffTime.toISOString()]
    );

    const processedData = data.map((row) => ({
      ...JSON.parse(row.value_json),
      timestamp: row.timestamp,
    }));

    res.json(processedData);
  } catch (error) {
    logger.error("Error fetching CPU data:", error);
    res.status(500).json({ error: "Failed to fetch CPU data" });
  }
});

// Get interface data for a device
router.get("/interfaces/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;

    const interfaces = await database.all(
      `SELECT * FROM interface_data 
       WHERE device_id = ? 
       ORDER BY interface_index`,
      [deviceId]
    );

    res.json(interfaces);
  } catch (error) {
    logger.error("Error fetching interface data:", error);
    res.status(500).json({ error: "Failed to fetch interface data" });
  }
});

// Get environmental data for a device
router.get("/environmental/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { hours = 24 } = req.query;

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - Number.parseInt(hours));

    const data = await database.all(
      `SELECT value_json, timestamp 
       FROM snmp_data 
       WHERE device_id = ? AND metric_type = 'environmental' AND timestamp >= ?
       ORDER BY timestamp ASC`,
      [deviceId, cutoffTime.toISOString()]
    );

    const processedData = data.map((row) => ({
      ...JSON.parse(row.value_json),
      timestamp: row.timestamp,
    }));

    res.json(processedData);
  } catch (error) {
    logger.error("Error fetching environmental data:", error);
    res.status(500).json({ error: "Failed to fetch environmental data" });
  }
});

// Get dashboard overview data
router.get("/overview", async (req, res) => {
  try {
    // Get device counts by status
    const deviceStats = await database.all(
      `SELECT status, COUNT(*) as count 
       FROM device_info 
       GROUP BY status`
    );

    // Get total interface count
    const interfaceCount = await database.get(
      `SELECT COUNT(*) as total 
       FROM interface_data`
    );

    // Get recent alerts (devices that haven't been seen in 10 minutes)
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - 10);

    const alerts = await database.all(
      `SELECT ip_address, hostname, last_seen 
       FROM device_info 
       WHERE status != 'online' OR last_seen < ?
       ORDER BY last_seen DESC
       LIMIT 10`,
      [cutoffTime.toISOString()]
    );

    // Get recent SNMP data for charts
    const recentData = await database.all(
      `SELECT d.ip_address, d.hostname, s.metric_type, s.value_json, s.timestamp
       FROM snmp_data s
       JOIN device_info d ON s.device_id = d.id
       WHERE s.timestamp >= datetime('now', '-1 hour')
       ORDER BY s.timestamp DESC
       LIMIT 100`
    );

    res.json({
      deviceStats: deviceStats.reduce((acc, stat) => {
        acc[stat.status] = stat.count;
        return acc;
      }, {}),
      totalInterfaces: interfaceCount.total,
      alerts,
      recentData: recentData.map((row) => ({
        ...row,
        value_json: JSON.parse(row.value_json),
      })),
    });
  } catch (error) {
    logger.error("Error fetching overview data:", error);
    res.status(500).json({ error: "Failed to fetch overview data" });
  }
});

// Get historical data for a specific metric
router.get("/history/:deviceId/:metricType", async (req, res) => {
  try {
    const { deviceId, metricType } = req.params;
    const { hours = 24, limit = 1000 } = req.query;

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - Number.parseInt(hours));

    const data = await database.all(
      `SELECT value_json, timestamp 
       FROM snmp_data 
       WHERE device_id = ? AND metric_type = ? AND timestamp >= ?
       ORDER BY timestamp ASC
       LIMIT ?`,
      [deviceId, metricType, cutoffTime.toISOString(), Number.parseInt(limit)]
    );

    const processedData = data.map((row) => ({
      ...JSON.parse(row.value_json),
      timestamp: row.timestamp,
    }));

    res.json(processedData);
  } catch (error) {
    logger.error("Error fetching historical data:", error);
    res.status(500).json({ error: "Failed to fetch historical data" });
  }
});

module.exports = router;
