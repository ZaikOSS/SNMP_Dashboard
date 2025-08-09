"use client";

import { useState, useEffect } from "react";
import { getDevices, addDevice, removeDevice } from "../api/snmpApi";
import { Plus, Trash2, Server, AlertCircle, Eye, EyeOff } from "lucide-react";

const Settings = () => {
  const [devices, setDevices] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPasswords, setShowPasswords] = useState({});
  const [formData, setFormData] = useState({
    ip_address: "",
    hostname: "",
    device_type: "router",
    community: "public",
    snmp_version: "2c",
    snmp_port: 161,
    snmpv3_username: "",
    snmpv3_auth_protocol: "MD5",
    snmpv3_auth_password: "",
    snmpv3_priv_protocol: "DES",
    snmpv3_priv_password: "",
    snmpv3_security_level: "authPriv",
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const devicesData = await getDevices();
      setDevices(devicesData);
    } catch (error) {
      console.error("Error fetching devices:", error);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.ip_address.trim()) {
      errors.ip_address = "IP address is required";
    } else if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(formData.ip_address)) {
      errors.ip_address = "Invalid IP address format";
    }

    if (formData.snmp_version === "3") {
      if (!formData.snmpv3_username.trim()) {
        errors.snmpv3_username = "Username is required for SNMP v3";
      }

      if (
        formData.snmpv3_security_level !== "noAuthNoPriv" &&
        !formData.snmpv3_auth_password.trim()
      ) {
        errors.snmpv3_auth_password = "Authentication password is required";
      }

      if (
        formData.snmpv3_security_level === "authPriv" &&
        !formData.snmpv3_priv_password.trim()
      ) {
        errors.snmpv3_priv_password =
          "Privacy password is required for authPriv";
      }
    } else {
      if (!formData.community.trim()) {
        errors.community = "SNMP community is required";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitLoading(true);
    try {
      await addDevice(formData);
      setFormData({
        ip_address: "",
        hostname: "",
        device_type: "router",
        community: "public",
        snmp_version: "2c",
        snmp_port: 161,
        snmpv3_username: "",
        snmpv3_auth_protocol: "MD5",
        snmpv3_auth_password: "",
        snmpv3_priv_protocol: "DES",
        snmpv3_priv_password: "",
        snmpv3_security_level: "authPriv",
      });
      setShowAddForm(false);
      fetchDevices();
    } catch (error) {
      console.error("Error adding device:", error);
      setFormErrors({ submit: "Failed to add device. Please try again." });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleRemoveDevice = async (deviceId) => {
    if (!window.confirm("Are you sure you want to remove this device?")) return;

    try {
      await removeDevice(deviceId);
      fetchDevices();
    } catch (error) {
      console.error("Error removing device:", error);
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "online":
        return "text-green-600 bg-green-100";
      case "offline":
        return "text-red-600 bg-red-100";
      case "unreachable":
        return "text-yellow-600 bg-yellow-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getSNMPVersionBadge = (version) => {
    const colors = {
      1: "bg-red-100 text-red-800",
      "2c": "bg-blue-100 text-blue-800",
      3: "bg-green-100 text-green-800",
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${
          colors[version] || "bg-gray-100 text-gray-800"
        }`}
      >
        SNMP v{version}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Device</span>
        </button>
      </div>

      {/* Add Device Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Add New Device
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IP Address *
                </label>
                <input
                  type="text"
                  value={formData.ip_address}
                  onChange={(e) =>
                    setFormData({ ...formData, ip_address: e.target.value })
                  }
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    formErrors.ip_address ? "border-red-300" : "border-gray-300"
                  }`}
                  placeholder="192.168.1.1"
                />
                {formErrors.ip_address && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.ip_address}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hostname
                </label>
                <input
                  type="text"
                  value={formData.hostname}
                  onChange={(e) =>
                    setFormData({ ...formData, hostname: e.target.value })
                  }
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Router-01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Device Type
                </label>
                <select
                  value={formData.device_type}
                  onChange={(e) =>
                    setFormData({ ...formData, device_type: e.target.value })
                  }
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="router">Router</option>
                  <option value="switch">Switch</option>
                  <option value="firewall">Firewall</option>
                  <option value="server">Server</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SNMP Version *
                </label>
                <select
                  value={formData.snmp_version}
                  onChange={(e) =>
                    setFormData({ ...formData, snmp_version: e.target.value })
                  }
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="1">SNMP v1</option>
                  <option value="2c">SNMP v2c</option>
                  <option value="3">SNMP v3</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SNMP Port
                </label>
                <input
                  type="number"
                  value={formData.snmp_port}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      snmp_port: Number.parseInt(e.target.value),
                    })
                  }
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="161"
                />
              </div>

              {/* SNMP v1/v2c Community */}
              {formData.snmp_version !== "3" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SNMP Community *
                  </label>
                  <input
                    type="text"
                    value={formData.community}
                    onChange={(e) =>
                      setFormData({ ...formData, community: e.target.value })
                    }
                    className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                      formErrors.community
                        ? "border-red-300"
                        : "border-gray-300"
                    }`}
                    placeholder="public"
                  />
                  {formErrors.community && (
                    <p className="mt-1 text-sm text-red-600">
                      {formErrors.community}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* SNMP v3 Configuration */}
            {formData.snmp_version === "3" && (
              <div className="border-t pt-4 mt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  SNMP v3 Configuration
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={formData.snmpv3_username}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          snmpv3_username: e.target.value,
                        })
                      }
                      className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                        formErrors.snmpv3_username
                          ? "border-red-300"
                          : "border-gray-300"
                      }`}
                      placeholder="admin"
                    />
                    {formErrors.snmpv3_username && (
                      <p className="mt-1 text-sm text-red-600">
                        {formErrors.snmpv3_username}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Security Level
                    </label>
                    <select
                      value={formData.snmpv3_security_level}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          snmpv3_security_level: e.target.value,
                        })
                      }
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="noAuthNoPriv">No Auth, No Privacy</option>
                      <option value="authNoPriv">Auth, No Privacy</option>
                      <option value="authPriv">Auth and Privacy</option>
                    </select>
                  </div>

                  {formData.snmpv3_security_level !== "noAuthNoPriv" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Auth Protocol
                        </label>
                        <select
                          value={formData.snmpv3_auth_protocol}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              snmpv3_auth_protocol: e.target.value,
                            })
                          }
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="MD5">MD5</option>
                          <option value="SHA">SHA</option>
                          <option value="SHA224">SHA224</option>
                          <option value="SHA256">SHA256</option>
                          <option value="SHA384">SHA384</option>
                          <option value="SHA512">SHA512</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Auth Password *
                        </label>
                        <div className="relative">
                          <input
                            type={showPasswords.auth ? "text" : "password"}
                            value={formData.snmpv3_auth_password}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                snmpv3_auth_password: e.target.value,
                              })
                            }
                            className={`block w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                              formErrors.snmpv3_auth_password
                                ? "border-red-300"
                                : "border-gray-300"
                            }`}
                            placeholder="Authentication password"
                          />
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility("auth")}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          >
                            {showPasswords.auth ? (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                        </div>
                        {formErrors.snmpv3_auth_password && (
                          <p className="mt-1 text-sm text-red-600">
                            {formErrors.snmpv3_auth_password}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {formData.snmpv3_security_level === "authPriv" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Privacy Protocol
                        </label>
                        <select
                          value={formData.snmpv3_priv_protocol}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              snmpv3_priv_protocol: e.target.value,
                            })
                          }
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="DES">DES</option>
                          <option value="AES">AES</option>
                          <option value="AES192">AES192</option>
                          <option value="AES256">AES256</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Privacy Password *
                        </label>
                        <div className="relative">
                          <input
                            type={showPasswords.priv ? "text" : "password"}
                            value={formData.snmpv3_priv_password}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                snmpv3_priv_password: e.target.value,
                              })
                            }
                            className={`block w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                              formErrors.snmpv3_priv_password
                                ? "border-red-300"
                                : "border-gray-300"
                            }`}
                            placeholder="Privacy password"
                          />
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility("priv")}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          >
                            {showPasswords.priv ? (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                        </div>
                        {formErrors.snmpv3_priv_password && (
                          <p className="mt-1 text-sm text-red-600">
                            {formErrors.snmpv3_priv_password}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {formErrors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                  <span className="text-red-800">{formErrors.submit}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setFormErrors({});
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitLoading ? "Adding..." : "Add Device"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Devices List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Monitored Devices
          </h2>
        </div>

        {devices.length === 0 ? (
          <div className="text-center py-12">
            <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No devices configured
            </h3>
            <p className="text-gray-500">
              Add your first device to start monitoring.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Device
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SNMP Version
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Seen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {devices.map((device) => (
                  <tr key={device.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {device.hostname || "Unnamed Device"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {device.ip_address}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {device.device_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getSNMPVersionBadge(device.snmp_version)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          device.status
                        )}`}
                      >
                        {device.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {device.last_seen
                        ? new Date(device.last_seen).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleRemoveDevice(device.id)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
