require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("✅ MongoDB Connected Successfully");
}).catch(err => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
});

// Password hashing middleware
app.use(express.json());
app.use(async (req, res, next) => {
    // Hash passwords for new students
    if (req.method === 'POST' && req.path === '/teacher/students') {
        if (req.body.password) {
            const salt = await bcrypt.genSalt(10);
            req.body.password = await bcrypt.hash(req.body.password, salt);
        }
    }
    next();
});

// Routes
const teacherRoutes = require('./routes/teacherRoutes');
const studentRoutes = require('./routes/studentRoutes');

app.use('/teacher', teacherRoutes);
app.use('/student', studentRoutes);

// Student Attendance Page Route
app.get('/student-attendance', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

// Teacher Panel Route
app.get('/teacher', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'teacher.html'));
});

// Redirect root to teacher panel
app.get('/', (req, res) => {
    res.redirect('/teacher');
});

// Handle 404
app.use((req, res) => {
    res.status(404).json({ message: "❌ Route Not Found" });
});

// Server Initialization
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));