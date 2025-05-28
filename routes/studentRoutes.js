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
        const { studentID, date, subject, sessionToken } = req.body;
        
        if (!studentID || !date || !subject || !sessionToken) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Validate session token (check if QR is still valid)
        if (!validateSessionToken(sessionToken)) {
            return res.status(400).json({ 
                message: "QR code has expired. Please scan a fresh QR code from your teacher." 
            });
        }

        const student = await Student.findOne({ studentID });
        if (!student) return res.status(404).json({ message: "Student not found" });

        // Generate device identifier
        const deviceIdentifier = generateDeviceIdentifier(req);
        const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'] || 'unknown';

        console.log(`Attendance attempt - Student: ${studentID}, Device: ${deviceIdentifier}, IP: ${ipAddress}, Subject: ${subject}, Date: ${date}`);

        // FIXED: Parse the date to ensure consistent comparison
        const attendanceDate = new Date(date);
        // Set time to start of day to avoid time zone issues
        attendanceDate.setUTCHours(0, 0, 0, 0);
        const dateString = attendanceDate.toISOString().split('T')[0]; // Get YYYY-MM-DD format

        // FIXED: Check for existing attendance from the same device for this SPECIFIC subject and date
        const existingDeviceAttendance = await Attendance.findOne({
            date: attendanceDate,
            subject: subject,
            deviceIdentifier: deviceIdentifier
        });

        if (existingDeviceAttendance) {
            console.log(`❌ Device ${deviceIdentifier} already submitted for ${subject} on ${dateString}`);
            return res.status(400).json({ 
                message: `Attendance already submitted from this device for ${subject} on ${dateString}.` 
            });
        }

        // FIXED: Check for existing attendance for this student for this SPECIFIC subject and date
        const existingStudentAttendance = await Attendance.findOne({
            date: attendanceDate,
            subject: subject,
            student: student._id
        });

        if (existingStudentAttendance) {
            console.log(`❌ Student ${studentID} already has attendance for ${subject} on ${dateString}`);
            return res.status(400).json({ 
                message: `Attendance already marked for ${studentID} in ${subject} on ${dateString}.` 
            });
        }

        // Create new attendance record with device tracking
        const attendance = new Attendance({
            date: attendanceDate,
            subject,
            student: student._id,
            deviceIdentifier,
            sessionToken,
            ipAddress,
            userAgent
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

        console.log(`✅ Attendance marked successfully for ${studentID} in ${subject} on ${dateString} from device ${deviceIdentifier}`);
        res.json({ success: true, message: "Attendance marked successfully!" });

    } catch (error) {
        console.error("Attendance error:", error);
        if (error.code === 11000) {
            // Handle duplicate key errors
            return res.status(400).json({ 
                message: "Attendance already submitted for this session." 
            });
        }
        res.status(500).json({ message: "Server error" });
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