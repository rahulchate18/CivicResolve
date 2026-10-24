const Message = require("../models/Message");
const Complaint = require("../models/Complaint");
const Agent = require("../models/Agent");
const User = require("../models/User");
const { notifyNewMessage } = require("../services/emailService");

/**
 * Helper to verify participant access to a complaint's message thread
 * - ADMIN: Oversight access
 * - USER: Owner of the complaint
 * - AGENT: Approved agent currently assigned to the complaint
 */
const verifyThreadAccess = async (complaint, user) => {
    if (!complaint || !user) return false;

    if (user.role === "ADMIN") {
        return true;
    }

    const createdById = complaint.createdBy?._id || complaint.createdBy;
    if (user.role === "USER") {
        return createdById.toString() === user._id.toString();
    }

    if (user.role === "AGENT") {
        const agentProfile = await Agent.findOne({ user: user._id });
        if (!agentProfile || agentProfile.approvalStatus !== "APPROVED") {
            return false;
        }

        if (!complaint.assignedAgent) {
            return false;
        }

        const assignedId = complaint.assignedAgent?._id || complaint.assignedAgent;
        return assignedId.toString() === user._id.toString();
    }

    return false;
};

/**
 * POST /api/complaints/:complaintId/messages
 * Send a message within a complaint thread
 */
const sendMessage = async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.complaintId)
            .populate("createdBy", "name email")
            .populate("assignedAgent", "name email");

        if (!complaint) {
            return res.status(404).json({
                message: "Complaint not found",
            });
        }

        const isAuthorized = await verifyThreadAccess(complaint, req.user);
        if (!isAuthorized) {
            return res.status(403).json({
                message: "Access denied: You are not authorized to message in this complaint thread",
            });
        }

        const { message, attachments } = req.body;

        const newMessage = new Message({
            complaint: complaint._id,
            sender: req.user._id,
            message: message.trim(),
            attachments: Array.isArray(attachments) ? attachments : [],
        });

        await newMessage.save();

        const populatedMessage = await Message.findById(newMessage._id)
            .populate("sender", "name role");

        // Non-blocking notification dispatch to conversation recipient
        const isSenderCitizen = complaint.createdBy._id.toString() === req.user._id.toString();
        const recipientUser = isSenderCitizen ? complaint.assignedAgent : complaint.createdBy;

        if (recipientUser) {
            const snippet = message.length > 80 ? `${message.substring(0, 80)}...` : message;
            notifyNewMessage(complaint, req.user, recipientUser, snippet).catch(() => {});
        }

        return res.status(201).json({
            message: "Message sent successfully",
            data: populatedMessage,
        });
    } catch (error) {
        console.error("Send message error:", error.message);
        return res.status(500).json({
            message: "Unable to send message",
        });
    }
};

/**
 * GET /api/complaints/:complaintId/messages
 * Retrieve paginated message history for a complaint thread
 */
const getMessages = async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.complaintId);
        if (!complaint) {
            return res.status(404).json({
                message: "Complaint not found",
            });
        }

        const isAuthorized = await verifyThreadAccess(complaint, req.user);
        if (!isAuthorized) {
            return res.status(403).json({
                message: "Access denied: You are not authorized to view this complaint thread",
            });
        }

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const skip = (page - 1) * limit;

        const [messages, total] = await Promise.all([
            Message.find({ complaint: complaint._id })
                .sort({ createdAt: 1 })
                .skip(skip)
                .limit(limit)
                .populate("sender", "name role"),
            Message.countDocuments({ complaint: complaint._id }),
        ]);

        return res.status(200).json({
            messages,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        console.error("Get messages error:", error.message);
        return res.status(500).json({
            message: "Unable to retrieve messages",
        });
    }
};

/**
 * PATCH /api/complaints/:complaintId/messages/:messageId/read
 * Mark a message as read by the recipient
 */
const markMessageAsRead = async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.complaintId);
        if (!complaint) {
            return res.status(404).json({
                message: "Complaint not found",
            });
        }

        const isAuthorized = await verifyThreadAccess(complaint, req.user);
        if (!isAuthorized) {
            return res.status(403).json({
                message: "Access denied: You are not authorized to update messages in this thread",
            });
        }

        const message = await Message.findOne({
            _id: req.params.messageId,
            complaint: complaint._id,
        });

        if (!message) {
            return res.status(404).json({
                message: "Message not found in this complaint thread",
            });
        }

        // The sender cannot mark their own sent message as read
        if (message.sender.toString() === req.user._id.toString()) {
            return res.status(400).json({
                message: "Sender cannot mark their own message as read",
            });
        }

        if (!message.isRead) {
            message.isRead = true;
            message.readAt = new Date();
            await message.save();
        }

        return res.status(200).json({
            message: "Message marked as read",
            data: message,
        });
    } catch (error) {
        console.error("Mark message read error:", error.message);
        return res.status(500).json({
            message: "Unable to mark message as read",
        });
    }
};

module.exports = {
    sendMessage,
    getMessages,
    markMessageAsRead,
};
