const express = require('express');
const router = express.Router();
const Student = require('../models/student');
const Attendance = require('../models/Attendance');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

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
        const { studentID, date, subject, deviceId } = req.body;
        
        if (!studentID || !date || !subject || !deviceId) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Validate date format (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
        }

        const student = await Student.findOne({ studentID });
        if (!student) return res.status(404).json({ message: "Student not found" });

        // Check for existing attendance by student
        const existingByStudent = await Attendance.findOne({ 
            date,
            subject,
            student: student._id 
        });
        
        if (existingByStudent) {
            return res.status(400).json({ message: "Attendance already marked for this student" });
        }

        // Check for existing attendance by device
        const existingByDevice = await Attendance.findOne({ 
            date,
            subject,
            deviceId 
        });
        
        if (existingByDevice) {
            return res.status(400).json({ message: "Attendance already marked from this device" });
        }

        // Create new attendance record
        const attendance = new Attendance({
            date,
            subject,
            student: student._id,
            deviceId,
            status: 'present'
        });

        await attendance.save();

        res.json({ success: true, message: "Attendance marked successfully" });

    } catch (error) {
        console.error("Attendance submission error:", error);
        
        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({ 
                message: "Attendance already marked for this session" 
            });
        }
        
        res.status(500).json({ message: "Server error: " + error.message });
    }
});

module.exports = router;