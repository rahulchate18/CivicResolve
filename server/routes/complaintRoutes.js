const express = require("express");
const {
    createComplaint,
    getComplaints,
    getComplaintById,
    getComplaintByTrackingId,
    updateComplaintStatus,
    assignAgent,
} = require("../controllers/complaintController");
const { protect, authorize } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const {
    createComplaintValidator,
    updateStatusValidator,
    assignAgentValidator,
    listComplaintsValidator,
    mongoIdParamValidator,
    trackingIdParamValidator,
} = require("../validators/complaintValidators");

const router = express.Router();

// All complaint endpoints require authentication
router.use(protect);

// POST /api/complaints - Register a new complaint (Citizen role)
router.post("/", authorize("USER"), createComplaintValidator, validate, createComplaint);

// GET /api/complaints - Filtered & paginated complaint listing (Role-scoped)
router.get("/", listComplaintsValidator, validate, getComplaints);

// GET /api/complaints/track/:trackingId - Detailed tracking view (Access controlled)
router.get("/track/:trackingId", trackingIdParamValidator, validate, getComplaintByTrackingId);

// GET /api/complaints/:id - Detail view by MongoDB ID (Access controlled)
router.get("/:id", mongoIdParamValidator, validate, getComplaintById);

// PATCH /api/complaints/:id/status - Status transitions (Citizen close/reopen, Agent/Admin operational)
router.patch("/:id/status", updateStatusValidator, validate, updateComplaintStatus);

// PATCH /api/complaints/:id/assign - Administrator agent assignment
router.patch("/:id/assign", authorize("ADMIN"), assignAgentValidator, validate, assignAgent);

// Nested messaging routes: /api/complaints/:complaintId/messages
const messageRoutes = require("./messageRoutes");
router.use("/:complaintId/messages", messageRoutes);

module.exports = router;
