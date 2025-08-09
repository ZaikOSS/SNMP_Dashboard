import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getHistoricalData } from '../api/snmpApi';

const CpuChart = ({ deviceId }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(24);

  useEffect(() => {
    if (deviceId) {
      fetchHistoricalData();
    }
  }, [deviceId, timeRange]);

  const fetchHistoricalData = async () => {
    setLoading(true);
    try {
      const historicalData = await getHistoricalData(deviceId, timeRange, 'cpu');
      
      const chartData = historicalData.map(record => ({
        timestamp: new Date(record.timestamp).toLocaleTimeString(),
        cpu: record.value.cpu_5min || 0,
        fullTimestamp: record.timestamp
      }));
      
      setData(chartData);
    } catch (error) {
      console.error('Error fetching historical data:', error);
    } finally {
      setLoading(false);
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
          <p className="text-sm font-semibold text-blue-600">
            CPU: {payload[0].value}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">CPU Utilization</h3>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(parseInt(e.target.value))}
          className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={1}>Last Hour</option>
          <option value={6}>Last 6 Hours</option>
          <option value={24}>Last 24 Hours</option>
          <option value={168}>Last Week</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No CPU data available for the selected time range
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
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
                domain={[0, 100]}
                label={{ value: 'CPU %', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="cpu" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5, stroke: '#3b82f6', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default CpuChart;
