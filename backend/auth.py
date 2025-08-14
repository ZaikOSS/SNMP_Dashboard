import os
from functools import wraps
from flask import Blueprint, jsonify, request
from werkzeug.security import check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt

# Import all necessary database functions
from db import create_user, get_user_by_username, get_all_users, delete_user_by_id, update_user

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

# --- Authentication Endpoints ---
@auth_bp.route("/register", methods=["POST"])
def register_endpoint():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'visitor')

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    if role not in ['admin', 'visitor']:
        return jsonify({"error": "Invalid role specified"}), 400
    
    user = create_user(username, password, role)
    if user:
        return jsonify({"message": f"User '{username}' created successfully as '{role}'"}), 201
    else:
        return jsonify({"error": "Username already exists"}), 409

@auth_bp.route("/login", methods=["POST"])
def login_endpoint():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    user_data = get_user_by_username(username)
    if user_data and check_password_hash(user_data['password_hash'], password):
        additional_claims = {"role": user_data['role']}
        identity = str(user_data['id'])
        access_token = create_access_token(identity=identity, additional_claims=additional_claims)
        return jsonify(access_token=access_token)
    
    return jsonify({"error": "Invalid username or password"}), 401

# --- User Management Endpoints (Admin Only) ---

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

# --- New Endpoint for Updating Users ---
@auth_bp.route("/users/<int:user_id>", methods=["PUT"])
@admin_required()
def update_user_endpoint(user_id):
    """(Admin Only) Updates a user's username and role."""
    data = request.get_json()
    username = data.get('username')
    role = data.get('role')

    if not username or not role:
        return jsonify({"error": "Username and role are required"}), 400
    if role not in ['admin', 'visitor']:
        return jsonify({"error": "Invalid role"}), 400

    if update_user(user_id, username, role):
        return jsonify({"message": "User updated successfully"}), 200
    else:
        return jsonify({"error": "Failed to update user. User may not exist or username is already taken."}), 400
