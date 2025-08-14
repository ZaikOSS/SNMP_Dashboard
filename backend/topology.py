from flask import Blueprint, jsonify, request
from db import create_connection, get_connections, delete_connection
from auth import admin_required

# --- Blueprint Setup ---
topology_bp = Blueprint('topology', __name__)

# --- Topology Endpoints (Admin Only) ---

@topology_bp.route("/connections", methods=["GET"])
@admin_required()
def get_connections_endpoint():
    """(Admin Only) Gets all saved device connections."""
    connections = get_connections()
    return jsonify(connections)

@topology_bp.route("/connections", methods=["POST"])
@admin_required()
def create_connection_endpoint():
    """(Admin Only) Creates a new connection between two devices."""
    data = request.get_json()
    required_fields = ["source_device_id", "source_interface", "target_device_id", "target_interface"]
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400
    
    new_id = create_connection(
        data["source_device_id"],
        data["source_interface"],
        data["target_device_id"],
        data["target_interface"]
    )
    return jsonify({"message": "Connection created successfully", "id": new_id}), 201

@topology_bp.route("/connections/<int:connection_id>", methods=["DELETE"])
@admin_required()
def delete_connection_endpoint(connection_id):
    """(Admin Only) Deletes a device connection."""
    if delete_connection(connection_id):
        return jsonify({"message": "Connection deleted successfully"}), 200
    else:
        return jsonify({"error": "Connection not found"}), 404
