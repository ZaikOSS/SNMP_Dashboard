from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity
from auth import user_required, admin_required
from db import insert_feedback, get_all_feedback, get_feedback_by_user_id, delete_feedback

# --- Blueprint Setup ---
feedback_bp = Blueprint('feedback', __name__)

@feedback_bp.route("/feedback", methods=["POST"])
@user_required()
def create_feedback():
    """Allows any authenticated user to submit feedback."""
    data = request.get_json()
    user_id = get_jwt_identity()

    problem = data.get("problem")
    troubleshooting = data.get("troubleshooting")
    solution = data.get("solution")

    if not problem:
        return jsonify({"error": "Problem description is required."}), 400

    feedback_id = insert_feedback(user_id, problem, troubleshooting, solution)

    return jsonify({"message": "Feedback submitted successfully.", "id": feedback_id}), 201

@feedback_bp.route("/feedback", methods=["GET"])
@admin_required()
def get_feedback_admin():
    """Allows an admin to view all feedback."""
    feedback_list = get_all_feedback()
    return jsonify(feedback_list), 200

# NEW: Read-only endpoint for all authenticated users
@feedback_bp.route("/feedback/view", methods=["GET"])
@user_required()
def get_feedback_user():
    """Allows any authenticated user to view all feedback."""
    feedback_list = get_all_feedback()
    return jsonify(feedback_list), 200

@feedback_bp.route("/feedback/<int:feedback_id>", methods=["DELETE"])
@admin_required()
def remove_feedback(feedback_id):
    """Allows an admin to delete a feedback entry."""
    if delete_feedback(feedback_id):
        return jsonify({"message": "Feedback deleted successfully."}), 200
    else:
        return jsonify({"error": "Feedback not found."}), 404