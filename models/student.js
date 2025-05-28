const mongoose = require("mongoose");

const StudentSchema = new mongoose.Schema({
    studentID: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    subjects: {
        type: Map,
        of: {
            totalClasses: { type: Number, default: 0 },
            attendedClasses: { type: Number, default: 0 }
        }
    }
}, { timestamps: true }); // Adds createdAt & updatedAt fields

module.exports = mongoose.model("Student", StudentSchema);
