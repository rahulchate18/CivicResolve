const mongoose = require("mongoose");

const agentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Associated user account reference is required"],
            unique: true,
        },

        department: {
            type: String,
            required: [true, "Agent department is required"],
            trim: true,
            maxlength: [100, "Department cannot exceed 100 characters"],
        },

        specialization: {
            type: [String],
            default: [],
        },

        approvalStatus: {
            type: String,
            enum: {
                values: ["PENDING", "APPROVED", "REJECTED"],
                message: "{VALUE} is not a valid agent approval status",
            },
            default: "PENDING",
            required: true,
        },

        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        approvedAt: {
            type: Date,
            default: null,
        },

        rejectionReason: {
            type: String,
            trim: true,
            maxlength: [500, "Rejection reason cannot exceed 500 characters"],
            default: "",
        },

        isAvailable: {
            type: Boolean,
            default: true,
        },

        maxActiveComplaints: {
            type: Number,
            default: 10,
            min: [1, "Maximum active complaints must be at least 1"],
            max: [100, "Maximum active complaints cannot exceed 100"],
        },

        activeComplaintsCount: {
            type: Number,
            default: 0,
            min: [0, "Active complaints count cannot be negative"],
        },

        totalResolved: {
            type: Number,
            default: 0,
            min: [0, "Total resolved count cannot be negative"],
        },
    },
    {
        timestamps: true,
    }
);

// Query optimization indexes
agentSchema.index({ user: 1 }, { unique: true });
agentSchema.index({ approvalStatus: 1, isAvailable: 1 });
agentSchema.index({ department: 1, approvalStatus: 1 });

module.exports = mongoose.model("Agent", agentSchema);
