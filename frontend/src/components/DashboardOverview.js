import React from 'react';
import { Server, Cpu, Thermometer, Fan, Clock, CheckCircle, XCircle } from 'lucide-react';

const DashboardOverview = ({ device, data }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'text-green-600 bg-green-100';
      case 'offline': return 'text-red-600 bg-red-100';
      case 'unreachable': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatUptime = (uptime) => {
    if (!uptime || uptime === 'N/A') return 'N/A';
    
    // Convert centiseconds to readable format
    const totalSeconds = Math.floor(parseInt(uptime) / 100);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Device Overview</h2>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(device.status)}`}>
          {device.status}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Device Info */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Server className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="font-semibold text-blue-900">Device Info</h3>
          </div>
          <div className="space-y-1 text-sm">
            <p><span className="font-medium">IP:</span> {device.ip_address}</p>
            <p><span className="font-medium">Hostname:</span> {device.hostname || 'N/A'}</p>
            <p><span className="font-medium">Type:</span> {device.device_type}</p>
          </div>
        </div>

        {/* System Uptime */}
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Clock className="h-5 w-5 text-green-600 mr-2" />
            <h3 className="font-semibold text-green-900">Uptime</h3>
          </div>
          <div className="text-2xl font-bold text-green-800">
            {formatUptime(data.system?.uptime)}
          </div>
          <div className="text-xs text-green-600 mt-1">
            System uptime
          </div>
        </div>

        {/* CPU Utilization */}
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Cpu className="h-5 w-5 text-orange-600 mr-2" />
            <h3 className="font-semibold text-orange-900">CPU Usage</h3>
          </div>
          <div className="text-2xl font-bold text-orange-800">
            {data.cpu?.utilization || 'N/A'}%
          </div>
          <div className="text-xs text-orange-600 mt-1">
            5-minute average
          </div>
        </div>

        {/* Temperature */}
        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Thermometer className="h-5 w-5 text-red-600 mr-2" />
            <h3 className="font-semibold text-red-900">Temperature</h3>
          </div>
          <div className="text-2xl font-bold text-red-800">
            {data.environmental?.temperature || 'N/A'}°C
          </div>
          <div className="text-xs text-red-600 mt-1">
            Current temperature
          </div>
        </div>
      </div>

      {/* System Description */}
      {data.system?.description && (
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">System Description</h3>
          <p className="text-sm text-gray-700">{data.system.description}</p>
        </div>
      )}

      {/* Interface Summary */}
      {data.interfaces && data.interfaces.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold text-gray-900 mb-3">Interface Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {data.interfaces.length}
              </div>
              <div className="text-sm text-gray-600">Total Interfaces</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {data.interfaces.filter(i => i.oper_status === 'up').length}
              </div>
              <div className="text-sm text-gray-600">Up</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {data.interfaces.filter(i => i.oper_status === 'down').length}
              </div>
              <div className="text-sm text-gray-600">Down</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {data.interfaces.filter(i => !['up', 'down'].includes(i.oper_status)).length}
              </div>
              <div className="text-sm text-gray-600">Other</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
