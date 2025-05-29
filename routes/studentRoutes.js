const express = require('express');
const router = express.Router();
const Student = require('../models/student');
const Attendance = require('../models/Attendance');
const bcrypt = require('bcryptjs');

// Student login
router.post('/login', async (req, res) => {
    try {
        const { studentID, password } = req.body;
        const student = await Student.findOne({ studentID });

        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        const isMatch = await bcrypt.compare(password, student.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        res.json({ success: true, message: "Login successful" });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// Get all students for attendance dropdown
router.get('/attendance-students', async (req, res) => {
    try {
        const students = await Student.find({}, 'studentID name');
        res.json(students);
    } catch (err) {
        console.error("Error fetching students:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// Submit attendance with duplicate check
router.post("/submit-attendance", async (req, res) => {
    try {
        const { studentID, date, subject, deviceId } = req.body;

        if (!studentID || !date || !subject || !deviceId) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const student = await Student.findOne({ studentID });
        if (!student) return res.status(404).json({ message: "Student not found" });

        const attendance = new Attendance({
            date,
            subject,
            student: student._id,
            deviceId
        });

        await attendance.save(); // Let MongoDB handle uniqueness

        res.json({ success: true, message: "Attendance submitted successfully" });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: "Attendance already submitted from this device" });
        }
        console.error("Attendance submission error:", error);
        res.status(500).json({ message: "Server error" });
    }
});




// New route: Check if attendance already submitted
router.post("/check-attendance", async (req, res) => {
    try {
        const { date, subject, deviceId } = req.body;

        if (!date || !subject || !deviceId) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const existingAttendance = await Attendance.findOne({ date, subject, deviceId });

        res.json({ alreadySubmitted: !!existingAttendance });
    } catch (error) {
        console.error("Check attendance error:", error);
        res.status(500).json({ message: "Server error" });
    }
});


module.exports = router;
