const express = require("express");
const router = express.Router();
const qr = require('qr-image');
const Attendance = require("../models/Attendance");
const Student = require("../models/student");
const bcrypt = require("bcryptjs");
const baseUrl = process.env.BASE_URL || (process.env.NODE_ENV === 'production' 
    ? 'https://self-attendance-system.onrender.com' 
    : 'http://localhost:9000');

// QR Code Generation
router.get("/generate-qr", async (req, res) => {
    try {
        const { date, subject } = req.query;
        if (!date || !subject) {
            return res.status(400).json({ message: "Date and subject required" });
        }

        const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
        const attendanceUrl = `${baseUrl}/student-attendance?date=${encodeURIComponent(date)}&subject=${encodeURIComponent(subject)}&t=${Date.now()}`;
        
        const qr_png = qr.image(attendanceUrl, { type: 'png' });
        res.setHeader('Content-type', 'image/png');
        qr_png.pipe(res);
    } catch (error) {
        console.error("QR generation error:", error);
        res.status(500).json({ message: "Error generating QR code" });
    }
});

// Get all students
router.get("/students", async (req, res) => {
    try {
        const students = await Student.find({}, "studentID name");
        res.json(students);
    } catch (err) {
        console.error("Error fetching students:", err);
        res.status(500).json({ message: "Error fetching students" });
    }
});

// View attendance register
router.get("/attendance-register", async (req, res) => {
    try {
        const { subject, date } = req.query;
        if (!subject) return res.status(400).json({ message: "Subject is required" });

        const query = { subject };
        if (date) query.date = date;

        const attendanceRecords = await Attendance.find(query)
            .populate('student', 'studentID name')
            .sort({ date: 1 });

        const dates = [...new Set(attendanceRecords.map(r => r.date))].sort();

        const attendanceMap = {};
        attendanceRecords.forEach(record => {
            const dateStr = record.date;
            if (!attendanceMap[dateStr]) {
                attendanceMap[dateStr] = [];
            }
            attendanceMap[dateStr].push(record.student.studentID);
        });

        const attendedStudents = await Student.find({
            _id: { $in: attendanceRecords.map(r => r.student._id) }
        }, "studentID name");

        res.json({ students: attendedStudents, subject, attendanceMap, dates });

    } catch (error) {
        console.error("Error in /attendance-register:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Add new student
router.post('/students', async (req, res) => {
    try {
        const { studentID, name, password } = req.body;
        const existing = await Student.findOne({ studentID });
        if (existing) return res.status(400).json({ message: "Student ID already exists" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password || studentID, salt);

        const student = new Student({ studentID, name, password: hashedPassword });
        await student.save();

        res.json({ success: true, student });
    } catch (error) {
        console.error("Error adding student:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Reset student password
router.post('/reset-password', async (req, res) => {
    try {
        const { studentID } = req.body;
        const student = await Student.findOne({ studentID });

        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        const salt = await bcrypt.genSalt(10);
        student.password = await bcrypt.hash(studentID, salt);
        await student.save();

        res.json({ success: true, message: "Password reset successfully" });
    } catch (error) {
        console.error("Password reset error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;