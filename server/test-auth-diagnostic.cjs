const dns = require("node:dns/promises");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

async function main() {
  try {
    const uri = process.env.TEST_MONGODB_URI;
    if (!uri) {
      console.log("STOP: TEST_MONGODB_URI is missing in this terminal.");
      return;
    }

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log("Database:", mongoose.connection.name);

    if (mongoose.connection.name !== "civicresolve_isolated_test") {
      console.log("STOP: Unexpected database.");
      return;
    }

    const user = await User.findOne({
      email: "local.test.admin@civicresolve.test"
    }).select("+password");

    if (!user) {
      console.log("Admin account exists: NO");
      return;
    }

    console.log("Admin account exists: YES");
    console.log("Role:", user.role);
    console.log("Active:", user.isActive);
    console.log(
      "Designated test password matches:",
      await bcrypt.compare("TestAdminPassword123!", user.password)
    );
  } catch (error) {
    console.log("Diagnostic failed:", error.name);
    console.log("Error code:", error.code || "Not provided");
  } finally {
    await mongoose.disconnect();
  }
}

main();
