const express = require("express");
const {
    register,
    login,
    getProfile,
    updateProfile,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const {
    registerValidator,
    loginValidator,
    updateProfileValidator,
} = require("../validators/authValidators");

const router = express.Router();

// Public routes
// POST /api/auth/register
router.post("/register", registerValidator, validate, register);

// POST /api/auth/login
router.post("/login", loginValidator, validate, login);

// Protected routes
// GET /api/auth/me
router.get("/me", protect, getProfile);

// PATCH /api/auth/me
router.patch("/me", protect, updateProfileValidator, validate, updateProfile);

module.exports = router;
