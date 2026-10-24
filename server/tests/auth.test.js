const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// Ensure JWT_SECRET is set for tests without needing production .env
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret_key_minimum_32_chars_long_for_security";
process.env.PORT = "0"; // Ephemeral port
process.env.NODE_ENV = "test";

const app = require("../server");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/authMiddleware");

// Helper to make HTTP requests against the test server
let server;
let baseUrl;

test.before(async () => {
    await new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });
});

test.after(async () => {
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
});

// Helper for HTTP requests
const request = async (path, options = {}) => {
    const url = `${baseUrl}${path}`;
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };

    const res = await fetch(url, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    return { status: res.status, body: data };
};

// ==========================================
// TEST SUITE: Phase 1 Authentication & Security
// ==========================================

test("1. Health-check endpoint remains functional", async () => {
    const res = await request("/");
    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Online Complaint Registration API is running");
});

test("2. Registration validation rejects invalid inputs", async () => {
    // Missing required fields
    const resEmpty = await request("/api/auth/register", {
        method: "POST",
        body: {},
    });
    assert.equal(resEmpty.status, 400);

    // Password too short (< 8 chars)
    const resShortPass = await request("/api/auth/register", {
        method: "POST",
        body: {
            name: "John Doe",
            email: "john@example.com",
            password: "short",
        },
    });
    assert.equal(resShortPass.status, 400);

    // Invalid email format
    const resBadEmail = await request("/api/auth/register", {
        method: "POST",
        body: {
            name: "John Doe",
            email: "not-an-email",
            password: "password123",
        },
    });
    assert.equal(resBadEmail.status, 400);

    // Attempting to self-register as AGENT or ADMIN must be rejected
    const resRoleAdmin = await request("/api/auth/register", {
        method: "POST",
        body: {
            name: "Hacker User",
            email: "hacker@example.com",
            password: "password123",
            role: "ADMIN",
        },
    });
    assert.equal(resRoleAdmin.status, 400);
});

test("3. Successful registration creates citizen and returns token with safe user payload", async () => {
    const origFindOne = User.findOne;
    const origCreate = User.create;

    try {
        User.findOne = async () => null; // Email doesn't exist yet
        User.create = async (doc) => ({
            _id: "650000000000000000000001",
            name: doc.name,
            email: doc.email,
            password: doc.password,
            role: "USER",
            isActive: true,
            phone: doc.phone || "",
            address: doc.address || "",
            city: doc.city || "",
            state: doc.state || "",
            postalCode: doc.postalCode || "",
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const res = await request("/api/auth/register", {
            method: "POST",
            body: {
                name: "Rahul Citizen",
                email: "rahul@example.com",
                password: "securepassword123",
                phone: "9876543210",
            },
        });

        assert.equal(res.status, 201);
        assert.equal(res.body.message, "Registration successful");
        assert.ok(res.body.token, "Token should be returned");
        assert.equal(res.body.user.role, "USER");
        assert.equal(res.body.user.email, "rahul@example.com");
        assert.equal(res.body.user.password, undefined, "Password must not be returned in user object");
    } finally {
        User.findOne = origFindOne;
        User.create = origCreate;
    }
});

test("4. Duplicate email registration is rejected with 409 Conflict", async () => {
    const origFindOne = User.findOne;

    try {
        User.findOne = async () => ({
            _id: "650000000000000000000001",
            email: "existing@example.com",
        });

        const res = await request("/api/auth/register", {
            method: "POST",
            body: {
                name: "Duplicate User",
                email: "existing@example.com",
                password: "password123",
            },
        });

        assert.equal(res.status, 409);
        assert.match(res.body.message, /already exists/i);
    } finally {
        User.findOne = origFindOne;
    }
});

test("5. Password hashing verifies bcrypt hash is stored rather than plaintext", async () => {
    const origFindOne = User.findOne;
    const origCreate = User.create;
    let storedPasswordHash = "";

    try {
        User.findOne = async () => null;
        User.create = async (doc) => {
            storedPasswordHash = doc.password;
            return {
                _id: "650000000000000000000002",
                ...doc,
            };
        };

        await request("/api/auth/register", {
            method: "POST",
            body: {
                name: "Test Hash User",
                email: "hash@example.com",
                password: "mysecretpassword123",
            },
        });

        assert.notEqual(storedPasswordHash, "mysecretpassword123", "Plaintext password must never be stored");
        const isBcrypt = await bcrypt.compare("mysecretpassword123", storedPasswordHash);
        assert.ok(isBcrypt, "Stored password must be a valid bcrypt hash of original password");
    } finally {
        User.findOne = origFindOne;
        User.create = origCreate;
    }
});

test("6. Successful login returns 200 with JWT and user profile", async () => {
    const origFindOne = User.findOne;
    const hashedPassword = await bcrypt.hash("validpassword123", 10);

    try {
        User.findOne = () => ({
            select: async () => ({
                _id: "650000000000000000000003",
                name: "Login User",
                email: "login@example.com",
                password: hashedPassword,
                role: "USER",
                isActive: true,
            }),
        });

        const res = await request("/api/auth/login", {
            method: "POST",
            body: {
                email: "login@example.com",
                password: "validpassword123",
            },
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.message, "Login successful");
        assert.ok(res.body.token);
        assert.equal(res.body.user.email, "login@example.com");
    } finally {
        User.findOne = origFindOne;
    }
});

test("7. Invalid login credentials return 401 Unauthorized", async () => {
    const origFindOne = User.findOne;
    const hashedPassword = await bcrypt.hash("correctpass123", 10);

    try {
        User.findOne = () => ({
            select: async () => ({
                _id: "650000000000000000000003",
                email: "login@example.com",
                password: hashedPassword,
                isActive: true,
            }),
        });

        // Wrong password
        const resWrongPass = await request("/api/auth/login", {
            method: "POST",
            body: {
                email: "login@example.com",
                password: "wrongpassword",
            },
        });
        assert.equal(resWrongPass.status, 401);

        // Non-existent user
        User.findOne = () => ({ select: async () => null });
        const resNotFound = await request("/api/auth/login", {
            method: "POST",
            body: {
                email: "nobody@example.com",
                password: "correctpass123",
            },
        });
        assert.equal(resNotFound.status, 401);
    } finally {
        User.findOne = origFindOne;
    }
});

test("8. Missing bearer token on protected endpoint returns 401", async () => {
    const res = await request("/api/auth/me");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /no authorization token/i);
});

test("9. Malformed, invalid, and expired JWTs return 401", async () => {
    // Malformed token
    const resMalformed = await request("/api/auth/me", {
        headers: { Authorization: "Bearer this.is.not.a.valid.jwt" },
    });
    assert.equal(resMalformed.status, 401);

    // Invalid secret
    const fakeToken = jwt.sign({ id: "650000000000000000000001" }, "wrong_secret_key");
    const resBadSecret = await request("/api/auth/me", {
        headers: { Authorization: `Bearer ${fakeToken}` },
    });
    assert.equal(resBadSecret.status, 401);

    // Expired token
    const expiredToken = jwt.sign(
        { id: "650000000000000000000001" },
        process.env.JWT_SECRET,
        { expiresIn: "-1s" }
    );
    const resExpired = await request("/api/auth/me", {
        headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(resExpired.status, 401);
    assert.match(resExpired.body.message, /expired/i);
});

test("10. Authenticated profile retrieval (GET /api/auth/me) returns safe profile", async () => {
    const origFindById = User.findById;
    const token = jwt.sign({ id: "650000000000000000000010", role: "USER" }, process.env.JWT_SECRET);

    try {
        User.findById = () => ({
            select: async () => ({
                _id: "650000000000000000000010",
                name: "Safe Citizen",
                email: "safecitizen@example.com",
                role: "USER",
                isActive: true,
                phone: "1234567890",
                city: "New Delhi",
                createdAt: new Date(),
                updatedAt: new Date(),
            }),
        });

        const res = await request("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.user.name, "Safe Citizen");
        assert.equal(res.body.user.phone, "1234567890");
        assert.equal(res.body.user.password, undefined);
    } finally {
        User.findById = origFindById;
    }
});

test("11. Profile update whitelisting (PATCH /api/auth/me) updates permitted fields", async () => {
    const origFindById = User.findById;
    const origFindByIdAndUpdate = User.findByIdAndUpdate;
    const token = jwt.sign({ id: "650000000000000000000011", role: "USER" }, process.env.JWT_SECRET);

    try {
        User.findById = () => ({
            select: async () => ({
                _id: "650000000000000000000011",
                name: "Old Name",
                role: "USER",
                isActive: true,
            }),
        });

        let appliedUpdates = {};
        User.findByIdAndUpdate = (id, updateQuery) => {
            appliedUpdates = updateQuery.$set;
            return {
                select: async () => ({
                    _id: id,
                    name: appliedUpdates.name || "Old Name",
                    phone: appliedUpdates.phone || "",
                    city: appliedUpdates.city || "",
                    role: "USER",
                    isActive: true,
                }),
            };
        };

        const res = await request("/api/auth/me", {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
            body: {
                name: "New Updated Name",
                phone: "9998887776",
                city: "Bengaluru",
            },
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.message, "Profile updated successfully");
        assert.equal(appliedUpdates.name, "New Updated Name");
        assert.equal(appliedUpdates.phone, "9998887776");
        assert.equal(appliedUpdates.city, "Bengaluru");
    } finally {
        User.findById = origFindById;
        User.findByIdAndUpdate = origFindByIdAndUpdate;
    }
});

test("12. Attempts to change role or privileged fields via profile update are rejected", async () => {
    const origFindById = User.findById;
    const token = jwt.sign({ id: "650000000000000000000012", role: "USER" }, process.env.JWT_SECRET);

    try {
        User.findById = () => ({
            select: async () => ({
                _id: "650000000000000000000012",
                role: "USER",
                isActive: true,
            }),
        });

        // Attempting to elevate role to ADMIN
        const resRole = await request("/api/auth/me", {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
            body: {
                role: "ADMIN",
            },
        });
        assert.equal(resRole.status, 400);

        // Attempting to modify isActive
        const resActive = await request("/api/auth/me", {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
            body: {
                isActive: false,
            },
        });
        assert.equal(resActive.status, 400);

        // Attempting to inject password directly
        const resPass = await request("/api/auth/me", {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
            body: {
                password: "newplaintextpassword",
            },
        });
        assert.equal(resPass.status, 400);
    } finally {
        User.findById = origFindById;
    }
});

test("13. Role authorization middleware permits allowed roles and returns 403 for disallowed", async () => {
    // Test authorize middleware directly with mock req/res/next
    const adminOnly = authorize("ADMIN");
    const agentOrAdmin = authorize("AGENT", "ADMIN");

    // Case A: User has role "USER", tries to access ADMIN endpoint -> 403
    let statusSent = null;
    let jsonSent = null;
    let nextCalled = false;

    const mockRes403 = {
        status: (code) => {
            statusSent = code;
            return {
                json: (payload) => {
                    jsonSent = payload;
                },
            };
        },
    };

    adminOnly({ user: { role: "USER" } }, mockRes403, () => {
        nextCalled = true;
    });

    assert.equal(statusSent, 403);
    assert.equal(nextCalled, false);
    assert.match(jsonSent.message, /forbidden/i);

    // Case B: User has role "ADMIN", calls ADMIN endpoint -> next() called
    nextCalled = false;
    adminOnly({ user: { role: "ADMIN" } }, mockRes403, () => {
        nextCalled = true;
    });
    assert.equal(nextCalled, true);

    // Case C: User has role "AGENT", calls AGENT/ADMIN endpoint -> next() called
    nextCalled = false;
    agentOrAdmin({ user: { role: "AGENT" } }, mockRes403, () => {
        nextCalled = true;
    });
    assert.equal(nextCalled, true);
});

test("14. Deactivated or removed user token is rejected with 401", async () => {
    const origFindById = User.findById;
    const token = jwt.sign({ id: "650000000000000000000014" }, process.env.JWT_SECRET);

    try {
        // User marked isActive: false
        User.findById = () => ({
            select: async () => ({
                _id: "650000000000000000000014",
                isActive: false,
            }),
        });

        const resInactive = await request("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(resInactive.status, 401);
        assert.match(resInactive.body.message, /deactivated/i);

        // User deleted from DB (null)
        User.findById = () => ({
            select: async () => null,
        });

        const resDeleted = await request("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(resDeleted.status, 401);
        assert.match(resDeleted.body.message, /no longer exists/i);
    } finally {
        User.findById = origFindById;
    }
});

test("15. Undefined routes return safe 404 JSON response without leakage", async () => {
    const res = await request("/api/unknown/endpoint/route");
    assert.equal(res.status, 404);
    assert.ok(res.body.message);
    assert.equal(res.body.stack, undefined, "Stack trace must not leak in test/production");
});
