import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { getDevices, getHistoricalData } from '../api/snmpApi';
import { Calendar, TrendingUp, Download } from 'lucide-react';

const HistoricalData = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('cpu');
  const [timeRange, setTimeRange] = useState(24);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      fetchHistoricalData();
    }
  }, [selectedDevice, selectedMetric, timeRange]);

  const fetchDevices = async () => {
    try {
      const devicesData = await getDevices();
      setDevices(devicesData);
      if (devicesData.length > 0 && !selectedDevice) {
        setSelectedDevice(devicesData[0]);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricalData = async () => {
    if (!selectedDevice) return;
    
    setLoading(true);
    try {
      const historicalData = await getHistoricalData(selectedDevice.id, timeRange, selectedMetric);
      
      const chartData = historicalData.map(record => {
        const timestamp = new Date(record.timestamp);
        let value = 0;
        
        switch (selectedMetric) {
          case 'cpu':
            value = record.value.cpu_5min || 0;
            break;
          case 'temperature':
            value = record.value.temperature_value || 0;
            break;
          default:
            value = 0;
        }
        
        return {
          timestamp: timestamp.toLocaleTimeString(),
          value: value,
          fullTimestamp: record.timestamp,
          date: timestamp.toLocaleDateString()
        };
      });
      
      setData(chartData);
    } catch (error) {
      console.error('Error fetching historical data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMetricLabel = (metric) => {
    switch (metric) {
      case 'cpu': return 'CPU Utilization (%)';
      case 'temperature': return 'Temperature (°C)';
      default: return 'Value';
    }
  };

  const getMetricColor = (metric) => {
    switch (metric) {
      case 'cpu': return '#3b82f6';
      case 'temperature': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm text-gray-600">
            {new Date(data.fullTimestamp).toLocaleString()}
          </p>
          <p className="text-sm font-semibold" style={{ color: getMetricColor(selectedMetric) }}>
            {getMetricLabel(selectedMetric)}: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  const exportData = () => {
    if (data.length === 0) return;
    
    const csvContent = [
      ['Timestamp', getMetricLabel(selectedMetric)],
      ...data.map(row => [new Date(row.fullTimestamp).toISOString(), row.value])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDevice.hostname || selectedDevice.ip_address}_${selectedMetric}_${timeRange}h.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading && devices.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Historical Data</h1>
        <button
          onClick={exportData}
          disabled={data.length === 0}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Device
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
                  {device.hostname || device.ip_address} ({device.ip_address})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Metric
            </label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="cpu">CPU Utilization</option>
              <option value="temperature">Temperature</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Range
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(parseInt(e.target.value))}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={1}>Last Hour</option>
              <option value={6}>Last 6 Hours</option>
              <option value={24}>Last 24 Hours</option>
              <option value={72}>Last 3 Days</option>
              <option value={168}>Last Week</option>
              <option value={720}>Last Month</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {getMetricLabel(selectedMetric)} - {selectedDevice?.hostname || selectedDevice?.ip_address}
          </h2>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Calendar className="h-4 w-4" />
            <span>Last {timeRange} hours</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-96 text-gray-500">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>No data available for the selected time range</p>
            </div>
          </div>
        ) : (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={getMetricColor(selectedMetric)} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={getMetricColor(selectedMetric)} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="timestamp" 
                  stroke="#666"
                  fontSize={12}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  stroke="#666"
                  fontSize={12}
                  label={{ 
                    value: getMetricLabel(selectedMetric), 
                    angle: -90, 
                    position: 'insideLeft' 
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={getMetricColor(selectedMetric)}
                  fillOpacity={1}
                  fill="url(#colorGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Statistics */}
      {data.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {Math.max(...data.map(d => d.value)).toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">Maximum</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Math.min(...data.map(d => d.value)).toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">Minimum</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {(data.reduce((sum, d) => sum + d.value, 0) / data.length).toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">Average</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {data.length}
              </div>
              <div className="text-sm text-gray-600">Data Points</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricalData;
