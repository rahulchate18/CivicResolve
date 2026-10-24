const express = require("express");
const {
    submitFeedback,
    getFeedbackForComplaint,
    listFeedback,
} = require("../controllers/feedbackController");
const { protect, authorize } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const {
    createFeedbackValidator,
    getComplaintFeedbackValidator,
} = require("../validators/feedbackValidators");

const router = express.Router();

// All feedback endpoints require authentication
router.use(protect);

// POST /api/feedback - Submit feedback for a completed complaint (Citizen role)
router.post("/", authorize("USER"), createFeedbackValidator, validate, submitFeedback);

// GET /api/feedback/complaint/:complaintId - View feedback for a specific complaint
router.get("/complaint/:complaintId", getComplaintFeedbackValidator, validate, getFeedbackForComplaint);

// GET /api/feedback - List feedback scoped by role (citizen's own, officer's received, or admin all)
router.get("/", listFeedback);

module.exports = router;
