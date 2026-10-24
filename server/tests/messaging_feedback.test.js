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
const { sendEmail, setTransporterForTesting } = require("../services/emailService");

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

// ==========================================
// TEST SUITE: Phase 4 Messaging, Feedback, and Notifications
// ==========================================

test("1. Citizen owner and assigned approved officer can send messages", async () => {
    const citizenId = new mongoose.Types.ObjectId().toString();
    const agentId = new mongoose.Types.ObjectId().toString();
    const complaintId = new mongoose.Types.ObjectId().toString();

    const citizenToken = createTestToken(citizenId, "USER");
    const agentToken = createTestToken(agentId, "AGENT");

    const origUserFindById = User.findById;
    const origAgentFindOne = Agent.findOne;
    const origComplaintFindById = Complaint.findById;
    const origMessageSave = Message.prototype.save;
    const origMessageFindById = Message.findById;

    try {
        User.findById = (id) => ({
            select: async () => ({
                _id: id,
                role: id === citizenId ? "USER" : "AGENT",
                isActive: true,
                name: id === citizenId ? "Citizen" : "Officer",
            }),
        });

        Agent.findOne = async () => ({
            user: agentId,
            approvalStatus: "APPROVED",
        });

        const mockComplaint = {
            _id: complaintId,
            createdBy: { _id: citizenId, name: "Citizen", email: "citizen@example.com" },
            assignedAgent: { _id: agentId, name: "Officer", email: "agent@example.com" },
            status: "IN_PROGRESS",
        };

        Complaint.findById = () => ({
            populate: () => ({
                populate: async () => mockComplaint,
            }),
        });

        let savedMsg = null;
        Message.prototype.save = async function () {
            savedMsg = this;
            return this;
        };

        Message.findById = () => ({
            populate: async () => ({
                _id: savedMsg._id,
                complaint: complaintId,
                sender: { _id: savedMsg.sender, name: "Sender", role: "USER" },
                message: savedMsg.message,
                isRead: false,
            }),
        });

        // Citizen sends message
        const resCitizen = await request(`/api/complaints/${complaintId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${citizenToken}` },
            body: {
                message: "Hello officer, when can you inspect the site?",
            },
        });

        assert.equal(resCitizen.status, 201);
        assert.equal(resCitizen.body.message, "Message sent successfully");
        assert.equal(savedMsg.message, "Hello officer, when can you inspect the site?");
        assert.equal(savedMsg.sender.toString(), citizenId);

        // Assigned agent sends response
        const resAgent = await request(`/api/complaints/${complaintId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${agentToken}` },
            body: {
                message: "Inspection is scheduled for tomorrow at 10 AM.",
            },
        });

        assert.equal(resAgent.status, 201);
        assert.equal(savedMsg.sender.toString(), agentId);
    } finally {
        User.findById = origUserFindById;
        Agent.findOne = origAgentFindOne;
        Complaint.findById = origComplaintFindById;
        Message.prototype.save = origMessageSave;
        Message.findById = origMessageFindById;
    }
});

test("2. Unrelated citizen and unassigned officer are denied messaging access", async () => {
    const ownerId = new mongoose.Types.ObjectId().toString();
    const strangerCitizenId = new mongoose.Types.ObjectId().toString();
    const otherAgentId = new mongoose.Types.ObjectId().toString();
    const assignedAgentId = new mongoose.Types.ObjectId().toString();
    const complaintId = new mongoose.Types.ObjectId().toString();

    const strangerToken = createTestToken(strangerCitizenId, "USER");
    const otherAgentToken = createTestToken(otherAgentId, "AGENT");

    const origUserFindById = User.findById;
    const origAgentFindOne = Agent.findOne;
    const origComplaintFindById = Complaint.findById;

    try {
        User.findById = (id) => ({
            select: async () => ({
                _id: id,
                role: id === strangerCitizenId ? "USER" : "AGENT",
                isActive: true,
            }),
        });

        Agent.findOne = async () => ({
            user: otherAgentId,
            approvalStatus: "APPROVED",
        });

        Complaint.findById = () => ({
            populate: () => ({
                populate: async () => ({
                    _id: complaintId,
                    createdBy: { _id: ownerId },
                    assignedAgent: { _id: assignedAgentId },
                }),
            }),
        });

        // Unrelated citizen gets 403
        const resStranger = await request(`/api/complaints/${complaintId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${strangerToken}` },
            body: { message: "Sneaking into conversation" },
        });
        assert.equal(resStranger.status, 403);

        // Unassigned agent gets 403
        const resOtherAgent = await request(`/api/complaints/${complaintId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${otherAgentToken}` },
            body: { message: "Unauthorized agent comment" },
        });
        assert.equal(resOtherAgent.status, 403);
    } finally {
        User.findById = origUserFindById;
        Agent.findOne = origAgentFindOne;
        Complaint.findById = origComplaintFindById;
    }
});

test("3. Unapproved agent is denied messaging access", async () => {
    const agentId = new mongoose.Types.ObjectId().toString();
    const complaintId = new mongoose.Types.ObjectId().toString();
    const token = createTestToken(agentId, "AGENT");

    const origUserFindById = User.findById;
    const origAgentFindOne = Agent.findOne;
    const origComplaintFindById = Complaint.findById;

    try {
        User.findById = () => ({
            select: async () => ({
                _id: agentId,
                role: "AGENT",
                isActive: true,
            }),
        });

        // Agent is PENDING
        Agent.findOne = async () => ({
            user: agentId,
            approvalStatus: "PENDING",
        });

        Complaint.findById = () => ({
            populate: () => ({
                populate: async () => ({
                    _id: complaintId,
                    createdBy: { _id: new mongoose.Types.ObjectId() },
                    assignedAgent: { _id: agentId },
                }),
            }),
        });

        const res = await request(`/api/complaints/${complaintId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: { message: "Pending agent message" },
        });
        assert.equal(res.status, 403);
    } finally {
        User.findById = origUserFindById;
        Agent.findOne = origAgentFindOne;
        Complaint.findById = origComplaintFindById;
    }
});

test("4. Message validation rejects empty and oversized messages", async () => {
    const citizenId = new mongoose.Types.ObjectId().toString();
    const complaintId = new mongoose.Types.ObjectId().toString();
    const token = createTestToken(citizenId, "USER");

    const origUserFindById = User.findById;

    try {
        User.findById = () => ({
            select: async () => ({ _id: citizenId, role: "USER", isActive: true }),
        });

        // Empty message
        const resEmpty = await request(`/api/complaints/${complaintId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: { message: "" },
        });
        assert.equal(resEmpty.status, 400);

        // Oversized message (> 2000 chars)
        const resOversized = await request(`/api/complaints/${complaintId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: { message: "X".repeat(2001) },
        });
        assert.equal(resOversized.status, 400);
    } finally {
        User.findById = origUserFindById;
    }
});

test("5. Client attempts to forge message sender are rejected", async () => {
    const citizenId = new mongoose.Types.ObjectId().toString();
    const fakeSenderId = new mongoose.Types.ObjectId().toString();
    const complaintId = new mongoose.Types.ObjectId().toString();
    const token = createTestToken(citizenId, "USER");

    const origUserFindById = User.findById;

    try {
        User.findById = () => ({
            select: async () => ({ _id: citizenId, role: "USER", isActive: true }),
        });

        const resForge = await request(`/api/complaints/${complaintId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: {
                message: "Impersonation attempt",
                sender: fakeSenderId,
            },
        });
        assert.equal(resForge.status, 400);
        assert.match(resForge.body.message, /prohibited/i);
    } finally {
        User.findById = origUserFindById;
    }
});

test("6. Read-state updates: recipient can mark read, sender cannot mark own message read", async () => {
    const citizenId = new mongoose.Types.ObjectId().toString();
    const agentId = new mongoose.Types.ObjectId().toString();
    const complaintId = new mongoose.Types.ObjectId().toString();
    const messageId = new mongoose.Types.ObjectId().toString();

    const citizenToken = createTestToken(citizenId, "USER");
    const agentToken = createTestToken(agentId, "AGENT");

    const origUserFindById = User.findById;
    const origAgentFindOne = Agent.findOne;
    const origComplaintFindById = Complaint.findById;
    const origMessageFindOne = Message.findOne;

    try {
        User.findById = (id) => ({
            select: async () => ({
                _id: id,
                role: id === citizenId ? "USER" : "AGENT",
                isActive: true,
            }),
        });

        Agent.findOne = async () => ({
            user: agentId,
            approvalStatus: "APPROVED",
        });

        Complaint.findById = async () => ({
            _id: complaintId,
            createdBy: citizenId,
            assignedAgent: agentId,
        });

        // Message was sent by agent
        const mockMsg = {
            _id: messageId,
            complaint: complaintId,
            sender: agentId,
            isRead: false,
            readAt: null,
            save: async function () { return this; },
        };

        Message.findOne = async () => mockMsg;

        // Case A: Agent (the sender) tries to mark their own message as read -> 400 Bad Request
        const resSenderMark = await request(`/api/complaints/${complaintId}/messages/${messageId}/read`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${agentToken}` },
        });
        assert.equal(resSenderMark.status, 400);
        assert.match(resSenderMark.body.message, /sender cannot mark/i);

        // Case B: Citizen (the recipient) marks it as read -> 200 OK
        const resRecipientMark = await request(`/api/complaints/${complaintId}/messages/${messageId}/read`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${citizenToken}` },
        });
        assert.equal(resRecipientMark.status, 200);
        assert.equal(mockMsg.isRead, true);
        assert.ok(mockMsg.readAt);
    } finally {
        User.findById = origUserFindById;
        Agent.findOne = origAgentFindOne;
        Complaint.findById = origComplaintFindById;
        Message.findOne = origMessageFindOne;
    }
});

test("7. Feedback rating boundaries enforce integer between 1 and 5", async () => {
    const citizenId = new mongoose.Types.ObjectId().toString();
    const complaintId = new mongoose.Types.ObjectId().toString();
    const token = createTestToken(citizenId, "USER");

    const origUserFindById = User.findById;

    try {
        User.findById = () => ({
            select: async () => ({ _id: citizenId, role: "USER", isActive: true }),
        });

        // Rating 0 (invalid)
        const resZero = await request("/api/feedback", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: { complaintId, rating: 0 },
        });
        assert.equal(resZero.status, 400);

        // Rating 6 (invalid)
        const resSix = await request("/api/feedback", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: { complaintId, rating: 6 },
        });
        assert.equal(resSix.status, 400);

        // Rating float 3.5 (invalid, must be integer)
        const resFloat = await request("/api/feedback", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: { complaintId, rating: 3.5 },
        });
        assert.equal(resFloat.status, 400);
    } finally {
        User.findById = origUserFindById;
    }
});

test("8. Only the complaint owner can submit feedback", async () => {
    const ownerId = new mongoose.Types.ObjectId().toString();
    const strangerId = new mongoose.Types.ObjectId().toString();
    const complaintId = new mongoose.Types.ObjectId().toString();

    const strangerToken = createTestToken(strangerId, "USER");

    const origUserFindById = User.findById;
    const origComplaintFindById = Complaint.findById;

    try {
        User.findById = () => ({
            select: async () => ({ _id: strangerId, role: "USER", isActive: true }),
        });

        Complaint.findById = async () => ({
            _id: complaintId,
            createdBy: ownerId,
            status: "RESOLVED",
        });

        const res = await request("/api/feedback", {
            method: "POST",
            headers: { Authorization: `Bearer ${strangerToken}` },
            body: {
                complaintId,
                rating: 5,
                comments: "Great service",
            },
        });

        assert.equal(res.status, 403);
        assert.match(res.body.message, /only the citizen who filed this complaint/i);
    } finally {
        User.findById = origUserFindById;
        Complaint.findById = origComplaintFindById;
    }
});

test("9. Feedback blocked for complaints not in RESOLVED or CLOSED status", async () => {
    const citizenId = new mongoose.Types.ObjectId().toString();
    const complaintId = new mongoose.Types.ObjectId().toString();
    const token = createTestToken(citizenId, "USER");

    const origUserFindById = User.findById;
    const origComplaintFindById = Complaint.findById;

    try {
        User.findById = () => ({
            select: async () => ({ _id: citizenId, role: "USER", isActive: true }),
        });

        // Complaint is still PENDING
        Complaint.findById = async () => ({
            _id: complaintId,
            createdBy: citizenId,
            status: "PENDING",
        });

        const resPending = await request("/api/feedback", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: {
                complaintId,
                rating: 4,
            },
        });
        assert.equal(resPending.status, 400);
        assert.match(resPending.body.message, /must be RESOLVED or CLOSED/i);
    } finally {
        User.findById = origUserFindById;
        Complaint.findById = origComplaintFindById;
    }
});

test("10. Successful feedback submission and duplicate feedback rejection (409 Conflict)", async () => {
    const citizenId = new mongoose.Types.ObjectId().toString();
    const agentId = new mongoose.Types.ObjectId().toString();
    const complaintId = new mongoose.Types.ObjectId().toString();
    const token = createTestToken(citizenId, "USER");

    const origUserFindById = User.findById;
    const origComplaintFindById = Complaint.findById;
    const origFeedbackFindOne = Feedback.findOne;
    const origFeedbackSave = Feedback.prototype.save;
    const origFeedbackFindById = Feedback.findById;

    try {
        User.findById = (id) => {
            const userObj = {
                _id: id,
                role: id === citizenId ? "USER" : "AGENT",
                isActive: true,
                name: id === citizenId ? "Citizen" : "Officer",
                email: "agent@example.com",
            };
            return {
                select: async () => userObj,
                then: (resolve) => resolve(userObj),
            };
        };

        Complaint.findById = async () => ({
            _id: complaintId,
            createdBy: citizenId,
            assignedAgent: agentId,
            status: "RESOLVED",
        });

        // First attempt: no existing feedback
        let hasExisting = false;
        Feedback.findOne = async () => (hasExisting ? { _id: "f1", rating: 5 } : null);

        let savedFeedbackDoc = null;
        Feedback.prototype.save = async function () {
            savedFeedbackDoc = this;
            return this;
        };

        Feedback.findById = () => ({
            populate: () => ({
                populate: async () => ({
                    _id: "f1",
                    complaint: complaintId,
                    rating: 5,
                    comments: "Excellent prompt resolution!",
                    submittedBy: { name: "Citizen" },
                }),
            }),
        });

        const resSuccess = await request("/api/feedback", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: {
                complaintId,
                rating: 5,
                comments: "Excellent prompt resolution!",
            },
        });

        assert.equal(resSuccess.status, 201);
        assert.equal(resSuccess.body.feedback.rating, 5);

        // Second attempt: feedback now exists -> 409 Conflict
        hasExisting = true;
        const resDuplicate = await request("/api/feedback", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: {
                complaintId,
                rating: 4,
            },
        });

        assert.equal(resDuplicate.status, 409);
        assert.match(resDuplicate.body.message, /already been submitted/i);
    } finally {
        User.findById = origUserFindById;
        Complaint.findById = origComplaintFindById;
        Feedback.findOne = origFeedbackFindOne;
        Feedback.prototype.save = origFeedbackSave;
        Feedback.findById = origFeedbackFindById;
    }
});

test("11. Unauthorized feedback read access is denied with 403", async () => {
    const ownerId = new mongoose.Types.ObjectId().toString();
    const strangerId = new mongoose.Types.ObjectId().toString();
    const complaintId = new mongoose.Types.ObjectId().toString();
    const strangerToken = createTestToken(strangerId, "USER");

    const origUserFindById = User.findById;
    const origComplaintFindById = Complaint.findById;

    try {
        User.findById = () => ({
            select: async () => ({ _id: strangerId, role: "USER", isActive: true }),
        });

        Complaint.findById = async () => ({
            _id: complaintId,
            createdBy: ownerId,
            assignedAgent: null,
        });

        const res = await request(`/api/feedback/complaint/${complaintId}`, {
            headers: { Authorization: `Bearer ${strangerToken}` },
        });

        assert.equal(res.status, 403);
    } finally {
        User.findById = origUserFindById;
        Complaint.findById = origComplaintFindById;
    }
});

test("12. Missing SMTP configuration operates in simulated mode without errors", async () => {
    // Ensure clean state without SMTP config
    setTransporterForTesting(null);

    const result = await sendEmail({
        to: "citizen@example.com",
        subject: "Simulated Test Email",
        text: "This is a safe simulated email delivery.",
    });

    assert.equal(result.success, true);
    assert.equal(result.simulated, true);
    assert.equal(result.to, "citizen@example.com");
});

test("13. Mocked email success and failure behavior", async () => {
    // Mock success transporter
    const mockSuccessTransporter = {
        sendMail: async () => ({ messageId: "<test-msg-123@local>" }),
    };
    setTransporterForTesting(mockSuccessTransporter);

    const resSuccess = await sendEmail({
        to: "success@example.com",
        subject: "Success Test",
        text: "Testing success",
    });
    assert.equal(resSuccess.success, true);
    assert.equal(resSuccess.messageId, "<test-msg-123@local>");

    // Mock failure transporter
    const mockFailTransporter = {
        sendMail: async () => {
            throw new Error("SMTP connection timeout");
        },
    };
    setTransporterForTesting(mockFailTransporter);

    const resFail = await sendEmail({
        to: "fail@example.com",
        subject: "Failure Test",
        text: "Testing failure",
    });
    // Must gracefully catch and report success: false without throwing
    assert.equal(resFail.success, false);
    assert.match(resFail.error, /timeout/i);

    // Reset transporter
    setTransporterForTesting(null);
});
