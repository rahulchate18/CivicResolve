const { validationResult } = require("express-validator");

/**
 * Middleware to evaluate express-validator result and return
 * standard 400 Bad Request if validation rules failed.
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map((err) => ({
            field: err.path || err.param,
            message: err.msg,
        }));

        return res.status(400).json({
            message: formattedErrors[0].message,
            errors: formattedErrors,
        });
    }
    next();
};

module.exports = validate;
