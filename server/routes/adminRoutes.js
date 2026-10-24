const express = require("express");
const {
    getAgentApplications,
    getAgentApplicationById,
    approveAgentApplication,
    rejectAgentApplication,
    getUsers,
    getUserById,
    updateUserStatus,
    getAnalyticsOverview,
} = require("../controllers/adminController");
const { protect, authorize } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const {
    listAgentsValidator,
    rejectAgentValidator,
    listUsersValidator,
    updateUserStatusValidator,
    analyticsQueryValidator,
    adminMongoIdValidator,
} = require("../validators/adminValidators");

const router = express.Router();

// Strict security: ALL admin endpoints require authentication and ADMIN role
router.use(protect, authorize("ADMIN"));

// ==========================================
// OFFICER APPLICATION MANAGEMENT
// ==========================================
// GET /api/admin/agents - List officer applications with pagination & filtering
router.get("/agents", listAgentsValidator, validate, getAgentApplications);

// GET /api/admin/agents/:id - View specific agent application
router.get("/agents/:id", adminMongoIdValidator, validate, getAgentApplicationById);

// PATCH /api/admin/agents/:id/approve - Approve pending application
router.patch("/agents/:id/approve", adminMongoIdValidator, validate, approveAgentApplication);

// PATCH /api/admin/agents/:id/reject - Reject pending application with notes
router.patch("/agents/:id/reject", rejectAgentValidator, validate, rejectAgentApplication);

// ==========================================
// USER ACCOUNT MANAGEMENT
// ==========================================
// GET /api/admin/users - List users with pagination and search
router.get("/users", listUsersValidator, validate, getUsers);

// GET /api/admin/users/:id - View user administrative profile
router.get("/users/:id", adminMongoIdValidator, validate, getUserById);

// PATCH /api/admin/users/:id/status - Activate or deactivate user account
router.patch("/users/:id/status", updateUserStatusValidator, validate, updateUserStatus);

// ==========================================
// ANALYTICS & REPORTING
// ==========================================
// GET /api/admin/analytics & /api/admin/analytics/overview - Live MongoDB metrics
router.get("/analytics", analyticsQueryValidator, validate, getAnalyticsOverview);
router.get("/analytics/overview", analyticsQueryValidator, validate, getAnalyticsOverview);

module.exports = router;
