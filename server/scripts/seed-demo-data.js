/**
 * CivicResolve — SkillWallet SmartBridge Demo Seed Script
 *
 * PURPOSE:
 * Populates an isolated, realistic municipal demonstration dataset
 * (Citizens, Department Officers, Administrator, Complaints, Status Timeline,
 * Messages, and Citizen Feedback) strictly in the dedicated demo database
 * ("civicresolve_demo").
 *
 * MANDATORY SAFETY CONTROLS:
 * 1. Requires ALLOW_DEMO_SEED="true" environment variable.
 * 2. Requires --confirm-demo-db command-line flag.
 * 3. Requires DEMO_MONGODB_URI to be explicitly provided.
 *    NEVER falls back to MONGODB_URI or TEST_MONGODB_URI.
 * 4. Parses URI and verifies the database path is strictly "civicresolve_demo".
 * 5. Refuses protected databases ("complaint_registration", "civicresolve_isolated_test").
 * 6. Verifies mongoose.connection.name === "civicresolve_demo" post-connection.
 * 7. Never logs database credentials, connection strings, or password hashes.
 * 8. Fully idempotent: safe to re-run without creating duplicate records.
 */

const dns = require("node:dns/promises");
// Configure trusted public DNS resolvers for MongoDB Atlas SRV resolution
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Agent = require("../models/Agent");
const Complaint = require("../models/Complaint");
const Message = require("../models/Message");
const Feedback = require("../models/Feedback");

const ALLOWED_DATABASE_NAME = "civicresolve_demo";
const FORBIDDEN_DATABASE_NAMES = [
    "complaint_registration",
    "civicresolve_isolated_test",
    "test",
    "admin",
    "local",
];

// Strictly designated demo personas with clearly labeled demo-only credentials
const DEMO_PERSONAS = {
    admin: {
        name: "Demo System Administrator",
        email: "demo.admin@civicresolve.demo",
        password: "DemoAdmin2026!",
        role: "ADMIN",
        phone: "+1-555-0199",
        address: "Civic Center Admin HQ",
        city: "Metropolis",
        state: "State",
        postalCode: "10001",
    },
    officerTech: {
        name: "Officer Alex Rivera (Technical)",
        email: "officer.tech@civicresolve.demo",
        password: "DemoOfficer2026!",
        role: "AGENT",
        department: "Technical Support",
        specialization: ["Infrastructure", "Electrical", "Telecommunications"],
        phone: "+1-555-0191",
        address: "Municipal Engineering Dept",
        city: "Metropolis",
        state: "State",
        postalCode: "10002",
    },
    officerBilling: {
        name: "Officer Priya Sharma (Billing)",
        email: "officer.billing@civicresolve.demo",
        password: "DemoOfficer2026!",
        role: "AGENT",
        department: "Billing & Revenue",
        specialization: ["Property Tax", "Water Meters", "Service Charges"],
        phone: "+1-555-0192",
        address: "Revenue & Finance Complex",
        city: "Metropolis",
        state: "State",
        postalCode: "10003",
    },
    citizenJane: {
        name: "Jane Doe (Citizen)",
        email: "citizen.jane@civicresolve.demo",
        password: "DemoCitizen2026!",
        role: "USER",
        phone: "+1-555-0181",
        address: "742 Evergreen Terrace",
        city: "Metropolis",
        state: "State",
        postalCode: "10010",
    },
    citizenJohn: {
        name: "John Smith (Citizen)",
        email: "citizen.john@civicresolve.demo",
        password: "DemoCitizen2026!",
        role: "USER",
        phone: "+1-555-0182",
        address: "123 Elm Street",
        city: "Metropolis",
        state: "State",
        postalCode: "10011",
    },
};

/**
 * Extracts database name from MongoDB connection string
 */
const extractDatabaseNameFromUri = (uriString) => {
    try {
        const withoutQuery = uriString.split("?")[0];
        const parts = withoutQuery.split("/");
        if (parts.length < 4) return null;
        const dbName = parts[parts.length - 1].trim();
        return dbName || null;
    } catch {
        return null;
    }
};

const runSeed = async () => {
    console.log("=================================================");
    console.log("CivicResolve — Internship Demo Dataset Seeding");
    console.log("=================================================");

    // Safeguard 1: Explicit environment opt-in
    if (process.env.ALLOW_DEMO_SEED !== "true") {
        console.error("ABORTED: ALLOW_DEMO_SEED environment variable must be set to 'true'.");
        process.exit(1);
    }

    // Safeguard 2: Command-line confirmation flag
    if (!process.argv.includes("--confirm-demo-db")) {
        console.error("ABORTED: Must provide explicit '--confirm-demo-db' command-line flag.");
        process.exit(1);
    }

    // Safeguard 3: Dedicated DEMO_MONGODB_URI only; never fall back
    const demoUri = process.env.DEMO_MONGODB_URI;
    if (!demoUri || typeof demoUri !== "string" || !demoUri.trim()) {
        console.error("ABORTED: DEMO_MONGODB_URI environment variable is required.");
        console.error("Notice: This script will NEVER fall back to MONGODB_URI or TEST_MONGODB_URI.");
        process.exit(1);
    }

    // Safeguard 4 & 5: Pre-connection database URI validation and protected database rejection
    const parsedDbName = extractDatabaseNameFromUri(demoUri);
    if (FORBIDDEN_DATABASE_NAMES.includes(parsedDbName)) {
        console.error(`ABORTED: Database target '${parsedDbName}' is a protected production/test namespace.`);
        console.error("Demo seeding is strictly forbidden against this database.");
        process.exit(1);
    }

    if (parsedDbName !== ALLOWED_DATABASE_NAME) {
        console.error(`ABORTED: Target database path mismatch.`);
        console.error(`Allowed database name : '${ALLOWED_DATABASE_NAME}'`);
        console.error(`Detected in DEMO URI   : '${parsedDbName || "<none/root>"}'`);
        console.error("For safety, this script refuses to run against any database other than 'civicresolve_demo'.");
        process.exit(1);
    }

    console.log("Preflight URI validation passed: Database target verified as 'civicresolve_demo'.");

    // Connect to verified demo database
    try {
        await mongoose.connect(demoUri, {
            serverSelectionTimeoutMS: 10000,
        });
    } catch (connErr) {
        console.error("ABORTED: Failed to connect to demo database:", connErr.message);
        process.exit(1);
    }

    // Safeguard 6: Post-connection live connection verification
    const activeDbName = mongoose.connection.name;
    if (activeDbName !== ALLOWED_DATABASE_NAME) {
        console.error(`ABORTED: Active Mongoose connection is connected to '${activeDbName}', NOT '${ALLOWED_DATABASE_NAME}'.`);
        await mongoose.disconnect();
        process.exit(1);
    }

    console.log(`Connection verified: Successfully connected to active database '${activeDbName}'.\n`);

    try {
        // ==========================================
        // 1. SEED / UPSERT USERS
        // ==========================================
        console.log("--- 1. Seeding Demo Users ---");
        const users = {};

        for (const [key, persona] of Object.entries(DEMO_PERSONAS)) {
            let existingUser = await User.findOne({ email: persona.email });

            if (!existingUser) {
                const hashedPassword = await bcrypt.hash(persona.password, 12);
                existingUser = await User.create({
                    name: persona.name,
                    email: persona.email,
                    password: hashedPassword,
                    role: persona.role,
                    isActive: true,
                    phone: persona.phone,
                    address: persona.address,
                    city: persona.city,
                    state: persona.state,
                    postalCode: persona.postalCode,
                });
                console.log(`+ Created user: ${persona.email} (${persona.role})`);
            } else {
                existingUser.name = persona.name;
                existingUser.role = persona.role;
                existingUser.isActive = true;
                existingUser.phone = persona.phone;
                existingUser.address = persona.address;
                existingUser.city = persona.city;
                existingUser.state = persona.state;
                existingUser.postalCode = persona.postalCode;
                await existingUser.save();
                console.log(`= Verified user: ${persona.email} (${persona.role})`);
            }
            users[key] = existingUser;
        }

        // ==========================================
        // 2. SEED / UPSERT AGENT PROFILES
        // ==========================================
        console.log("\n--- 2. Seeding Approved Officer Profiles ---");
        const agentProfiles = {};

        const officerConfigs = [
            { key: "officerTech", persona: DEMO_PERSONAS.officerTech },
            { key: "officerBilling", persona: DEMO_PERSONAS.officerBilling },
        ];

        for (const { key, persona } of officerConfigs) {
            const officerUser = users[key];
            let existingAgent = await Agent.findOne({ user: officerUser._id });

            if (!existingAgent) {
                existingAgent = await Agent.create({
                    user: officerUser._id,
                    department: persona.department,
                    specialization: persona.specialization,
                    approvalStatus: "APPROVED",
                    approvedBy: users.admin._id,
                    approvedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
                    isAvailable: true,
                    maxActiveComplaints: 10,
                    activeComplaintsCount: 0,
                    totalResolved: 0,
                });
                console.log(`+ Created approved Agent profile for ${persona.email} (${persona.department})`);
            } else {
                existingAgent.department = persona.department;
                existingAgent.specialization = persona.specialization;
                existingAgent.approvalStatus = "APPROVED";
                existingAgent.approvedBy = users.admin._id;
                existingAgent.isAvailable = true;
                await existingAgent.save();
                console.log(`= Verified Agent profile for ${persona.email} (${persona.department})`);
            }
            agentProfiles[key] = existingAgent;
        }

        // ==========================================
        // 3. SEED / UPSERT REALISTIC COMPLAINTS
        // ==========================================
        console.log("\n--- 3. Seeding Representative Complaint Lifecycles ---");

        const demoComplaints = [
            {
                trackingId: "CMP-DEMO-TECH01",
                title: "Exposed High-Voltage Cable Near Primary School",
                description: "A severe storm caused a utility pole to split, exposing heavy live wiring near the entrance of Lincoln Elementary. Poses immediate danger to pedestrians and students.",
                category: "Technical",
                priority: "URGENT",
                status: "PENDING",
                createdBy: users.citizenJane._id,
                assignedAgent: null,
                citizenContact: {
                    phone: "+1-555-0181",
                    address: "742 Evergreen Terrace",
                    city: "Metropolis",
                    state: "State",
                    postalCode: "10010",
                },
                statusHistory: [
                    {
                        status: "PENDING",
                        changedBy: users.citizenJane._id,
                        changedAt: new Date(Date.now() - 48 * 3600 * 1000),
                        notes: "Grievance registered by citizen. Awaiting administrative dispatch.",
                    },
                ],
                resolution: "",
                resolvedAt: null,
            },
            {
                trackingId: "CMP-DEMO-BILL02",
                title: "Commercial Property Tax Assessed on Residential Flat",
                description: "Received property tax assessment notice reflecting commercial rate structure for residential unit 4B. Previous assessments were residential. Deeds and occupancy certificates attached.",
                category: "Billing",
                priority: "MEDIUM",
                status: "ASSIGNED",
                createdBy: users.citizenJohn._id,
                assignedAgent: users.officerBilling._id,
                citizenContact: {
                    phone: "+1-555-0182",
                    address: "123 Elm Street",
                    city: "Metropolis",
                    state: "State",
                    postalCode: "10011",
                },
                statusHistory: [
                    {
                        status: "PENDING",
                        changedBy: users.citizenJohn._id,
                        changedAt: new Date(Date.now() - 36 * 3600 * 1000),
                        notes: "Grievance submitted by citizen.",
                    },
                    {
                        status: "ASSIGNED",
                        changedBy: users.admin._id,
                        changedAt: new Date(Date.now() - 24 * 3600 * 1000),
                        notes: "Dispatched to Revenue & Billing assessment queue.",
                    },
                ],
                resolution: "",
                resolvedAt: null,
            },
            {
                trackingId: "CMP-DEMO-TECH03",
                title: "Underground Fiber Duct Collapsed During Storm Drain Digging",
                description: "Municipal road works contractor damaged the municipal fiber duct along 5th Avenue, cutting internet and emergency telephony to the civic clinic and local library.",
                category: "Technical",
                priority: "HIGH",
                status: "IN_PROGRESS",
                createdBy: users.citizenJane._id,
                assignedAgent: users.officerTech._id,
                citizenContact: {
                    phone: "+1-555-0181",
                    address: "500 5th Avenue Civic Corridor",
                    city: "Metropolis",
                    state: "State",
                    postalCode: "10010",
                },
                statusHistory: [
                    {
                        status: "PENDING",
                        changedBy: users.citizenJane._id,
                        changedAt: new Date(Date.now() - 72 * 3600 * 1000),
                        notes: "Grievance submitted by citizen.",
                    },
                    {
                        status: "ASSIGNED",
                        changedBy: users.admin._id,
                        changedAt: new Date(Date.now() - 60 * 3600 * 1000),
                        notes: "Dispatched to Technical Infrastructure emergency crew.",
                    },
                    {
                        status: "IN_PROGRESS",
                        changedBy: users.officerTech._id,
                        changedAt: new Date(Date.now() - 48 * 3600 * 1000),
                        notes: "Field technicians dispatched with trenching equipment and optical splice unit.",
                    },
                ],
                resolution: "",
                resolvedAt: null,
            },
            {
                trackingId: "CMP-DEMO-SERV04",
                title: "Bi-Weekly Green Waste Collection Skipped on Oak Avenue",
                description: "Municipal green waste collection did not occur on scheduled Tuesday pickup for odd-numbered residences on Oak Avenue. Multiple curbside bins overflowed.",
                category: "Service",
                priority: "LOW",
                status: "RESOLVED",
                createdBy: users.citizenJohn._id,
                assignedAgent: users.officerBilling._id,
                citizenContact: {
                    phone: "+1-555-0182",
                    address: "123 Elm Street / Oak Ave Junction",
                    city: "Metropolis",
                    state: "State",
                    postalCode: "10011",
                },
                statusHistory: [
                    {
                        status: "PENDING",
                        changedBy: users.citizenJohn._id,
                        changedAt: new Date(Date.now() - 30 * 3600 * 1000),
                        notes: "Grievance submitted by citizen.",
                    },
                    {
                        status: "ASSIGNED",
                        changedBy: users.admin._id,
                        changedAt: new Date(Date.now() - 22 * 3600 * 1000),
                        notes: "Assigned to Sanitation & Public Services supervisor.",
                    },
                    {
                        status: "IN_PROGRESS",
                        changedBy: users.officerBilling._id,
                        changedAt: new Date(Date.now() - 16 * 3600 * 1000),
                        notes: "Contacted waste management fleet dispatch.",
                    },
                    {
                        status: "RESOLVED",
                        changedBy: users.officerBilling._id,
                        changedAt: new Date(Date.now() - 8 * 3600 * 1000),
                        notes: "Sanitation recovery vehicle dispatched. Curbside bins cleared.",
                    },
                ],
                resolution: "Sanitation recovery vehicle rerouted. All curbside green bins cleared and schedule logged for supervisor review.",
                resolvedAt: new Date(Date.now() - 8 * 3600 * 1000),
            },
            {
                trackingId: "CMP-DEMO-SERV05",
                title: "Burst Water Main Flooding Corner of 4th and Main",
                description: "Major 12-inch water transmission line ruptured, flooding street and causing zero water pressure across Sector 4.",
                category: "Service",
                priority: "URGENT",
                status: "CLOSED",
                createdBy: users.citizenJane._id,
                assignedAgent: users.officerTech._id,
                citizenContact: {
                    phone: "+1-555-0181",
                    address: "Sector 4 Main Square",
                    city: "Metropolis",
                    state: "State",
                    postalCode: "10010",
                },
                statusHistory: [
                    {
                        status: "PENDING",
                        changedBy: users.citizenJane._id,
                        changedAt: new Date(Date.now() - 96 * 3600 * 1000),
                        notes: "Emergency grievance submitted by citizen.",
                    },
                    {
                        status: "ASSIGNED",
                        changedBy: users.admin._id,
                        changedAt: new Date(Date.now() - 90 * 3600 * 1000),
                        notes: "Urgent dispatch to Water Authority.",
                    },
                    {
                        status: "IN_PROGRESS",
                        changedBy: users.officerTech._id,
                        changedAt: new Date(Date.now() - 84 * 3600 * 1000),
                        notes: "Emergency valve closed. Replacement cast-iron piping in transit.",
                    },
                    {
                        status: "RESOLVED",
                        changedBy: users.officerTech._id,
                        changedAt: new Date(Date.now() - 36 * 3600 * 1000),
                        notes: "Transmission pipe replaced and pressure restored to 4.2 bar.",
                    },
                    {
                        status: "CLOSED",
                        changedBy: users.citizenJane._id,
                        changedAt: new Date(Date.now() - 24 * 3600 * 1000),
                        notes: "Citizen verified clean water delivery and closed complaint.",
                    },
                ],
                resolution: "Emergency isolation valve engaged, defective pipe segment replaced, pressure tested to 4.2 bar, and roadway repaved.",
                resolvedAt: new Date(Date.now() - 36 * 3600 * 1000),
            },
        ];

        const complaintsMap = {};

        for (const data of demoComplaints) {
            let complaint = await Complaint.findOne({ trackingId: data.trackingId });

            if (!complaint) {
                complaint = await Complaint.create(data);
                console.log(`+ Created complaint [${data.status}]: ${data.trackingId} — ${data.title}`);
            } else {
                complaint.title = data.title;
                complaint.description = data.description;
                complaint.category = data.category;
                complaint.priority = data.priority;
                complaint.status = data.status;
                complaint.assignedAgent = data.assignedAgent;
                complaint.statusHistory = data.statusHistory;
                complaint.resolution = data.resolution;
                complaint.resolvedAt = data.resolvedAt;
                await complaint.save();
                console.log(`= Verified complaint [${data.status}]: ${data.trackingId} — ${data.title}`);
            }
            complaintsMap[data.trackingId] = complaint;
        }

        // ==========================================
        // 4. SEED / UPSERT INQUIRY MESSAGES
        // ==========================================
        console.log("\n--- 4. Seeding Inquiry Message Thread (Complaint CMP-DEMO-TECH03) ---");
        const activeComplaint = complaintsMap["CMP-DEMO-TECH03"];

        const demoMessages = [
            {
                complaint: activeComplaint._id,
                sender: users.citizenJane._id,
                message: "Good morning Officer Rivera, the excavation contractor is still on site. Are the fiber splicing technicians arriving today?",
                isRead: true,
                readAt: new Date(Date.now() - 35 * 3600 * 1000),
                createdAt: new Date(Date.now() - 36 * 3600 * 1000),
            },
            {
                complaint: activeComplaint._id,
                sender: users.officerTech._id,
                message: "Hello Ms. Doe, yes. Field Crew #4 is on scene with replacement conduit. We expect splicing to complete before 4 PM.",
                isRead: true,
                readAt: new Date(Date.now() - 29 * 3600 * 1000),
                createdAt: new Date(Date.now() - 30 * 3600 * 1000),
            },
            {
                complaint: activeComplaint._id,
                sender: users.citizenJane._id,
                message: "Thank you for the update. Clinic staff confirmed the fiber crew just pulled in and started work.",
                isRead: false,
                readAt: null,
                createdAt: new Date(Date.now() - 28 * 3600 * 1000),
            },
        ];

        for (const msgData of demoMessages) {
            const existingMsg = await Message.findOne({
                complaint: msgData.complaint,
                sender: msgData.sender,
                message: msgData.message,
            });

            if (!existingMsg) {
                await Message.create(msgData);
                console.log(`+ Added message to thread from ${msgData.sender.equals(users.citizenJane._id) ? "Citizen" : "Officer"}`);
            } else {
                console.log(`= Verified message in thread from ${msgData.sender.equals(users.citizenJane._id) ? "Citizen" : "Officer"}`);
            }
        }

        // ==========================================
        // 5. SEED / UPSERT CITIZEN FEEDBACK
        // ==========================================
        console.log("\n--- 5. Seeding Citizen Feedback (Complaint CMP-DEMO-SERV05) ---");
        const closedComplaint = complaintsMap["CMP-DEMO-SERV05"];

        const existingFeedback = await Feedback.findOne({
            complaint: closedComplaint._id,
            submittedBy: users.citizenJane._id,
        });

        if (!existingFeedback) {
            await Feedback.create({
                complaint: closedComplaint._id,
                submittedBy: users.citizenJane._id,
                agent: users.officerTech._id,
                rating: 5,
                comments: "Rapid emergency crew response. Water pressure fully restored within hours. Excellent municipal coordination.",
            });
            console.log("+ Created 5-Star feedback rating from Citizen Jane.");
        } else {
            existingFeedback.rating = 5;
            existingFeedback.comments = "Rapid emergency crew response. Water pressure fully restored within hours. Excellent municipal coordination.";
            await existingFeedback.save();
            console.log("= Verified 5-Star feedback rating from Citizen Jane.");
        }

        // ==========================================
        // 6. SYNC AGENT WORKLOAD STATS
        // ==========================================
        console.log("\n--- 6. Synchronizing Officer Workload Metrics ---");
        for (const { key } of officerConfigs) {
            const officerUser = users[key];
            const activeCount = await Complaint.countDocuments({
                assignedAgent: officerUser._id,
                status: { $in: ["ASSIGNED", "IN_PROGRESS"] },
            });
            const resolvedCount = await Complaint.countDocuments({
                assignedAgent: officerUser._id,
                status: { $in: ["RESOLVED", "CLOSED"] },
            });

            await Agent.findOneAndUpdate(
                { user: officerUser._id },
                {
                    activeComplaintsCount: activeCount,
                    totalResolved: resolvedCount,
                }
            );
            console.log(`= Officer ${officerUser.email}: Active = ${activeCount}, Resolved = ${resolvedCount}`);
        }

        console.log("\n=================================================");
        console.log("Seeding complete! Isolated demo environment ready.");
        console.log("Evaluator Personas Configured:");
        console.log("- Administrator: demo.admin@civicresolve.demo       (Password: DemoAdmin2026!)");
        console.log("- Officer Tech:  officer.tech@civicresolve.demo     (Password: DemoOfficer2026!)");
        console.log("- Officer Bill:  officer.billing@civicresolve.demo  (Password: DemoOfficer2026!)");
        console.log("- Citizen Jane:  citizen.jane@civicresolve.demo     (Password: DemoCitizen2026!)");
        console.log("- Citizen John:  citizen.john@civicresolve.demo     (Password: DemoCitizen2026!)");
        console.log("=================================================");
    } catch (err) {
        console.error("\nABORTED: Error during demo seeding:", err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log("Database connection closed.");
    }
};

runSeed();
