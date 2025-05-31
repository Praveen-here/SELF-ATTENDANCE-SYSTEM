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
        const { studentID, date, subject, deviceId, latitude, longitude } = req.body;

        if (!studentID || !date || !subject || !deviceId || !latitude || !longitude) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const student = await Student.findOne({ studentID });
        if (!student) return res.status(404).json({ message: "Student not found" });

        const centerLat = parseFloat(process.env.CAMPUS_CENTER_LAT);
        const centerLng = parseFloat(process.env.CAMPUS_CENTER_LNG);
        const radiusMeters = parseFloat(process.env.CAMPUS_RADIUS_METERS);

        // Haversine formula
        const toRad = deg => (deg * Math.PI) / 180;
        const earthRadius = 6371000; // meters

        const dLat = toRad(latitude - centerLat);
        const dLng = toRad(longitude - centerLng);
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(toRad(centerLat)) * Math.cos(toRad(latitude)) *
                  Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = earthRadius * c;

        if (distance > radiusMeters) {
            return res.status(403).json({ message: "You are not in campus range to mark attendance." });
        }

        const attendance = new Attendance({
            date,
            subject,
            student: student._id,
            deviceId
        });

        await attendance.save();
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
