const snmp = require("net-snmp");
const cron = require("node-cron");
const { database } = require("./database");
const config = require("./config");
const logger = require("./logger");

class SNMPCollector {
  constructor() {
    this.isRunning = false;
    this.sessions = new Map(); // Store SNMP sessions per device
    this.connectionAttempts = new Map(); // Track connection attempts
  }

  start() {
    if (this.isRunning) {
      logger.warn("SNMP Collector is already running");
      return;
    }

    this.isRunning = true;
    logger.info("Starting SNMP Collector");

    // Test all devices first
    this.testAllDevices();

    // Schedule different collection tasks
    this.scheduleSystemCollection();
    this.scheduleCPUCollection();
    this.scheduleInterfaceCollection();
    this.scheduleEnvironmentalCollection();
    this.scheduleCleanup();
  }

  async testAllDevices() {
    try {
      const devices = await this.getActiveDevices();
      logger.info(`Testing connectivity for ${devices.length} devices`);

      for (const device of devices) {
        await this.testDeviceConnectivity(device);
      }
    } catch (error) {
      logger.error("Error testing devices:", error);
    }
  }

  async testDeviceConnectivity(device) {
    try {
      logger.info(
        `Testing connectivity for ${device.ip_address} (SNMP v${device.snmp_version})`
      );

      // Create a temporary session for testing
      const session = await this.createSession(device);

      // Test with system description OID
      const result = await this.performSNMPGet(
        session,
        "1.3.6.1.2.1.1.1.0",
        device
      );

      if (result) {
        logger.info(
          `✓ Device ${device.ip_address} is reachable: ${result
            .toString()
            .substring(0, 50)}...`
        );
        await this.updateDeviceStatus(device.id, "online");
        return true;
      } else {
        logger.warn(`✗ Device ${device.ip_address} is not responding`);
        await this.updateDeviceStatus(device.id, "unreachable");
        return false;
      }
    } catch (error) {
      logger.error(
        `✗ Device ${device.ip_address} connection failed:`,
        error.message
      );
      await this.updateDeviceStatus(device.id, "error");
      return false;
    }
  }

  async createSession(device) {
    const sessionKey = `${device.ip_address}:${device.snmp_version || "2c"}`;

    // Close existing session if any
    if (this.sessions.has(sessionKey)) {
      try {
        this.sessions.get(sessionKey).close();
      } catch (e) {
        // Ignore close errors
      }
      this.sessions.delete(sessionKey);
    }

    const snmpVersion = device.snmp_version || "2c";
    let session;

    try {
      if (snmpVersion === "3") {
        session = await this.createSNMPv3Session(device);
      } else {
        session = await this.createSNMPv1v2Session(device, snmpVersion);
      }

      // Store session
      this.sessions.set(sessionKey, session);

      // Add error handler
      session.on("error", (error) => {
        logger.error(`SNMP session error for ${device.ip_address}:`, error);
        this.sessions.delete(sessionKey);
      });

      return session;
    } catch (error) {
      logger.error(
        `Failed to create SNMP session for ${device.ip_address}:`,
        error
      );
      throw error;
    }
  }

  async createSNMPv3Session(device) {
    logger.info(`Creating SNMPv3 session for ${device.ip_address}`);

    const options = {
      port: device.snmp_port || 161,
      retries: 3,
      timeout: 10000, // Increased timeout for SNMPv3
      version: snmp.Version3,
      idBitsSize: 32,
      context: "",
    };

    // Create user object
    const user = {
      name: device.snmpv3_username || "admin",
      level: snmp.SecurityLevel.noAuthNoPriv,
    };

    const securityLevel = device.snmpv3_security_level || "authPriv";

    // Set security level
    switch (securityLevel.toLowerCase()) {
      case "noauthnopriv":
        user.level = snmp.SecurityLevel.noAuthNoPriv;
        break;
      case "authnopriv":
        user.level = snmp.SecurityLevel.authNoPriv;
        break;
      case "authpriv":
        user.level = snmp.SecurityLevel.authPriv;
        break;
      default:
        user.level = snmp.SecurityLevel.authPriv;
    }

    logger.info(`SNMPv3 config: user=${user.name}, level=${securityLevel}`);

    // Add authentication if required
    if (user.level !== snmp.SecurityLevel.noAuthNoPriv) {
      const authProtocol = device.snmpv3_auth_protocol || "MD5";
      const authPassword = device.snmpv3_auth_password;

      if (!authPassword) {
        throw new Error("Authentication password is required but not provided");
      }

      switch (authProtocol.toUpperCase()) {
        case "MD5":
          user.authProtocol = snmp.AuthProtocols.md5;
          break;
        case "SHA":
          user.authProtocol = snmp.AuthProtocols.sha;
          break;
        default:
          user.authProtocol = snmp.AuthProtocols.md5;
      }

      user.authKey = authPassword;
      logger.info(
        `SNMPv3 auth: protocol=${authProtocol}, key_length=${authPassword.length}`
      );
    }

    // Add privacy if required
    if (user.level === snmp.SecurityLevel.authPriv) {
      const privProtocol = device.snmpv3_priv_protocol || "DES";
      const privPassword = device.snmpv3_priv_password;

      if (!privPassword) {
        throw new Error("Privacy password is required but not provided");
      }

      switch (privProtocol.toUpperCase()) {
        case "DES":
          user.privProtocol = snmp.PrivProtocols.des;
          break;
        case "AES":
        case "AES128":
          user.privProtocol = snmp.PrivProtocols.aes;
          break;
        case "AES192":
          user.privProtocol = snmp.PrivProtocols.aes192;
          break;
        case "AES256":
          user.privProtocol = snmp.PrivProtocols.aes256;
          break;
        default:
          user.privProtocol = snmp.PrivProtocols.des;
      }

      user.privKey = privPassword;
      logger.info(
        `SNMPv3 priv: protocol=${privProtocol}, key_length=${privPassword.length}`
      );
    }

    try {
      const session = snmp.createV3Session(device.ip_address, user, options);
      logger.info(
        `✓ SNMPv3 session created successfully for ${device.ip_address}`
      );
      return session;
    } catch (error) {
      logger.error(
        `✗ Failed to create SNMPv3 session for ${device.ip_address}:`,
        error
      );
      throw error;
    }
  }

  async createSNMPv1v2Session(device, version) {
    logger.info(`Creating SNMP v${version} session for ${device.ip_address}`);

    const snmpVersion = version === "1" ? snmp.Version1 : snmp.Version2c;
    const community = device.community || "public";

    const options = {
      port: device.snmp_port || 161,
      retries: 3,
      timeout: 5000,
      version: snmpVersion,
    };

    try {
      const session = snmp.createSession(device.ip_address, community, options);
      logger.info(
        `✓ SNMP v${version} session created successfully for ${device.ip_address}`
      );
      return session;
    } catch (error) {
      logger.error(
        `✗ Failed to create SNMP v${version} session for ${device.ip_address}:`,
        error
      );
      throw error;
    }
  }

  async performSNMPGet(session, oid, device) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`SNMP GET timeout for ${device.ip_address}`));
      }, 15000); // 15 second timeout

      session.get([oid], (error, varbinds) => {
        clearTimeout(timeout);

        if (error) {
          logger.error(`SNMP GET error for ${device.ip_address}:`, error);
          reject(error);
          return;
        }

        if (!varbinds || varbinds.length === 0) {
          reject(new Error("No varbinds returned"));
          return;
        }

        const varbind = varbinds[0];

        if (snmp.isVarbindError(varbind)) {
          const errorMsg = snmp.varbindError(varbind);
          logger.error(
            `SNMP varbind error for ${device.ip_address}:`,
            errorMsg
          );
          reject(new Error(errorMsg));
          return;
        }

        resolve(varbind.value);
      });
    });
  }

  async performSNMPWalk(session, oid, device) {
    return new Promise((resolve, reject) => {
      const results = [];
      const timeout = setTimeout(() => {
        reject(new Error(`SNMP WALK timeout for ${device.ip_address}`));
      }, 30000); // 30 second timeout

      session.walk(
        oid,
        (varbinds) => {
          for (const varbind of varbinds) {
            if (snmp.isVarbindError(varbind)) {
              logger.debug(
                `SNMP walk varbind error:`,
                snmp.varbindError(varbind)
              );
            } else {
              results.push({
                oid: varbind.oid,
                value: varbind.value,
              });
            }
          }
        },
        (error) => {
          clearTimeout(timeout);

          if (error) {
            logger.error(`SNMP WALK error for ${device.ip_address}:`, error);
            reject(error);
          } else {
            resolve(results);
          }
        }
      );
    });
  }

  scheduleSystemCollection() {
    cron.schedule("*/5 * * * *", async () => {
      if (!this.isRunning) return;

      try {
        const devices = await this.getActiveDevices();
        for (const device of devices) {
          await this.collectSystemData(device);
        }
      } catch (error) {
        logger.error("Error in system collection:", error);
      }
    });
  }

  scheduleCPUCollection() {
    cron.schedule("* * * * *", async () => {
      if (!this.isRunning) return;

      try {
        const devices = await this.getActiveDevices();
        for (const device of devices) {
          await this.collectCPUData(device);
        }
      } catch (error) {
        logger.error("Error in CPU collection:", error);
      }
    });
  }

  scheduleInterfaceCollection() {
    cron.schedule("*/2 * * * *", async () => {
      if (!this.isRunning) return;

      try {
        const devices = await this.getActiveDevices();
        for (const device of devices) {
          await this.collectInterfaceData(device);
        }
      } catch (error) {
        logger.error("Error in interface collection:", error);
      }
    });
  }

  scheduleEnvironmentalCollection() {
    cron.schedule("*/3 * * * *", async () => {
      if (!this.isRunning) return;

      try {
        const devices = await this.getActiveDevices();
        for (const device of devices) {
          await this.collectEnvironmentalData(device);
        }
      } catch (error) {
        logger.error("Error in environmental collection:", error);
      }
    });
  }

  scheduleCleanup() {
    cron.schedule("0 2 * * *", async () => {
      try {
        await this.cleanupOldData();
      } catch (error) {
        logger.error("Error in data cleanup:", error);
      }
    });
  }

  async getActiveDevices() {
    try {
      const devices = await database.all("SELECT * FROM device_info");
      return devices;
    } catch (error) {
      logger.error("Error fetching devices:", error);
      return [];
    }
  }

  async collectSystemData(device) {
    try {
      logger.debug(`Collecting system data for ${device.ip_address}`);

      const session = await this.createSession(device);
      const systemData = {};

      const systemOids = [
        { key: "sys_descr", oid: config.OIDS.sys_descr },
        { key: "sys_uptime", oid: config.OIDS.sys_uptime },
        { key: "sys_name", oid: config.OIDS.sys_name },
        { key: "sys_location", oid: config.OIDS.sys_location },
        { key: "sys_contact", oid: config.OIDS.sys_contact },
      ];

      for (const { key, oid } of systemOids) {
        try {
          const value = await this.performSNMPGet(session, oid, device);
          systemData[key] = value.toString();
        } catch (error) {
          logger.debug(
            `Failed to get ${key} for ${device.ip_address}:`,
            error.message
          );
        }
      }

      if (Object.keys(systemData).length > 0) {
        await this.saveSnmpData(device.id, "system", systemData);
        await this.updateDeviceStatus(device.id, "online");
        logger.debug(`✓ System data collected for ${device.ip_address}`);
      } else {
        await this.updateDeviceStatus(device.id, "unreachable");
        logger.warn(`✗ No system data collected for ${device.ip_address}`);
      }
    } catch (error) {
      logger.error(
        `Error collecting system data for ${device.ip_address}:`,
        error
      );
      await this.updateDeviceStatus(device.id, "error");
    }
  }

  async collectCPUData(device) {
    try {
      const session = await this.createSession(device);
      const cpuData = {};

      const cpuOids = [
        { key: "cpu_5sec", oid: config.OIDS.cpu_5sec },
        { key: "cpu_1min", oid: config.OIDS.cpu_1min },
        { key: "cpu_5min", oid: config.OIDS.cpu_5min },
      ];

      for (const { key, oid } of cpuOids) {
        try {
          const value = await this.performSNMPGet(session, oid, device);
          cpuData[key] = Number.parseInt(value);
        } catch (error) {
          logger.debug(
            `Failed to get ${key} for ${device.ip_address}:`,
            error.message
          );
        }
      }

      if (Object.keys(cpuData).length > 0) {
        await this.saveSnmpData(device.id, "cpu", cpuData);
        logger.debug(`✓ CPU data collected for ${device.ip_address}`);
      }
    } catch (error) {
      logger.debug(
        `Error collecting CPU data for ${device.ip_address}:`,
        error.message
      );
    }
  }

  async collectEnvironmentalData(device) {
    try {
      const session = await this.createSession(device);
      const envData = {};

      try {
        const temperature = await this.performSNMPGet(
          session,
          config.OIDS.temperature_value,
          device
        );
        if (temperature !== null && temperature !== undefined) {
          envData.temperature_value = Number.parseInt(temperature);
        }
      } catch (error) {
        logger.debug(
          `Failed to get temperature for ${device.ip_address}:`,
          error.message
        );
      }

      try {
        const fanState = await this.performSNMPGet(
          session,
          config.OIDS.fan_state,
          device
        );
        if (fanState !== null && fanState !== undefined) {
          envData.fan_state = Number.parseInt(fanState);
        }
      } catch (error) {
        logger.debug(
          `Failed to get fan state for ${device.ip_address}:`,
          error.message
        );
      }

      if (Object.keys(envData).length > 0) {
        await this.saveSnmpData(device.id, "environmental", envData);
        logger.debug(`✓ Environmental data collected for ${device.ip_address}`);
      }
    } catch (error) {
      logger.debug(
        `Error collecting environmental data for ${device.ip_address}:`,
        error.message
      );
    }
  }

  async collectInterfaceData(device) {
    try {
      const session = await this.createSession(device);

      // Walk interface names
      const interfaceNames = await this.performSNMPWalk(
        session,
        config.OIDS.if_name_base,
        device
      );

      for (const iface of interfaceNames) {
        const oidParts = iface.oid.split(".");
        const interfaceIndex = Number.parseInt(oidParts[oidParts.length - 1]);
        const interfaceName = iface.value.toString();

        if (!interfaceName || interfaceName.trim() === "") {
          continue;
        }

        try {
          const interfaceStats = await this.collectSingleInterfaceStats(
            session,
            device,
            interfaceIndex
          );

          await this.saveInterfaceData(
            device.id,
            interfaceIndex,
            interfaceName,
            interfaceStats.description || interfaceName,
            interfaceStats.adminStatus || "unknown",
            interfaceStats.operStatus || "unknown",
            interfaceStats.speed || 0,
            interfaceStats.type || "unknown",
            interfaceStats.inOctets || 0,
            interfaceStats.outOctets || 0,
            interfaceStats.inPackets || 0,
            interfaceStats.outPackets || 0,
            interfaceStats.inErrors || 0,
            interfaceStats.outErrors || 0
          );
        } catch (error) {
          logger.debug(
            `Error collecting stats for interface ${interfaceName}:`,
            error.message
          );
        }
      }

      logger.debug(
        `✓ Interface data collected for ${device.ip_address}: ${interfaceNames.length} interfaces`
      );
    } catch (error) {
      logger.debug(
        `Error collecting interface data for ${device.ip_address}:`,
        error.message
      );
    }
  }

  async collectSingleInterfaceStats(session, device, interfaceIndex) {
    const stats = {};

    // Get basic interface info
    try {
      const adminStatus = await this.performSNMPGet(
        session,
        `${config.OIDS.if_admin_status_base}.${interfaceIndex}`,
        device
      );
      stats.adminStatus =
        config.INTERFACE_STATUS[Number.parseInt(adminStatus)] || "unknown";
    } catch (error) {
      logger.debug(
        `Failed to get admin status for interface ${interfaceIndex}`
      );
    }

    try {
      const operStatus = await this.performSNMPGet(
        session,
        `${config.OIDS.if_oper_status_base}.${interfaceIndex}`,
        device
      );
      stats.operStatus =
        config.INTERFACE_STATUS[Number.parseInt(operStatus)] || "unknown";
    } catch (error) {
      logger.debug(`Failed to get oper status for interface ${interfaceIndex}`);
    }

    return stats;
  }

  async saveSnmpData(deviceId, metricType, data) {
    try {
      await database.run(
        "INSERT INTO snmp_data (device_id, metric_type, value_json) VALUES (?, ?, ?)",
        [deviceId, metricType, JSON.stringify(data)]
      );
    } catch (error) {
      logger.error("Error saving SNMP data:", error);
    }
  }

  async saveInterfaceData(
    deviceId,
    interfaceIndex,
    interfaceName,
    description,
    adminStatus,
    operStatus,
    speed,
    type,
    inOctets,
    outOctets,
    inPackets,
    outPackets,
    inErrors,
    outErrors
  ) {
    try {
      await database.run(
        `
        INSERT OR REPLACE INTO interface_data 
        (device_id, interface_index, interface_name, interface_description, admin_status, oper_status, 
         interface_speed, interface_type, in_octets, out_octets, in_packets, out_packets, 
         in_errors, out_errors, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
        [
          deviceId,
          interfaceIndex,
          interfaceName,
          description,
          adminStatus,
          operStatus,
          speed,
          type,
          inOctets,
          outOctets,
          inPackets,
          outPackets,
          inErrors,
          outErrors,
        ]
      );
    } catch (error) {
      logger.error("Error saving interface data:", error);
    }
  }

  async updateDeviceStatus(deviceId, status) {
    try {
      await database.run(
        "UPDATE device_info SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?",
        [status, deviceId]
      );
    } catch (error) {
      logger.error("Error updating device status:", error);
    }
  }

  async cleanupOldData() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - config.DATA_RETENTION_DAYS);

      const result = await database.run(
        "DELETE FROM snmp_data WHERE timestamp < ?",
        [cutoffDate.toISOString()]
      );

      if (result.changes > 0) {
        logger.info(`Cleaned up ${result.changes} old SNMP records`);
      }
    } catch (error) {
      logger.error("Error cleaning up old data:", error);
    }
  }

  // Public method for testing device connectivity
  async testDevice(deviceId) {
    try {
      const device = await database.get(
        "SELECT * FROM device_info WHERE id = ?",
        [deviceId]
      );
      if (!device) {
        throw new Error("Device not found");
      }

      return await this.testDeviceConnectivity(device);
    } catch (error) {
      logger.error(`Error testing device ${deviceId}:`, error);
      throw error;
    }
  }

  stop() {
    this.isRunning = false;

    // Close all sessions
    for (const [key, session] of this.sessions) {
      try {
        session.close();
      } catch (error) {
        logger.error(`Error closing session ${key}:`, error);
      }
    }

    this.sessions.clear();
    logger.info("SNMP Collector stopped");
  }
}

const collector = new SNMPCollector();

function startSNMPCollector() {
  collector.start();
}

function stopSNMPCollector() {
  collector.stop();
}

module.exports = {
  startSNMPCollector,
  stopSNMPCollector,
  collector,
};
