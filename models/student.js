const mongoose = require("mongoose");

const StudentSchema = new mongoose.Schema({
    studentID: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    password: { type: String, required: true },
    // Remove the subjects map since we're tracking attendance differently
}, { timestamps: true });

module.exports = mongoose.model("Student", StudentSchema);