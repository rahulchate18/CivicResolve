const User = require("../models/User");
const Agent = require("../models/Agent");
const Complaint = require("../models/Complaint");

// ==========================================
// 1. OFFICER APPLICATION MANAGEMENT
// ==========================================

/**
 * GET /api/admin/agents
 * List officer applications with pagination and status filtering
 */
const getAgentApplications = async (req, res) => {
    try {
        const query = {};
        if (req.query.status) {
            query.approvalStatus = req.query.status;
        }

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const skip = (page - 1) * limit;

        const [agents, total] = await Promise.all([
            Agent.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("user", "name email phone role isActive createdAt")
                .populate("approvedBy", "name email"),
            Agent.countDocuments(query),
        ]);

        return res.status(200).json({
            agents,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        console.error("Get agent applications error:", error.message);
        return res.status(500).json({
            message: "Unable to retrieve agent applications",
        });
    }
};

/**
 * GET /api/admin/agents/:id
 * Retrieve single officer application details
 */
const getAgentApplicationById = async (req, res) => {
    try {
        const agent = await Agent.findById(req.params.id)
            .populate("user", "name email phone role isActive createdAt")
            .populate("approvedBy", "name email");

        if (!agent) {
            return res.status(404).json({
                message: "Agent application profile not found",
            });
        }

        return res.status(200).json({
            agent,
        });
    } catch (error) {
        console.error("Get agent application by ID error:", error.message);
        return res.status(500).json({
            message: "Unable to retrieve agent application details",
        });
    }
};

/**
 * PATCH /api/admin/agents/:id/approve
 * Approve a pending officer application
 */
const approveAgentApplication = async (req, res) => {
    try {
        const agent = await Agent.findById(req.params.id);
        if (!agent) {
            return res.status(404).json({
                message: "Agent application profile not found",
            });
        }

        if (agent.approvalStatus === "APPROVED") {
            return res.status(400).json({
                message: "Agent application is already approved",
            });
        }

        const linkedUser = await User.findById(agent.user);
        if (!linkedUser) {
            return res.status(400).json({
                message: "Linked user account does not exist",
            });
        }

        if (!linkedUser.isActive) {
            return res.status(400).json({
                message: "Cannot approve application for a deactivated user account",
            });
        }

        // Ensure user account is assigned AGENT role
        if (linkedUser.role !== "AGENT") {
            linkedUser.role = "AGENT";
            await linkedUser.save();
        }

        agent.approvalStatus = "APPROVED";
        agent.approvedBy = req.user._id;
        agent.approvedAt = new Date();
        agent.rejectionReason = "";
        agent.isAvailable = true;

        await agent.save();

        const updatedAgent = await Agent.findById(agent._id)
            .populate("user", "name email phone role isActive")
            .populate("approvedBy", "name email");

        return res.status(200).json({
            message: "Agent application approved successfully",
            agent: updatedAgent,
        });
    } catch (error) {
        console.error("Approve agent error:", error.message);
        return res.status(500).json({
            message: "Unable to approve agent application",
        });
    }
};

/**
 * PATCH /api/admin/agents/:id/reject
 * Reject a pending officer application with reason notes
 */
const rejectAgentApplication = async (req, res) => {
    try {
        const { rejectionReason } = req.body;

        const agent = await Agent.findById(req.params.id);
        if (!agent) {
            return res.status(404).json({
                message: "Agent application profile not found",
            });
        }

        if (agent.approvalStatus === "REJECTED") {
            return res.status(400).json({
                message: "Agent application is already rejected",
            });
        }

        if (agent.approvalStatus === "APPROVED") {
            return res.status(400).json({
                message: "Cannot reject an already approved agent directly; manage active assignments and revoke status first",
            });
        }

        agent.approvalStatus = "REJECTED";
        agent.approvedBy = req.user._id;
        agent.approvedAt = new Date();
        agent.rejectionReason = rejectionReason.trim();
        agent.isAvailable = false;

        await agent.save();

        const updatedAgent = await Agent.findById(agent._id)
            .populate("user", "name email phone role isActive")
            .populate("approvedBy", "name email");

        return res.status(200).json({
            message: "Agent application rejected",
            agent: updatedAgent,
        });
    } catch (error) {
        console.error("Reject agent error:", error.message);
        return res.status(500).json({
            message: "Unable to reject agent application",
        });
    }
};

// ==========================================
// 2. USER MANAGEMENT
// ==========================================

/**
 * GET /api/admin/users
 * List users with pagination, role/status filtering, and safe search
 */
const getUsers = async (req, res) => {
    try {
        const query = {};

        if (req.query.role) {
            query.role = req.query.role;
        }

        if (req.query.isActive !== undefined) {
            query.isActive = req.query.isActive === "true";
        }

        if (req.query.search) {
            const escapedSearch = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const searchRegex = new RegExp(escapedSearch, "i");
            query.$or = [{ name: searchRegex }, { email: searchRegex }];
        }

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            User.find(query)
                .select("-password")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            User.countDocuments(query),
        ]);

        return res.status(200).json({
            users,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        console.error("Get users error:", error.message);
        return res.status(500).json({
            message: "Unable to retrieve users",
        });
    }
};

/**
 * GET /api/admin/users/:id
 * Retrieve administrative view of user profile
 */
const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-password");
        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        return res.status(200).json({
            user,
        });
    } catch (error) {
        console.error("Get user by ID error:", error.message);
        return res.status(500).json({
            message: "Unable to retrieve user details",
        });
    }
};

/**
 * PATCH /api/admin/users/:id/status
 * Activate or deactivate a user account with self-deactivation and last-admin guards
 */
const updateUserStatus = async (req, res) => {
    try {
        const { isActive } = req.body;

        const targetUser = await User.findById(req.params.id).select("-password");
        if (!targetUser) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        // Self-deactivation protection
        if (req.user._id.toString() === targetUser._id.toString() && isActive === false) {
            return res.status(400).json({
                message: "Administrators cannot deactivate their own account",
            });
        }

        // Last active administrator protection
        if (targetUser.role === "ADMIN" && isActive === false) {
            const activeAdminCount = await User.countDocuments({
                role: "ADMIN",
                isActive: true,
            });

            if (activeAdminCount <= 1) {
                return res.status(400).json({
                    message: "Cannot deactivate the last active administrator",
                });
            }
        }

        targetUser.isActive = isActive;
        await targetUser.save();

        // If an agent account is deactivated, mark their agent availability as false
        if (targetUser.role === "AGENT" && !isActive) {
            await Agent.findOneAndUpdate({ user: targetUser._id }, { isAvailable: false });
        }

        return res.status(200).json({
            message: `User account ${isActive ? "activated" : "deactivated"} successfully`,
            user: targetUser,
        });
    } catch (error) {
        console.error("Update user status error:", error.message);
        return res.status(500).json({
            message: "Unable to update user status",
        });
    }
};

// ==========================================
// 3. ANALYTICS & METRICS
// ==========================================

/**
 * GET /api/admin/analytics/overview (and /api/admin/analytics)
 * System-wide performance and complaint metrics via MongoDB aggregation pipelines
 */
const getAnalyticsOverview = async (req, res) => {
    try {
        const dateFilter = {};
        if (req.query.startDate || req.query.endDate) {
            dateFilter.createdAt = {};
            if (req.query.startDate) {
                dateFilter.createdAt.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                dateFilter.createdAt.$lte = new Date(req.query.endDate);
            }
        }

        // 1. Total Complaints & Groupings
        const [
            totalComplaints,
            statusAgg,
            categoryAgg,
            priorityAgg,
            resolutionAgg,
            volumeAgg,
            agentAgg,
        ] = await Promise.all([
            Complaint.countDocuments(dateFilter),

            // Group by status
            Complaint.aggregate([
                { $match: dateFilter },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ]),

            // Group by category
            Complaint.aggregate([
                { $match: dateFilter },
                { $group: { _id: "$category", count: { $sum: 1 } } },
            ]),

            // Group by priority
            Complaint.aggregate([
                { $match: dateFilter },
                { $group: { _id: "$priority", count: { $sum: 1 } } },
            ]),

            // Resolution statistics: duration between resolvedAt and createdAt
            Complaint.aggregate([
                {
                    $match: {
                        ...dateFilter,
                        status: { $in: ["RESOLVED", "CLOSED"] },
                        resolvedAt: { $ne: null },
                        createdAt: { $ne: null },
                    },
                },
                {
                    $project: {
                        durationHours: {
                            $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 3600000],
                        },
                    },
                },
                {
                    $match: {
                        durationHours: { $gte: 0 },
                    },
                },
                {
                    $group: {
                        _id: null,
                        avgHours: { $avg: "$durationHours" },
                        minHours: { $min: "$durationHours" },
                        maxHours: { $max: "$durationHours" },
                        count: { $sum: 1 },
                    },
                },
            ]),

            // Volume over time (daily)
            Complaint.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
                { $limit: 30 },
            ]),

            // Officer workload and performance summary
            Agent.aggregate([
                {
                    $lookup: {
                        from: "users",
                        localField: "user",
                        foreignField: "_id",
                        as: "userInfo",
                    },
                },
                { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        _id: 1,
                        department: 1,
                        approvalStatus: 1,
                        isAvailable: 1,
                        activeComplaintsCount: 1,
                        maxActiveComplaints: 1,
                        totalResolved: 1,
                        officerName: "$userInfo.name",
                        officerEmail: "$userInfo.email",
                    },
                },
                { $sort: { totalResolved: -1 } },
                { $limit: 20 },
            ]),
        ]);

        // Normalize status counts
        const byStatus = {
            PENDING: 0,
            ASSIGNED: 0,
            IN_PROGRESS: 0,
            RESOLVED: 0,
            CLOSED: 0,
            REJECTED: 0,
        };
        for (const item of statusAgg) {
            if (item._id && byStatus[item._id] !== undefined) {
                byStatus[item._id] = item.count;
            }
        }

        // Normalize category counts
        const byCategory = {
            Technical: 0,
            Billing: 0,
            Service: 0,
            Product: 0,
            Other: 0,
        };
        for (const item of categoryAgg) {
            if (item._id && byCategory[item._id] !== undefined) {
                byCategory[item._id] = item.count;
            }
        }

        // Normalize priority counts
        const byPriority = {
            LOW: 0,
            MEDIUM: 0,
            HIGH: 0,
            URGENT: 0,
        };
        for (const item of priorityAgg) {
            if (item._id && byPriority[item._id] !== undefined) {
                byPriority[item._id] = item.count;
            }
        }

        const resStats = resolutionAgg[0] || {};
        const resolvedCount = byStatus.RESOLVED;
        const closedCount = byStatus.CLOSED;
        const rejectedCount = byStatus.REJECTED;
        const activeCount = Math.max(0, totalComplaints - (resolvedCount + closedCount + rejectedCount));

        return res.status(200).json({
            summary: {
                totalComplaints,
                resolvedCount,
                closedCount,
                rejectedCount,
                activeCount,
            },
            breakdowns: {
                byStatus,
                byCategory,
                byPriority,
            },
            resolutionMetrics: {
                resolvedCount: resStats.count || 0,
                avgResolutionHours: resStats.avgHours ? Math.round(resStats.avgHours * 10) / 10 : 0,
                minResolutionHours: resStats.minHours ? Math.round(resStats.minHours * 10) / 10 : 0,
                maxResolutionHours: resStats.maxHours ? Math.round(resStats.maxHours * 10) / 10 : 0,
            },
            volumeOverTime: volumeAgg.map((item) => ({ date: item._id, count: item.count })),
            officerPerformance: agentAgg,
        });
    } catch (error) {
        console.error("Analytics overview error:", error.message);
        return res.status(500).json({
            message: "Unable to calculate analytics metrics",
        });
    }
};

module.exports = {
    getAgentApplications,
    getAgentApplicationById,
    approveAgentApplication,
    rejectAgentApplication,
    getUsers,
    getUserById,
    updateUserStatus,
    getAnalyticsOverview,
};
