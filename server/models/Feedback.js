
const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
    {
        complaint: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Complaint",
            required: true,
        },

        submittedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        agent: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        rating: {
            type: Number,
            required: [true, "Rating is required"],
            min: [1, "Rating must be at least 1"],
            max: [5, "Rating cannot exceed 5"],
            validate: {
                validator: Number.isInteger,
                message: "Rating must be a whole number between 1 and 5",
            },
        },

        comments: {
            type: String,
            trim: true,
            maxlength: [1000, "Comments cannot exceed 1000 characters"],
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

// Allow only one feedback entry per user for each complaint.
feedbackSchema.index({ complaint: 1, submittedBy: 1 }, { unique: true });

module.exports = mongoose.model("Feedback", feedbackSchema);
