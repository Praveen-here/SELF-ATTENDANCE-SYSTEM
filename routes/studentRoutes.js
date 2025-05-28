const express = require('express');
const router = express.Router();
const Student = require('../models/student');
const Attendance = require('../models/Attendance');

// Get all students for attendance
router.get('/attendance-students', async (req, res) => {
    try {
        const students = await Student.find({}, 'studentID name');
        res.json(students);
    } catch (err) {
        console.error("Error fetching students:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// Student Attendance Submission
router.post("/submit-attendance", async (req, res) => {
    try {
        const { studentID, date, subject } = req.body;
        
        if (!studentID || !date || !subject) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const student = await Student.findOne({ studentID });
        if (!student) return res.status(404).json({ message: "Student not found" });

        // Check for existing attendance
        const existing = await Attendance.findOne({ 
            date: new Date(date),
            subject,
            student: student._id 
        });
        
        if (existing) {
            return res.status(400).json({ message: "Attendance already marked" });
        }

        // Create new attendance record
        const attendance = new Attendance({
            date: new Date(date),
            subject,
            student: student._id
        });

        await attendance.save();

        // Update student's subject attendance count
        const studentSubjects = student.subjects.get(subject) || {
            totalClasses: 0,
            attendedClasses: 0
        };
        
        studentSubjects.totalClasses += 1;
        studentSubjects.attendedClasses += 1;
        student.subjects.set(subject, studentSubjects);
        await student.save();

        res.json({ success: true, message: "Attendance marked successfully" });

    } catch (error) {
        console.error("Attendance error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;