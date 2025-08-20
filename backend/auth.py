import os
from functools import wraps
from flask import Blueprint, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt

# Import all necessary database functions
from db import create_user, get_user_by_username, get_all_users, delete_user_by_id, update_user, update_user_password, update_user_status

# --- Blueprint Setup ---
auth_bp = Blueprint('auth', __name__)

# --- Custom Decorator for Role-Based Access ---
def admin_required():
    def wrapper(fn):
        @wraps(fn)
        @jwt_required()
        def decorator(*args, **kwargs):
            claims = get_jwt()
            if claims.get("role") == "admin":
                return fn(*args, **kwargs)
            else:
                return jsonify(msg="Admins only!"), 403
        return decorator
    return wrapper

def manager_required():
    def wrapper(fn):
        @wraps(fn)
        @jwt_required()
        def decorator(*args, **kwargs):
            claims = get_jwt()
            if claims.get("role") in ["admin", "manager"]:
                return fn(*args, **kwargs)
            else:
                return jsonify(msg="Admins and Managers only!"), 403
        return decorator
    return wrapper

def user_required():
    """Custom decorator to require a valid JWT for any user role."""
    def wrapper(fn):
        @wraps(fn)
        @jwt_required()
        def decorator(*args, **kwargs):
            return fn(*args, **kwargs)
        return decorator
    return wrapper

# --- Authentication Endpoints ---
@auth_bp.route("/register", methods=["POST"])
def register_endpoint():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'visitor')

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    if role not in ['admin', 'manager', 'visitor']:
        return jsonify({"error": "Invalid role specified"}), 400
    if role in ['admin', 'manager']:
        return jsonify({"error": f"Role '{role}' cannot be created via this endpoint. Only 'visitor' role is allowed."}), 403

    user = create_user(username, password, role, 'pending')
    if user:
        return jsonify({"message": f"User '{username}' created successfully as '{role}'. Awaiting admin approval."}), 201
    else:
        return jsonify({"error": "Username already exists"}), 409

@auth_bp.route("/login", methods=["POST"])
def login_endpoint():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    user_data = get_user_by_username(username)
    if user_data and check_password_hash(user_data['password_hash'], password):
        if user_data['status'] != 'approved':
            return jsonify({"error": f"Account is not active. Status: {user_data['status']}"}), 403
        
        additional_claims = {"role": user_data['role']}
        identity = str(user_data['id'])
        access_token = create_access_token(identity=identity, additional_claims=additional_claims)
        return jsonify(access_token=access_token)
    
    return jsonify({"error": "Invalid username or password"}), 401

@auth_bp.route("/change-password", methods=["PUT"])
@user_required()
def change_password_endpoint():
    data = request.get_json()
    new_password = data.get('new_password')
    if not new_password:
        return jsonify({"error": "New password required"}), 400
    
    user_id = int(get_jwt_identity())
    if update_user_password(user_id, new_password):
        return jsonify({"message": "Password updated successfully"}), 200
    else:
        return jsonify({"error": "Failed to update password"}), 400

# --- User Management Endpoints (Admin Only) ---
@auth_bp.route("/users/create-admin", methods=["POST"])
@admin_required()
def create_admin_endpoint():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
        
    user = create_user(username, password, 'admin', 'approved')
    if user:
        return jsonify({"message": f"Admin '{username}' created successfully."}), 201
    else:
        return jsonify({"error": "Username already exists"}), 409

@auth_bp.route("/users/create-manager", methods=["POST"])
@admin_required()
def create_manager_endpoint():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    
    user = create_user(username, password, 'manager', 'approved')
    if user:
        return jsonify({"message": f"Manager '{username}' created successfully."}), 201
    else:
        return jsonify({"error": "Username already exists"}), 409

@auth_bp.route("/users", methods=["GET"])
@admin_required()
def get_users_endpoint():
    """(Admin Only) Gets a list of all users."""
    users = get_all_users()
    return jsonify(users)

@auth_bp.route("/users/<int:user_id>", methods=["DELETE"])
@admin_required()
def delete_user_endpoint(user_id):
    """(Admin Only) Deletes a user."""
    current_user_id = int(get_jwt_identity())
    if user_id == current_user_id:
         return jsonify({"error": "Admin cannot delete their own account"}), 400

    if delete_user_by_id(user_id):
        return jsonify({"message": "User deleted successfully"}), 200
    else:
        return jsonify({"error": "User not found"}), 404

@auth_bp.route("/users/<int:user_id>", methods=["PUT"])
@admin_required()
def update_user_endpoint(user_id):
    """(Admin Only) Updates a user's username and role."""
    data = request.get_json()
    username = data.get('username')
    role = data.get('role')

    if not username or not role:
        return jsonify({"error": "Username and role are required"}), 400
    if role not in ['admin', 'manager', 'visitor']:
        return jsonify({"error": "Invalid role"}), 400

    if update_user(user_id, username, role):
        return jsonify({"message": "User updated successfully"}), 200
    else:
        return jsonify({"error": "Failed to update user. User may not exist or username is already taken."}), 400

@auth_bp.route("/users/<int:user_id>/status", methods=["PUT"])
@admin_required()
def update_user_status_endpoint(user_id):
    """(Admin Only) Updates a user's status to 'approved' or 'suspended'."""
    data = request.get_json()
    status = data.get('status')
    if status not in ['approved', 'suspended']:
        return jsonify({"error": "Invalid status. Must be 'approved' or 'suspended'."}), 400
        
    if update_user_status(user_id, status):
        return jsonify({"message": f"User status updated to '{status}' successfully."}), 200
    else:
        return jsonify({"error": "Failed to update user status. User not found."}), 404