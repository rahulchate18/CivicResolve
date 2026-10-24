const mongoose = require("mongoose");
const crypto = require("crypto");

/**
 * Valid state transitions for complaint resolution lifecycle.
 * Checked by complaint management controllers during update operations.
 */
const VALID_STATUS_TRANSITIONS = Object.freeze({
    PENDING: ["ASSIGNED", "REJECTED", "CLOSED"],
    ASSIGNED: ["IN_PROGRESS", "REJECTED", "CLOSED"],
    IN_PROGRESS: ["RESOLVED", "REJECTED", "CLOSED"],
    RESOLVED: ["CLOSED", "IN_PROGRESS"], // Reopened if resolution disputed
    CLOSED: ["IN_PROGRESS"],            // Reopened by admin on appeal
    REJECTED: ["IN_PROGRESS"],          // Reopened by admin on appeal
});

/**
 * Generate a unique, human-readable tracking ID:
 * Format: CMP-YYYYMMDD-XXXXX (e.g., CMP-20261023-A4F89)
 */
const generateTrackingId = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `CMP-${dateStr}-${randomHex}`;
};

const attachmentSchema = new mongoose.Schema(
    {
        filename: {
            type: String,
            required: [true, "Stored filename is required"],
            trim: true,
        },
        originalName: {
            type: String,
            required: [true, "Original filename is required"],
            trim: true,
        },
        url: {
            type: String,
            required: [true, "Attachment URL/storage key is required"],
            trim: true,
        },
        mimeType: {
            type: String,
            required: [true, "MIME type is required"],
            trim: true,
        },
        size: {
            type: Number,
            required: [true, "File size in bytes is required"],
            max: [10 * 1024 * 1024, "Attachment size cannot exceed 10 MB"],
        },
        uploadedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: true }
);

const statusHistorySchema = new mongoose.Schema(
    {
        status: {
            type: String,
            required: [true, "Historical status is required"],
            enum: [
                "PENDING",
                "ASSIGNED",
                "IN_PROGRESS",
                "RESOLVED",
                "CLOSED",
                "REJECTED",
            ],
        },
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Actor recording status change is required"],
        },
        changedAt: {
            type: Date,
            default: Date.now,
        },
        notes: {
            type: String,
            trim: true,
            maxlength: [1000, "Status transition notes cannot exceed 1000 characters"],
            default: "",
        },
    },
    { _id: true }
);

const citizenContactSchema = new mongoose.Schema(
    {
        phone: {
            type: String,
            trim: true,
            maxlength: [25, "Phone cannot exceed 25 characters"],
            default: "",
        },
        address: {
            type: String,
            trim: true,
            maxlength: [200, "Address cannot exceed 200 characters"],
            default: "",
        },
        city: {
            type: String,
            trim: true,
            maxlength: [100, "City cannot exceed 100 characters"],
            default: "",
        },
        state: {
            type: String,
            trim: true,
            maxlength: [100, "State cannot exceed 100 characters"],
            default: "",
        },
        postalCode: {
            type: String,
            trim: true,
            maxlength: [20, "Postal code cannot exceed 20 characters"],
            default: "",
        },
    },
    { _id: false }
);

const complaintSchema = new mongoose.Schema(
    {
        trackingId: {
            type: String,
            required: [true, "Complaint tracking ID is required"],
            unique: true,
            uppercase: true,
            trim: true,
            immutable: true,
            default: generateTrackingId,
        },

        title: {
            type: String,
            required: [true, "Complaint title is required"],
            trim: true,
            minlength: [5, "Title must contain at least 5 characters"],
            maxlength: [150, "Title cannot exceed 150 characters"],
        },

        description: {
            type: String,
            required: [true, "Complaint description is required"],
            trim: true,
            minlength: [10, "Description must contain at least 10 characters"],
            maxlength: [5000, "Description cannot exceed 5000 characters"],
        },

        category: {
            type: String,
            required: [true, "Complaint category is required"],
            enum: {
                values: [
                    "Technical",
                    "Billing",
                    "Service",
                    "Product",
                    "Other",
                ],
                message: "{VALUE} is not a valid complaint category",
            },
        },

        priority: {
            type: String,
            enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
            default: "MEDIUM",
        },

        status: {
            type: String,
            enum: [
                "PENDING",
                "ASSIGNED",
                "IN_PROGRESS",
                "RESOLVED",
                "CLOSED",
                "REJECTED",
            ],
            default: "PENDING",
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Creator reference is required"],
        },

        assignedAgent: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        citizenContact: {
            type: citizenContactSchema,
            default: () => ({}),
        },

        attachments: {
            type: [attachmentSchema],
            default: [],
        },

        statusHistory: {
            type: [statusHistorySchema],
            default: [],
        },

        resolution: {
            type: String,
            trim: true,
            maxlength: [3000, "Resolution cannot exceed 3000 characters"],
            default: "",
        },

        resolvedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Query optimization indexes
complaintSchema.index({ trackingId: 1 }, { unique: true });
complaintSchema.index({ createdBy: 1, createdAt: -1 });
complaintSchema.index({ assignedAgent: 1, status: 1 });
complaintSchema.index({ status: 1, createdAt: -1 });
complaintSchema.index({ category: 1, status: 1 });

const Complaint = mongoose.model("Complaint", complaintSchema);

module.exports = Complaint;
module.exports.VALID_STATUS_TRANSITIONS = VALID_STATUS_TRANSITIONS;
module.exports.generateTrackingId = generateTrackingId;
