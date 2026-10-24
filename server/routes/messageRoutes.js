const express = require("express");
const {
    sendMessage,
    getMessages,
    markMessageAsRead,
} = require("../controllers/messageController");
const { protect } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const {
    createMessageValidator,
    listMessagesValidator,
    markMessageReadValidator,
} = require("../validators/messageValidators");

// mergeParams: true is essential to capture :complaintId from parent router
const router = express.Router({ mergeParams: true });

// All messaging endpoints require authentication
router.use(protect);

// POST /api/complaints/:complaintId/messages - Send message
router.post("/", createMessageValidator, validate, sendMessage);

// GET /api/complaints/:complaintId/messages - List thread messages
router.get("/", listMessagesValidator, validate, getMessages);

// PATCH /api/complaints/:complaintId/messages/:messageId/read - Mark message read
router.patch("/:messageId/read", markMessageReadValidator, validate, markMessageAsRead);

module.exports = router;
