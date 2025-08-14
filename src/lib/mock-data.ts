
import { Device, DeviceMetrics, InterfacePort, User, Connection } from "@/types";

// Mock data is now largely replaced by the API.
// Keeping some for components that might still use them for fallback or testing.

export const mockUsers: User[] = [
  { id: 1, username: 'admin', role: 'admin' },
  { id: 2, username: 'jane.doe', role: 'visitor' },
  { id: 3, username: 'john.smith', role: 'visitor' },
  { id: 4, username: 'guest', role: 'visitor' },
];

export const getMockMetrics = (): DeviceMetrics[] => {
  const metrics: DeviceMetrics[] = [];
  const now = new Date();
  for (let i = 10; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60000); // last 10 minutes
    metrics.push({
      timestamp: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dataIn: Math.floor(Math.random() * (800 - 200 + 1) + 200), // Random data between 200 and 800 KB/s
      dataOut: Math.floor(Math.random() * (600 - 150 + 1) + 150), // Random data between 150 and 600 KB/s
    });
  }
  return metrics;
};

// This function is no longer representative of the main Device type
export const getMockPorts = (): InterfacePort[] => {
  const ports: InterfacePort[] = [];
  const portNames = ["FastEthernet0/0", "FastEthernet0/1", "GigabitEthernet0/0", "GigabitEthernet0/1", "FastEthernet0/2", "FastEthernet0/3"];
  
  for (let i = 0; i < portNames.length; i++) {
    ports.push({
      id: (i+1).toString(),
      name: portNames[i],
      trafficIn: parseFloat((Math.random() * 500).toFixed(2)),
      trafficOut: parseFloat((Math.random() * 300).toFixed(2)),
      poeWatts: i % 2 === 1 ? parseFloat((Math.random() * 30).toFixed(2)) : 0,
    });
  }

  return ports;
}
