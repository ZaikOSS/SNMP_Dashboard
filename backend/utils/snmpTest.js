const snmp = require("net-snmp");
const logger = require("../logger");

class SNMPTester {
  static async testSNMPv1v2c(
    host,
    community = "public",
    version = "2c",
    port = 161
  ) {
    return new Promise((resolve, reject) => {
      const snmpVersion = version === "1" ? snmp.Version1 : snmp.Version2c;

      const session = snmp.createSession(host, community, {
        port: port,
        retries: 3,
        timeout: 5000,
        version: snmpVersion,
      });

      const testOid = "1.3.6.1.2.1.1.1.0"; // sysDescr

      session.get([testOid], (error, varbinds) => {
        session.close();

        if (error) {
          reject(new Error(`SNMP v${version} test failed: ${error.message}`));
          return;
        }

        const varbind = varbinds[0];
        if (snmp.isVarbindError(varbind)) {
          reject(
            new Error(`SNMP varbind error: ${snmp.varbindError(varbind)}`)
          );
          return;
        }

        resolve({
          success: true,
          version: version,
          systemDescription: varbind.value.toString(),
          message: `SNMP v${version} connection successful`,
        });
      });
    });
  }

  static async testSNMPv3(
    host,
    username,
    authPassword,
    privPassword,
    authProtocol = "MD5",
    privProtocol = "DES",
    securityLevel = "authPriv",
    port = 161
  ) {
    return new Promise((resolve, reject) => {
      try {
        // Enhanced options for better compatibility
        const options = {
          port: port,
          retries: 2,
          timeout: 15000,
          version: snmp.Version3,
          idBitsSize: 32,
          context: "",
          engineID: "", // Let it auto-discover
        };

        const user = {
          name: username,
          level: snmp.SecurityLevel.noAuthNoPriv,
        };

        // Set security level with validation
        const normalizedSecLevel = securityLevel
          .toLowerCase()
          .replace(/[^a-z]/g, "");

        switch (normalizedSecLevel) {
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

        console.log(`Security Level: ${securityLevel} -> ${user.level}`);

        // Add authentication with enhanced validation
        if (user.level !== snmp.SecurityLevel.noAuthNoPriv) {
          if (!authPassword || authPassword.length < 8) {
            reject(
              new Error("Authentication password must be at least 8 characters")
            );
            return;
          }

          const normalizedAuthProtocol = authProtocol.toUpperCase();

          switch (normalizedAuthProtocol) {
            case "MD5":
              user.authProtocol = snmp.AuthProtocols.md5;
              break;
            case "SHA":
            case "SHA1":
              user.authProtocol = snmp.AuthProtocols.sha;
              break;
            case "SHA224":
              user.authProtocol = snmp.AuthProtocols.sha224;
              break;
            case "SHA256":
              user.authProtocol = snmp.AuthProtocols.sha256;
              break;
            case "SHA384":
              user.authProtocol = snmp.AuthProtocols.sha384;
              break;
            case "SHA512":
              user.authProtocol = snmp.AuthProtocols.sha512;
              break;
            default:
              console.log(`Unknown auth protocol ${authProtocol}, using MD5`);
              user.authProtocol = snmp.AuthProtocols.md5;
          }

          user.authKey = authPassword;
          console.log(`Auth Protocol: ${authProtocol} -> ${user.authProtocol}`);
        }

        // Add privacy with enhanced validation
        if (user.level === snmp.SecurityLevel.authPriv) {
          if (!privPassword || privPassword.length < 8) {
            reject(new Error("Privacy password must be at least 8 characters"));
            return;
          }

          const normalizedPrivProtocol = privProtocol.toUpperCase();

          switch (normalizedPrivProtocol) {
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
              console.log(`Unknown priv protocol ${privProtocol}, using DES`);
              user.privProtocol = snmp.PrivProtocols.des;
          }

          user.privKey = privPassword;
          console.log(`Priv Protocol: ${privProtocol} -> ${user.privProtocol}`);
        }

        console.log("Creating SNMPv3 session...");
        console.log(`User config:`, {
          name: user.name,
          level: user.level,
          authProtocol: user.authProtocol,
          privProtocol: user.privProtocol,
          authKeyLength: user.authKey ? user.authKey.length : 0,
          privKeyLength: user.privKey ? user.privKey.length : 0,
        });

        let session;
        try {
          session = snmp.createV3Session(host, user, options);
        } catch (sessionError) {
          console.error("Session creation error:", sessionError);
          reject(
            new Error(
              `Failed to create SNMPv3 session: ${sessionError.message}`
            )
          );
          return;
        }

        console.log("Session created, testing connectivity...");

        const testOid = "1.3.6.1.2.1.1.1.0"; // sysDescr

        // Set up timeout
        const timeout = setTimeout(() => {
          console.log("Test timeout reached");
          try {
            session.close();
          } catch (e) {
            // Ignore close errors
          }
          reject(new Error("SNMPv3 test timeout (15 seconds)"));
        }, 15000);

        // Perform the test
        session.get([testOid], (error, varbinds) => {
          clearTimeout(timeout);

          try {
            session.close();
          } catch (e) {
            // Ignore close errors
          }

          if (error) {
            console.error("SNMP GET error:", error);
            reject(new Error(`SNMPv3 GET failed: ${error.message}`));
            return;
          }

          if (!varbinds || varbinds.length === 0) {
            reject(new Error("No response from SNMPv3 agent"));
            return;
          }

          const varbind = varbinds[0];
          if (snmp.isVarbindError(varbind)) {
            const errorMsg = snmp.varbindError(varbind);
            console.error("Varbind error:", errorMsg);
            reject(new Error(`SNMPv3 varbind error: ${errorMsg}`));
            return;
          }

          console.log("✓ SNMPv3 test successful!");
          resolve({
            success: true,
            version: "3",
            systemDescription: varbind.value.toString(),
            securityLevel: securityLevel,
            username: username,
            message: "SNMPv3 connection successful",
          });
        });
      } catch (error) {
        console.error("Unexpected error:", error);
        reject(new Error(`SNMPv3 test failed: ${error.message}`));
      }
    });
  }

  static async testDevice(deviceConfig) {
    const {
      ip_address,
      snmp_version,
      community,
      snmp_port,
      snmpv3_username,
      snmpv3_auth_password,
      snmpv3_priv_password,
      snmpv3_auth_protocol,
      snmpv3_priv_protocol,
      snmpv3_security_level,
    } = deviceConfig;

    try {
      if (snmp_version === "3") {
        return await this.testSNMPv3(
          ip_address,
          snmpv3_username,
          snmpv3_auth_password,
          snmpv3_priv_password,
          snmpv3_auth_protocol,
          snmpv3_priv_protocol,
          snmpv3_security_level,
          snmp_port
        );
      } else {
        return await this.testSNMPv1v2c(
          ip_address,
          community,
          snmp_version,
          snmp_port
        );
      }
    } catch (error) {
      logger.error(`SNMP test failed for ${ip_address}:`, error);
      throw error;
    }
  }
}

module.exports = SNMPTester;
