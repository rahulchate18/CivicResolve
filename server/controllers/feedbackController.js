const Feedback = require("../models/Feedback");
const Complaint = require("../models/Complaint");
const Agent = require("../models/Agent");
const User = require("../models/User");
const { notifyFeedbackSubmitted } = require("../services/emailService");

/**
 * POST /api/feedback
 * Submit feedback and 1-5 rating for a resolved or closed complaint
 */
const submitFeedback = async (req, res) => {
    try {
        const { complaintId, rating, comments } = req.body;

        const complaint = await Complaint.findById(complaintId);
        if (!complaint) {
            return res.status(404).json({
                message: "Complaint not found",
            });
        }

        // Ownership rule: Only the filing citizen can submit feedback
        if (complaint.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                message: "Only the citizen who filed this complaint can submit feedback",
            });
        }

        // Completion policy: Must be RESOLVED or CLOSED
        if (!["RESOLVED", "CLOSED"].includes(complaint.status)) {
            return res.status(400).json({
                message: `Feedback can only be submitted for completed complaints (status must be RESOLVED or CLOSED; current status is ${complaint.status})`,
            });
        }

        // Check for duplicate feedback
        const existingFeedback = await Feedback.findOne({
            complaint: complaint._id,
            submittedBy: req.user._id,
        });

        if (existingFeedback) {
            return res.status(409).json({
                message: "Feedback has already been submitted for this complaint",
            });
        }

        const feedback = new Feedback({
            complaint: complaint._id,
            submittedBy: req.user._id,
            agent: complaint.assignedAgent || null,
            rating: parseInt(rating, 10),
            comments: typeof comments === "string" ? comments.trim() : "",
        });

        await feedback.save();

        const populatedFeedback = await Feedback.findById(feedback._id)
            .populate("submittedBy", "name email")
            .populate("agent", "name email");

        // Non-blocking notification to assigned officer
        if (complaint.assignedAgent) {
            (async () => {
                try {
                    const agentUser = await User.findById(complaint.assignedAgent);
                    if (agentUser) {
                        notifyFeedbackSubmitted(complaint, feedback, agentUser).catch(() => {});
                    }
                } catch (_) {}
            })();
        }

        return res.status(201).json({
            message: "Feedback submitted successfully",
            feedback: populatedFeedback,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "Feedback has already been submitted for this complaint",
            });
        }

        console.error("Submit feedback error:", error.message);
        return res.status(500).json({
            message: "Unable to submit feedback",
        });
    }
};

/**
 * GET /api/feedback/complaint/:complaintId
 * Retrieve feedback for a specific complaint with access control
 */
const getFeedbackForComplaint = async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.complaintId);
        if (!complaint) {
            return res.status(404).json({
                message: "Complaint not found",
            });
        }

        // Authorization check: Citizen owner, assigned agent, or admin
        const isOwner = complaint.createdBy.toString() === req.user._id.toString();
        const isAssigned = complaint.assignedAgent && complaint.assignedAgent.toString() === req.user._id.toString();
        const isAdmin = req.user.role === "ADMIN";

        if (!isOwner && !isAssigned && !isAdmin) {
            return res.status(403).json({
                message: "Access denied: You are not authorized to view feedback for this complaint",
            });
        }

        const feedback = await Feedback.findOne({ complaint: complaint._id })
            .populate("submittedBy", "name email")
            .populate("agent", "name email");

        if (!feedback) {
            return res.status(404).json({
                message: "No feedback found for this complaint",
            });
        }

        return res.status(200).json({
            feedback,
        });
    } catch (error) {
        console.error("Get feedback error:", error.message);
        return res.status(500).json({
            message: "Unable to retrieve feedback",
        });
    }
};

/**
 * GET /api/feedback
 * List feedback scoped by caller's role
 */
const listFeedback = async (req, res) => {
    try {
        const filter = {};

        if (req.user.role === "USER") {
            filter.submittedBy = req.user._id;
        } else if (req.user.role === "AGENT") {
            const agentProfile = await Agent.findOne({ user: req.user._id });
            if (!agentProfile || agentProfile.approvalStatus !== "APPROVED") {
                return res.status(403).json({
                    message: "Agent account is not approved to view feedback",
                });
            }
            filter.agent = req.user._id;
        }
        // ADMIN sees all feedback

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const skip = (page - 1) * limit;

        const [feedbackList, total] = await Promise.all([
            Feedback.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("submittedBy", "name email")
                .populate("agent", "name email")
                .populate("complaint", "trackingId title status"),
            Feedback.countDocuments(filter),
        ]);

        return res.status(200).json({
            feedback: feedbackList,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        console.error("List feedback error:", error.message);
        return res.status(500).json({
            message: "Unable to list feedback",
        });
    }
};

module.exports = {
    submitFeedback,
    getFeedbackForComplaint,
    listFeedback,
};
