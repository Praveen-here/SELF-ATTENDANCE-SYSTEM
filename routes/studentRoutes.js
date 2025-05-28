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
        
        console.log("Received attendance submission:", req.body);
        
        if (!studentID || !date || !subject || !deviceId) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const student = await Student.findOne({ studentID });
        if (!student) return res.status(404).json({ message: "Student not found" });

        // Create date object in UTC
        const dateObj = new Date(date);
        const utcDate = new Date(Date.UTC(
            dateObj.getFullYear(),
            dateObj.getMonth(),
            dateObj.getDate()
        ));
        
        // Check for existing attendance
        const existing = await Attendance.findOne({ 
            date: utcDate,
            subject,
            $or: [
                { student: student._id },
                { deviceId }
            ]
        });
        
        if (existing) {
            const message = existing.student.equals(student._id) 
                ? "Attendance already marked for this student"
                : "Attendance already marked from this device";
                
            return res.status(400).json({ message });
        }

        // Create new attendance record
        const attendance = new Attendance({
            date: utcDate,
            subject,
            student: student._id,
            deviceId
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
        console.error("Attendance submission error:", error);
        
        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({ 
                message: "Attendance already marked for this session" 
            });
        }
        
        // Handle validation errors
        if (error instanceof mongoose.Error.ValidationError) {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;