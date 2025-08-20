import json
from pysnmp.hlapi import (
    SnmpEngine,
    UsmUserData,
    UdpTransportTarget,
    ContextData,
    ObjectType,
    ObjectIdentity,
    usmHMACMD5AuthProtocol,
    usmAesCfb128Protocol,
    getCmd,
    nextCmd
)
from db import insert_device, insert_history, get_latest_device_history
from datetime import datetime
from ping3 import ping

# --- OID Definitions ---
# Separate OIDs for different vendors
CISCO_OIDS = {
    "hostname": "1.3.6.1.2.1.1.5.0",
    "sysdescr": "1.3.6.1.2.1.1.1.0",
    "sysuptime": "1.3.6.1.2.1.1.3.0",
    "cpuUtilization": "1.3.6.1.4.1.9.9.109.1.1.1.1.8.1", # cpmCPUTotal5minRev
    "ciscoMemoryPoolUsed": "1.3.6.1.4.1.9.9.48.1.1.1.5.1",
    "ciscoMemoryPoolFree": "1.3.6.1.4.1.9.9.48.1.1.1.6.1",
    "powerSupplyStatus": "1.3.6.1.4.1.9.9.13.1.5.1.3.1",
    "fanStatus": "1.3.6.1.4.1.9.9.13.1.4.1.3.1"
}

HP_OIDS = {
    "hostname": "1.3.6.1.2.1.1.5.0",
    "sysdescr": "1.3.6.1.2.1.1.1.0",
    "sysuptime": "1.3.6.1.2.1.1.3.0",
    "cpuUtilization": "1.3.6.1.4.1.11.2.14.5.1.9.0",
    "ramUtilization": "1.3.6.1.4.1.11.2.14.5.1.10.1.3.1",
    "powerSupplyStatus": "1.3.6.1.4.1.11.2.14.5.1.7.1.3.1",
    "fanStatus": "1.3.6.1.4.1.25506.13.1.2.4.7.3.0"
}

# General OIDs (typically common across vendors)
INTERFACE_OIDS = {
    "ifDescr": "1.3.6.1.2.1.2.2.1.2",
    "ifType": "1.3.6.1.2.1.2.2.1.3",
    "ifOperStatus": "1.3.6.1.2.1.2.2.1.8",
    "ifPhysAddress": "1.3.6.1.2.1.2.2.1.6",
    "ifInOctets": "1.3.6.1.2.1.2.2.1.10",
    "ifOutOctets": "1.3.6.1.2.1.2.2.1.16",
}
POE_OIDS = {
    "pethPsePortPower": "1.3.6.1.2.1.105.1.3.1.1.5"
}
INTERFACE_TYPE_MAP = {
    '6': 'ethernetCsmacd',
    '71': 'ieee80211',
    '117': 'gigabitEthernet',
    '135': 'l2vlan',
}

# --- Helper Functions ---
def format_mac_address(value):
    """Formats a MAC address string from PySNMP into a standard format."""
    if not value:
        return None
    
    if hasattr(value, 'asOctets'):
        value = value.asOctets()
    
    if isinstance(value, str):
        if ':' in value or '-' in value:
            return value.upper()
        try:
            return ':'.join(f'{ord(c):02x}' for c in value).upper()
        except TypeError:
            return str(value)
    
    if isinstance(value, bytes):
        return ':'.join(f'{b:02x}' for b in value).upper()
    
    return str(value)

def snmp_get(ip, user, auth_key, priv_key, oids):
    """Performs an SNMP GET to retrieve specific OID values."""
    try:
        errorIndication, errorStatus, errorIndex, varBinds = next(
            getCmd(
                SnmpEngine(),
                UsmUserData(user, authKey=auth_key, privKey=priv_key, authProtocol=usmHMACMD5AuthProtocol, privProtocol=usmAesCfb128Protocol),
                UdpTransportTarget((ip, 161), timeout=2, retries=1),
                ContextData(),
                *[ObjectType(ObjectIdentity(oid)) for oid in oids]
            )
        )
        if errorIndication or errorStatus:
            return None, str(errorIndication or errorStatus.prettyPrint())
        return varBinds, None
    except Exception as e:
        return None, f"SNMP GET query failed: {str(e)}"

def snmp_walk(ip, user, auth_key, priv_key, oid):
    """Performs an SNMP WALK to retrieve all values from a table OID."""
    results = {}
    try:
        for (errorIndication, errorStatus, errorIndex, varBinds) in nextCmd(
            SnmpEngine(),
            UsmUserData(user, authKey=auth_key, privKey=priv_key, authProtocol=usmHMACMD5AuthProtocol, privProtocol=usmAesCfb128Protocol),
            UdpTransportTarget((ip, 161)),
            ContextData(),
            ObjectType(ObjectIdentity(oid)),
            lexicographicMode=False
        ):
            if errorIndication or errorStatus:
                return None, str(errorIndication or errorStatus.prettyPrint())
            for varBind in varBinds:
                port_index = str(varBind[0]).split('.')[-1]
                results[port_index] = varBind[1]
        return results, None
    except Exception as e:
        return None, f"SNMP WALK query failed: {str(e)}"

# --- Main Logic ---
def get_device_details(ip, user, auth_key, priv_key, vendor):
    """Main function to query all device details."""
    if ping(ip, timeout=1) is None:
        return {"status": "offline", "message": f"Device at {ip} is unreachable."}

    # Select OID set based on vendor
    vendor = vendor.lower()
    if vendor == "cisco":
        vendor_oids = CISCO_OIDS
    elif vendor == "hp":
        vendor_oids = HP_OIDS
    else:
        return {"status": "error", "message": "Unsupported vendor specified."}

    results = {"status": "success", "data": {}}
    all_scalar_oids = [
        vendor_oids["hostname"],
        vendor_oids["sysdescr"],
        vendor_oids["sysuptime"],
        vendor_oids["cpuUtilization"],
        vendor_oids["powerSupplyStatus"],
        vendor_oids["fanStatus"]
    ]
    if vendor == "cisco":
        all_scalar_oids.append(vendor_oids["ciscoMemoryPoolUsed"])
        all_scalar_oids.append(vendor_oids["ciscoMemoryPoolFree"])
    elif vendor == "hp":
        all_scalar_oids.append(vendor_oids["ramUtilization"])
    
    varbinds, error = snmp_get(ip, user, auth_key, priv_key, all_scalar_oids)

    if error:
        results["status"] = "error"
        results.setdefault("errors", []).append({"operation": "snmp_get", "message": error})
        return results

    varbinds_map = {str(vb[0]): vb[1] for vb in varbinds}
    
    # Base info
    results["data"]["hostname"] = str(varbinds_map.get(vendor_oids["hostname"]))
    results["data"]["sysdescr"] = str(varbinds_map.get(vendor_oids["sysdescr"]))
    results["data"]["sysuptime"] = str(varbinds_map.get(vendor_oids["sysuptime"]))

    # System Health
    try:
        cpu_val = varbinds_map.get(vendor_oids["cpuUtilization"])
        results["data"]["cpu_utilization"] = int(cpu_val) if cpu_val else None
    except (ValueError, TypeError):
        results["data"]["cpu_utilization"] = None

    try:
        if vendor == "cisco":
            used_ram_str = varbinds_map.get(vendor_oids["ciscoMemoryPoolUsed"])
            free_ram_str = varbinds_map.get(vendor_oids["ciscoMemoryPoolFree"])
            if used_ram_str is not None and free_ram_str is not None:
                used_ram = float(str(used_ram_str))
                free_ram = float(str(free_ram_str))
                total_ram = used_ram + free_ram
                results["data"]["ram_utilization"] = round((used_ram / total_ram) * 100, 2) if total_ram > 0 else 0
            else:
                results["data"]["ram_utilization"] = None
        elif vendor == "hp":
            ram_util_val = varbinds_map.get(vendor_oids["ramUtilization"])
            results["data"]["ram_utilization"] = float(ram_util_val) if ram_util_val else None
    except (ValueError, TypeError):
        results["data"]["ram_utilization"] = None

    try:
        power_val = varbinds_map.get(vendor_oids["powerSupplyStatus"])
        if vendor == "cisco":
            power_status_map = {"1": "Normal", "2": "Warning", "3": "Critical"}
            results["data"]["power_supply_status"] = power_status_map.get(str(power_val), "Unknown") if power_val is not None else "Unknown"
        elif vendor == "hp":
            hp_power_status_map = {"1": "ok", "2": "failed", "3": "not_installed"}
            results["data"]["power_supply_status"] = hp_power_status_map.get(str(power_val), "Unknown") if power_val is not None else "Unknown"
    except (ValueError, TypeError):
        results["data"]["power_supply_status"] = "Unknown"

    try:
        fan_val = varbinds_map.get(vendor_oids["fanStatus"])
        if vendor == "cisco":
            fan_status_map = {"1": "Normal", "2": "Warning", "3": "Critical", "4": "Shutdown", "5": "Not Present"}
            results["data"]["fan_status"] = fan_status_map.get(str(fan_val), "Unknown") if fan_val is not None else "Unknown"
        elif vendor == "hp":
            hp_fan_status_map = {"1": "ok", "2": "warning", "3": "failed"}
            results["data"]["fan_status"] = hp_fan_status_map.get(str(fan_val), "Unknown") if fan_val is not None else "Unknown"
    except (ValueError, TypeError):
        results["data"]["fan_status"] = "Unknown"

    # Interface Details
    interfaces = {}
    total_in_octets, total_out_octets = 0, 0
    
    all_interface_data = {}
    for key, oid in INTERFACE_OIDS.items():
        table_data, error = snmp_walk(ip, user, auth_key, priv_key, oid)
        if error:
            results["status"] = "partial"
            results.setdefault("errors", []).append({"oid": key, "message": error})
        elif table_data:
            all_interface_data[key] = table_data

    if "ifDescr" in all_interface_data:
        for port_index in all_interface_data["ifDescr"].keys():
            interfaces[port_index] = {
                "ifDescr": str(all_interface_data.get("ifDescr", {}).get(port_index, "")),
                "ifType": INTERFACE_TYPE_MAP.get(str(all_interface_data.get("ifType", {}).get(port_index, "")), "unknown"),
                "ifOperStatus": str(all_interface_data.get("ifOperStatus", {}).get(port_index, "2")), # Default to down
                "ifPhysAddress": format_mac_address(all_interface_data.get("ifPhysAddress", {}).get(port_index)),
                "ifInOctets": str(all_interface_data.get("ifInOctets", {}).get(port_index, "0")),
                "ifOutOctets": str(all_interface_data.get("ifOutOctets", {}).get(port_index, "0")),
            }
            total_in_octets += int(interfaces[port_index]["ifInOctets"])
            total_out_octets += int(interfaces[port_index]["ifOutOctets"])

    poe_data, _ = snmp_walk(ip, user, auth_key, priv_key, POE_OIDS["pethPsePortPower"])
    if poe_data:
        for port_index, value in poe_data.items():
            if port_index in interfaces:
                interfaces[port_index]["pethPsePortPower"] = str(value)

    results["data"]["interfaces"] = list(interfaces.values())
    
    # Calculate throughput
    in_throughput_kbps, out_throughput_kbps = 0, 0
    history = get_latest_device_history(ip)
    if history and len(history) == 2:
        prev_record = history[1]
        time_format = '%Y-%m-%d %H:%M:%S'
        try:
            time_diff = (datetime.now() - datetime.strptime(prev_record['timestamp'].split('.')[0], time_format)).total_seconds()
        except ValueError:
            time_diff = (datetime.now() - datetime.strptime(prev_record['timestamp'], time_format)).total_seconds()
            
        if time_diff > 0:
            in_oct_diff = total_in_octets - prev_record['total_in_octets']
            out_oct_diff = total_out_octets - prev_record['total_out_octets']
            in_throughput_kbps = round((in_oct_diff * 8) / (time_diff * 1024), 2)
            out_throughput_kbps = round((out_oct_diff * 8) / (time_diff * 1024), 2)

    # Database operations
    hostname = results["data"].get("hostname")
    if hostname:
        try:
            insert_device(
                ip, hostname, results["data"]["sysdescr"], results["data"]["sysuptime"],
                json.dumps(results["data"]["interfaces"]),
                results["data"]["cpu_utilization"], results["data"]["ram_utilization"],
                results["data"]["power_supply_status"],
                results["data"]["fan_status"],
                ip,
                vendor
            )
            insert_history(
                ip, hostname, results["data"]["sysdescr"], results["data"]["sysuptime"],
                total_in_octets, total_out_octets,
                in_throughput_kbps, out_throughput_kbps,
                results["data"]["cpu_utilization"], results["data"]["ram_utilization"]
            )
        except Exception as e:
            results["status"] = "partial"
            results.setdefault("errors", []).append({"operation": "database_insert", "message": str(e)})

    return results