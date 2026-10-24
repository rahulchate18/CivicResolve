const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const User = require("../models/User");
const Complaint = require("../models/Complaint");
const { VALID_STATUS_TRANSITIONS, generateTrackingId } = require("../models/Complaint");
const Agent = require("../models/Agent");
const Feedback = require("../models/Feedback");
const Message = require("../models/Message");

// ==========================================
// TEST SUITE: Phase 2 Data Models Refinement
// ==========================================

test("1. Valid complaint document passes schema validation", async () => {
    const validComplaint = new Complaint({
        title: "Streetlight not working on 5th Avenue",
        description: "The streetlight outside building 42 has been flickering and is now completely dark.",
        category: "Service",
        priority: "HIGH",
        status: "PENDING",
        createdBy: new mongoose.Types.ObjectId(),
        citizenContact: {
            phone: "+91-9876543210",
            address: "Building 42, 5th Avenue",
            city: "Metropolis",
            state: "State",
            postalCode: "110001",
        },
    });

    await validComplaint.validate();
    assert.ok(validComplaint.trackingId.startsWith("CMP-"), "Should have auto-generated tracking ID");
});

test("2. Required complaint fields and invalid enums produce validation errors", async () => {
    // Missing required fields
    const emptyComplaint = new Complaint({});
    await assert.rejects(
        async () => await emptyComplaint.validate(),
        (err) => {
            assert.ok(err.errors.title, "Title should be required");
            assert.ok(err.errors.description, "Description should be required");
            assert.ok(err.errors.category, "Category should be required");
            assert.ok(err.errors.createdBy, "CreatedBy should be required");
            return true;
        }
    );

    // Invalid category enum
    const badCategoryComplaint = new Complaint({
        title: "Valid Title Here",
        description: "Valid description with sufficient length",
        category: "InvalidCategoryEnum",
        createdBy: new mongoose.Types.ObjectId(),
    });
    await assert.rejects(
        async () => await badCategoryComplaint.validate(),
        (err) => {
            assert.ok(err.errors.category, "Invalid category enum should fail validation");
            return true;
        }
    );

    // Invalid priority enum
    const badPriorityComplaint = new Complaint({
        title: "Valid Title Here",
        description: "Valid description with sufficient length",
        category: "Technical",
        priority: "SUPER_URGENT",
        createdBy: new mongoose.Types.ObjectId(),
    });
    await assert.rejects(
        async () => await badPriorityComplaint.validate(),
        (err) => {
            assert.ok(err.errors.priority, "Invalid priority enum should fail validation");
            return true;
        }
    );
});

test("3. Tracking ID generation produces standard format and immutable behavior", () => {
    const trackingId1 = generateTrackingId();
    const trackingId2 = generateTrackingId();

    // Verify format CMP-YYYYMMDD-XXXXX
    assert.match(trackingId1, /^CMP-\d{8}-[0-9A-F]{6}$/);
    assert.match(trackingId2, /^CMP-\d{8}-[0-9A-F]{6}$/);
    assert.notEqual(trackingId1, trackingId2, "Tracking IDs must be distinct");

    // Verify trackingId field schema definition
    const trackingIdConfig = Complaint.schema.path("trackingId");
    assert.equal(trackingIdConfig.options.required[0], true);
    assert.equal(trackingIdConfig.options.unique, true);
    assert.equal(trackingIdConfig.options.immutable, true);
});

test("4. Status history subdocuments validate actor, status enum, and transitions", async () => {
    const actorId = new mongoose.Types.ObjectId();
    const complaint = new Complaint({
        title: "Billing issue with monthly plan",
        description: "Charged twice for the premium monthly subscription.",
        category: "Billing",
        createdBy: actorId,
        statusHistory: [
            {
                status: "PENDING",
                changedBy: actorId,
                notes: "Initial complaint filing",
            },
            {
                status: "ASSIGNED",
                changedBy: actorId,
                notes: "Assigned to officer",
            },
        ],
    });

    await complaint.validate();
    assert.equal(complaint.statusHistory.length, 2);

    // Verify valid status transition dictionary exists
    assert.ok(VALID_STATUS_TRANSITIONS.PENDING.includes("ASSIGNED"));
    assert.ok(VALID_STATUS_TRANSITIONS.ASSIGNED.includes("IN_PROGRESS"));
    assert.ok(VALID_STATUS_TRANSITIONS.IN_PROGRESS.includes("RESOLVED"));

    // Invalid status in history produces error
    const badHistoryComplaint = new Complaint({
        title: "Valid Title Here",
        description: "Valid description with sufficient length",
        category: "Billing",
        createdBy: actorId,
        statusHistory: [
            {
                status: "INVALID_STATUS",
                changedBy: actorId,
            },
        ],
    });
    await assert.rejects(
        async () => await badHistoryComplaint.validate(),
        (err) => {
            assert.ok(err.errors["statusHistory.0.status"]);
            return true;
        }
    );
});

test("5. Attachment metadata validates file size and required attributes", async () => {
    const complaint = new Complaint({
        title: "Water pipeline leakage issue",
        description: "Severe pipeline leakage at main junction road.",
        category: "Service",
        createdBy: new mongoose.Types.ObjectId(),
        attachments: [
            {
                filename: "leakage_photo_1729660000.jpg",
                originalName: "leakage_photo.jpg",
                url: "/uploads/complaints/leakage_photo_1729660000.jpg",
                mimeType: "image/jpeg",
                size: 2048576, // ~2MB
            },
        ],
    });

    await complaint.validate();

    // Oversized attachment (> 10MB) must fail validation
    const oversizedComplaint = new Complaint({
        title: "Valid Title Here",
        description: "Valid description with sufficient length",
        category: "Service",
        createdBy: new mongoose.Types.ObjectId(),
        attachments: [
            {
                filename: "huge_video.mp4",
                originalName: "huge_video.mp4",
                url: "/uploads/complaints/huge_video.mp4",
                mimeType: "video/mp4",
                size: 15 * 1024 * 1024, // 15MB > 10MB limit
            },
        ],
    });

    await assert.rejects(
        async () => await oversizedComplaint.validate(),
        (err) => {
            assert.ok(err.errors["attachments.0.size"]);
            return true;
        }
    );
});

test("6. Agent model defaults to PENDING approval and correct workload counters", async () => {
    const userId = new mongoose.Types.ObjectId();
    const agent = new Agent({
        user: userId,
        department: "Public Works",
        specialization: ["Roads", "Water Supply"],
    });

    await agent.validate();
    assert.equal(agent.approvalStatus, "PENDING", "New agents must default to PENDING approval");
    assert.equal(agent.isAvailable, true);
    assert.equal(agent.maxActiveComplaints, 10);
    assert.equal(agent.activeComplaintsCount, 0);
    assert.equal(agent.totalResolved, 0);
    assert.equal(agent.approvedBy, null);
});

test("7. Agent invalid approval states and negative workload counters fail validation", async () => {
    const userId = new mongoose.Types.ObjectId();

    // Invalid approvalStatus
    const badStatusAgent = new Agent({
        user: userId,
        department: "Electricity",
        approvalStatus: "AUTO_APPROVED",
    });
    await assert.rejects(
        async () => await badStatusAgent.validate(),
        (err) => {
            assert.ok(err.errors.approvalStatus);
            return true;
        }
    );

    // Negative activeComplaintsCount
    const negCountAgent = new Agent({
        user: userId,
        department: "Electricity",
        activeComplaintsCount: -1,
    });
    await assert.rejects(
        async () => await negCountAgent.validate(),
        (err) => {
            assert.ok(err.errors.activeComplaintsCount);
            return true;
        }
    );
});

test("8. Message model validates required references and content constraints", async () => {
    const complaintId = new mongoose.Types.ObjectId();
    const senderId = new mongoose.Types.ObjectId();

    // Valid message
    const validMsg = new Message({
        complaint: complaintId,
        sender: senderId,
        message: "Hello officer, can you provide an update on this complaint?",
    });
    await validMsg.validate();
    assert.equal(validMsg.isRead, false);
    assert.equal(validMsg.readAt, null);

    // Missing complaint reference
    const missingComplaintMsg = new Message({
        sender: senderId,
        message: "Hello?",
    });
    await assert.rejects(
        async () => await missingComplaintMsg.validate(),
        (err) => {
            assert.ok(err.errors.complaint);
            return true;
        }
    );

    // Empty message content
    const emptyMsg = new Message({
        complaint: complaintId,
        sender: senderId,
        message: "",
    });
    await assert.rejects(
        async () => await emptyMsg.validate(),
        (err) => {
            assert.ok(err.errors.message);
            return true;
        }
    );

    // Oversized message (> 2000 chars)
    const longMsg = new Message({
        complaint: complaintId,
        sender: senderId,
        message: "A".repeat(2001),
    });
    await assert.rejects(
        async () => await longMsg.validate(),
        (err) => {
            assert.ok(err.errors.message);
            return true;
        }
    );
});

test("9. Schema index declarations and model registrations are complete", () => {
    // Model registrations
    assert.ok(mongoose.models.User, "User model should be registered");
    assert.ok(mongoose.models.Complaint, "Complaint model should be registered");
    assert.ok(mongoose.models.Agent, "Agent model should be registered");
    assert.ok(mongoose.models.Feedback, "Feedback model should be registered");
    assert.ok(mongoose.models.Message, "Message model should be registered");

    // Indexes on Complaint
    const complaintIndexes = Complaint.schema.indexes();
    const trackingIdIdx = complaintIndexes.find(([idx]) => idx.trackingId === 1);
    assert.ok(trackingIdIdx, "Complaint must have trackingId index");
    assert.equal(trackingIdIdx[1].unique, true, "trackingId index must be unique");

    // Indexes on Agent
    const agentIndexes = Agent.schema.indexes();
    const agentUserIdx = agentIndexes.find(([idx]) => idx.user === 1);
    assert.ok(agentUserIdx, "Agent must have user index");
    assert.equal(agentUserIdx[1].unique, true, "Agent user index must be unique");

    // Indexes on Message
    const msgIndexes = Message.schema.indexes();
    const msgCompIdx = msgIndexes.find(([idx]) => idx.complaint === 1 && idx.createdAt === 1);
    assert.ok(msgCompIdx, "Message must have compound index on { complaint: 1, createdAt: 1 }");
});

test("10. Feedback model compound index ensures one feedback per user per complaint", () => {
    const feedbackIndexes = Feedback.schema.indexes();
    const uniqueFeedbackIdx = feedbackIndexes.find(([idx]) => idx.complaint === 1 && idx.submittedBy === 1);
    assert.ok(uniqueFeedbackIdx, "Feedback must have compound index on { complaint: 1, submittedBy: 1 }");
    assert.equal(uniqueFeedbackIdx[1].unique, true, "Feedback compound index must be unique");
});
