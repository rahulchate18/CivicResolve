const mongoose = require("mongoose");

/**
 * Message Model for Complaint-Bound Communication
 *
 * AUTHORIZATION POLICY (To be enforced in future messaging controller):
 * Only the citizen who created the complaint (complaint.createdBy) and
 * the currently assigned agent (complaint.assignedAgent) are authorized
 * to view or post messages in a complaint thread.
 * Administrators may access threads for oversight and dispute resolution.
 */

const messageAttachmentSchema = new mongoose.Schema(
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

const messageSchema = new mongoose.Schema(
    {
        complaint: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Complaint",
            required: [true, "Complaint reference is required"],
        },

        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Message sender reference is required"],
        },

        message: {
            type: String,
            required: [true, "Message content is required"],
            trim: true,
            minlength: [1, "Message content cannot be empty"],
            maxlength: [2000, "Message content cannot exceed 2000 characters"],
        },

        attachments: {
            type: [messageAttachmentSchema],
            default: [],
        },

        isRead: {
            type: Boolean,
            default: false,
        },

        readAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for conversation sorting and unread message queries
messageSchema.index({ complaint: 1, createdAt: 1 });
messageSchema.index({ complaint: 1, isRead: 1 });

module.exports = mongoose.model("Message", messageSchema);
