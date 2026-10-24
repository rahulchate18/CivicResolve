/**
 * CivicResolve — Isolated Local Test Environment Bootstrap Script
 *
 * PURPOSE:
 * Seeds/configures designated local test accounts (1 ADMIN, 1 PENDING AGENT)
 * strictly in an isolated test database ("civicresolve_isolated_test").
 *
 * MANDATORY SAFETY CONTROLS:
 * 1. Requires ALLOW_LOCAL_TEST_BOOTSTRAP="true" environment variable.
 * 2. Requires --confirm-isolated-test-db command-line flag.
 * 3. Requires TEST_MONGODB_URI to be explicitly provided. Never falls back to MONGODB_URI.
 * 4. Parses the URI and verifies the database path is strictly "civicresolve_isolated_test".
 * 5. Verifies mongoose.connection.name === "civicresolve_isolated_test" post-connection.
 * 6. Never logs database credentials, connection strings, or password hashes.
 * 7. Promotes only the exact designated test admin email: local.test.admin@civicresolve.test.
 * 8. Creates officer and pending Agent record idempotently with strict preflight validation.
 */

const dns = require("node:dns/promises");
// Configure trusted public DNS resolvers for MongoDB Atlas SRV resolution
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Agent = require("../models/Agent");

// Strictly designated test account personas
const TEST_ADMIN = {
    name: "Local Test Admin",
    email: "local.test.admin@civicresolve.test",
    password: "TestAdminPassword123!",
    role: "ADMIN",
};

const TEST_OFFICER = {
    name: "Local Test Officer",
    email: "local.test.officer@civicresolve.test",
    password: "TestOfficerPassword123!",
    department: "Public Works",
    specialization: ["Municipal Infrastructure", "Sanitation"],
};

const EXPECTED_DATABASE_NAME = "civicresolve_isolated_test";

/**
 * Extracts database name from MongoDB connection string
 * Supports both standard (mongodb://) and DNS SRV (mongodb+srv://) URIs
 */
const extractDatabaseNameFromUri = (uriString) => {
    try {
        // Strip query parameters
        const withoutQuery = uriString.split("?")[0];
        // Split protocol from rest
        const parts = withoutQuery.split("/");
        if (parts.length < 4) return null;
        // Last segment is the database name
        const dbName = parts[parts.length - 1].trim();
        return dbName || null;
    } catch {
        return null;
    }
};

const runBootstrap = async () => {
    console.log("=================================================");
    console.log("CivicResolve — Isolated Test Bootstrap Initialization");
    console.log("=================================================");

    // Safeguard 1: Environment flag
    if (process.env.ALLOW_LOCAL_TEST_BOOTSTRAP !== "true") {
        console.error("ABORTED: ALLOW_LOCAL_TEST_BOOTSTRAP environment variable must be set to 'true'.");
        process.exit(1);
    }

    // Safeguard 2: Command-line confirmation flag
    if (!process.argv.includes("--confirm-isolated-test-db")) {
        console.error("ABORTED: Must provide explicit '--confirm-isolated-test-db' command-line flag.");
        process.exit(1);
    }

    // Safeguard 3 & 4: Explicit test URI required; never fall back to MONGODB_URI
    const testUri = process.env.TEST_MONGODB_URI;
    if (!testUri || typeof testUri !== "string" || !testUri.trim()) {
        console.error("ABORTED: TEST_MONGODB_URI environment variable is required.");
        console.error("Notice: This script will NEVER fall back to standard MONGODB_URI to avoid accidental contamination.");
        process.exit(1);
    }

    const parsedDbName = extractDatabaseNameFromUri(testUri);
    if (parsedDbName !== EXPECTED_DATABASE_NAME) {
        console.error(`ABORTED: Target database path mismatch.`);
        console.error(`Expected database name : '${EXPECTED_DATABASE_NAME}'`);
        console.error(`Detected in TEST URI   : '${parsedDbName || "<none/root>"}'`);
        console.error("For safety, this script refuses to run against any database other than 'civicresolve_isolated_test'.");
        process.exit(1);
    }

    console.log("Preflight URI validation passed: Database target verified as isolated test namespace.");

    // Connect to verified test database
    try {
        await mongoose.connect(testUri, {
            serverSelectionTimeoutMS: 10000,
        });
    } catch (connErr) {
        console.error("ABORTED: Failed to connect to verified test database:", connErr.message);
        process.exit(1);
    }

    // Safeguard 5: Post-connection live connection verification
    const activeDbName = mongoose.connection.name;
    if (activeDbName !== EXPECTED_DATABASE_NAME) {
        console.error(`ABORTED: Active Mongoose connection is connected to '${activeDbName}', NOT '${EXPECTED_DATABASE_NAME}'.`);
        await mongoose.disconnect();
        process.exit(1);
    }

    console.log(`Connection verified: Successfully connected to active database '${activeDbName}'.`);

    try {
        // ==========================================
        // STAGE 1: PREFLIGHT INSPECTION & VALIDATION
        // (Read-only check before ANY mutation)
        // ==========================================
        console.log("\n--- STAGE 1: Preflight Inspection & Validation ---");

        // 1. Inspect Administrator Persona
        const existingAdmin = await User.findOne({ email: TEST_ADMIN.email });
        if (existingAdmin) {
            if (existingAdmin.email !== TEST_ADMIN.email) {
                throw new Error("Preflight violation: Admin account email mismatch.");
            }
            if (existingAdmin.role !== "ADMIN" && existingAdmin.role !== "USER") {
                throw new Error(
                    `Preflight violation: Admin candidate (${TEST_ADMIN.email}) has unexpected role '${existingAdmin.role}'. Expected 'ADMIN' or 'USER'.`
                );
            }
            console.log(`- Admin candidate: Found existing account with role '${existingAdmin.role}' (OK).`);
        } else {
            console.log(`- Admin candidate: No existing account found. Ready for creation.`);
        }

        // 2. Inspect Officer Persona & Linked Agent Record
        let existingOfficer = await User.findOne({ email: TEST_OFFICER.email });
        let existingAgent = null;

        if (existingOfficer) {
            if (existingOfficer.email !== TEST_OFFICER.email) {
                throw new Error("Preflight violation: Officer account email mismatch.");
            }
            if (existingOfficer.role === "ADMIN") {
                throw new Error(
                    `Preflight violation: Officer candidate (${TEST_OFFICER.email}) already has 'ADMIN' role. Refusing to alter.`
                );
            }
            if (existingOfficer.role !== "USER" && existingOfficer.role !== "AGENT") {
                throw new Error(
                    `Preflight violation: Officer candidate (${TEST_OFFICER.email}) has unexpected role '${existingOfficer.role}'.`
                );
            }

            existingAgent = await Agent.findOne({ user: existingOfficer._id });
            if (existingAgent) {
                console.log(
                    `- Officer candidate: Found existing account (role: '${existingOfficer.role}') and Agent profile (status: '${existingAgent.approvalStatus}'). Existing profile will be preserved.`
                );
            } else {
                console.log(
                    `- Officer candidate: Found existing account (role: '${existingOfficer.role}') with no Agent profile. Ready to attach Agent profile.`
                );
            }
        } else {
            console.log(`- Officer candidate: No existing account found. Ready for creation.`);
        }

        console.log("Preflight validation complete: All preconditions satisfied. Proceeding to mutations.");

        // ==========================================
        // STAGE 2: APPLY TEST PERSONA MUTATIONS
        // ==========================================
        console.log("\n--- STAGE 2: Applying Test Persona Setup ---");

        // 1. Bootstrap Test Admin
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash(TEST_ADMIN.password, 12);
            await User.create({
                name: TEST_ADMIN.name,
                email: TEST_ADMIN.email,
                password: hashedPassword,
                role: "ADMIN",
                isActive: true,
                phone: "+1-555-0100",
                address: "Civic Center Admin Office",
                city: "Metropolis",
                state: "State",
                postalCode: "10001",
            });
            console.log(`Created new administrator: ${TEST_ADMIN.email}`);
        } else {
            if (existingAdmin.role !== "ADMIN") {
                existingAdmin.role = "ADMIN";
                existingAdmin.isActive = true;
                await existingAdmin.save();
                console.log(`Promoted existing user to ADMIN role: ${TEST_ADMIN.email}`);
            } else {
                console.log(`Administrator already configured: ${TEST_ADMIN.email}`);
            }
        }

        // 2. Bootstrap Test Officer
        let officerUser = existingOfficer;
        if (!officerUser) {
            const hashedPassword = await bcrypt.hash(TEST_OFFICER.password, 12);
            officerUser = await User.create({
                name: TEST_OFFICER.name,
                email: TEST_OFFICER.email,
                password: hashedPassword,
                role: "USER", // Starts as USER until approved by admin
                isActive: true,
                phone: "+1-555-0101",
                address: "Public Works Substation",
                city: "Metropolis",
                state: "State",
                postalCode: "10002",
            });
            console.log(`Created officer candidate account: ${TEST_OFFICER.email}`);
        } else {
            console.log(`Officer candidate account verified: ${TEST_OFFICER.email}`);
        }

        // 3. Attach Agent Application Profile (Preserved if already present)
        if (!existingAgent) {
            await Agent.create({
                user: officerUser._id,
                department: TEST_OFFICER.department,
                specialization: TEST_OFFICER.specialization,
                approvalStatus: "PENDING",
                isAvailable: true,
                maxActiveComplaints: 10,
                activeComplaintsCount: 0,
                totalResolved: 0,
            });
            console.log(`Created PENDING Agent application profile for officer: ${TEST_OFFICER.email}`);
        } else {
            console.log(`Preserved existing Agent profile (approvalStatus: '${existingAgent.approvalStatus}'). No changes made.`);
        }

        console.log("\n=================================================");
        console.log("Bootstrap complete: Isolated test environment ready.");
        console.log("Designated personas:");
        console.log(`- Admin:   ${TEST_ADMIN.email} (Role: ADMIN)`);
        console.log(`- Officer: ${TEST_OFFICER.email} (Status: PENDING approval)`);
        console.log("=================================================");
    } catch (err) {
        console.error("\nABORTED: Error during test role setup:", err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log("Database connection closed.");
    }
};

runBootstrap();
