const express = require("express");
const router = express.Router();
const qr = require('qr-image');
const Attendance = require("../models/Attendance");
const Student = require("../models/student");
const baseUrl = process.env.BASE_URL || (process.env.NODE_ENV === 'production' 
    ? 'https://self-attendance-system.onrender.com' 
    : 'http://localhost:9000');

// Generate QR Code with timestamp
router.get("/generate-qr", async (req, res) => {
    try {
        const { date, subject, t } = req.query;
        if (!date || !subject || !t) {
            return res.status(400).json({ message: "Date, subject and timestamp required" });
        }

        // Include timestamp in QR code URL
        const attendanceUrl = `${baseUrl}/student-attendance?date=${encodeURIComponent(date)}&subject=${encodeURIComponent(subject)}&t=${t}`;
        
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

// Add to teacherRoutes.js

// Reset student password
router.post('/reset-password', async (req, res) => {
    try {
        const { studentID } = req.body;
        const student = await Student.findOne({ studentID });
        
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }
        
        // Reset password to studentID (default)
        const salt = await bcrypt.genSalt(10);
        student.password = await bcrypt.hash(studentID, salt);
        await student.save();
        
        res.json({ success: true, message: "Password reset successfully" });
    } catch (error) {
        console.error("Password reset error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Add new student
router.post('/students', async (req, res) => {
    try {
        const { studentID, name, password } = req.body;
        
        // Check if student already exists
        const existing = await Student.findOne({ studentID });
        if (existing) {
            return res.status(400).json({ message: "Student ID already exists" });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Create new student
        const student = new Student({
            studentID,
            name,
            password: hashedPassword
        });
        
        await student.save();
        res.json({ success: true, student });
    } catch (error) {
        console.error("Error adding student:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// 📌 POST: Mark attendance
router.post("/mark-attendance", async (req, res) => {
    try {
        let { date, subject, studentsPresent } = req.body;

        date = date.trim();
        const parsedDate = new Date(date);
        if (isNaN(parsedDate)) {
            return res.status(400).json({ message: "❌ Invalid date format" });
        }
        const formattedDate = parsedDate.toISOString().split("T")[0];

        const presentStudents = await Student.find({ studentID: { $in: studentsPresent } }).select("_id studentID");
        const presentStudentIds = presentStudents.map(s => s._id);

        let attendanceRecord = await Attendance.findOne({ date: formattedDate, subject });

        if (!attendanceRecord) {
            attendanceRecord = new Attendance({
                date: formattedDate,
                subject,
                presentStudents: presentStudentIds
            });
        } else {
            attendanceRecord.presentStudents = presentStudentIds;
        }

        await attendanceRecord.save();
        res.json({ message: "✅ Attendance submitted successfully!" });

    } catch (error) {
        console.error("❌ Error submitting attendance:", error);
        res.status(500).json({ message: "❌ Server error while marking attendance" });
    }
});

// 📌 PUT: Update attendance after submission
router.put("/update-attendance", async (req, res) => {
    try {
        const { date, subject, studentsPresent } = req.body;
        console.log("📩 Attendance update received:", req.body);

        if (!date || !subject || !Array.isArray(studentsPresent)) {
            return res.status(400).json({ message: "❌ Invalid attendance data" });
        }

        const formattedDate = new Date(date).toISOString().split("T")[0];

        const presentStudents = await Student.find({ studentID: { $in: studentsPresent } }).select("_id studentID");
        const presentStudentIds = presentStudents.map(s => s._id);

        const allStudents = await Student.find({}, "_id studentID");
        const absentStudentIds = allStudents
            .filter(s => !studentsPresent.includes(s.studentID))
            .map(s => s._id);

        let attendanceRecord = await Attendance.findOne({ date: formattedDate, subject });

        if (!attendanceRecord) {
            return res.status(404).json({ message: "❌ Attendance record not found" });
        }

        attendanceRecord.presentStudents = presentStudentIds;
        await attendanceRecord.save();
        console.log("✅ Attendance record updated.");

        await Student.updateMany(
            { _id: { $in: presentStudentIds } },
            { $inc: { [`subjects.${subject}.attendedClasses`]: 1, [`subjects.${subject}.totalClasses`]: 1 } }
        );

        await Student.updateMany(
            { _id: { $in: absentStudentIds } },
            { $inc: { [`subjects.${subject}.totalClasses`]: 1 } }
        );

        res.json({ message: "✅ Attendance updated successfully!" });

    } catch (error) {
        console.error("❌ Error updating attendance:", error);
        res.status(500).json({ message: "❌ Server error while updating attendance" });
    }
});

// 📌 GET: View full attendance by subject with dates, present & absent
router.get("/attendance-register", async (req, res) => {
    try {
        const { subject } = req.query;
        if (!subject) return res.status(400).json({ message: "Subject is required" });

        // Get all attendance records for the subject
        const attendances = await Attendance.find({ subject })
            .populate('student', 'studentID')
            .sort({ date: 1 });

        // Get all students
        const students = await Student.find({}, "studentID name");

        // Create attendance map with null checks
        const attendanceMap = {};
        const dates = [];
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
                attendanceMap[dateStr].push(record.student.studentID);
            } catch (error) {
                console.error(`Error processing record ${record._id}:`, error);
            }
        });

        // Calculate attendance stats for each student
        const totalClasses = [...new Set(dates)].length;
        const processedStudents = students.map(student => {
            const attendedClasses = [...new Set(dates)].reduce((count, date) => {
                const presentIDs = attendanceMap[date] || [];
                return presentIDs.includes(student.studentID) ? count + 1 : count;
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
            dates: [...new Set(dates)].sort()
        });

    } catch (error) {
        console.error("❌ Error in /attendance-register:", error);
        res.status(500).json({ message: "❌ Server error" });
    }
});

// 📌 POST: Save attendance from table editor (used when manually editing)
router.post('/save-attendance', async (req, res) => {
    const { attendanceData, subject } = req.body;
    const invalidEntries = [];

    console.log("📥 Received attendance data:", attendanceData);
    console.log("📚 Subject:", subject);

    try {
        for (let data of attendanceData) {
            const { studentID, date, status } = data;
            console.log(`📌 Processing: ${studentID} - ${date} - ${status}`);

            const parsedDate = new Date(date);
            if (!date || isNaN(parsedDate)) {
                console.warn(`❌ Invalid date skipped for student ${studentID}`);
                invalidEntries.push(studentID);
                continue;
            }

            const formattedDate = parsedDate.toISOString().split("T")[0];
            const student = await Student.findOne({ studentID });

            if (!student) {
                console.warn(`❌ Student not found: ${studentID}`);
                invalidEntries.push(studentID);
                continue;
            }

            let attendanceRecord = await Attendance.findOne({ date: formattedDate, subject });

            if (!attendanceRecord) {
                attendanceRecord = new Attendance({
                    date: formattedDate,
                    subject,
                    presentStudents: status === 'P' ? [student._id] : [],
                });
            } else {
                const isPresent = attendanceRecord.presentStudents
                    .some(id => id.toString() === student._id.toString());

                if (status === 'P' && !isPresent) {
                    attendanceRecord.presentStudents.push(student._id);
                } else if (status === 'A' && isPresent) {
                    attendanceRecord.presentStudents = attendanceRecord.presentStudents.filter(
                        id => id.toString() !== student._id.toString()
                    );
                }
            }

            await attendanceRecord.save();
        }

        const message = invalidEntries.length > 0
            ? `✅ Attendance saved, but skipped: ${invalidEntries.join(", ")}`
            : "✅ All attendance saved successfully!";

        res.json({ success: true, message });

    } catch (error) {
        console.error("❌ Error updating attendance:", error);
        res.status(500).json({ success: false, message: '❌ Failed to update attendance.' });
    }
});

module.exports = router;