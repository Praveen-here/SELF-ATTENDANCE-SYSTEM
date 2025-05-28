const express = require('express');
const router = express.Router();
const Student = require('../models/student');
const Attendance = require('../models/Attendance');
const crypto = require('crypto');

// Helper function to generate a comprehensive device identifier
function generateDeviceIdentifier(req) {
    const ipAddress = req.headers['x-forwarded-for'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress ||
                     (req.connection.socket ? req.connection.socket.remoteAddress : null);
    
    const userAgent = req.headers['user-agent'] || 'unknown';
    const acceptLanguage = req.headers['accept-language'] || '';
    const acceptEncoding = req.headers['accept-encoding'] || '';
    
    // Create a more robust device fingerprint
    const deviceString = `${ipAddress}${userAgent}${acceptLanguage}${acceptEncoding}`;
    const deviceHash = crypto.createHash('sha256').update(deviceString).digest('hex');
    return deviceHash;
}

// Validate session token and check if it's still valid (within time limit)
function validateSessionToken(sessionToken) {
    try {
        // Session token format: timestamp_randomString
        const [timestamp, ...rest] = sessionToken.split('_');
        const tokenTime = parseInt(timestamp);
        const currentTime = Date.now();
        
        // QR codes expire after 10 minutes (600000 ms)
        const expirationTime = 10 * 60 * 1000;
        
        return (currentTime - tokenTime) <= expirationTime;
    } catch (error) {
        return false;
    }
}

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

// Student Attendance Submission with enhanced security
router.post("/submit-attendance", async (req, res) => {
    try {
        const { studentID, date, subject, sessionToken, deviceFingerprint } = req.body;
        
        // Validate all required fields
        if (!studentID || !date || !subject || !sessionToken || !deviceFingerprint) {
            return res.status(400).json({ message: "Missing required security parameters" });
        }

        // Validate session token
        if (!validateSessionToken(sessionToken)) {
            return res.status(400).json({ 
                message: "QR code session expired. Please scan a fresh code." 
            });
        }

        // Validate student exists
        const student = await Student.findOne({ studentID });
        if (!student) return res.status(404).json({ message: "Student not registered" });

        // Date standardization
        const attendanceDate = new Date(date);
        attendanceDate.setUTCHours(0, 0, 0, 0);

        // Check for existing student attendance
        const existingStudentAttendance = await Attendance.findOne({
            date: attendanceDate,
            subject: subject,
            student: student._id
        });

        if (existingStudentAttendance) {
            return res.status(400).json({ 
                message: `${student.name} already marked present for ${subject} today.` 
            });
        }

        // Check for device usage
        const existingDeviceAttendance = await Attendance.findOne({
            date: attendanceDate,
            subject: subject,
            deviceIdentifier: deviceFingerprint
        });

        if (existingDeviceAttendance) {
            return res.status(400).json({ 
                message: "This device already submitted attendance for today's session." 
            });
        }

        // Create new attendance record
        const attendance = new Attendance({
            date: attendanceDate,
            subject,
            student: student._id,
            deviceIdentifier: deviceFingerprint,
            sessionToken,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        await attendance.save();

        // Update student's attendance records
        const subjectStats = student.subjects.get(subject) || { 
            totalClasses: 0, 
            attendedClasses: 0 
        };
        subjectStats.totalClasses += 1;
        subjectStats.attendedClasses += 1;
        student.subjects.set(subject, subjectStats);
        await student.save();

        res.json({ 
            success: true, 
            message: `${student.name}'s attendance recorded successfully!` 
        });

    } catch (error) {
        console.error("Submission error:", error);
        if (error.code === 11000) {
            return res.status(400).json({ 
                message: "Duplicate submission detected by system" 
            });
        }
        res.status(500).json({ message: "Server error during submission" });
    }
});

// Get attendance stats for a specific device (for debugging)
router.get('/device-stats/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const attendanceCount = await Attendance.countDocuments({ deviceIdentifier: deviceId });
        const recentAttendance = await Attendance.find({ deviceIdentifier: deviceId })
            .sort({ timestamp: -1 })
            .limit(10)
            .populate('student', 'studentID name');
            
        res.json({ 
            deviceId, 
            totalSubmissions: attendanceCount, 
            recentAttendance 
        });
    } catch (error) {
        console.error("Device stats error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;