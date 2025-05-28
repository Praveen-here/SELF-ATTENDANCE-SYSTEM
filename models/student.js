const mongoose = require("mongoose");

const StudentSchema = new mongoose.Schema({
    studentID: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    password: { type: String, required: true }, // Added password field for authentication
    subjects: {
        type: Map,
        of: {
            totalClasses: { type: Number, default: 0 },
            attendedClasses: { type: Number, default: 0 }
        }
    }
}, { timestamps: true });

module.exports = mongoose.model("Student", StudentSchema);