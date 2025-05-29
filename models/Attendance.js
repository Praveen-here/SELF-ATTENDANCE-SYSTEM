const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    subject: { type: String, required: true },
    date: { type: String, required: true },
    deviceId: { type: String, required: true },
}, { timestamps: true });

// Compound unique index to prevent duplicate attendance submissions
attendanceSchema.index({ student: 1, subject: 1, date: 1, deviceId: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
