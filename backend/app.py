import io
import csv
import os
import json
from flask import Flask, jsonify, Response, request
from dotenv import load_dotenv
from flask_jwt_extended import JWTManager, jwt_required
from flask_cors import CORS
from datetime import datetime

# Import database and snmp utility functions
from db import init_db, get_devices, get_device_history, get_latest_device_history, delete_device
from snmp_utils import get_device_details

# Import blueprints
from auth import auth_bp, admin_required, user_required, manager_required
from topology import topology_bp
from feedback import feedback_bp

# --- Flask App Initialization ---
load_dotenv() 

app = Flask(__name__)
CORS(app)

app.config["JWT_SECRET_KEY"] = os.environ.get("SECRET_KEY")

# Initialize JWT Manager and register blueprints
jwt = JWTManager(app)
app.register_blueprint(auth_bp)
app.register_blueprint(topology_bp)
app.register_blueprint(feedback_bp)

# Initialize the database
init_db()

# --- Core API Endpoints ---
@app.route("/snmp", methods=["POST"])
@manager_required()
def snmp_endpoint():
    data = request.get_json()
    required_fields = ["ip", "user", "auth_key", "priv_key", "vendor"]
    if not all(field in data for field in required_fields):
        missing = [field for field in required_fields if field not in data]
        return jsonify({"error": "Missing required fields", "missing_fields": missing}), 400
    
    result = get_device_details(data["ip"], data["user"], data["auth_key"], data["priv_key"], data["vendor"])
    
    if result["status"] == "success":
        return jsonify(result), 200
    elif result["status"] == "partial":
        return jsonify(result), 207
    else:
        return jsonify({"status": "error", "message": "Failed to retrieve device information", "errors": result.get("errors", [])}), 500

@app.route("/devices", methods=["GET"])
@jwt_required()
def devices_endpoint():
    return jsonify(get_devices())

@app.route("/history/<ip>", methods=["GET"])
@jwt_required()
def history_endpoint(ip):
    return jsonify(get_device_history(ip))

@app.route("/refresh/device", methods=["POST"])
@user_required()
def refresh_device_endpoint():
    data = request.get_json()
    
    if not data or "ip" not in data:
        return jsonify({"error": "Missing required field: ip"}), 400
    
    ip = data["ip"]
    user = os.environ.get("SNMP_USER")
    auth_key = os.environ.get("SNMP_AUTH_KEY")
    priv_key = os.environ.get("SNMP_PRIV_KEY")
    vendor = os.environ.get("SNMP_VENDOR", "cisco")

    if not all([ip, user, auth_key, priv_key]):
        return jsonify({"error": "SNMP credentials or IP are missing"}), 400
    
    result = get_device_details(ip, user, auth_key, priv_key, vendor)
    
    if result["status"] == "success":
        return jsonify(result), 200
    elif result["status"] == "partial":
        return jsonify(result), 207
    else:
        return jsonify({"status": "error", "message": "Failed to retrieve device information", "errors": result.get("errors", [])}), 500

@app.route("/export/csv", methods=["GET"])
@jwt_required()
def export_csv_endpoint():
    devices = get_devices()
    if not devices:
        return "No device data to export.", 200
    output = io.StringIO()
    fieldnames = [key for key in devices[0].keys() if key != 'interfaces']
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for device in devices:
        simple_device = {k: v for k, v in device.items() if k != 'interfaces'}
        writer.writerow(simple_device)
    return Response(output.getvalue(), mimetype="text/csv", headers={"Content-disposition": "attachment; filename=devices.csv"})

@app.route("/export/json", methods=["GET"])
@jwt_required()
def export_json_endpoint():
    return jsonify(get_devices())

@app.route("/throughput/<ip>", methods=["GET"])
@jwt_required()
def throughput_endpoint(ip):
    """Calculates and returns the real-time network throughput for a device."""
    history = get_latest_device_history(ip)
    
    if len(history) < 2:
        return jsonify({"message": "Not enough data to calculate throughput."}), 404

    current_data = history[0]
    return jsonify({
        "inbound_kbps": current_data['in_throughput_kbps'],
        "outbound_kbps": current_data['out_throughput_kbps'],
        "timestamp": current_data['timestamp']
    })

@app.route("/devices/<int:device_id>", methods=["DELETE"])
@manager_required()
def delete_device_endpoint(device_id):
    """(Admins and Managers Only) Deletes a device and its history from the database."""
    if delete_device(device_id):
        return jsonify({"message": f"Device with ID {device_id} deleted successfully."}), 200
    else:
        return jsonify({"error": f"Device with ID {device_id} not found."}), 404

@app.route("/history/detailed/<ip>", methods=["GET"])
@jwt_required()
def detailed_history_endpoint(ip):
    """Returns detailed historical data for a device, suitable for graphing."""
    history = get_device_history(ip)
    return jsonify(history)

# --- Main Execution ---
if __name__ == '__main__':
    app.run(debug=True, port=1999)