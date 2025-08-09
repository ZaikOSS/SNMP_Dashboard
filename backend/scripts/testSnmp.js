#!/usr/bin/env node

// Fix for Node.js 17+ OpenSSL compatibility
process.env.NODE_OPTIONS = "--openssl-legacy-provider";

const SNMPTester = require("../utils/snmpTest");

async function testSNMP() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("SNMP Connectivity Test Tool");
    console.log("===========================");
    console.log("");
    console.log("Usage:");
    console.log(
      "  node testSnmp.js <host> <version> [community] [username] [authPass] [privPass] [authProtocol] [privProtocol] [secLevel]"
    );
    console.log("");
    console.log("Examples:");
    console.log("  SNMP v2c:");
    console.log("    node testSnmp.js 192.168.1.1 2c public");
    console.log("");
    console.log("  SNMP v3 (authPriv):");
    console.log(
      "    node testSnmp.js 192.168.1.1 3 - SNMPv3User SNMPpass SNMPprivpass MD5 DES authPriv"
    );
    console.log("");
    console.log("  SNMP v3 (authNoPriv):");
    console.log(
      "    node testSnmp.js 192.168.1.1 3 - SNMPv3User SNMPpass - MD5 - authNoPriv"
    );
    console.log("");
    console.log("  SNMP v3 (noAuthNoPriv):");
    console.log(
      "    node testSnmp.js 192.168.1.1 3 - SNMPv3User - - - - noAuthNoPriv"
    );
    console.log("");
    process.exit(1);
  }

  const host = args[0];
  const version = args[1];

  console.log("SNMP Connectivity Test");
  console.log("======================");
  console.log(`Target: ${host}`);
  console.log(`Version: SNMP v${version}`);
  console.log("");

  try {
    let result;

    if (version === "3") {
      const username = args[3] || "SNMPv3User";
      const authPass = args[4] && args[4] !== "-" ? args[4] : "";
      const privPass = args[5] && args[5] !== "-" ? args[5] : "";
      const authProtocol = args[6] || "MD5";
      const privProtocol = args[7] || "DES";
      const secLevel = args[8] || "authPriv";

      console.log("SNMPv3 Configuration:");
      console.log(`  Username: ${username}`);
      console.log(`  Security Level: ${secLevel}`);
      console.log(`  Auth Protocol: ${authProtocol}`);
      console.log(`  Auth Password: ${authPass ? "***" : "none"}`);
      console.log(`  Priv Protocol: ${privProtocol}`);
      console.log(`  Priv Password: ${privPass ? "***" : "none"}`);
      console.log("");

      // Validate configuration
      if (secLevel !== "noAuthNoPriv" && !authPass) {
        console.log(
          "✗ ERROR: Authentication password required for security level:",
          secLevel
        );
        process.exit(1);
      }

      if (secLevel === "authPriv" && !privPass) {
        console.log(
          "✗ ERROR: Privacy password required for authPriv security level"
        );
        process.exit(1);
      }

      console.log("Testing SNMPv3 connection...");
      result = await SNMPTester.testSNMPv3(
        host,
        username,
        authPass,
        privPass,
        authProtocol,
        privProtocol,
        secLevel
      );
    } else {
      const community = args[2] || "public";

      console.log("SNMP Configuration:");
      console.log(`  Community: ${community}`);
      console.log("");

      console.log(`Testing SNMP v${version} connection...`);
      result = await SNMPTester.testSNMPv1v2c(host, community, version);
    }

    console.log("");
    console.log("🎉 SUCCESS!");
    console.log("============");
    console.log(`Version: SNMP v${result.version}`);
    console.log(`System Description: ${result.systemDescription}`);
    console.log(`Message: ${result.message}`);

    if (result.securityLevel) {
      console.log(`Security Level: ${result.securityLevel}`);
    }
    if (result.username) {
      console.log(`Username: ${result.username}`);
    }

    console.log("");
    console.log("✓ Your SNMP configuration is working correctly!");
    console.log("  You can now add this device to your dashboard.");

    process.exit(0);
  } catch (error) {
    console.log("");
    console.log("❌ FAILED!");
    console.log("==========");
    console.log(`Error: ${error.message}`);
    console.log("");

    // Provide troubleshooting suggestions
    console.log("Troubleshooting suggestions:");
    console.log("1. Check if the device IP is reachable (ping test)");
    console.log("2. Verify SNMP is enabled on the device");
    console.log("3. Check firewall settings (SNMP uses UDP port 161)");

    if (version === "3") {
      console.log("4. Verify SNMPv3 user configuration on the device:");
      console.log("   - Username matches exactly");
      console.log("   - Authentication password is correct (min 8 chars)");
      console.log("   - Privacy password is correct (min 8 chars)");
      console.log("   - Security level matches device configuration");
      console.log("");
      console.log("Example Cisco router SNMPv3 configuration:");
      console.log("  snmp-server group v3group v3 auth");
      console.log(
        "  snmp-server user SNMPv3User v3group v3 auth md5 SNMPpass priv des SNMPprivpass"
      );
      console.log(
        "  snmp-server host <management-ip> version 3 auth SNMPv3User"
      );
    } else {
      console.log("4. Verify SNMP community string is correct");
      console.log("5. Check if the community has read access");
    }

    process.exit(1);
  }
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.log("");
  console.log("❌ CRITICAL ERROR!");
  console.log("==================");
  console.log(`Unexpected error: ${error.message}`);
  console.log("");
  console.log("This might be a Node.js compatibility issue.");
  console.log(
    "Try running with: NODE_OPTIONS='--openssl-legacy-provider' node testSnmp.js ..."
  );
  process.exit(1);
});

testSNMP();
