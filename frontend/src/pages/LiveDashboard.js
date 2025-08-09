import React, { useState, useEffect } from 'react';
import DashboardOverview from '../components/DashboardOverview';
import InterfaceTable from '../components/InterfaceTable';
import CpuChart from '../components/CpuChart';
import { getDevices, getCurrentData } from '../api/snmpApi';
import { RefreshCw, AlertCircle } from 'lucide-react';

const LiveDashboard = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [currentData, setCurrentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      fetchCurrentData();
    }
  }, [selectedDevice]);

  useEffect(() => {
    if (autoRefresh && selectedDevice) {
      const interval = setInterval(fetchCurrentData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedDevice]);

  const fetchDevices = async () => {
    try {
      const devicesData = await getDevices();
      setDevices(devicesData);
      if (devicesData.length > 0 && !selectedDevice) {
        setSelectedDevice(devicesData[0]);
      }
    } catch (err) {
      setError('Failed to fetch devices');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentData = async () => {
    if (!selectedDevice) return;
    
    try {
      const data = await getCurrentData(selectedDevice.id);
      setCurrentData(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch current data');
    }
  };

  const handleRefresh = () => {
    fetchCurrentData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No devices configured</h3>
        <p className="text-gray-500 mb-4">Add devices in the Settings page to start monitoring.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Live Dashboard</h1>
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Auto-refresh</span>
          </label>
          <button
            onClick={handleRefresh}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Device Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Device
        </label>
        <select
          value={selectedDevice?.id || ''}
          onChange={(e) => {
            const device = devices.find(d => d.id === parseInt(e.target.value));
            setSelectedDevice(device);
          }}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          {devices.map(device => (
            <option key={device.id} value={device.id}>
              {device.hostname || device.ip_address} ({device.ip_address}) - {device.status}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {selectedDevice && currentData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Overview */}
          <div className="lg:col-span-2">
            <DashboardOverview device={selectedDevice} data={currentData} />
          </div>

          {/* CPU Chart */}
          <div>
            <CpuChart deviceId={selectedDevice.id} />
          </div>

          {/* Interface Table */}
          <div>
            <InterfaceTable interfaces={currentData.interfaces || []} />
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveDashboard;
