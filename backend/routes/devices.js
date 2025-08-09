const express = require("express")
const { database } = require("../database")
const logger = require("../logger")

const router = express.Router()

// Get all devices
router.get("/", async (req, res) => {
  try {
    const devices = await database.all("SELECT * FROM device_info ORDER BY created_at DESC")
    res.json(devices)
  } catch (error) {
    logger.error("Error fetching devices:", error)
    res.status(500).json({ error: "Failed to fetch devices" })
  }
})

// Get device by ID
router.get("/:id", async (req, res) => {
  try {
    const device = await database.get("SELECT * FROM device_info WHERE id = ?", [req.params.id])

    if (!device) {
      return res.status(404).json({ error: "Device not found" })
    }

    res.json(device)
  } catch (error) {
    logger.error("Error fetching device:", error)
    res.status(500).json({ error: "Failed to fetch device" })
  }
})

// Add new device
router.post("/", async (req, res) => {
  try {
    const { ip_address, hostname, device_type, community } = req.body

    // Validate required fields
    if (!ip_address) {
      return res.status(400).json({ error: "IP address is required" })
    }

    // Validate IP address format
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/
    if (!ipRegex.test(ip_address)) {
      return res.status(400).json({ error: "Invalid IP address format" })
    }

    const result = await database.run(
      `
      INSERT INTO device_info (ip_address, hostname, device_type, community)
      VALUES (?, ?, ?, ?)
    `,
      [ip_address, hostname || "", device_type || "router", community || "public"],
    )

    logger.info(`Added new device: ${ip_address}`)
    res.status(201).json({
      message: "Device added successfully",
      id: result.id,
    })
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "Device with this IP address already exists" })
    }

    logger.error("Error adding device:", error)
    res.status(500).json({ error: "Failed to add device" })
  }
})

// Update device
router.put("/:id", async (req, res) => {
  try {
    const { hostname, device_type, community } = req.body
    const deviceId = req.params.id

    // Check if device exists
    const existingDevice = await database.get("SELECT id FROM device_info WHERE id = ?", [deviceId])
    if (!existingDevice) {
      return res.status(404).json({ error: "Device not found" })
    }

    await database.run(
      `
      UPDATE device_info 
      SET hostname = ?, device_type = ?, community = ?
      WHERE id = ?
    `,
      [hostname, device_type, community, deviceId],
    )

    logger.info(`Updated device ID: ${deviceId}`)
    res.json({ message: "Device updated successfully" })
  } catch (error) {
    logger.error("Error updating device:", error)
    res.status(500).json({ error: "Failed to update device" })
  }
})

// Delete device
router.delete("/:id", async (req, res) => {
  try {
    const deviceId = req.params.id

    // Check if device exists
    const device = await database.get("SELECT ip_address FROM device_info WHERE id = ?", [deviceId])
    if (!device) {
      return res.status(404).json({ error: "Device not found" })
    }

    // Delete device (CASCADE will handle related data)
    await database.run("DELETE FROM device_info WHERE id = ?", [deviceId])

    logger.info(`Deleted device: ${device.ip_address}`)
    res.json({ message: "Device removed successfully" })
  } catch (error) {
    logger.error("Error removing device:", error)
    res.status(500).json({ error: "Failed to remove device" })
  }
})

module.exports = router
