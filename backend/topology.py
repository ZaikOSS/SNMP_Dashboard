from flask import Blueprint, jsonify, request
from db import create_connection, get_connections, delete_connection
from auth import admin_required, user_required, manager_required

# --- Blueprint Setup ---
topology_bp = Blueprint('topology', __name__)

# --- Topology Endpoints (Admins and Managers Only) ---
@topology_bp.route("/connections", methods=["GET"])
@manager_required()
def get_connections_endpoint_manager():
    """(Admins and Managers Only) Gets all saved device connections."""
    connections = get_connections()
    return jsonify(connections)

@topology_bp.route("/connections", methods=["POST"])
@manager_required()
def create_connection_endpoint():
    """(Admins and Managers Only) Creates a new connection between two devices."""
    data = request.get_json()
    required_fields = ["source_device_id", "source_interface", "target_device_id", "target_interface", "type"]
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400
    
    new_id = create_connection(
        data["source_device_id"],
        data["source_interface"],
        data["target_device_id"],
        data["target_interface"],
        data["type"]
    )
    return jsonify({"message": "Connection created successfully", "id": new_id}), 201

@topology_bp.route("/connections/<int:connection_id>", methods=["DELETE"])
@manager_required()
def delete_connection_endpoint(connection_id):
    """(Admins and Managers Only) Deletes a device connection."""
    if delete_connection(connection_id):
        return jsonify({"message": "Connection deleted successfully"}), 200
    else:
        return jsonify({"error": "Connection not found"}), 404

@topology_bp.route("/connections/view", methods=["GET"])
@user_required()
def get_connections_endpoint_visitor():
    """(Visitor and Admin) Gets all saved device connections for viewing."""
    connections = get_connections()
    return jsonify(connections)