import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Minus } from 'lucide-react';

const InterfaceTable = ({ interfaces }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'up':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'down':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'testing':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'up': return 'text-green-700 bg-green-100';
      case 'down': return 'text-red-700 bg-red-100';
      case 'testing': return 'text-yellow-700 bg-yellow-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  if (!interfaces || interfaces.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Interface Status</h3>
        <div className="text-center py-8 text-gray-500">
          No interface data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Interface Status</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Interface
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Admin Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Operational Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Updated
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {interfaces.map((iface, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {iface.name || `Interface ${index + 1}`}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {getStatusIcon(iface.admin_status)}
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(iface.admin_status)}`}>
                      {iface.admin_status || 'unknown'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {getStatusIcon(iface.oper_status)}
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(iface.oper_status)}`}>
                      {iface.oper_status || 'unknown'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {iface.last_updated ? new Date(iface.last_updated).toLocaleString() : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InterfaceTable;
