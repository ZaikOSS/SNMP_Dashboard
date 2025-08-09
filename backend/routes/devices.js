const express = require("express");
const { database } = require("../database");
const logger = require("../logger");
const { collector } = require("../snmpCollector");
const SNMPTester = require("../utils/snmpTest");

const router = express.Router();

// Get all devices
router.get("/", async (req, res) => {
  try {
    const devices = await database.all(`
      SELECT 
        id, ip_address, hostname, device_type, community, 
        snmp_version, snmp_port, snmpv3_username, snmpv3_auth_protocol,
        snmpv3_priv_protocol, snmpv3_security_level, status, last_seen, created_at
      FROM device_info 
      ORDER BY created_at DESC
    `);

    // Don't send passwords in the response
    const sanitizedDevices = devices.map((device) => ({
      ...device,
      snmpv3_auth_password: device.snmpv3_auth_password ? "***" : "",
      snmpv3_priv_password: device.snmpv3_priv_password ? "***" : "",
    }));

    res.json(sanitizedDevices);
  } catch (error) {
    logger.error("Error fetching devices:", error);
    res.status(500).json({ error: "Failed to fetch devices" });
  }
});

// Get current data for a device (NEW ENDPOINT)
router.get("/:id/current", async (req, res) => {
  try {
    const { id } = req.params;

    logger.info(`Fetching current data for device ${id}`);

    // Get device info
    const device = await database.get(
      "SELECT * FROM device_info WHERE id = ?",
      [id]
    );
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    // Get latest system data
    const systemData = await database.get(
      `SELECT value_json, timestamp 
       FROM snmp_data 
       WHERE device_id = ? AND metric_type = 'system' 
       ORDER BY timestamp DESC 
       LIMIT 1`,
      [id]
    );

    // Get latest CPU data
    const cpuData = await database.get(
      `SELECT value_json, timestamp 
       FROM snmp_data 
       WHERE device_id = ? AND metric_type = 'cpu' 
       ORDER BY timestamp DESC 
       LIMIT 1`,
      [id]
    );

    // Get latest environmental data
    const envData = await database.get(
      `SELECT value_json, timestamp 
       FROM snmp_data 
       WHERE device_id = ? AND metric_type = 'environmental' 
       ORDER BY timestamp DESC 
       LIMIT 1`,
      [id]
    );

    // Get interface data
    const interfaces = await database.all(
      `SELECT * FROM interface_data 
       WHERE device_id = ? 
       ORDER BY interface_index`,
      [id]
    );

    // Build response
    const currentData = {};

    if (systemData) {
      const systemValue = JSON.parse(systemData.value_json);
      currentData.system = {
        description: systemValue.sys_descr || "N/A",
        uptime: systemValue.sys_uptime || "N/A",
        name: systemValue.sys_name || "N/A",
        location: systemValue.sys_location || "N/A",
        contact: systemValue.sys_contact || "N/A",
        timestamp: systemData.timestamp,
      };
    }

    if (cpuData) {
      const cpuValue = JSON.parse(cpuData.value_json);
      currentData.cpu = {
        utilization:
          cpuValue.cpu_5min || cpuValue.cpu_1min || cpuValue.cpu_5sec || 0,
        cpu_5min: cpuValue.cpu_5min || 0,
        cpu_1min: cpuValue.cpu_1min || 0,
        cpu_5sec: cpuValue.cpu_5sec || 0,
        timestamp: cpuData.timestamp,
      };
    }

    if (envData) {
      const envValue = JSON.parse(envData.value_json);
      currentData.environmental = {
        temperature: envValue.temperature_value || "N/A",
        fan_state: envValue.fan_state || "N/A",
        timestamp: envData.timestamp,
      };
    }

    // Format interfaces
    currentData.interfaces = interfaces.map((iface) => ({
      name: iface.interface_name,
      description: iface.interface_description,
      admin_status: iface.admin_status,
      oper_status: iface.oper_status,
      speed: iface.interface_speed,
      type: iface.interface_type,
      last_updated: iface.last_updated,
    }));

    logger.info(
      `Current data fetched for device ${id}: ${
        Object.keys(currentData).length
      } data types`
    );

    res.json(currentData);
  } catch (error) {
    logger.error(
      `Error fetching current data for device ${req.params.id}:`,
      error
    );
    res.status(500).json({ error: "Failed to fetch current data" });
  }
});

// Get historical data for a device (NEW ENDPOINT)
router.get("/:id/history", async (req, res) => {
  try {
    const { id } = req.params;
    const { hours = 24, type = "cpu" } = req.query;

    logger.info(
      `Fetching historical data for device ${id}, type: ${type}, hours: ${hours}`
    );

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - Number.parseInt(hours));

    const data = await database.all(
      `SELECT value_json, timestamp 
       FROM snmp_data 
       WHERE device_id = ? AND metric_type = ? AND timestamp >= ?
       ORDER BY timestamp ASC`,
      [id, type, cutoffTime.toISOString()]
    );

    const processedData = data.map((row) => ({
      timestamp: row.timestamp,
      value: JSON.parse(row.value_json),
    }));

    logger.info(`Historical data fetched: ${processedData.length} records`);

    res.json(processedData);
  } catch (error) {
    logger.error(
      `Error fetching historical data for device ${req.params.id}:`,
      error
    );
    res.status(500).json({ error: "Failed to fetch historical data" });
  }
});

// Test SNMP connectivity before adding device
router.post("/test", async (req, res) => {
  try {
    const deviceConfig = req.body;

    logger.info(`Testing SNMP connectivity for ${deviceConfig.ip_address}`);

    const result = await SNMPTester.testDevice(deviceConfig);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error("SNMP test failed:", error);
    res.json({
      success: false,
      error: error.message,
      message: "SNMP connectivity test failed",
    });
  }
});

// Add new device with enhanced validation
router.post("/", async (req, res) => {
  try {
    const {
      ip_address,
      hostname,
      device_type = "router",
      community = "public",
      snmp_version = "2c",
      snmp_port = 161,
      snmpv3_username,
      snmpv3_auth_protocol = "MD5",
      snmpv3_auth_password,
      snmpv3_priv_protocol = "DES",
      snmpv3_priv_password,
      snmpv3_security_level = "authPriv",
      test_before_add = true,
    } = req.body;

    // Validate required fields
    if (!ip_address) {
      return res.status(400).json({ error: "IP address is required" });
    }

    // Validate IP address format
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (!ipRegex.test(ip_address)) {
      return res.status(400).json({ error: "Invalid IP address format" });
    }

    // Check if device already exists
    const existingDevice = await database.get(
      "SELECT id FROM device_info WHERE ip_address = ?",
      [ip_address]
    );
    if (existingDevice) {
      return res
        .status(409)
        .json({ error: "Device with this IP address already exists" });
    }

    // Test connectivity before adding (optional)
    if (test_before_add) {
      try {
        logger.info(`Testing connectivity before adding device ${ip_address}`);
        await SNMPTester.testDevice(req.body);
        logger.info(`✓ Connectivity test passed for ${ip_address}`);
      } catch (error) {
        logger.warn(
          `✗ Connectivity test failed for ${ip_address}: ${error.message}`
        );
        return res.status(400).json({
          error: "SNMP connectivity test failed",
          details: error.message,
          suggestion: "Please check your SNMP configuration and try again",
        });
      }
    }

    // Insert new device
    const result = await database.run(
      `INSERT INTO device_info (
        ip_address, hostname, device_type, community, snmp_version, snmp_port,
        snmpv3_username, snmpv3_auth_protocol, snmpv3_auth_password,
        snmpv3_priv_protocol, snmpv3_priv_password, snmpv3_security_level,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unknown', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        ip_address,
        hostname,
        device_type,
        community,
        snmp_version,
        snmp_port,
        snmpv3_username,
        snmpv3_auth_protocol,
        snmpv3_auth_password,
        snmpv3_priv_protocol,
        snmpv3_priv_password,
        snmpv3_security_level,
      ]
    );

    logger.info(`✓ Added new device: ${ip_address} (SNMP v${snmp_version})`);

    // Test the device immediately after adding
    setTimeout(async () => {
      try {
        await collector.testDevice(result.id);
      } catch (error) {
        logger.error(`Failed to test newly added device ${ip_address}:`, error);
      }
    }, 1000);

    // Return the created device (without passwords)
    const newDevice = await database.get(
      "SELECT * FROM device_info WHERE id = ?",
      [result.id]
    );
    const sanitizedDevice = {
      ...newDevice,
      snmpv3_auth_password: newDevice.snmpv3_auth_password ? "***" : "",
      snmpv3_priv_password: newDevice.snmpv3_priv_password ? "***" : "",
    };

    res.status(201).json(sanitizedDevice);
  } catch (error) {
    logger.error("Error adding device:", error);
    res.status(500).json({ error: "Failed to add device" });
  }
});

// Test existing device connectivity
router.post("/:id/test", async (req, res) => {
  try {
    const { id } = req.params;

    // Get device info
    const device = await database.get(
      "SELECT * FROM device_info WHERE id = ?",
      [id]
    );
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    logger.info(
      `Testing connectivity for existing device ${device.ip_address}`
    );

    const result = await SNMPTester.testDevice(device);

    // Update device status based on test result
    await database.run(
      "UPDATE device_info SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?",
      [result.success ? "online" : "error", id]
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error(`SNMP test failed for device ${req.params.id}:`, error);

    // Update device status to error
    await database.run("UPDATE device_info SET status = ? WHERE id = ?", [
      "error",
      req.params.id,
    ]);

    res.json({
      success: false,
      error: error.message,
      message: "SNMP connectivity test failed",
    });
  }
});

// Get device details with recent data
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const device = await database.get(
      "SELECT * FROM device_info WHERE id = ?",
      [id]
    );
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    // Get recent SNMP data
    const recentData = await database.all(
      `SELECT metric_type, value_json, timestamp 
       FROM snmp_data 
       WHERE device_id = ? 
       ORDER BY timestamp DESC 
       LIMIT 50`,
      [id]
    );

    // Get interface data
    const interfaces = await database.all(
      `SELECT * FROM interface_data 
       WHERE device_id = ? 
       ORDER BY interface_index`,
      [id]
    );

    // Sanitize device data
    const sanitizedDevice = {
      ...device,
      snmpv3_auth_password: device.snmpv3_auth_password ? "***" : "",
      snmpv3_priv_password: device.snmpv3_priv_password ? "***" : "",
    };

    res.json({
      device: sanitizedDevice,
      recentData: recentData.map((row) => ({
        ...row,
        value_json: JSON.parse(row.value_json),
      })),
      interfaces,
    });
  } catch (error) {
    logger.error("Error fetching device:", error);
    res.status(500).json({ error: "Failed to fetch device" });
  }
});

// Update device
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if device exists
    const existingDevice = await database.get(
      "SELECT * FROM device_info WHERE id = ?",
      [id]
    );
    if (!existingDevice) {
      return res.status(404).json({ error: "Device not found" });
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    const allowedFields = [
      "hostname",
      "device_type",
      "community",
      "snmp_version",
      "snmp_port",
      "snmpv3_username",
      "snmpv3_auth_protocol",
      "snmpv3_auth_password",
      "snmpv3_priv_protocol",
      "snmpv3_priv_password",
      "snmpv3_security_level",
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updateData[field]);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    updateValues.push(id);

    await database.run(
      `UPDATE device_info SET ${updateFields.join(", ")} WHERE id = ?`,
      updateValues
    );

    logger.info(`Updated device: ${existingDevice.ip_address}`);

    // Return updated device
    const updatedDevice = await database.get(
      "SELECT * FROM device_info WHERE id = ?",
      [id]
    );
    const sanitizedDevice = {
      ...updatedDevice,
      snmpv3_auth_password: updatedDevice.snmpv3_auth_password ? "***" : "",
      snmpv3_priv_password: updatedDevice.snmpv3_priv_password ? "***" : "",
    };

    res.json(sanitizedDevice);
  } catch (error) {
    logger.error("Error updating device:", error);
    res.status(500).json({ error: "Failed to update device" });
  }
});

// Delete device
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const existingDevice = await database.get(
      "SELECT * FROM device_info WHERE id = ?",
      [id]
    );
    if (!existingDevice) {
      return res.status(404).json({ error: "Device not found" });
    }

    await database.run("DELETE FROM device_info WHERE id = ?", [id]);

    logger.info(`Deleted device: ${existingDevice.ip_address}`);

    res.json({ message: "Device deleted successfully" });
  } catch (error) {
    logger.error("Error deleting device:", error);
    res.status(500).json({ error: "Failed to delete device" });
  }
});

module.exports = router;
