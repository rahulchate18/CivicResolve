const Complaint = require("../models/Complaint");
const { VALID_STATUS_TRANSITIONS } = require("../models/Complaint");
const User = require("../models/User");
const Agent = require("../models/Agent");
const {
    notifyComplaintCreated,
    notifyComplaintAssigned,
    notifyStatusChanged,
} = require("../services/emailService");

/**
 * Helper to verify if the requesting user has access to a complaint.
 * - ADMIN: Access to all complaints
 * - USER: Access only to complaints they created
 * - AGENT: Access only to assigned complaints, and only if agent is APPROVED
 */
const verifyComplaintAccess = async (complaint, user) => {
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
 * POST /api/complaints
 * Create a new complaint for the authenticated citizen
 */
const createComplaint = async (req, res) => {
    try {
        const { title, description, category, priority, citizenContact, attachments } = req.body;

        // Auto-fallback citizen contact to user profile if not provided
        const contactInfo = {
            phone: citizenContact?.phone || req.user.phone || "",
            address: citizenContact?.address || req.user.address || "",
            city: citizenContact?.city || req.user.city || "",
            state: citizenContact?.state || req.user.state || "",
            postalCode: citizenContact?.postalCode || req.user.postalCode || "",
        };

        const complaint = new Complaint({
            title: title.trim(),
            description: description.trim(),
            category,
            priority: priority || "MEDIUM",
            status: "PENDING",
            createdBy: req.user._id,
            citizenContact: contactInfo,
            attachments: Array.isArray(attachments) ? attachments : [],
            statusHistory: [
                {
                    status: "PENDING",
                    changedBy: req.user._id,
                    changedAt: new Date(),
                    notes: "Complaint registered by citizen",
                },
            ],
        });

        await complaint.save();

        const populatedComplaint = await Complaint.findById(complaint._id)
            .populate("createdBy", "name email phone");

        // Non-blocking notification dispatch
        notifyComplaintCreated(populatedComplaint, populatedComplaint.createdBy).catch(() => {});

        return res.status(201).json({
            message: "Complaint registered successfully",
            complaint: populatedComplaint,
        });
    } catch (error) {
        console.error("Create complaint error:", error.message);
        return res.status(500).json({
            message: "Unable to create complaint",
        });
    }
};

/**
 * GET /api/complaints
 * List and filter complaints with role-based visibility and pagination
 */
const getComplaints = async (req, res) => {
    try {
        const query = {};

        // Role-based visibility scoping
        if (req.user.role === "USER") {
            query.createdBy = req.user._id;
        } else if (req.user.role === "AGENT") {
            const agentProfile = await Agent.findOne({ user: req.user._id });
            if (!agentProfile || agentProfile.approvalStatus !== "APPROVED") {
                return res.status(403).json({
                    message: "Agent account is pending administrator approval",
                });
            }
            query.assignedAgent = req.user._id;
        }
        // ADMIN queries all complaints (query remains unrestricted)

        // Query filters
        if (req.query.status) {
            query.status = req.query.status;
        }
        if (req.query.category) {
            query.category = req.query.category;
        }
        if (req.query.priority) {
            query.priority = req.query.priority;
        }
        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            if (req.query.startDate) {
                query.createdAt.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                query.createdAt.$lte = new Date(req.query.endDate);
            }
        }

        // Bounded pagination
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const skip = (page - 1) * limit;

        const [complaints, total] = await Promise.all([
            Complaint.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("createdBy", "name email phone")
                .populate("assignedAgent", "name email"),
            Complaint.countDocuments(query),
        ]);

        return res.status(200).json({
            complaints,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        console.error("List complaints error:", error.message);
        return res.status(500).json({
            message: "Unable to retrieve complaints",
        });
    }
};

/**
 * GET /api/complaints/:id
 * Retrieve complaint by MongoDB ObjectId
 */
const getComplaintById = async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id)
            .populate("createdBy", "name email phone")
            .populate("assignedAgent", "name email")
            .populate("statusHistory.changedBy", "name role");

        if (!complaint) {
            return res.status(404).json({
                message: "Complaint not found",
            });
        }

        const isAuthorized = await verifyComplaintAccess(complaint, req.user);
        if (!isAuthorized) {
            return res.status(403).json({
                message: "Access denied: You are not authorized to view this complaint",
            });
        }

        return res.status(200).json({
            complaint,
        });
    } catch (error) {
        console.error("Get complaint by ID error:", error.message);
        return res.status(500).json({
            message: "Unable to retrieve complaint details",
        });
    }
};

/**
 * GET /api/complaints/track/:trackingId
 * Retrieve complaint by human-readable tracking ID with strict access control
 */
const getComplaintByTrackingId = async (req, res) => {
    try {
        const trackingId = req.params.trackingId.trim().toUpperCase();

        const complaint = await Complaint.findOne({ trackingId })
            .populate("createdBy", "name email phone")
            .populate("assignedAgent", "name email")
            .populate("statusHistory.changedBy", "name role");

        if (!complaint) {
            return res.status(404).json({
                message: "Complaint with specified tracking ID not found",
            });
        }

        const isAuthorized = await verifyComplaintAccess(complaint, req.user);
        if (!isAuthorized) {
            return res.status(403).json({
                message: "Access denied: You are not authorized to track this complaint",
            });
        }

        return res.status(200).json({
            complaint,
        });
    } catch (error) {
        console.error("Get complaint by tracking ID error:", error.message);
        return res.status(500).json({
            message: "Unable to retrieve tracking details",
        });
    }
};

/**
 * PATCH /api/complaints/:id/status
 * Update complaint status with strict state machine transitions and role validation
 */
const updateComplaintStatus = async (req, res) => {
    try {
        const { status: newStatus, notes, resolution } = req.body;

        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) {
            return res.status(404).json({
                message: "Complaint not found",
            });
        }

        const currentStatus = complaint.status;

        // Role-based operational permission checks
        if (req.user.role === "USER") {
            const isOwner = complaint.createdBy.toString() === req.user._id.toString();
            if (!isOwner) {
                return res.status(403).json({
                    message: "You can only manage your own complaints",
                });
            }

            // Citizens can only close resolved complaints or reopen resolved/closed complaints
            const isAllowedCitizenAction =
                (currentStatus === "RESOLVED" && newStatus === "CLOSED") ||
                ((currentStatus === "RESOLVED" || currentStatus === "CLOSED") && newStatus === "IN_PROGRESS");

            if (!isAllowedCitizenAction) {
                return res.status(403).json({
                    message: "Citizens are only permitted to close resolved complaints or reopen unresolved cases",
                });
            }
        } else if (req.user.role === "AGENT") {
            const agentProfile = await Agent.findOne({ user: req.user._id });
            if (!agentProfile || agentProfile.approvalStatus !== "APPROVED") {
                return res.status(403).json({
                    message: "Agent account is not approved for operational updates",
                });
            }

            if (!complaint.assignedAgent || complaint.assignedAgent.toString() !== req.user._id.toString()) {
                return res.status(403).json({
                    message: "You can only update complaints assigned to you",
                });
            }

            // Agents cannot set CLOSED (only Citizen or Admin can close)
            if (newStatus === "CLOSED") {
                return res.status(403).json({
                    message: "Only the citizen or an administrator can close a complaint",
                });
            }
        }
        // ADMIN can perform any valid transition

        // Validate state machine transition
        const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
        if (!allowedTransitions.includes(newStatus)) {
            return res.status(400).json({
                message: `Invalid status transition from '${currentStatus}' to '${newStatus}'`,
            });
        }

        // Apply status update
        complaint.status = newStatus;

        if (newStatus === "RESOLVED") {
            complaint.resolution = resolution || notes || complaint.resolution || "Resolved";
            complaint.resolvedAt = new Date();

            // Increment agent totalResolved and decrement activeComplaintsCount
            if (complaint.assignedAgent) {
                await Agent.findOneAndUpdate(
                    { user: complaint.assignedAgent, activeComplaintsCount: { $gt: 0 } },
                    { $inc: { totalResolved: 1, activeComplaintsCount: -1 } }
                );
            }
        } else if (
            (currentStatus === "RESOLVED" || currentStatus === "CLOSED") &&
            newStatus === "IN_PROGRESS"
        ) {
            // Reopening complaint
            complaint.resolvedAt = null;

            // Increment active complaints count for assigned agent
            if (complaint.assignedAgent) {
                await Agent.findOneAndUpdate(
                    { user: complaint.assignedAgent },
                    { $inc: { activeComplaintsCount: 1 } }
                );
            }
        }

        // Record audit trail in statusHistory
        complaint.statusHistory.push({
            status: newStatus,
            changedBy: req.user._id,
            changedAt: new Date(),
            notes: notes || `Status changed from ${currentStatus} to ${newStatus}`,
        });

        await complaint.save();

        const updatedComplaint = await Complaint.findById(complaint._id)
            .populate("createdBy", "name email phone")
            .populate("assignedAgent", "name email")
            .populate("statusHistory.changedBy", "name role");

        // Non-blocking status change notification
        notifyStatusChanged(updatedComplaint, newStatus, updatedComplaint.createdBy).catch(() => {});

        return res.status(200).json({
            message: "Complaint status updated successfully",
            complaint: updatedComplaint,
        });
    } catch (error) {
        console.error("Update status error:", error.message);
        return res.status(500).json({
            message: "Unable to update complaint status",
        });
    }
};

/**
 * PATCH /api/complaints/:id/assign
 * Administrator-only agent assignment and workload balancing
 */
const assignAgent = async (req, res) => {
    try {
        const { agentId, notes } = req.body;

        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) {
            return res.status(404).json({
                message: "Complaint not found",
            });
        }

        // Validate target User
        const targetUser = await User.findById(agentId);
        if (!targetUser || targetUser.role !== "AGENT" || !targetUser.isActive) {
            return res.status(400).json({
                message: "Target user is not an active agent",
            });
        }

        // Validate target Agent profile
        const targetAgentProfile = await Agent.findOne({ user: targetUser._id });
        if (!targetAgentProfile) {
            return res.status(400).json({
                message: "Agent profile does not exist for specified user",
            });
        }

        if (targetAgentProfile.approvalStatus !== "APPROVED") {
            return res.status(400).json({
                message: "Agent is not approved by administrator",
            });
        }

        if (!targetAgentProfile.isAvailable) {
            return res.status(400).json({
                message: "Agent is currently marked as unavailable for new assignments",
            });
        }

        // Workload limit enforcement
        if (targetAgentProfile.activeComplaintsCount >= targetAgentProfile.maxActiveComplaints) {
            return res.status(400).json({
                message: `Agent has reached maximum active complaint workload capacity (${targetAgentProfile.maxActiveComplaints})`,
            });
        }

        // Prevent redundant reassignment to the exact same agent
        const oldAgentId = complaint.assignedAgent;
        if (oldAgentId && oldAgentId.toString() === targetUser._id.toString()) {
            return res.status(400).json({
                message: "Complaint is already assigned to this agent",
            });
        }

        // Consistent counter adjustments:
        // Decrement previous agent's active workload if reassigning
        if (oldAgentId) {
            await Agent.findOneAndUpdate(
                { user: oldAgentId, activeComplaintsCount: { $gt: 0 } },
                { $inc: { activeComplaintsCount: -1 } }
            );
        }

        // Increment new agent's active workload
        await Agent.findOneAndUpdate(
            { user: targetUser._id },
            { $inc: { activeComplaintsCount: 1 } }
        );

        // Update complaint
        complaint.assignedAgent = targetUser._id;
        if (complaint.status === "PENDING") {
            complaint.status = "ASSIGNED";
        }

        complaint.statusHistory.push({
            status: complaint.status,
            changedBy: req.user._id,
            changedAt: new Date(),
            notes: notes || `Assigned to agent ${targetUser.name}`,
        });

        await complaint.save();

        const updatedComplaint = await Complaint.findById(complaint._id)
            .populate("createdBy", "name email phone")
            .populate("assignedAgent", "name email")
            .populate("statusHistory.changedBy", "name role");

        // Non-blocking assignment notification
        notifyComplaintAssigned(updatedComplaint, targetUser, updatedComplaint.createdBy).catch(() => {});

        return res.status(200).json({
            message: "Complaint assigned successfully",
            complaint: updatedComplaint,
        });
    } catch (error) {
        console.error("Assign agent error:", error.message);
        return res.status(500).json({
            message: "Unable to assign complaint",
        });
    }
};

module.exports = {
    createComplaint,
    getComplaints,
    getComplaintById,
    getComplaintByTrackingId,
    updateComplaintStatus,
    assignAgent,
};
