/**
 * 404 handler for undefined API routes
 */
const notFound = (req, res, next) => {
    res.status(404).json({
        message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    });
};

/**
 * Centralized error-handling middleware for safe JSON responses
 */
const errorHandler = (err, req, res, next) => {
    let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    let message = err.message || "An unexpected server error occurred";

    // Mongoose bad ObjectId / CastError
    if (err.name === "CastError") {
        statusCode = 400;
        message = "Resource not found with specified identifier format";
    }

    // Mongoose duplicate key error (code 11000)
    if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyValue || {})[0] || "value";
        message = `A record with this ${field} already exists`;
    }

    // Mongoose schema validation error
    if (err.name === "ValidationError") {
        statusCode = 400;
        message = Object.values(err.errors)
            .map((val) => val.message)
            .join(", ");
    }

    // JWT errors
    if (err.name === "JsonWebTokenError") {
        statusCode = 401;
        message = "Invalid authorization token";
    }

    if (err.name === "TokenExpiredError") {
        statusCode = 401;
        message = "Authorization token has expired";
    }

    const response = {
        message,
    };

    // Include stack trace only in development, never in production
    if (process.env.NODE_ENV === "development") {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
};

module.exports = {
    notFound,
    errorHandler,
};
