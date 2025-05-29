const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
    date: { type: String, required: true },
    subject: { type: String, required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    deviceId: { type: String, required: true }
});

// Enforce 1 attendance submission per device per subject per date
attendanceSchema.index({ deviceId: 1, subject: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
