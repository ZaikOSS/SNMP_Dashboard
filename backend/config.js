module.exports = {
  // SNMP Configuration
  SNMP: {
    COMMUNITY: process.env.SNMP_COMMUNITY || "public",
    PORT: Number.parseInt(process.env.SNMP_PORT) || 161,
    TIMEOUT: Number.parseInt(process.env.SNMP_TIMEOUT) || 5000,
    RETRIES: Number.parseInt(process.env.SNMP_RETRIES) || 3,
    VERSION: process.env.SNMP_VERSION || "2c",
  },

  // Polling intervals (milliseconds)
  POLLING: {
    SYSTEM: Number.parseInt(process.env.POLL_INTERVAL_SYSTEM) || 300000, // 5 minutes
    CPU: Number.parseInt(process.env.POLL_INTERVAL_CPU) || 60000, // 1 minute
    INTERFACES: Number.parseInt(process.env.POLL_INTERVAL_INTERFACES) || 120000, // 2 minutes
    ENVIRONMENTAL: Number.parseInt(process.env.POLL_INTERVAL_ENVIRONMENTAL) || 180000, // 3 minutes
  },

  // Data retention
  DATA_RETENTION_DAYS: Number.parseInt(process.env.DATA_RETENTION_DAYS) || 30,

  // SNMP OIDs
  OIDS: {
    sys_descr: "1.3.6.1.2.1.1.1.0",
    sys_uptime: "1.3.6.1.2.1.1.3.0",
    cpu_5min: "1.3.6.1.4.1.9.9.109.1.1.1.1.8.1",
    temperature_value: "1.3.6.1.4.1.9.9.13.1.3.1.3.1",
    fan_state: "1.3.6.1.4.1.9.9.13.1.4.1.3.1",
    if_name_base: "1.3.6.1.2.1.31.1.1.1.1",
    if_admin_status_base: "1.3.6.1.2.1.2.2.1.7",
    if_oper_status_base: "1.3.6.1.2.1.2.2.1.8",
  },
}
