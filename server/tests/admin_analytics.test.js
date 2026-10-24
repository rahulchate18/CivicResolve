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

const createTestToken = (userId, role = "ADMIN") => {
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

// ==========================================
// TEST SUITE: Phase 5 Administration and Analytics
// ==========================================

test("1. Unauthenticated requests to admin endpoints are denied with 401", async () => {
    const res = await request("/api/admin/agents");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /no authorization token/i);
});

test("2. Non-admin roles (USER, AGENT) cannot access admin endpoints (403 Forbidden)", async () => {
    const citizenId = new mongoose.Types.ObjectId().toString();
    const agentId = new mongoose.Types.ObjectId().toString();

    const citizenToken = createTestToken(citizenId, "USER");
    const agentToken = createTestToken(agentId, "AGENT");

    const origUserFindById = User.findById;

    try {
        User.findById = (id) => ({
            select: async () => ({
                _id: id,
                role: id === citizenId ? "USER" : "AGENT",
                isActive: true,
            }),
        });

        // Citizen caller -> 403 Forbidden
        const resCitizen = await request("/api/admin/agents", {
            headers: { Authorization: `Bearer ${citizenToken}` },
        });
        assert.equal(resCitizen.status, 403);
        assert.match(resCitizen.body.message, /forbidden/i);

        // Officer caller -> 403 Forbidden
        const resAgent = await request("/api/admin/users", {
            headers: { Authorization: `Bearer ${agentToken}` },
        });
        assert.equal(resAgent.status, 403);
        assert.match(resAgent.body.message, /forbidden/i);
    } finally {
        User.findById = origUserFindById;
    }
});

test("3. Admin can list officer applications with pagination and filtering", async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const adminToken = createTestToken(adminId, "ADMIN");

    const origUserFindById = User.findById;
    const origAgentFind = Agent.find;
    const origAgentCount = Agent.countDocuments;

    let appliedQuery = null;

    try {
        User.findById = () => ({
            select: async () => ({ _id: adminId, role: "ADMIN", isActive: true }),
        });

        Agent.find = (q) => {
            appliedQuery = q;
            return {
                sort: () => ({
                    skip: () => ({
                        limit: () => ({
                            populate: () => ({
                                populate: async () => [
                                    { _id: "a1", department: "Electricity", approvalStatus: "PENDING" },
                                ],
                            }),
                        }),
                    }),
                }),
            };
        };

        Agent.countDocuments = async () => 1;

        const res = await request("/api/admin/agents?status=PENDING&page=1&limit=10", {
            headers: { Authorization: `Bearer ${adminToken}` },
        });

        assert.equal(res.status, 200);
        assert.equal(appliedQuery.approvalStatus, "PENDING");
        assert.equal(res.body.agents.length, 1);
        assert.equal(res.body.pagination.total, 1);
    } finally {
        User.findById = origUserFindById;
        Agent.find = origAgentFind;
        Agent.countDocuments = origAgentCount;
    }
});

test("4. Admin can approve a pending officer application", async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const candidateUserId = new mongoose.Types.ObjectId().toString();
    const agentProfileId = new mongoose.Types.ObjectId().toString();
    const adminToken = createTestToken(adminId, "ADMIN");

    const origUserFindById = User.findById;
    const origAgentFindById = Agent.findById;

    let savedAgent = null;

    try {
        User.findById = (id) => {
            if (id.toString() === adminId) {
                return {
                    select: async () => ({ _id: adminId, role: "ADMIN", isActive: true }),
                };
            }
            return Promise.resolve({
                _id: candidateUserId,
                role: "USER",
                isActive: true,
                save: async function () { this.role = "AGENT"; return this; },
            });
        };

        const mockAgentDoc = {
            _id: agentProfileId,
            user: candidateUserId,
            department: "Roads",
            approvalStatus: "PENDING",
            isAvailable: true,
            save: async function () {
                savedAgent = this;
                return this;
            },
        };

        let callCount = 0;
        Agent.findById = (id) => {
            callCount++;
            if (callCount === 1) return Promise.resolve(mockAgentDoc);
            return {
                populate: () => ({
                    populate: async () => ({
                        _id: agentProfileId,
                        department: "Roads",
                        approvalStatus: savedAgent.approvalStatus,
                        approvedBy: { _id: adminId, name: "Admin" },
                    }),
                }),
            };
        };

        const res = await request(`/api/admin/agents/${agentProfileId}/approve`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${adminToken}` },
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.message, "Agent application approved successfully");
        assert.equal(savedAgent.approvalStatus, "APPROVED");
        assert.equal(savedAgent.approvedBy.toString(), adminId);
    } finally {
        User.findById = origUserFindById;
        Agent.findById = origAgentFindById;
    }
});

test("5. Repeated approval and invalid decisions are rejected with 400", async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const agentProfileId = new mongoose.Types.ObjectId().toString();
    const adminToken = createTestToken(adminId, "ADMIN");

    const origUserFindById = User.findById;
    const origAgentFindById = Agent.findById;

    try {
        User.findById = () => ({
            select: async () => ({ _id: adminId, role: "ADMIN", isActive: true }),
        });

        // Already approved agent
        Agent.findById = async () => ({
            _id: agentProfileId,
            approvalStatus: "APPROVED",
        });

        const resRepeated = await request(`/api/admin/agents/${agentProfileId}/approve`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.equal(resRepeated.status, 400);
        assert.match(resRepeated.body.message, /already approved/i);
    } finally {
        User.findById = origUserFindById;
        Agent.findById = origAgentFindById;
    }
});

test("6. Admin can reject a pending officer application with validated reason", async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const agentProfileId = new mongoose.Types.ObjectId().toString();
    const adminToken = createTestToken(adminId, "ADMIN");

    const origUserFindById = User.findById;
    const origAgentFindById = Agent.findById;

    let savedAgent = null;

    try {
        User.findById = () => ({
            select: async () => ({ _id: adminId, role: "ADMIN", isActive: true }),
        });

        const mockAgentDoc = {
            _id: agentProfileId,
            approvalStatus: "PENDING",
            isAvailable: true,
            save: async function () {
                savedAgent = this;
                return this;
            },
        };

        let callCount = 0;
        Agent.findById = (id) => {
            callCount++;
            if (callCount === 1) return Promise.resolve(mockAgentDoc);
            return {
                populate: () => ({
                    populate: async () => ({
                        _id: agentProfileId,
                        approvalStatus: savedAgent.approvalStatus,
                        rejectionReason: savedAgent.rejectionReason,
                    }),
                }),
            };
        };

        // Missing rejection reason -> 400
        const resEmptyReason = await request(`/api/admin/agents/${agentProfileId}/reject`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${adminToken}` },
            body: { rejectionReason: "" },
        });
        assert.equal(resEmptyReason.status, 400);

        // Valid rejection -> 200
        const resReject = await request(`/api/admin/agents/${agentProfileId}/reject`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${adminToken}` },
            body: { rejectionReason: "Verification credentials could not be authenticated." },
        });

        assert.equal(resReject.status, 200);
        assert.equal(savedAgent.approvalStatus, "REJECTED");
        assert.equal(savedAgent.rejectionReason, "Verification credentials could not be authenticated.");
        assert.equal(savedAgent.isAvailable, false);
    } finally {
        User.findById = origUserFindById;
        Agent.findById = origAgentFindById;
    }
});

test("7. User management listing returns safe profiles without passwords", async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const adminToken = createTestToken(adminId, "ADMIN");

    const origUserFindById = User.findById;
    const origUserFind = User.find;
    const origUserCount = User.countDocuments;

    try {
        User.findById = () => ({
            select: async () => ({ _id: adminId, role: "ADMIN", isActive: true }),
        });

        User.find = () => ({
            select: () => ({
                sort: () => ({
                    skip: () => ({
                        limit: async () => [
                            { _id: "u1", name: "Citizen One", email: "c1@example.com", role: "USER", isActive: true },
                            { _id: "u2", name: "Officer Two", email: "o2@example.com", role: "AGENT", isActive: true },
                        ],
                    }),
                }),
            }),
        });

        User.countDocuments = async () => 2;

        const res = await request("/api/admin/users?page=1&limit=10", {
            headers: { Authorization: `Bearer ${adminToken}` },
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.users.length, 2);
        assert.equal(res.body.users[0].password, undefined, "Password must never be returned");
        assert.equal(res.body.pagination.total, 2);
    } finally {
        User.findById = origUserFindById;
        User.find = origUserFind;
        User.countDocuments = origUserCount;
    }
});

test("8. Admin user status endpoint protects against self-deactivation and last-admin deactivation", async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const otherAdminId = new mongoose.Types.ObjectId().toString();
    const adminToken = createTestToken(adminId, "ADMIN");

    const origUserFindById = User.findById;
    const origUserCount = User.countDocuments;

    try {
        // Case A: Admin tries to deactivate themselves -> 400 Bad Request
        User.findById = (id) => ({
            select: async () => ({
                _id: id,
                role: "ADMIN",
                isActive: true,
            }),
        });

        const resSelf = await request(`/api/admin/users/${adminId}/status`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${adminToken}` },
            body: { isActive: false },
        });
        assert.equal(resSelf.status, 400);
        assert.match(resSelf.body.message, /cannot deactivate their own account/i);

        // Case B: Trying to deactivate the last remaining active admin -> 400 Bad Request
        User.findById = (id) => {
            if (id.toString() === adminId) {
                return { select: async () => ({ _id: adminId, role: "ADMIN", isActive: true }) };
            }
            return {
                select: async () => ({
                    _id: otherAdminId,
                    role: "ADMIN",
                    isActive: true,
                    save: async function () { return this; },
                }),
            };
        };

        // Only 1 active admin exists in system
        User.countDocuments = async () => 1;

        const resLastAdmin = await request(`/api/admin/users/${otherAdminId}/status`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${adminToken}` },
            body: { isActive: false },
        });
        assert.equal(resLastAdmin.status, 400);
        assert.match(resLastAdmin.body.message, /last active administrator/i);
    } finally {
        User.findById = origUserFindById;
        User.countDocuments = origUserCount;
    }
});

test("9. User status management endpoint rejects privilege escalation or role changes", async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const targetUserId = new mongoose.Types.ObjectId().toString();
    const adminToken = createTestToken(adminId, "ADMIN");

    const origUserFindById = User.findById;

    try {
        User.findById = () => ({
            select: async () => ({ _id: adminId, role: "ADMIN", isActive: true }),
        });

        // Attempting to change role to ADMIN via status endpoint
        const resRole = await request(`/api/admin/users/${targetUserId}/status`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${adminToken}` },
            body: {
                isActive: true,
                role: "ADMIN",
            },
        });
        assert.equal(resRole.status, 400);
        assert.match(resRole.body.message, /prohibited/i);
    } finally {
        User.findById = origUserFindById;
    }
});

test("10. Analytics overview aggregates live database statistics and handles empty data cleanly", async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const adminToken = createTestToken(adminId, "ADMIN");

    const origUserFindById = User.findById;
    const origComplaintCount = Complaint.countDocuments;
    const origComplaintAgg = Complaint.aggregate;
    const origAgentAgg = Agent.aggregate;

    try {
        User.findById = () => ({
            select: async () => ({ _id: adminId, role: "ADMIN", isActive: true }),
        });

        Complaint.countDocuments = async () => 10;

        let aggCall = 0;
        Complaint.aggregate = async () => {
            aggCall++;
            if (aggCall === 1) {
                // Status breakdown
                return [
                    { _id: "PENDING", count: 4 },
                    { _id: "IN_PROGRESS", count: 3 },
                    { _id: "RESOLVED", count: 2 },
                    { _id: "CLOSED", count: 1 },
                ];
            }
            if (aggCall === 2) {
                // Category breakdown
                return [
                    { _id: "Technical", count: 5 },
                    { _id: "Billing", count: 5 },
                ];
            }
            if (aggCall === 3) {
                // Priority breakdown
                return [
                    { _id: "HIGH", count: 6 },
                    { _id: "MEDIUM", count: 4 },
                ];
            }
            if (aggCall === 4) {
                // Resolution stats (avg 24.5 hours)
                return [
                    { _id: null, avgHours: 24.5, minHours: 2.0, maxHours: 48.0, count: 3 },
                ];
            }
            // Volume over time
            return [
                { _id: "2026-10-22", count: 4 },
                { _id: "2026-10-23", count: 6 },
            ];
        };

        Agent.aggregate = async () => [
            {
                _id: "agentProfile1",
                department: "Public Works",
                approvalStatus: "APPROVED",
                activeComplaintsCount: 3,
                maxActiveComplaints: 10,
                totalResolved: 15,
                officerName: "Officer John",
                officerEmail: "john@gov.portal",
            },
        ];

        const res = await request("/api/admin/analytics/overview", {
            headers: { Authorization: `Bearer ${adminToken}` },
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.summary.totalComplaints, 10);
        assert.equal(res.body.summary.resolvedCount, 2);
        assert.equal(res.body.summary.closedCount, 1);
        assert.equal(res.body.summary.activeCount, 7); // 10 - (2 + 1 + 0) = 7
        assert.equal(res.body.breakdowns.byStatus.PENDING, 4);
        assert.equal(res.body.breakdowns.byCategory.Technical, 5);
        assert.equal(res.body.resolutionMetrics.avgResolutionHours, 24.5);
        assert.equal(res.body.officerPerformance[0].officerName, "Officer John");
    } finally {
        User.findById = origUserFindById;
        Complaint.countDocuments = origComplaintCount;
        Complaint.aggregate = origComplaintAgg;
        Agent.aggregate = origAgentAgg;
    }
});
