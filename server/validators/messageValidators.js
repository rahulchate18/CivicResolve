const { body, param, query } = require("express-validator");

/**
 * Validation rules for sending a complaint message
 */
const createMessageValidator = [
    param("complaintId")
        .isMongoId()
        .withMessage("Invalid complaint identifier format"),

    body("message")
        .trim()
        .notEmpty()
        .withMessage("Message content is required")
        .isLength({ min: 1, max: 2000 })
        .withMessage("Message content must be between 1 and 2000 characters"),

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
        .withMessage("Attachment URL is required"),

    body("attachments.*.mimeType")
        .if(body("attachments").exists())
        .trim()
        .notEmpty()
        .withMessage("Attachment MIME type is required"),

    body("attachments.*.size")
        .if(body("attachments").exists())
        .isInt({ min: 1, max: 10 * 1024 * 1024 })
        .withMessage("Attachment size must be between 1 byte and 10 MB"),

    // Reject client self-assignment of internal fields
    body(["sender", "complaint", "isRead", "readAt", "_id"])
        .custom((val, { path }) => {
            if (val !== undefined) {
                throw new Error(`Self-assignment of message field '${path}' is prohibited`);
            }
            return true;
        }),
];

/**
 * Validation rules for retrieving messages in a complaint thread
 */
const listMessagesValidator = [
    param("complaintId")
        .isMongoId()
        .withMessage("Invalid complaint identifier format"),

    query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),

    query("limit")
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage("Limit must be between 1 and 50"),
];

/**
 * Validation rules for marking message as read
 */
const markMessageReadValidator = [
    param("complaintId")
        .isMongoId()
        .withMessage("Invalid complaint identifier format"),

    param("messageId")
        .isMongoId()
        .withMessage("Invalid message identifier format"),
];

module.exports = {
    createMessageValidator,
    listMessagesValidator,
    markMessageReadValidator,
};
