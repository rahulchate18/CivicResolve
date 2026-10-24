const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Protect routes by verifying JWT in the Authorization Bearer header
 * and resolving the active database user.
 */
const protect = async (req, res, next) => {
    try {
        let token;
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }

        if (!token) {
            return res.status(401).json({
                message: "Access denied. No authorization token provided",
            });
        }

        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET environment variable is not defined");
            return res.status(500).json({
                message: "Internal server authentication configuration error",
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtError) {
            if (jwtError.name === "TokenExpiredError") {
                return res.status(401).json({
                    message: "Authorization token has expired. Please log in again",
                });
            }
            return res.status(401).json({
                message: "Invalid authorization token",
            });
        }

        if (!decoded || !decoded.id) {
            return res.status(401).json({
                message: "Malformed token payload",
            });
        }

        const user = await User.findById(decoded.id).select("-password");

        if (!user) {
            return res.status(401).json({
                message: "User account no longer exists",
            });
        }

        if (!user.isActive) {
            return res.status(401).json({
                message: "Account is deactivated. Please contact an administrator",
            });
        }

        // Attach safe user object to request
        req.user = user;
        next();
    } catch (error) {
        console.error("Authentication middleware error:", error.message);
        return res.status(500).json({
            message: "Authentication processing error",
        });
    }
};

/**
 * Restrict access to users with specified database roles
 * @param  {...string} roles - e.g. "ADMIN", "AGENT"
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                message: "Authentication required before authorization",
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: "Forbidden: You do not have permission to access this resource",
            });
        }

        next();
    };
};

module.exports = {
    protect,
    authorize,
};
