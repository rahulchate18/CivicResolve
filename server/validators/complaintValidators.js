const { body, query, param } = require("express-validator");

/**
 * Validation rules for creating a complaint
 */
const createComplaintValidator = [
    body("title")
        .trim()
        .notEmpty()
        .withMessage("Title is required")
        .isLength({ min: 5, max: 150 })
        .withMessage("Title must be between 5 and 150 characters"),

    body("description")
        .trim()
        .notEmpty()
        .withMessage("Description is required")
        .isLength({ min: 10, max: 5000 })
        .withMessage("Description must be between 10 and 5000 characters"),

    body("category")
        .trim()
        .notEmpty()
        .withMessage("Category is required")
        .isIn(["Technical", "Billing", "Service", "Product", "Other"])
        .withMessage("Category must be one of: Technical, Billing, Service, Product, Other"),

    body("priority")
        .optional()
        .isIn(["LOW", "MEDIUM", "HIGH", "URGENT"])
        .withMessage("Priority must be one of: LOW, MEDIUM, HIGH, URGENT"),

    body("citizenContact.phone")
        .optional()
        .trim()
        .isLength({ max: 25 })
        .withMessage("Phone cannot exceed 25 characters"),

    body("citizenContact.address")
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage("Address cannot exceed 200 characters"),

    body("citizenContact.city")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("City cannot exceed 100 characters"),

    body("citizenContact.state")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("State cannot exceed 100 characters"),

    body("citizenContact.postalCode")
        .optional()
        .trim()
        .isLength({ max: 20 })
        .withMessage("Postal code cannot exceed 20 characters"),

    body("attachments")
        .optional()
        .isArray()
        .withMessage("Attachments must be an array of metadata objects"),

    body("attachments.*.filename")
        .if(body("attachments").exists())
        .trim()
        .notEmpty()
        .withMessage("Attachment filename is required"),

    body("attachments.*.originalName")
        .if(body("attachments").exists())
        .trim()
        .notEmpty()
        .withMessage("Attachment original name is required"),

    body("attachments.*.url")
        .if(body("attachments").exists())
        .trim()
        .notEmpty()
        .withMessage("Attachment storage URL/key is required"),

    body("attachments.*.mimeType")
        .if(body("attachments").exists())
        .trim()
        .notEmpty()
        .withMessage("Attachment MIME type is required"),

    body("attachments.*.size")
        .if(body("attachments").exists())
        .isInt({ min: 1, max: 10 * 1024 * 1024 })
        .withMessage("Attachment file size must be between 1 byte and 10 MB"),

    // Reject client-supplied privileged fields
    body(["trackingId", "status", "assignedAgent", "statusHistory", "resolution", "resolvedAt", "createdBy"])
        .custom((val, { path }) => {
            if (val !== undefined) {
                throw new Error(`Client self-assignment of '${path}' is prohibited`);
            }
            return true;
        }),
];

/**
 * Validation rules for updating complaint status
 */
const updateStatusValidator = [
    param("id")
        .isMongoId()
        .withMessage("Invalid complaint identifier format"),

    body("status")
        .trim()
        .notEmpty()
        .withMessage("New status is required")
        .isIn(["PENDING", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "REJECTED"])
        .withMessage("Invalid complaint status"),

    body("notes")
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage("Notes cannot exceed 1000 characters"),

    body("resolution")
        .optional()
        .trim()
        .isLength({ max: 3000 })
        .withMessage("Resolution text cannot exceed 3000 characters"),
];

/**
 * Validation rules for assigning an agent to a complaint
 */
const assignAgentValidator = [
    param("id")
        .isMongoId()
        .withMessage("Invalid complaint identifier format"),

    body("agentId")
        .trim()
        .notEmpty()
        .withMessage("Agent ID is required")
        .isMongoId()
        .withMessage("Invalid agent identifier format"),

    body("notes")
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage("Notes cannot exceed 1000 characters"),
];

/**
 * Validation rules for querying complaints list
 */
const listComplaintsValidator = [
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
        .isIn(["PENDING", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "REJECTED"])
        .withMessage("Invalid status filter"),

    query("category")
        .optional()
        .isIn(["Technical", "Billing", "Service", "Product", "Other"])
        .withMessage("Invalid category filter"),

    query("priority")
        .optional()
        .isIn(["LOW", "MEDIUM", "HIGH", "URGENT"])
        .withMessage("Invalid priority filter"),

    query("startDate")
        .optional()
        .isISO8601()
        .withMessage("startDate must be a valid ISO8601 date string"),

    query("endDate")
        .optional()
        .isISO8601()
        .withMessage("endDate must be a valid ISO8601 date string"),
];

/**
 * Validation rules for complaint ID parameter
 */
const mongoIdParamValidator = [
    param("id")
        .isMongoId()
        .withMessage("Invalid complaint identifier format"),
];

/**
 * Validation rules for trackingId parameter
 */
const trackingIdParamValidator = [
    param("trackingId")
        .trim()
        .notEmpty()
        .withMessage("Tracking ID is required")
        .matches(/^CMP-\d{8}-[0-9A-Z]{4,10}$/i)
        .withMessage("Invalid tracking ID format"),
];

module.exports = {
    createComplaintValidator,
    updateStatusValidator,
    assignAgentValidator,
    listComplaintsValidator,
    mongoIdParamValidator,
    trackingIdParamValidator,
};
