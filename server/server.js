const dns = require("node:dns/promises");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const complaintRoutes = require("./routes/complaintRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

// Security and middleware
app.use(helmet());

const allowedOrigins = [
    ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",").map((url) => url.trim()) : []),
    "http://localhost:5173",
    "http://localhost:5174",
].filter(Boolean);

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    })
);

app.use(express.json({ limit: "10kb" }));

// Health-check route
app.get("/", (req, res) => {
    res.json({
        message: "Online Complaint Registration API is running",
    });
});

// Authentication routes
app.use("/api/auth", authRoutes);

// Complaint routes
app.use("/api/complaints", complaintRoutes);

// Feedback routes
app.use("/api/feedback", feedbackRoutes);

// Admin routes
app.use("/api/admin", adminRoutes);

// 404 handler for undefined routes
app.use(notFound);

// Centralized error handling
app.use(errorHandler);

// Server configuration
const PORT = process.env.PORT || 5000;

// Connect to MongoDB before starting the server
const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
};

if (require.main === module) {
    startServer();
}

module.exports = app;
