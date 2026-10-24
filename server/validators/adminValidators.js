const { body, query, param } = require("express-validator");

/**
 * Validation rules for querying agent applications
 */
const listAgentsValidator = [
    query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),

    query("limit")
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage("Limit must be between 1 and 50"),

    query("status")
        .optional()
        .isIn(["PENDING", "APPROVED", "REJECTED"])
        .withMessage("Status filter must be PENDING, APPROVED, or REJECTED"),
];

/**
 * Validation rules for rejecting an agent application
 */
const rejectAgentValidator = [
    param("id")
        .isMongoId()
        .withMessage("Invalid agent profile identifier format"),

    body("rejectionReason")
        .trim()
        .notEmpty()
        .withMessage("Rejection reason is required")
        .isLength({ min: 3, max: 500 })
        .withMessage("Rejection reason must be between 3 and 500 characters"),
];

/**
 * Validation rules for listing users
 */
const listUsersValidator = [
    query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),

    query("limit")
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage("Limit must be between 1 and 50"),

    query("role")
        .optional()
        .isIn(["USER", "AGENT", "ADMIN"])
        .withMessage("Role filter must be USER, AGENT, or ADMIN"),

    query("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive filter must be boolean"),

    query("search")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("Search query cannot exceed 100 characters"),
];

/**
 * Validation rules for updating user account active status
 */
const updateUserStatusValidator = [
    param("id")
        .isMongoId()
        .withMessage("Invalid user identifier format"),

    body("isActive")
        .notEmpty()
        .withMessage("isActive is required")
        .isBoolean()
        .withMessage("isActive must be a boolean value"),

    // Reject attempts to alter role, password, or profile fields through this endpoint
    body(["role", "password", "email", "_id", "name"])
        .custom((val, { path }) => {
            if (val !== undefined) {
                throw new Error(`Modifying field '${path}' is prohibited through account status management`);
            }
            return true;
        }),
];

/**
 * Validation rules for analytics date range queries
 */
const analyticsQueryValidator = [
    query("startDate")
        .optional()
        .isISO8601()
        .withMessage("startDate must be a valid ISO8601 date string"),

    query("endDate")
        .optional()
        .isISO8601()
        .withMessage("endDate must be a valid ISO8601 date string"),
];

const adminMongoIdValidator = [
    param("id")
        .isMongoId()
        .withMessage("Invalid identifier format"),
];

module.exports = {
    listAgentsValidator,
    rejectAgentValidator,
    listUsersValidator,
    updateUserStatusValidator,
    analyticsQueryValidator,
    adminMongoIdValidator,
};
