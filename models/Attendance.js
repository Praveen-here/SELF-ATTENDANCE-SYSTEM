const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    subject: { type: String, required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    deviceId: { type: String, required: true }, // Added deviceId field
    timestamp: { type: Date, default: Date.now }
});

// Add compound index to prevent duplicate entries
AttendanceSchema.index({ date: 1, subject: 1, student: 1 }, { unique: true });
AttendanceSchema.index({ date: 1, subject: 1, deviceId: 1 }, { unique: true }); // Added deviceId index

module.exports = mongoose.model("Attendance", AttendanceSchema);