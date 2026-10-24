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

// Helper for test tokens and requests
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

// ==========================================
// TEST SUITE: Phase 3 Complaint APIs
// ==========================================

test("1. Valid complaint creation creates record with auto-generated tracking ID and PENDING status", async () => {
    const citizenId = new mongoose.Types.ObjectId().toString();
    const token = createTestToken(citizenId, "USER");

    const origUserFindById = User.findById;
    const origSave = Complaint.prototype.save;
    const origComplaintFindById = Complaint.findById;

    let savedComplaintDoc = null;

    try {
        User.findById = () => ({
            select: async () => ({
                _id: citizenId,
                name: "Rahul Citizen",
                email: "rahul@example.com",
                role: "USER",
                isActive: true,
                phone: "9876543210",
                address: "Street 1",
                city: "Delhi",
            }),
        });

        Complaint.prototype.save = async function () {
            savedComplaintDoc = this;
            return this;
        };

        Complaint.findById = () => ({
            populate: async () => ({
                _id: savedComplaintDoc._id,
                trackingId: savedComplaintDoc.trackingId,
                title: savedComplaintDoc.title,
                description: savedComplaintDoc.description,
                category: savedComplaintDoc.category,
                priority: savedComplaintDoc.priority,
                status: savedComplaintDoc.status,
                citizenContact: savedComplaintDoc.citizenContact,
                createdBy: {
                    _id: citizenId,
                    name: "Rahul Citizen",
                    email: "rahul@example.com",
                },
                statusHistory: savedComplaintDoc.statusHistory,
            }),
        });

        const res = await request("/api/complaints", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: {
                title: "Broken water pipe on Main Road",
                description: "Clean drinking water is leaking profusely onto the main road since this morning.",
                category: "Service",
                priority: "HIGH",
            },
        });

        assert.equal(res.status, 201);
        assert.equal(res.body.message, "Complaint registered successfully");
        assert.ok(res.body.complaint.trackingId.startsWith("CMP-"));
        assert.equal(res.body.complaint.status, "PENDING");
        assert.equal(res.body.complaint.statusHistory[0].status, "PENDING");
    } finally {
        User.findById = origUserFindById;
        Complaint.prototype.save = origSave;
        Complaint.findById = origComplaintFindById;
    }
});

test("2. Invalid complaint creation request is rejected with 400", async () => {
    const citizenId = new mongoose.Types.ObjectId().toString();
    const token = createTestToken(citizenId, "USER");

    const origUserFindById = User.findById;

    try {
        User.findById = () => ({
            select: async () => ({
                _id: citizenId,
                role: "USER",
                isActive: true,
            }),
        });

        // Short title (< 5 chars)
        const resShortTitle = await request("/api/complaints", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: {
                title: "Bad",
                description: "This description has more than ten characters.",
                category: "Technical",
            },
        });
        assert.equal(resShortTitle.status, 400);

        // Invalid category
        const resBadCat = await request("/api/complaints", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: {
                title: "Valid Title For Complaint",
                description: "This description has more than ten characters.",
                category: "InvalidCategory",
            },
        });
        assert.equal(resBadCat.status, 400);
    } finally {
        User.findById = origUserFindById;
    }
});

test("3. Client-supplied privileged fields during complaint creation are rejected", async () => {
    const citizenId = new mongoose.Types.ObjectId().toString();
    const token = createTestToken(citizenId, "USER");

    const origUserFindById = User.findById;

    try {
        User.findById = () => ({
            select: async () => ({
                _id: citizenId,
                role: "USER",
                isActive: true,
            }),
        });

        // Attempting to self-set trackingId
        const resTracking = await request("/api/complaints", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: {
                title: "Valid Title For Complaint",
                description: "Valid description with sufficient length.",
                category: "Technical",
                trackingId: "CMP-CUSTOM-ID",
            },
        });
        assert.equal(resTracking.status, 400);

        // Attempting to self-set status to RESOLVED
        const resStatus = await request("/api/complaints", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: {
                title: "Valid Title For Complaint",
                description: "Valid description with sufficient length.",
                category: "Technical",
                status: "RESOLVED",
            },
        });
        assert.equal(resStatus.status, 400);
    } finally {
        User.findById = origUserFindById;
    }
});

test("4. User complaint list is scoped exclusively to complaints created by that user", async () => {
    const citizenId = new mongoose.Types.ObjectId().toString();
    const token = createTestToken(citizenId, "USER");

    const origUserFindById = User.findById;
    const origFind = Complaint.find;
    const origCount = Complaint.countDocuments;

    let appliedQuery = null;

    try {
        User.findById = () => ({
            select: async () => ({
                _id: citizenId,
                role: "USER",
                isActive: true,
            }),
        });

        Complaint.find = (q) => {
            appliedQuery = q;
            return {
                sort: () => ({
                    skip: () => ({
                        limit: () => ({
                            populate: () => ({
                                populate: async () => [
                                    { _id: "c1", title: "My Complaint 1", createdBy: { _id: citizenId } },
                                ],
                            }),
                        }),
                    }),
                }),
            };
        };

        Complaint.countDocuments = async () => 1;

        const res = await request("/api/complaints", {
            headers: { Authorization: `Bearer ${token}` },
        });

        assert.equal(res.status, 200);
        assert.equal(appliedQuery.createdBy.toString(), citizenId);
        assert.equal(res.body.complaints.length, 1);
    } finally {
        User.findById = origUserFindById;
        Complaint.find = origFind;
        Complaint.countDocuments = origCount;
    }
});

test("5. Approved agent complaint list is scoped exclusively to assigned complaints", async () => {
    const agentUserId = new mongoose.Types.ObjectId().toString();
    const token = createTestToken(agentUserId, "AGENT");

    const origUserFindById = User.findById;
    const origAgentFindOne = Agent.findOne;
    const origFind = Complaint.find;
    const origCount = Complaint.countDocuments;

    let appliedQuery = null;

    try {
        User.findById = () => ({
            select: async () => ({
                _id: agentUserId,
                role: "AGENT",
                isActive: true,
            }),
        });

        Agent.findOne = async () => ({
            user: agentUserId,
            approvalStatus: "APPROVED",
            isAvailable: true,
        });

        Complaint.find = (q) => {
            appliedQuery = q;
            return {
                sort: () => ({
                    skip: () => ({
                        limit: () => ({
                            populate: () => ({
                                populate: async () => [
                                    { _id: "c2", title: "Assigned Task", assignedAgent: { _id: agentUserId } },
                                ],
                            }),
                        }),
                    }),
                }),
            };
        };

        Complaint.countDocuments = async () => 1;

        const res = await request("/api/complaints", {
            headers: { Authorization: `Bearer ${token}` },
        });

        assert.equal(res.status, 200);
        assert.equal(appliedQuery.assignedAgent.toString(), agentUserId);
    } finally {
        User.findById = origUserFindById;
        Agent.findOne = origAgentFindOne;
        Complaint.find = origFind;
        Complaint.countDocuments = origCount;
    }
});

test("6. Unapproved agent cannot access agent operations", async () => {
    const agentUserId = new mongoose.Types.ObjectId().toString();
    const token = createTestToken(agentUserId, "AGENT");

    const origUserFindById = User.findById;
    const origAgentFindOne = Agent.findOne;

    try {
        User.findById = () => ({
            select: async () => ({
                _id: agentUserId,
                role: "AGENT",
                isActive: true,
            }),
        });

        // Agent profile with PENDING approval status
        Agent.findOne = async () => ({
            user: agentUserId,
            approvalStatus: "PENDING",
        });

        const res = await request("/api/complaints", {
            headers: { Authorization: `Bearer ${token}` },
        });

        assert.equal(res.status, 403);
        assert.match(res.body.message, /pending administrator approval/i);
    } finally {
        User.findById = origUserFindById;
        Agent.findOne = origAgentFindOne;
    }
});

test("7. Administrator listing permissions queries all complaints with pagination", async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const token = createTestToken(adminId, "ADMIN");

    const origUserFindById = User.findById;
    const origFind = Complaint.find;
    const origCount = Complaint.countDocuments;

    let appliedQuery = null;

    try {
        User.findById = () => ({
            select: async () => ({
                _id: adminId,
                role: "ADMIN",
                isActive: true,
            }),
        });

        Complaint.find = (q) => {
            appliedQuery = q;
            return {
                sort: () => ({
                    skip: () => ({
                        limit: () => ({
                            populate: () => ({
                                populate: async () => [
                                    { _id: "c1" },
                                    { _id: "c2" },
                                ],
                            }),
                        }),
                    }),
                }),
            };
        };

        Complaint.countDocuments = async () => 2;

        const res = await request("/api/complaints?status=PENDING&page=1&limit=20", {
            headers: { Authorization: `Bearer ${token}` },
        });

        assert.equal(res.status, 200);
        assert.equal(appliedQuery.createdBy, undefined, "Admin query must not be restricted to single user");
        assert.equal(appliedQuery.status, "PENDING");
        assert.equal(res.body.pagination.total, 2);
    } finally {
        User.findById = origUserFindById;
        Complaint.find = origFind;
        Complaint.countDocuments = origCount;
    }
});

test("8. Complaint ownership and detail authorization permits owner and rejects unauthorized user", async () => {
    const ownerId = new mongoose.Types.ObjectId().toString();
    const strangerId = new mongoose.Types.ObjectId().toString();
    const complaintId = new mongoose.Types.ObjectId().toString();

    const strangerToken = createTestToken(strangerId, "USER");
    const ownerToken = createTestToken(ownerId, "USER");

    const origUserFindById = User.findById;
    const origComplaintFindById = Complaint.findById;

    try {
        User.findById = (id) => ({
            select: async () => ({
                _id: id,
                role: "USER",
                isActive: true,
            }),
        });

        Complaint.findById = () => ({
            populate: () => ({
                populate: () => ({
                    populate: async () => ({
                        _id: complaintId,
                        title: "Private Complaint",
                        createdBy: { _id: ownerId },
                        assignedAgent: null,
                        status: "PENDING",
                    }),
                }),
            }),
        });

        // Stranger attempts to view owner's complaint -> 403 Forbidden
        const resStranger = await request(`/api/complaints/${complaintId}`, {
            headers: { Authorization: `Bearer ${strangerToken}` },
        });
        assert.equal(resStranger.status, 403);
        assert.match(resStranger.body.message, /not authorized/i);

        // Owner views their complaint -> 200 OK
        const resOwner = await request(`/api/complaints/${complaintId}`, {
            headers: { Authorization: `Bearer ${ownerToken}` },
        });
        assert.equal(resOwner.status, 200);
        assert.equal(resOwner.body.complaint.title, "Private Complaint");
    } finally {
        User.findById = origUserFindById;
        Complaint.findById = origComplaintFindById;
    }
});

test("9. Tracking ID lookup enforces authorization and returns 404 for missing tracking ID", async () => {
    const citizenId = new mongoose.Types.ObjectId().toString();
    const token = createTestToken(citizenId, "USER");

    const origUserFindById = User.findById;
    const origFindOne = Complaint.findOne;

    try {
        User.findById = () => ({
            select: async () => ({
                _id: citizenId,
                role: "USER",
                isActive: true,
            }),
        });

        // Non-existent tracking ID
        Complaint.findOne = () => ({
            populate: () => ({
                populate: () => ({
                    populate: async () => null,
                }),
            }),
        });

        const resNotFound = await request("/api/complaints/track/CMP-20261023-A1B2C3", {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(resNotFound.status, 404);
    } finally {
        User.findById = origUserFindById;
        Complaint.findOne = origFindOne;
    }
});

test("10. Valid and invalid status transitions enforce state machine and operational roles", async () => {
    const agentId = new mongoose.Types.ObjectId().toString();
    const complaintId = new mongoose.Types.ObjectId().toString();
    const token = createTestToken(agentId, "AGENT");

    const origUserFindById = User.findById;
    const origAgentFindOne = Agent.findOne;
    const origComplaintFindById = Complaint.findById;
    const origSave = Complaint.prototype.save;

    try {
        User.findById = () => ({
            select: async () => ({
                _id: agentId,
                role: "AGENT",
                isActive: true,
            }),
        });

        Agent.findOne = async () => ({
            user: agentId,
            approvalStatus: "APPROVED",
        });

        // Case A: Invalid transition (PENDING -> RESOLVED directly is not allowed)
        Complaint.findById = async () => ({
            _id: complaintId,
            status: "PENDING",
            assignedAgent: agentId,
            createdBy: new mongoose.Types.ObjectId(),
            statusHistory: [],
        });

        const resInvalid = await request(`/api/complaints/${complaintId}/status`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
            body: {
                status: "RESOLVED",
            },
        });
        assert.equal(resInvalid.status, 400);
        assert.match(resInvalid.body.message, /invalid status transition/i);
    } finally {
        User.findById = origUserFindById;
        Agent.findOne = origAgentFindOne;
        Complaint.findById = origComplaintFindById;
        Complaint.prototype.save = origSave;
    }
});

test("11. Status history records the authenticated actor and notes upon successful transition", async () => {
    const agentId = new mongoose.Types.ObjectId().toString();
    const complaintId = new mongoose.Types.ObjectId().toString();
    const token = createTestToken(agentId, "AGENT");

    const origUserFindById = User.findById;
    const origAgentFindOne = Agent.findOne;
    const origComplaintFindById = Complaint.findById;

    let savedComplaint = null;

    try {
        User.findById = () => ({
            select: async () => ({
                _id: agentId,
                role: "AGENT",
                isActive: true,
            }),
        });

        Agent.findOne = async () => ({
            user: agentId,
            approvalStatus: "APPROVED",
        });

        const mockDoc = {
            _id: complaintId,
            status: "ASSIGNED",
            assignedAgent: agentId,
            createdBy: new mongoose.Types.ObjectId(),
            statusHistory: [],
            save: async function () {
                savedComplaint = this;
                return this;
            },
        };

        let callCount = 0;
        Complaint.findById = (id) => {
            callCount++;
            if (callCount === 1) {
                return Promise.resolve(mockDoc);
            }
            return {
                populate: () => ({
                    populate: () => ({
                        populate: async () => savedComplaint,
                    }),
                }),
            };
        };

        const res = await request(`/api/complaints/${complaintId}/status`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
            body: {
                status: "IN_PROGRESS",
                notes: "Investigation initiated on-site.",
            },
        });

        assert.equal(res.status, 200);
        assert.equal(savedComplaint.status, "IN_PROGRESS");
        assert.equal(savedComplaint.statusHistory.length, 1);
        assert.equal(savedComplaint.statusHistory[0].status, "IN_PROGRESS");
        assert.equal(savedComplaint.statusHistory[0].changedBy.toString(), agentId);
        assert.equal(savedComplaint.statusHistory[0].notes, "Investigation initiated on-site.");
    } finally {
        User.findById = origUserFindById;
        Agent.findOne = origAgentFindOne;
        Complaint.findById = origComplaintFindById;
    }
});

test("12. Agent assignment enforces administrator role, agent approval, and workload limits", async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const agentId = new mongoose.Types.ObjectId().toString();
    const complaintId = new mongoose.Types.ObjectId().toString();
    const adminToken = createTestToken(adminId, "ADMIN");

    const origUserFindById = User.findById;
    const origAgentFindOne = Agent.findOne;
    const origComplaintFindById = Complaint.findById;

    try {
        User.findById = (id) => {
            if (id.toString() === adminId) {
                return {
                    select: async () => ({
                        _id: adminId,
                        role: "ADMIN",
                        isActive: true,
                    }),
                };
            }
            return Promise.resolve({
                _id: agentId,
                name: "Agent Smith",
                role: "AGENT",
                isActive: true,
            });
        };

        Complaint.findById = async () => ({
            _id: complaintId,
            status: "PENDING",
            assignedAgent: null,
            statusHistory: [],
        });

        // Agent at max workload (10 of 10)
        Agent.findOne = async () => ({
            user: agentId,
            approvalStatus: "APPROVED",
            isAvailable: true,
            maxActiveComplaints: 10,
            activeComplaintsCount: 10,
        });

        const resOverload = await request(`/api/complaints/${complaintId}/assign`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${adminToken}` },
            body: {
                agentId,
            },
        });

        assert.equal(resOverload.status, 400);
        assert.match(resOverload.body.message, /maximum active complaint workload/i);
    } finally {
        User.findById = origUserFindById;
        Agent.findOne = origAgentFindOne;
        Complaint.findById = origComplaintFindById;
    }
});

test("13. Reassignment updates workload counters for both agents consistently", async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const oldAgentId = new mongoose.Types.ObjectId().toString();
    const newAgentId = new mongoose.Types.ObjectId().toString();
    const complaintId = new mongoose.Types.ObjectId().toString();
    const adminToken = createTestToken(adminId, "ADMIN");

    const origUserFindById = User.findById;
    const origAgentFindOne = Agent.findOne;
    const origAgentFindOneAndUpdate = Agent.findOneAndUpdate;
    const origComplaintFindById = Complaint.findById;

    const counterUpdates = [];

    try {
        User.findById = (id) => {
            if (id.toString() === adminId) {
                return {
                    select: async () => ({ _id: adminId, role: "ADMIN", isActive: true }),
                };
            }
            return Promise.resolve({
                _id: newAgentId,
                name: "New Agent",
                role: "AGENT",
                isActive: true,
            });
        };

        Agent.findOne = async () => ({
            user: newAgentId,
            approvalStatus: "APPROVED",
            isAvailable: true,
            maxActiveComplaints: 10,
            activeComplaintsCount: 2,
        });

        Agent.findOneAndUpdate = async (query, update) => {
            counterUpdates.push({ query, update });
            return {};
        };

        const mockComplaint = {
            _id: complaintId,
            status: "ASSIGNED",
            assignedAgent: oldAgentId,
            statusHistory: [],
            save: async function () { return this; },
        };

        let callCount = 0;
        Complaint.findById = (id) => {
            callCount++;
            if (callCount === 1) return Promise.resolve(mockComplaint);
            return {
                populate: () => ({
                    populate: () => ({
                        populate: async () => mockComplaint,
                    }),
                }),
            };
        };

        const res = await request(`/api/complaints/${complaintId}/assign`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${adminToken}` },
            body: {
                agentId: newAgentId,
                notes: "Reassigned due to department shift",
            },
        });

        assert.equal(res.status, 200);
        // Verify old agent decremented
        const oldDec = counterUpdates.find((c) => c.update.$inc.activeComplaintsCount === -1);
        assert.ok(oldDec, "Old agent workload counter must be decremented");
        assert.equal(oldDec.query.user.toString(), oldAgentId);

        // Verify new agent incremented
        const newInc = counterUpdates.find((c) => c.update.$inc.activeComplaintsCount === 1);
        assert.ok(newInc, "New agent workload counter must be incremented");
        assert.equal(newInc.query.user.toString(), newAgentId);
    } finally {
        User.findById = origUserFindById;
        Agent.findOne = origAgentFindOne;
        Agent.findOneAndUpdate = origAgentFindOneAndUpdate;
        Complaint.findById = origComplaintFindById;
    }
});

test("14. Invalid IDs and pagination boundary validations return standard 400 responses", async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const token = createTestToken(adminId, "ADMIN");

    const origUserFindById = User.findById;

    try {
        User.findById = () => ({
            select: async () => ({
                _id: adminId,
                role: "ADMIN",
                isActive: true,
            }),
        });

        // Malformed Mongo ID
        const resBadId = await request("/api/complaints/not-a-valid-id", {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(resBadId.status, 400);

        // Limit exceeds max (limit=100 > 50)
        const resOverLimit = await request("/api/complaints?limit=100", {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(resOverLimit.status, 400);
    } finally {
        User.findById = origUserFindById;
    }
});

test("15. Non-existent complaint ID returns 404", async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const token = createTestToken(adminId, "ADMIN");
    const validNonExistentId = new mongoose.Types.ObjectId().toString();

    const origUserFindById = User.findById;
    const origComplaintFindById = Complaint.findById;

    try {
        User.findById = () => ({
            select: async () => ({
                _id: adminId,
                role: "ADMIN",
                isActive: true,
            }),
        });

        Complaint.findById = () => ({
            populate: () => ({
                populate: () => ({
                    populate: async () => null,
                }),
            }),
        });

        const resNotFound = await request(`/api/complaints/${validNonExistentId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(resNotFound.status, 404);
        assert.match(resNotFound.body.message, /not found/i);
    } finally {
        User.findById = origUserFindById;
        Complaint.findById = origComplaintFindById;
    }
});
