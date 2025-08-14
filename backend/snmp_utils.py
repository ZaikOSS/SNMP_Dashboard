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

# --- OID Definitions ---
# Standard OIDs for basic device information
BASE_OIDS = {
    "hostname": "1.3.6.1.2.1.1.5.0",
    "sysdescr": "1.3.6.1.2.1.1.1.0",
    "sysuptime": "1.3.6.1.2.1.1.3.0",
    "sysobjectid": "1.3.6.1.2.1.1.2.0"
}

# OIDs for walking interface tables
INTERFACE_OIDS = {
    "ifDescr": "1.3.6.1.2.1.2.2.1.2",
    "ifType": "1.3.6.1.2.1.2.2.1.3",
    "ifOperStatus": "1.3.6.1.2.1.2.2.1.8",
    "ifInOctets": "1.3.6.1.2.1.2.2.1.10",
    "ifOutOctets": "1.3.6.1.2.1.2.2.1.16"
}

# Cisco-specific PoE OIDs
POE_OIDS = {
    "pethPsePortPowerAllocated": "1.3.6.1.2.1.105.1.3.1.1.4",
    "pethPsePortPower": "1.3.6.1.2.1.105.1.3.1.1.5"
}

# OIDs for System Health (CPU, RAM, Power)
# These are common examples and may NOT work for your specific device.
# You will likely need to find the correct OIDs from your vendor's MIB files.
SYSTEM_HEALTH_OIDS = {
    # Example for CPU: From HOST-RESOURCES-MIB, often needs the specific processor index.
    # This OID is a placeholder and almost certainly needs to be changed.
    "cpuUtilization": "1.3.6.1.4.1.9.2.1.57.0",
    
    # Common Cisco OIDs for RAM, specific to memory pool with index 1
    "ciscoMemoryPoolUsed": "1.3.6.1.4.1.9.9.48.1.1.1.5.1",
    "ciscoMemoryPoolFree": "1.3.6.1.4.1.9.9.48.1.1.1.6.1",

    # Example for Power Supply: From CISCO-ENVMON-MIB for the first power supply (index .1)
    "powerSupplyStatus": "1.3.6.1.4.1.9.9.13.1.5.1.3.1"
}

# --- SNMP Core Functions ---
def snmp_get_single(ip, user, auth_key, priv_key, oid):
    """Performs an SNMP GET for a single OID."""
    try:
        iterator = getCmd(
            SnmpEngine(),
            UsmUserData(user, authKey=auth_key, privKey=priv_key, authProtocol=usmHMACMD5AuthProtocol, privProtocol=usmAesCfb128Protocol),
            UdpTransportTarget((ip, 161), timeout=5, retries=2),
            ContextData(),
            ObjectType(ObjectIdentity(oid))
        )
        errorIndication, errorStatus, errorIndex, varBinds = next(iterator)
        if errorIndication: return None, str(errorIndication)
        if errorStatus: return None, errorStatus.prettyPrint()
        return str(varBinds[0][1]), None
    except Exception as e:
        return None, f"SNMP GET query failed: {str(e)}"

def snmp_walk(ip, user, auth_key, priv_key, oid):
    """Performs an SNMP WALK to retrieve all values from a table OID."""
    results = {}
    try:
        for (errorIndication,
             errorStatus,
             errorIndex,
             varBinds) in nextCmd(SnmpEngine(),
                                  UsmUserData(user, authKey=auth_key, privKey=priv_key, authProtocol=usmHMACMD5AuthProtocol, privProtocol=usmAesCfb128Protocol),
                                  UdpTransportTarget((ip, 161)),
                                  ContextData(),
                                  ObjectType(ObjectIdentity(oid)),
                                  lexicographicMode=False):
            if errorIndication:
                return None, str(errorIndication)
            elif errorStatus:
                return None, errorStatus.prettyPrint()
            else:
                for varBind in varBinds:
                    port_index = str(varBind[0]).split('.')[-1]
                    results[port_index] = str(varBind[1])
        return results, None
    except Exception as e:
        return None, f"SNMP WALK query failed: {str(e)}"

# --- Main Logic ---
def get_device_details(ip, user, auth_key, priv_key):
    """Main function to query all device details."""
    results = {"status": "success", "data": {}}
    
    # 1. Get base device info
    for key, oid in BASE_OIDS.items():
        value, error = snmp_get_single(ip, user, auth_key, priv_key, oid)
        if error:
            results["status"] = "partial"
            results.setdefault("errors", []).append({"oid": oid, "message": error})
        results["data"][key] = value

    # 2. Get System Health (CPU, RAM, Power)
    cpu_val, _ = snmp_get_single(ip, user, auth_key, priv_key, SYSTEM_HEALTH_OIDS["cpuUtilization"])
    results["data"]["cpu_utilization"] = float(cpu_val) if cpu_val else None
    
    used_ram_str, _ = snmp_get_single(ip, user, auth_key, priv_key, SYSTEM_HEALTH_OIDS["ciscoMemoryPoolUsed"])
    free_ram_str, _ = snmp_get_single(ip, user, auth_key, priv_key, SYSTEM_HEALTH_OIDS["ciscoMemoryPoolFree"])
    if used_ram_str and free_ram_str:
        used_ram = float(used_ram_str)
        free_ram = float(free_ram_str)
        total_ram = used_ram + free_ram
        if total_ram > 0:
            ram_percentage = (used_ram / total_ram) * 100
            results["data"]["ram_utilization"] = round(ram_percentage, 2)
    else:
        results["data"]["ram_utilization"] = None

    power_val, _ = snmp_get_single(ip, user, auth_key, priv_key, SYSTEM_HEALTH_OIDS["powerSupplyStatus"])
    power_status_map = {"1": "Normal", "2": "Warning", "3": "Critical", "4": "Shutdown", "5": "Not Present", "6": "Not Functioning"}
    results["data"]["power_supply_status"] = power_status_map.get(power_val, "Unknown") if power_val else "Unknown"

    # 3. Get Interface Details and calculate total throughput
    interfaces = {}
    total_in_octets = 0
    total_out_octets = 0
    for key, oid in INTERFACE_OIDS.items():
        table_data, error = snmp_walk(ip, user, auth_key, priv_key, oid)
        if error:
            results["status"] = "partial"
            results.setdefault("errors", []).append({"oid": oid, "message": error})
        elif table_data:
            for port_index, value in table_data.items():
                if port_index not in interfaces:
                    interfaces[port_index] = {}
                interfaces[port_index][key] = value
                if key == "ifInOctets":
                    total_in_octets += int(value)
                elif key == "ifOutOctets":
                    total_out_octets += int(value)
    
    # 4. Get PoE Details (if device is Cisco)
    if "cisco" in (results["data"].get("sysdescr") or "").lower():
        for key, oid in POE_OIDS.items():
            poe_data, _ = snmp_walk(ip, user, auth_key, priv_key, oid)
            if poe_data:
                for port_index, value in poe_data.items():
                    if port_index in interfaces:
                        interfaces[port_index][key] = value

    results["data"]["interfaces"] = list(interfaces.values())
    
    # 5. Calculate real-time throughput from last two records
    in_throughput_kbps = 0
    out_throughput_kbps = 0
    history = get_latest_device_history(ip)
    
    if len(history) == 2:
        # history[0] is the most recent record, history[1] is the previous one
        time_format = '%Y-%m-%d %H:%M:%S'
        current_time = datetime.strptime(history[0]['timestamp'].split('.')[0], time_format)
        previous_time = datetime.strptime(history[1]['timestamp'].split('.')[0], time_format)
        time_diff_seconds = (current_time - previous_time).total_seconds()
        
        in_octets_diff = total_in_octets - history[1]['total_in_octets']
        out_octets_diff = total_out_octets - history[1]['total_out_octets']
        
        if time_diff_seconds > 0:
            in_throughput_kbps = (in_octets_diff) / (1024 * time_diff_seconds)
            out_throughput_kbps = (out_octets_diff) / (1024 * time_diff_seconds)

    # 6. Store results in the database
    hostname = results["data"].get("hostname")
    if hostname:
        try:
            interfaces_json = json.dumps(results["data"]["interfaces"])
            insert_device(
                ip, 
                hostname, 
                results["data"].get("sysdescr"), 
                results["data"].get("sysuptime"),
                interfaces_json,
                results["data"].get("cpu_utilization"),
                results["data"].get("ram_utilization"),
                results["data"].get("power_supply_status")
            )
            insert_history(
                ip, 
                hostname, 
                results["data"].get("sysdescr"), 
                results["data"].get("sysuptime"),
                total_in_octets,
                total_out_octets,
                round(in_throughput_kbps, 2),
                round(out_throughput_kbps, 2)
            )
        except Exception as e:
            results["status"] = "partial"
            results.setdefault("errors", []).append({"operation": "database_insert", "message": str(e)})
            
    return results
