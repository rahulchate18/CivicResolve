const nodemailer = require("nodemailer");

/**
 * Reusable Email Notification Service using Nodemailer.
 *
 * Resilience & Security Principles:
 * 1. Safe graceful fallback: If SMTP configuration is absent, operations succeed in simulated mode.
 * 2. Non-blocking error handling: Email failures NEVER abort database transactions or fail HTTP requests.
 * 3. Secret hygiene: Credentials, tokens, and citizen passwords are never logged or exposed.
 * 4. Test support: Transporter can be mocked or injected for isolated automated tests.
 */

let transporter = null;

const getTransporter = () => {
    if (transporter) {
        return transporter;
    }

    const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;

    if (EMAIL_HOST && EMAIL_USER && EMAIL_PASS) {
        try {
            transporter = nodemailer.createTransport({
                host: EMAIL_HOST,
                port: parseInt(EMAIL_PORT, 10) || 587,
                secure: parseInt(EMAIL_PORT, 10) === 465,
                auth: {
                    user: EMAIL_USER,
                    pass: EMAIL_PASS,
                },
            });
        } catch (err) {
            console.error("Failed to initialize email transporter:", err.message);
            transporter = null;
        }
    }

    return transporter;
};

// Allow test suites to inject a mock transporter
const setTransporterForTesting = (mockTransporter) => {
    transporter = mockTransporter;
};

/**
 * Base email sending method with safe fallback
 */
const sendEmail = async ({ to, subject, text, html }) => {
    if (!to) {
        return { success: false, reason: "Recipient email not provided" };
    }

    const activeTransporter = getTransporter();
    const fromAddress = process.env.EMAIL_FROM || '"Complaint Portal" <no-reply@complaints.local>';

    if (!activeTransporter) {
        // Safe simulated delivery when SMTP is not configured
        return {
            success: true,
            simulated: true,
            to,
            subject,
        };
    }

    try {
        const info = await activeTransporter.sendMail({
            from: fromAddress,
            to,
            subject,
            text,
            html,
        });

        return {
            success: true,
            messageId: info.messageId,
        };
    } catch (error) {
        // Non-blocking: log sanitized error and do not throw
        console.error(`Email delivery failure to recipient: ${error.message}`);
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Notification: Complaint successfully registered
 */
const notifyComplaintCreated = async (complaint, citizen) => {
    if (!citizen?.email) return;

    return sendEmail({
        to: citizen.email,
        subject: `Complaint Registered [${complaint.trackingId}] - ${complaint.title}`,
        text: `Hello ${citizen.name || "Citizen"},\n\nYour complaint has been successfully registered with tracking ID: ${complaint.trackingId}.\nTitle: ${complaint.title}\nStatus: PENDING\n\nYou can track the progress of your complaint on the portal.\n\nThank you,\nOnline Complaint Portal Team`,
    });
};

/**
 * Notification: Complaint assigned to officer
 */
const notifyComplaintAssigned = async (complaint, agentUser, citizen) => {
    const promises = [];

    if (agentUser?.email) {
        promises.push(
            sendEmail({
                to: agentUser.email,
                subject: `New Complaint Assignment [${complaint.trackingId}]`,
                text: `Hello ${agentUser.name || "Officer"},\n\nA complaint has been assigned to you:\nTracking ID: ${complaint.trackingId}\nTitle: ${complaint.title}\nCategory: ${complaint.category}\nPriority: ${complaint.priority}\n\nPlease review and begin resolution on your dashboard.`,
            })
        );
    }

    if (citizen?.email) {
        promises.push(
            sendEmail({
                to: citizen.email,
                subject: `Officer Assigned to Your Complaint [${complaint.trackingId}]`,
                text: `Hello ${citizen.name || "Citizen"},\n\nYour complaint (${complaint.trackingId}) has been assigned to Officer ${agentUser?.name || "an assigned officer"}. The status is now ASSIGNED.`,
            })
        );
    }

    return Promise.all(promises);
};

/**
 * Notification: Status changed
 */
const notifyStatusChanged = async (complaint, newStatus, citizen) => {
    if (!citizen?.email) return;

    return sendEmail({
        to: citizen.email,
        subject: `Complaint Status Update [${complaint.trackingId}] - ${newStatus}`,
        text: `Hello ${citizen.name || "Citizen"},\n\nThe status of your complaint (${complaint.trackingId}) has been updated to: ${newStatus}.\n\nPlease check the portal for details.`,
    });
};

/**
 * Notification: New message received on complaint thread
 */
const notifyNewMessage = async (complaint, senderUser, recipientUser, messageSnippet) => {
    if (!recipientUser?.email) return;

    return sendEmail({
        to: recipientUser.email,
        subject: `New Message on Complaint [${complaint.trackingId}]`,
        text: `Hello ${recipientUser.name || "User"},\n\nYou have received a new message regarding complaint ${complaint.trackingId} from ${senderUser.name}:\n\n"${messageSnippet}"\n\nPlease log in to view the thread.`,
    });
};

/**
 * Notification: Feedback submitted
 */
const notifyFeedbackSubmitted = async (complaint, feedback, agentUser) => {
    if (!agentUser?.email) return;

    return sendEmail({
        to: agentUser.email,
        subject: `Citizen Feedback Received for Complaint [${complaint.trackingId}]`,
        text: `Hello ${agentUser.name || "Officer"},\n\nA citizen has submitted feedback for complaint ${complaint.trackingId}.\nRating: ${feedback.rating} / 5\n\nThank you for your service.`,
    });
};

module.exports = {
    sendEmail,
    setTransporterForTesting,
    notifyComplaintCreated,
    notifyComplaintAssigned,
    notifyStatusChanged,
    notifyNewMessage,
    notifyFeedbackSubmitted,
};
