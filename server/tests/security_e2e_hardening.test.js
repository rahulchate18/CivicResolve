const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret_key_minimum_32_chars_long_for_security";
process.env.PORT = "0";
process.env.NODE_ENV = "test";

const app = require("../server");
const User = require("../models/User");
const Agent = require("../models/Agent");
const Complaint = require("../models/Complaint");
const Message = require("../models/Message");
const Feedback = require("../models/Feedback");

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

const createTestToken = (userId, role = "USER") => {
    return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
};

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

// ==========================================================
// TEST SUITE: Phase 7 End-to-End Hardening & Security Audit
// ==========================================================

test("1. Cross-citizen isolation: Citizen cannot view or track another citizen's complaint", async () => {
    const citizenAId = "650000000000000000000001";
    const citizenBId = "650000000000000000000002";
    const complaintId = "650000000000000000000010";

    const origUserFindById = User.findById;
    const origComplaintFindById = Complaint.findById;
    const origComplaintFindOne = Complaint.findOne;

    try {
        User.findById = (id) => ({
            select: async () => ({
                _id: id,
                name: "Citizen Beta",
                role: "USER",
                isActive: true,
            }),
        });

        const mockComplaintDoc = {
            _id: complaintId,
            trackingId: "CMP-20261023-AAAA",
            title: "Alpha's Private Complaint",
            description: "Confidential street issue",
            createdBy: citizenAId, // Belongs to Citizen A
            status: "PENDING",
            populate: function () {
                return this;
            },
        };

        Complaint.findById = () => ({
            populate: () => ({
                populate: () => ({
                    populate: async () => mockComplaintDoc,
                }),
            }),
        });

        Complaint.findOne = () => ({
            populate: () => ({
                populate: () => ({
                    populate: async () => mockComplaintDoc,
                }),
            }),
        });

        const tokenB = createTestToken(citizenBId, "USER");

        // Citizen B attempts to access Citizen A's complaint by ID -> 403 Forbidden
        const resId = await request(`/api/complaints/${complaintId}`, {
            headers: { Authorization: `Bearer ${tokenB}` },
        });
        assert.strictEqual(resId.status, 403);
        assert.match(resId.body.message, /not authorized|access denied/i);

        // Citizen B attempts to track Citizen A's complaint by trackingId -> 403 Forbidden
        const resTrack = await request(`/api/complaints/track/CMP-20261023-AAAA`, {
            headers: { Authorization: `Bearer ${tokenB}` },
        });
        assert.strictEqual(resTrack.status, 403);
        assert.match(resTrack.body.message, /not authorized|access denied/i);
    } finally {
        User.findById = origUserFindById;
        Complaint.findById = origComplaintFindById;
        Complaint.findOne = origComplaintFindOne;
    }
});

test("2. Cross-citizen message thread isolation: Citizen cannot message another citizen's complaint", async () => {
    const ownerId = "650000000000000000000001";
    const intruderId = "650000000000000000000003";
    const complaintId = "650000000000000000000020";

    const origUserFindById = User.findById;
    const origComplaintFindById = Complaint.findById;

    try {
        User.findById = (id) => ({
            select: async () => ({
                _id: id,
                name: "Intruder Citizen",
                role: "USER",
                isActive: true,
            }),
        });

        Complaint.findById = () => ({
            populate: () => ({
                populate: async () => ({
                    _id: complaintId,
                    createdBy: { _id: ownerId }, // Owner is citizen 1
                    assignedAgent: null,
                }),
            }),
        });

        const intruderToken = createTestToken(intruderId, "USER");

        // Intruder attempts to send message to owner's thread -> 403 Forbidden
        const sendRes = await request(`/api/complaints/${complaintId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${intruderToken}` },
            body: { message: "Unauthorized message injection attempt" },
        });
        assert.strictEqual(sendRes.status, 403);
        assert.match(sendRes.body.message, /not authorized/i);
    } finally {
        User.findById = origUserFindById;
        Complaint.findById = origComplaintFindById;
    }
});

test("3. Officer assignment guard: Unassigned officer cannot message or update complaint", async () => {
    const officer1Id = "650000000000000000000031";
    const officer2Id = "650000000000000000000032";
    const complaintId = "650000000000000000000030";

    const origUserFindById = User.findById;
    const origAgentFindOne = Agent.findOne;
    const origComplaintFindById = Complaint.findById;

    try {
        User.findById = (id) => ({
            select: async () => ({
                _id: id,
                name: "Unassigned Officer",
                role: "AGENT",
                isActive: true,
            }),
        });

        Agent.findOne = async () => ({
            approvalStatus: "APPROVED",
            isAvailable: true,
        });

        Complaint.findById = async () => ({
            _id: complaintId,
            status: "ASSIGNED",
            createdBy: "650000000000000000000001",
            assignedAgent: officer1Id, // Assigned to officer 1, NOT officer 2
            populate: function () {
                return this;
            },
        });

        const officer2Token = createTestToken(officer2Id, "AGENT");

        // Unassigned officer attempts status update -> 403 Forbidden
        const updateRes = await request(`/api/complaints/${complaintId}/status`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${officer2Token}` },
            body: { status: "IN_PROGRESS", notes: "Interfering update" },
        });
        assert.strictEqual(updateRes.status, 403);
        assert.match(updateRes.body.message, /assigned to you/i);
    } finally {
        User.findById = origUserFindById;
        Agent.findOne = origAgentFindOne;
        Complaint.findById = origComplaintFindById;
    }
});

test("4. Lifecycle role boundaries: Officers cannot CLOSE complaints and Citizens cannot directly RESOLVE complaints", async () => {
    const citizenId = "650000000000000000000041";
    const officerId = "650000000000000000000042";
    const complaintId = "650000000000000000000040";

    const origUserFindById = User.findById;
    const origAgentFindOne = Agent.findOne;
    const origComplaintFindById = Complaint.findById;

    try {
        const citizenToken = createTestToken(citizenId, "USER");
        const officerToken = createTestToken(officerId, "AGENT");

        // 1. Citizen attempts to set status to RESOLVED directly
        User.findById = () => ({
            select: async () => ({
                _id: citizenId,
                name: "Test Citizen",
                role: "USER",
                isActive: true,
            }),
        });

        Complaint.findById = async () => ({
            _id: complaintId,
            status: "IN_PROGRESS",
            createdBy: citizenId,
            assignedAgent: officerId,
        });

        const citResolveRes = await request(`/api/complaints/${complaintId}/status`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${citizenToken}` },
            body: { status: "RESOLVED", resolution: "Citizen self-resolved" },
        });
        assert.strictEqual(citResolveRes.status, 403);
        assert.match(citResolveRes.body.message, /only permitted to close resolved complaints or reopen/i);

        // 2. Officer attempts to directly set status to CLOSED
        User.findById = () => ({
            select: async () => ({
                _id: officerId,
                name: "Assigned Officer",
                role: "AGENT",
                isActive: true,
            }),
        });

        Agent.findOne = async () => ({
            approvalStatus: "APPROVED",
            isAvailable: true,
        });

        Complaint.findById = async () => ({
            _id: complaintId,
            status: "RESOLVED",
            createdBy: citizenId,
            assignedAgent: officerId,
        });

        const offCloseRes = await request(`/api/complaints/${complaintId}/status`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${officerToken}` },
            body: { status: "CLOSED", notes: "Officer forced close" },
        });
        assert.strictEqual(offCloseRes.status, 403);
        assert.match(offCloseRes.body.message, /only the citizen or an administrator can close/i);
    } finally {
        User.findById = origUserFindById;
        Agent.findOne = origAgentFindOne;
        Complaint.findById = origComplaintFindById;
    }
});

test("5. Feedback enforcement: Feedback blocked for non-owner, non-resolved status, and duplicates", async () => {
    const ownerId = "650000000000000000000051";
    const nonOwnerId = "650000000000000000000052";
    const complaintId = "650000000000000000000050";

    const origUserFindById = User.findById;
    const origComplaintFindById = Complaint.findById;
    const origFeedbackFindOne = Feedback.findOne;

    try {
        const ownerToken = createTestToken(ownerId, "USER");
        const nonOwnerToken = createTestToken(nonOwnerId, "USER");

        // 1. Complaint is still IN_PROGRESS -> 400 Bad Request
        User.findById = () => ({
            select: async () => ({ _id: ownerId, role: "USER", isActive: true }),
        });
        Complaint.findById = async () => ({
            _id: complaintId,
            status: "IN_PROGRESS",
            createdBy: ownerId,
        });

        const earlyRes = await request(`/api/feedback`, {
            method: "POST",
            headers: { Authorization: `Bearer ${ownerToken}` },
            body: { complaintId, rating: 5, comments: "Too early" },
        });
        assert.strictEqual(earlyRes.status, 400);
        assert.match(earlyRes.body.message, /completed complaints/i);

        // 2. Complaint is RESOLVED, but submitted by non-owner -> 403 Forbidden
        User.findById = () => ({
            select: async () => ({ _id: nonOwnerId, role: "USER", isActive: true }),
        });
        Complaint.findById = async () => ({
            _id: complaintId,
            status: "RESOLVED",
            createdBy: ownerId,
        });

        const nonOwnerRes = await request(`/api/feedback`, {
            method: "POST",
            headers: { Authorization: `Bearer ${nonOwnerToken}` },
            body: { complaintId, rating: 5, comments: "Unauthorized user" },
        });
        assert.strictEqual(nonOwnerRes.status, 403);

        // 3. Duplicate feedback attempt -> 409 Conflict
        User.findById = () => ({
            select: async () => ({ _id: ownerId, role: "USER", isActive: true }),
        });
        Feedback.findOne = async () => ({ _id: "650000000000000000000099" }); // Already exists

        const dupRes = await request(`/api/feedback`, {
            method: "POST",
            headers: { Authorization: `Bearer ${ownerToken}` },
            body: { complaintId, rating: 5, comments: "Second feedback" },
        });
        assert.strictEqual(dupRes.status, 409);
        assert.match(dupRes.body.message, /already been submitted/i);
    } finally {
        User.findById = origUserFindById;
        Complaint.findById = origComplaintFindById;
        Feedback.findOne = origFeedbackFindOne;
    }
});

test("6. Token revocation on account deactivation: Deactivated user account is rejected by protect middleware", async () => {
    const userId = "650000000000000000000061";
    const origUserFindById = User.findById;

    try {
        const token = createTestToken(userId, "USER");

        User.findById = () => ({
            select: async () => ({
                _id: userId,
                name: "Deactivated User",
                role: "USER",
                isActive: false, // Account marked inactive
            }),
        });

        const res = await request("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
        });

        assert.strictEqual(res.status, 401);
        assert.match(res.body.message, /deactivated/i);
    } finally {
        User.findById = origUserFindById;
    }
});

test("7. Administrator safeguards: Admin self-deactivation and last-admin deactivation blocked", async () => {
    const adminId = "650000000000000000000071";
    const origUserFindById = User.findById;
    const origUserCount = User.countDocuments;

    try {
        const adminToken = createTestToken(adminId, "ADMIN");

        // 1. Admin attempts self-deactivation -> 400 Bad Request
        User.findById = () => ({
            select: async () => ({
                _id: adminId,
                name: "Super Admin",
                role: "ADMIN",
                isActive: true,
            }),
        });

        const selfDeactRes = await request(`/api/admin/users/${adminId}/status`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${adminToken}` },
            body: { isActive: false },
        });
        assert.strictEqual(selfDeactRes.status, 400);
        assert.match(selfDeactRes.body.message, /cannot deactivate their own account/i);

        // 2. Admin attempts to deactivate the last active admin
        const otherAdminId = "650000000000000000000072";
        User.findById = (id) => ({
            select: async () => ({
                _id: id,
                name: "Sole Other Admin",
                role: "ADMIN",
                isActive: true,
            }),
        });
        User.countDocuments = async () => 1; // Only 1 active admin remains

        const lastAdminRes = await request(`/api/admin/users/${otherAdminId}/status`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${adminToken}` },
            body: { isActive: false },
        });
        assert.strictEqual(lastAdminRes.status, 400);
        assert.match(lastAdminRes.body.message, /last active administrator/i);
    } finally {
        User.findById = origUserFindById;
        User.countDocuments = origUserCount;
    }
});
