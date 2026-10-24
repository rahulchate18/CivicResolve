const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Generate a signed JWT token containing user id and current role
 */
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );
};

/**
 * Format a database user document into a safe user payload
 */
const formatSafeUser = (user) => {
    return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        phone: user.phone || "",
        address: user.address || "",
        city: user.city || "",
        state: user.state || "",
        postalCode: user.postalCode || "",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
};

/**
 * Register a new citizen account
 * Role is strictly enforced as "USER"
 */
const register = async (req, res) => {
    try {
        const { name, email, password, phone, address, city, state, postalCode } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email, and password are required",
            });
        }

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                message: "Name, email, and password must be strings",
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must contain at least 8 characters",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail,
        });

        if (existingUser) {
            return res.status(409).json({
                message: "An account with this email already exists",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // Disallow self-assignment of AGENT or ADMIN role
        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: "USER",
            phone: typeof phone === "string" ? phone.trim() : "",
            address: typeof address === "string" ? address.trim() : "",
            city: typeof city === "string" ? city.trim() : "",
            state: typeof state === "string" ? state.trim() : "",
            postalCode: typeof postalCode === "string" ? postalCode.trim() : "",
        });

        const token = generateToken(user);

        return res.status(201).json({
            message: "Registration successful",
            token,
            user: formatSafeUser(user),
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "An account with this email already exists",
            });
        }

        console.error("Registration error:", error.message);

        return res.status(500).json({
            message: "Unable to register user",
        });
    }
};

/**
 * Log in an existing user with verified credentials
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }

        const user = await User.findOne({
            email: email.trim().toLowerCase(),
        }).select("+password");

        if (!user || !user.isActive) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const token = generateToken(user);

        return res.status(200).json({
            message: "Login successful",
            token,
            user: formatSafeUser(user),
        });
    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            message: "Unable to log in",
        });
    }
};

/**
 * Get profile for authenticated user
 * (Requires protect middleware)
 */
const getProfile = async (req, res) => {
    try {
        // req.user is set by protect middleware
        return res.status(200).json({
            user: formatSafeUser(req.user),
        });
    } catch (error) {
        console.error("Get profile error:", error.message);
        return res.status(500).json({
            message: "Unable to retrieve user profile",
        });
    }
};

/**
 * Update allowed profile fields for authenticated user
 * (Requires protect middleware)
 */
const updateProfile = async (req, res) => {
    try {
        // Strictly whitelist permitted fields to avoid mass assignment
        const allowedFields = ["name", "phone", "address", "city", "state", "postalCode"];
        const updates = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                if (typeof req.body[field] === "string") {
                    updates[field] = req.body[field].trim();
                }
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                message: "No valid profile update fields provided",
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { $set: updates },
            { new: true, runValidators: true }
        ).select("-password");

        if (!updatedUser) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        return res.status(200).json({
            message: "Profile updated successfully",
            user: formatSafeUser(updatedUser),
        });
    } catch (error) {
        console.error("Update profile error:", error.message);
        return res.status(500).json({
            message: "Unable to update profile",
        });
    }
};

module.exports = {
    register,
    login,
    getProfile,
    updateProfile,
};
