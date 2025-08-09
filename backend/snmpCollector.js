const snmp = require("net-snmp")
const cron = require("node-cron")
const { database } = require("./database")
const config = require("./config")
const logger = require("./logger")

class SNMPCollector {
  constructor() {
    this.isRunning = false
    this.sessions = new Map() // Store SNMP sessions per device
  }

  start() {
    if (this.isRunning) {
      logger.warn("SNMP Collector is already running")
      return
    }

    this.isRunning = true
    logger.info("Starting SNMP Collector")

    // Schedule different collection tasks
    this.scheduleSystemCollection()
    this.scheduleCPUCollection()
    this.scheduleInterfaceCollection()
    this.scheduleEnvironmentalCollection()
    this.scheduleCleanup()
  }

  scheduleSystemCollection() {
    // Collect system data every 5 minutes
    cron.schedule("*/5 * * * *", async () => {
      if (!this.isRunning) return

      try {
        const devices = await this.getActiveDevices()
        for (const device of devices) {
          await this.collectSystemData(device)
        }
      } catch (error) {
        logger.error("Error in system collection:", error)
      }
    })
  }

  scheduleCPUCollection() {
    // Collect CPU data every minute
    cron.schedule("* * * * *", async () => {
      if (!this.isRunning) return

      try {
        const devices = await this.getActiveDevices()
        for (const device of devices) {
          await this.collectCPUData(device)
        }
      } catch (error) {
        logger.error("Error in CPU collection:", error)
      }
    })
  }

  scheduleInterfaceCollection() {
    // Collect interface data every 2 minutes
    cron.schedule("*/2 * * * *", async () => {
      if (!this.isRunning) return

      try {
        const devices = await this.getActiveDevices()
        for (const device of devices) {
          await this.collectInterfaceData(device)
        }
      } catch (error) {
        logger.error("Error in interface collection:", error)
      }
    })
  }

  scheduleEnvironmentalCollection() {
    // Collect environmental data every 3 minutes
    cron.schedule("*/3 * * * *", async () => {
      if (!this.isRunning) return

      try {
        const devices = await this.getActiveDevices()
        for (const device of devices) {
          await this.collectEnvironmentalData(device)
        }
      } catch (error) {
        logger.error("Error in environmental collection:", error)
      }
    })
  }

  scheduleCleanup() {
    // Clean up old data daily at 2 AM
    cron.schedule("0 2 * * *", async () => {
      try {
        await this.cleanupOldData()
      } catch (error) {
        logger.error("Error in data cleanup:", error)
      }
    })
  }

  async getActiveDevices() {
    try {
      const devices = await database.all("SELECT * FROM device_info")
      return devices
    } catch (error) {
      logger.error("Error fetching devices:", error)
      return []
    }
  }

  getSession(device) {
    const sessionKey = `${device.ip_address}:${device.community}`

    if (!this.sessions.has(sessionKey)) {
      const session = snmp.createSession(device.ip_address, device.community, {
        port: config.SNMP.PORT,
        retries: config.SNMP.RETRIES,
        timeout: config.SNMP.TIMEOUT,
        version: snmp.Version2c,
      })

      this.sessions.set(sessionKey, session)
    }

    return this.sessions.get(sessionKey)
  }

  async snmpGet(device, oid) {
    return new Promise((resolve, reject) => {
      const session = this.getSession(device)

      session.get([oid], (error, varbinds) => {
        if (error) {
          reject(error)
        } else {
          const varbind = varbinds[0]
          if (snmp.isVarbindError(varbind)) {
            reject(new Error(snmp.varbindError(varbind)))
          } else {
            resolve(varbind.value)
          }
        }
      })
    })
  }

  async snmpWalk(device, oid) {
    return new Promise((resolve, reject) => {
      const session = this.getSession(device)
      const results = []

      session.walk(
        oid,
        (varbinds) => {
          for (const varbind of varbinds) {
            if (snmp.isVarbindError(varbind)) {
              logger.warn(`SNMP walk error for ${oid}:`, snmp.varbindError(varbind))
            } else {
              results.push({
                oid: varbind.oid,
                value: varbind.value,
              })
            }
          }
        },
        (error) => {
          if (error) {
            reject(error)
          } else {
            resolve(results)
          }
        },
      )
    })
  }

  async collectSystemData(device) {
    try {
      const systemData = {}

      // Get system description
      try {
        const sysDescr = await this.snmpGet(device, config.OIDS.sys_descr)
        systemData.sys_descr = sysDescr.toString()
      } catch (error) {
        logger.debug(`Failed to get system description for ${device.ip_address}:`, error.message)
      }

      // Get system uptime
      try {
        const sysUptime = await this.snmpGet(device, config.OIDS.sys_uptime)
        systemData.sys_uptime = sysUptime.toString()
      } catch (error) {
        logger.debug(`Failed to get system uptime for ${device.ip_address}:`, error.message)
      }

      if (Object.keys(systemData).length > 0) {
        await this.saveSnmpData(device.id, "system", systemData)
        await this.updateDeviceStatus(device.id, "online")
        logger.debug(`Collected system data for ${device.ip_address}`)
      }
    } catch (error) {
      logger.error(`Error collecting system data for ${device.ip_address}:`, error)
      await this.updateDeviceStatus(device.id, "error")
    }
  }

  async collectCPUData(device) {
    try {
      const cpuValue = await this.snmpGet(device, config.OIDS.cpu_5min)

      if (cpuValue !== null && cpuValue !== undefined) {
        const cpuData = { cpu_5min: Number.parseInt(cpuValue) }
        await this.saveSnmpData(device.id, "cpu", cpuData)
        logger.debug(`Collected CPU data for ${device.ip_address}: ${cpuValue}%`)
      }
    } catch (error) {
      logger.debug(`Error collecting CPU data for ${device.ip_address}:`, error.message)
    }
  }

  async collectEnvironmentalData(device) {
    try {
      const envData = {}

      // Get temperature
      try {
        const temperature = await this.snmpGet(device, config.OIDS.temperature_value)
        if (temperature !== null && temperature !== undefined) {
          envData.temperature_value = Number.parseInt(temperature)
        }
      } catch (error) {
        logger.debug(`Failed to get temperature for ${device.ip_address}:`, error.message)
      }

      // Get fan state
      try {
        const fanState = await this.snmpGet(device, config.OIDS.fan_state)
        if (fanState !== null && fanState !== undefined) {
          envData.fan_state = Number.parseInt(fanState)
        }
      } catch (error) {
        logger.debug(`Failed to get fan state for ${device.ip_address}:`, error.message)
      }

      if (Object.keys(envData).length > 0) {
        await this.saveSnmpData(device.id, "environmental", envData)
        logger.debug(`Collected environmental data for ${device.ip_address}`)
      }
    } catch (error) {
      logger.debug(`Error collecting environmental data for ${device.ip_address}:`, error.message)
    }
  }

  async collectInterfaceData(device) {
    try {
      // Walk interface names
      const interfaceNames = await this.snmpWalk(device, config.OIDS.if_name_base)

      for (const iface of interfaceNames) {
        const oidParts = iface.oid.split(".")
        const interfaceIndex = Number.parseInt(oidParts[oidParts.length - 1])
        const interfaceName = iface.value.toString()

        // Get admin status
        let adminStatus = "unknown"
        try {
          const adminStatusOid = `${config.OIDS.if_admin_status_base}.${interfaceIndex}`
          const adminStatusValue = await this.snmpGet(device, adminStatusOid)
          adminStatus = this.statusToString(adminStatusValue)
        } catch (error) {
          logger.debug(`Failed to get admin status for interface ${interfaceIndex}:`, error.message)
        }

        // Get operational status
        let operStatus = "unknown"
        try {
          const operStatusOid = `${config.OIDS.if_oper_status_base}.${interfaceIndex}`
          const operStatusValue = await this.snmpGet(device, operStatusOid)
          operStatus = this.statusToString(operStatusValue)
        } catch (error) {
          logger.debug(`Failed to get oper status for interface ${interfaceIndex}:`, error.message)
        }

        // Save interface data
        await this.saveInterfaceData(device.id, interfaceIndex, interfaceName, adminStatus, operStatus)
      }

      logger.debug(`Collected interface data for ${device.ip_address}: ${interfaceNames.length} interfaces`)
    } catch (error) {
      logger.debug(`Error collecting interface data for ${device.ip_address}:`, error.message)
    }
  }

  statusToString(statusCode) {
    const statusMap = {
      1: "up",
      2: "down",
      3: "testing",
      4: "unknown",
      5: "dormant",
      6: "notPresent",
      7: "lowerLayerDown",
    }

    return statusMap[Number.parseInt(statusCode)] || "unknown"
  }

  async saveSnmpData(deviceId, metricType, data) {
    try {
      await database.run("INSERT INTO snmp_data (device_id, metric_type, value_json) VALUES (?, ?, ?)", [
        deviceId,
        metricType,
        JSON.stringify(data),
      ])
    } catch (error) {
      logger.error("Error saving SNMP data:", error)
    }
  }

  async saveInterfaceData(deviceId, interfaceIndex, interfaceName, adminStatus, operStatus) {
    try {
      await database.run(
        `
        INSERT OR REPLACE INTO interface_data 
        (device_id, interface_index, interface_name, admin_status, oper_status, last_updated)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
        [deviceId, interfaceIndex, interfaceName, adminStatus, operStatus],
      )
    } catch (error) {
      logger.error("Error saving interface data:", error)
    }
  }

  async updateDeviceStatus(deviceId, status) {
    try {
      await database.run("UPDATE device_info SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?", [
        status,
        deviceId,
      ])
    } catch (error) {
      logger.error("Error updating device status:", error)
    }
  }

  async cleanupOldData() {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - config.DATA_RETENTION_DAYS)

      const result = await database.run("DELETE FROM snmp_data WHERE timestamp < ?", [cutoffDate.toISOString()])

      if (result.changes > 0) {
        logger.info(`Cleaned up ${result.changes} old SNMP records`)
      }
    } catch (error) {
      logger.error("Error cleaning up old data:", error)
    }
  }

  stop() {
    this.isRunning = false

    // Close all SNMP sessions
    for (const [key, session] of this.sessions) {
      try {
        session.close()
      } catch (error) {
        logger.error(`Error closing SNMP session ${key}:`, error)
      }
    }

    this.sessions.clear()
    logger.info("SNMP Collector stopped")
  }
}

const collector = new SNMPCollector()

function startSNMPCollector() {
  collector.start()
}

function stopSNMPCollector() {
  collector.stop()
}

module.exports = {
  startSNMPCollector,
  stopSNMPCollector,
  collector,
}
