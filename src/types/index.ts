
export interface User {
  id: number;
  username: string;
  role: 'admin' | 'visitor';
}

export type DeviceType = 'server' | 'router' | 'switch' | 'laptop' | 'phone' | 'unknown' | 'pc' | 'firewall';

export interface Interface {
    ifDescr: string;
    ifInOctets: string;
    ifOperStatus: string; // "1" is up, "2" is down
    ifOutOctets: string;
    ifPhysAddress?: string; // MAC Address
    ifSpeed?: string;
    ifType?: string;
    // Cisco PoE OIDs
    pethPsePortPowerAllocated?: string; // in milliwatts
    pethPsePortPower?: string; // in milliwatts
}

export interface Device {
  id: number;
  hostname: string;
  ip: string;
  last_seen: string;
  sysdescr: string;
  sysuptime: string;
  interfaces: Interface[];
  // Frontend-specific properties
  status: 'online' | 'offline'; 
  deviceType: DeviceType;
  // Real-time health data from API
  cpu_utilization: number | null;
  ram_utilization: number | null;
  power_supply_status: string | null;
}

export interface DeviceHistory {
    id: number;
    hostname: string;
    ip: string;
    sysdescr: string;
    sysuptime: string;
    timestamp: string;
    total_in_octets: number;
    total_out_octets: number;
    in_throughput_kbps: number | null;
    out_throughput_kbps: number | null;
}

export interface DeviceMetrics {
  timestamp: string;
  dataIn: number; // KB/s
  dataOut: number; // KB/s
}

export interface InterfacePort {
  id:string;
  name: string;
  trafficIn: number; // in KB/s
  trafficOut: number; // in KB/s
  poeWatts: number;
}

export interface Connection {
    id: number;
    source_device_id: number; 
    target_device_id: number; 
    source_interface: string;
    target_interface: string;
}
