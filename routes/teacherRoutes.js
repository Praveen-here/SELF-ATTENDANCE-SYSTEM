const express = require("express");
const router = express.Router();
const qr = require('qr-image');
const crypto = require('crypto');
const Attendance = require("../models/Attendance");
const Student = require("../models/student");
const baseUrl = process.env.BASE_URL || (process.env.NODE_ENV === 'production' 
    ? 'https://self-attendance-system.onrender.com' 
    : 'http://localhost:9000');

// 📌 GET: Generate QR Code with session token
router.get("/generate-qr", async (req, res) => {
    try {
        const { date, subject } = req.query;
        if (!date || !subject) {
            return res.status(400).json({ message: "Date and subject required" });
        }

        // Generate session token with timestamp and random string
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(16).toString('hex');
        const sessionToken = `${timestamp}_${randomString}`;

        // Create attendance URL with session token
        const attendanceUrl = `${baseUrl}/student-attendance?date=${encodeURIComponent(date)}&subject=${encodeURIComponent(subject)}&session=${sessionToken}`;
        
        console.log(`📱 Generated QR for ${subject} on ${date} with session: ${sessionToken}`);
        
        const qr_png = qr.image(attendanceUrl, { type: 'png' });
        res.setHeader('Content-type', 'image/png');
        qr_png.pipe(res);

    } catch (error) {
        console.error("QR generation error:", error);
        res.status(500).json({ message: "Error generating QR code" });
    }
});

// 📌 GET: Fetch all students
router.get("/students", async (req, res) => {
    try {
        const students = await Student.find({}, "studentID name");
        res.json(students);
    } catch (err) {
        console.error("❌ Error fetching students:", err);
        res.status(500).json({ message: "❌ Error fetching students" });
    }
});

// 📌 GET: View full attendance by subject with device tracking info
router.get("/attendance-register", async (req, res) => {
    try {
        const { subject } = req.query;
        if (!subject) return res.status(400).json({ message: "Subject is required" });

        // Get all attendance records for the subject
        const attendances = await Attendance.find({ subject })
            .populate('student', 'studentID name')
            .sort({ date: 1 });

        // Get all students
        const students = await Student.find({}, "studentID name");

        // Create attendance map with device tracking
        const attendanceMap = {};
        const dates = [];
        const deviceStats = {};

        attendances.forEach(record => {
            try {
                if (!record.student || !record.student.studentID) {
                    console.warn(`⚠️  Invalid student reference in attendance record: ${record._id}`);
                    return;
                }
                
                const dateStr = new Date(record.date).toISOString().split('T')[0];
                dates.push(dateStr);
                
                if (!attendanceMap[dateStr]) {
                    attendanceMap[dateStr] = [];
                }
                attendanceMap[dateStr].push({
                    studentID: record.student.studentID,
                    deviceId: record.deviceIdentifier?.substring(0, 8) + '...', // Show partial device ID
                    timestamp: record.timestamp,
                    ipAddress: record.ipAddress
                });

                // Track device usage statistics
                if (!deviceStats[record.deviceIdentifier]) {
                    deviceStats[record.deviceIdentifier] = 0;
                }
                deviceStats[record.deviceIdentifier]++;
                
            } catch (error) {
                console.error(`Error processing record ${record._id}:`, error);
            }
        });

        // Calculate attendance stats for each student
        const totalClasses = [...new Set(dates)].length;
        const processedStudents = students.map(student => {
            const attendedClasses = [...new Set(dates)].reduce((count, date) => {
                const dayAttendance = attendanceMap[date] || [];
                return dayAttendance.some(entry => entry.studentID === student.studentID) ? count + 1 : count;
            }, 0);
            
            const percentage = totalClasses > 0 
                ? ((attendedClasses / totalClasses) * 100).toFixed(1)
                : 0;

            return {
                studentID: student.studentID,
                name: student.name,
                attendedClasses,
                totalClasses,
                percentage
            };
        });

        res.json({ 
            students: processedStudents, 
            subject, 
            attendanceMap,
            dates: [...new Set(dates)].sort(),
            deviceStats: Object.keys(deviceStats).length, // Number of unique devices used
            totalSubmissions: attendances.length
        });

    } catch (error) {
        console.error("❌ Error in /attendance-register:", error);
        res.status(500).json({ message: "❌ Server error" });
    }
});

// 📌 GET: Device analytics for teachers
router.get("/device-analytics", async (req, res) => {
    try {
        const { date, subject } = req.query;
        
        const query = {};
        if (date) query.date = new Date(date);
        if (subject) query.subject = subject;

        const attendances = await Attendance.find(query)
            .populate('student', 'studentID name');

        const deviceUsage = {};
        const ipUsage = {};
        
        attendances.forEach(record => {
            // Track device usage
            const deviceKey = record.deviceIdentifier?.substring(0, 12) + '...';
            if (!deviceUsage[deviceKey]) {
                deviceUsage[deviceKey] = {
                    count: 0,
                    students: [],
                    ips: new Set()
                };
            }
            deviceUsage[deviceKey].count++;
            deviceUsage[deviceKey].students.push(record.student?.studentID || 'Unknown');
            deviceUsage[deviceKey].ips.add(record.ipAddress);

            // Track IP usage
            if (!ipUsage[record.ipAddress]) {
                ipUsage[record.ipAddress] = {
                    count: 0,
                    devices: new Set(),
                    students: []
                };
            }
            ipUsage[record.ipAddress].count++;
            ipUsage[record.ipAddress].devices.add(deviceKey);
            ipUsage[record.ipAddress].students.push(record.student?.studentID || 'Unknown');
        });

        // Convert Sets to Arrays for JSON response
        Object.keys(deviceUsage).forEach(device => {
            deviceUsage[device].ips = Array.from(deviceUsage[device].ips);
        });
        
        Object.keys(ipUsage).forEach(ip => {
            ipUsage[ip].devices = Array.from(ipUsage[ip].devices);
        });

        res.json({
            totalSubmissions: attendances.length,
            uniqueDevices: Object.keys(deviceUsage).length,
            uniqueIPs: Object.keys(ipUsage).length,
            deviceUsage,
            ipUsage,
            suspiciousActivity: {
                multipleStudentsPerDevice: Object.entries(deviceUsage)
                    .filter(([device, data]) => data.count > 1)
                    .map(([device, data]) => ({ device, ...data })),
                multipleDevicesPerIP: Object.entries(ipUsage)
                    .filter(([ip, data]) => data.devices.length > 3)
                    .map(([ip, data]) => ({ ip, ...data }))
            }
        });

    } catch (error) {
        console.error("❌ Error in device analytics:", error);
        res.status(500).json({ message: "❌ Server error" });
    }
});

module.exports = router;