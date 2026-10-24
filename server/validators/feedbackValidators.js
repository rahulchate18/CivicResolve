const { body, param } = require("express-validator");

/**
 * Validation rules for submitting citizen feedback
 */
const createFeedbackValidator = [
    body("complaintId")
        .trim()
        .notEmpty()
        .withMessage("Complaint ID is required")
        .isMongoId()
        .withMessage("Invalid complaint identifier format"),

    body("rating")
        .notEmpty()
        .withMessage("Rating is required")
        .isInt({ min: 1, max: 5 })
        .withMessage("Rating must be a whole integer between 1 and 5"),

    body("comments")
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage("Comments cannot exceed 1000 characters"),

    // Reject client self-assignment of internal fields
    body(["submittedBy", "agent", "_id"])
        .custom((val, { path }) => {
            if (val !== undefined) {
                throw new Error(`Self-assignment of feedback field '${path}' is prohibited`);
            }
            return true;
        }),
];

/**
 * Validation rules for retrieving feedback by complaint ID
 */
const getComplaintFeedbackValidator = [
    param("complaintId")
        .isMongoId()
        .withMessage("Invalid complaint identifier format"),
];

module.exports = {
    createFeedbackValidator,
    getComplaintFeedbackValidator,
};
