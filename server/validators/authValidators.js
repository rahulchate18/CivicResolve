const { body } = require("express-validator");

/**
 * Validation rules for citizen registration
 */
const registerValidator = [
    body("name")
        .trim()
        .notEmpty()
        .withMessage("Name is required")
        .isLength({ min: 2, max: 100 })
        .withMessage("Name must be between 2 and 100 characters"),

    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Please provide a valid email address")
        .normalizeEmail({ gmail_remove_dots: false }),

    body("password")
        .notEmpty()
        .withMessage("Password is required")
        .isLength({ min: 8 })
        .withMessage("Password must contain at least 8 characters"),

    body("role")
        .optional()
        .custom((val) => {
            if (val && val !== "USER") {
                throw new Error("Self-registration for AGENT or ADMIN roles is prohibited");
            }
            return true;
        }),

    body("phone")
        .optional()
        .trim()
        .isLength({ max: 25 })
        .withMessage("Phone number cannot exceed 25 characters"),

    body("address")
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage("Address cannot exceed 200 characters"),

    body("city")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("City cannot exceed 100 characters"),

    body("state")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("State cannot exceed 100 characters"),

    body("postalCode")
        .optional()
        .trim()
        .isLength({ max: 20 })
        .withMessage("Postal code cannot exceed 20 characters"),
];

/**
 * Validation rules for user login
 */
const loginValidator = [
    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Please provide a valid email address")
        .normalizeEmail({ gmail_remove_dots: false }),

    body("password")
        .notEmpty()
        .withMessage("Password is required"),
];

/**
 * Validation rules for profile updates
 */
const updateProfileValidator = [
    body("name")
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage("Name must be between 2 and 100 characters"),

    body("phone")
        .optional()
        .trim()
        .isLength({ max: 25 })
        .withMessage("Phone number cannot exceed 25 characters"),

    body("address")
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage("Address cannot exceed 200 characters"),

    body("city")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("City cannot exceed 100 characters"),

    body("state")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("State cannot exceed 100 characters"),

    body("postalCode")
        .optional()
        .trim()
        .isLength({ max: 20 })
        .withMessage("Postal code cannot exceed 20 characters"),

    // Explicitly reject prohibited fields
    body(["role", "isActive", "password", "email", "_id"])
        .custom((val, { path }) => {
            if (val !== undefined) {
                throw new Error(`Modifying field '${path}' is not permitted via profile update`);
            }
            return true;
        }),
];

module.exports = {
    registerValidator,
    loginValidator,
    updateProfileValidator,
};
