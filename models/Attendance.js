const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    subject: { type: String, required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    deviceIdentifier: { type: String, required: true }, // Device fingerprint
    sessionToken: { type: String, required: true }, // QR session token
    ipAddress: { type: String, required: true },
    userAgent: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

// Compound indexes for efficient querying
AttendanceSchema.index({ date: 1, subject: 1, student: 1 }, { unique: true });
AttendanceSchema.index({ date: 1, subject: 1, deviceIdentifier: 1 }, { unique: true });
AttendanceSchema.index({ sessionToken: 1 });

module.exports = mongoose.model("Attendance", AttendanceSchema);