module.exports = {
  // SNMP Configuration
  SNMP: {
    COMMUNITY: process.env.SNMP_COMMUNITY || "public",
    PORT: Number.parseInt(process.env.SNMP_PORT) || 161,
    TIMEOUT: Number.parseInt(process.env.SNMP_TIMEOUT) || 5000,
    RETRIES: Number.parseInt(process.env.SNMP_RETRIES) || 3,
    VERSION: process.env.SNMP_VERSION || "2c",
  },

  // SNMPv3 Configuration
  SNMPV3: {
    USERNAME: process.env.SNMPV3_USERNAME || "admin",
    AUTH_PROTOCOL: process.env.SNMPV3_AUTH_PROTOCOL || "MD5", // MD5, SHA, SHA224, SHA256, SHA384, SHA512
    AUTH_PASSWORD: process.env.SNMPV3_AUTH_PASSWORD || "",
    PRIV_PROTOCOL: process.env.SNMPV3_PRIV_PROTOCOL || "DES", // DES, AES, AES192, AES256
    PRIV_PASSWORD: process.env.SNMPV3_PRIV_PASSWORD || "",
    SECURITY_LEVEL: process.env.SNMPV3_SECURITY_LEVEL || "authPriv", // noAuthNoPriv, authNoPriv, authPriv
  },

  // Polling intervals (milliseconds)
  POLLING: {
    SYSTEM: Number.parseInt(process.env.POLL_INTERVAL_SYSTEM) || 300000, // 5 minutes
    CPU: Number.parseInt(process.env.POLL_INTERVAL_CPU) || 60000, // 1 minute
    INTERFACES: Number.parseInt(process.env.POLL_INTERVAL_INTERFACES) || 120000, // 2 minutes
    ENVIRONMENTAL:
      Number.parseInt(process.env.POLL_INTERVAL_ENVIRONMENTAL) || 180000, // 3 minutes
  },

  // Data retention
  DATA_RETENTION_DAYS: Number.parseInt(process.env.DATA_RETENTION_DAYS) || 30,

  // Enhanced SNMP OIDs based on log analysis
  OIDS: {
    // System Information
    sys_descr: "1.3.6.1.2.1.1.1.0",
    sys_uptime: "1.3.6.1.2.1.1.3.0",
    sys_name: "1.3.6.1.2.1.1.5.0",
    sys_location: "1.3.6.1.2.1.1.6.0",
    sys_contact: "1.3.6.1.2.1.1.4.0",

    // CPU Utilization (Cisco specific)
    cpu_5min: "1.3.6.1.4.1.9.9.109.1.1.1.1.8.1",
    cpu_1min: "1.3.6.1.4.1.9.9.109.1.1.1.1.7.1",
    cpu_5sec: "1.3.6.1.4.1.9.9.109.1.1.1.1.6.1",

    // Environmental Monitoring (Cisco specific)
    temperature_value: "1.3.6.1.4.1.9.9.13.1.3.1.3.1",
    fan_state: "1.3.6.1.4.1.9.9.13.1.4.1.3.1",

    // Interface Statistics - Standard MIB
    if_number: "1.3.6.1.2.1.2.1.0", // Number of interfaces
    if_descr_base: "1.3.6.1.2.1.2.2.1.2", // Interface description
    if_type_base: "1.3.6.1.2.1.2.2.1.3", // Interface type
    if_speed_base: "1.3.6.1.2.1.2.2.1.5", // Interface speed
    if_admin_status_base: "1.3.6.1.2.1.2.2.1.7", // Administrative status
    if_oper_status_base: "1.3.6.1.2.1.2.2.1.8", // Operational status

    // 32-bit counters (RFC 1213)
    if_in_octets_base: "1.3.6.1.2.1.2.2.1.10", // Input octets
    if_out_octets_base: "1.3.6.1.2.1.2.2.1.16", // Output octets
    if_in_ucast_pkts_base: "1.3.6.1.2.1.2.2.1.11", // Input unicast packets
    if_out_ucast_pkts_base: "1.3.6.1.2.1.2.2.1.17", // Output unicast packets
    if_in_errors_base: "1.3.6.1.2.1.2.2.1.14", // Input errors
    if_out_errors_base: "1.3.6.1.2.1.2.2.1.20", // Output errors

    // High Capacity (64-bit) counters (RFC 2863)
    if_name_base: "1.3.6.1.2.1.31.1.1.1.1", // Interface name
    if_hc_in_octets_base: "1.3.6.1.2.1.31.1.1.1.6", // High capacity input octets
    if_hc_out_octets_base: "1.3.6.1.2.1.31.1.1.1.10", // High capacity output octets
    if_hc_in_ucast_pkts_base: "1.3.6.1.2.1.31.1.1.1.7", // High capacity input unicast packets
    if_hc_out_ucast_pkts_base: "1.3.6.1.2.1.31.1.1.1.11", // High capacity output unicast packets
    if_high_speed_base: "1.3.6.1.2.1.31.1.1.1.15", // High speed (Mbps)
    if_alias_base: "1.3.6.1.2.1.31.1.1.1.18", // Interface alias

    // Memory Utilization (Cisco specific)
    memory_pool_used: "1.3.6.1.4.1.9.9.48.1.1.1.5.1",
    memory_pool_free: "1.3.6.1.4.1.9.9.48.1.1.1.6.1",
    memory_pool_total: "1.3.6.1.4.1.9.9.48.1.1.1.7.1",
  },

  // Interface types mapping
  INTERFACE_TYPES: {
    1: "other",
    6: "ethernetCsmacd",
    22: "propPointToPointSerial",
    23: "ppp",
    24: "softwareLoopback",
    117: "gigabitEthernet",
    131: "tunnel",
  },

  // Interface status mapping
  INTERFACE_STATUS: {
    1: "up",
    2: "down",
    3: "testing",
    4: "unknown",
    5: "dormant",
    6: "notPresent",
    7: "lowerLayerDown",
  },
};
