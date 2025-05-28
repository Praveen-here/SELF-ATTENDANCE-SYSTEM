const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema({
    date: { type: String, required: true }, // Store as YYYY-MM-DD
    subject: { type: String, required: true },
    student: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Student", 
        required: true 
    },
    deviceId: { type: String, required: true },
    status: { type: String, enum: ['present'], default: 'present' },
    timestamp: { type: Date, default: Date.now }
});

// Add compound index to prevent duplicate entries
AttendanceSchema.index({ date: 1, subject: 1, student: 1 }, { unique: true });
AttendanceSchema.index({ date: 1, subject: 1, deviceId: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", AttendanceSchema);