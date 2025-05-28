require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

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

// Add this before route definitions
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            res.redirect(`https://${req.header('host')}${req.url}`);
        } else {
            next();
        }
    });
}

// Routes
const teacherRoutes = require('./routes/teacherRoutes');
const studentRoutes = require('./routes/studentRoutes');

app.use('/teacher', teacherRoutes);
app.use('/student', studentRoutes);

// Student Attendance Page Route
app.get('/student-attendance', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

// Redirect root to teacher panel
app.get('/', (req, res) => {
    res.redirect('/teacher.html');
});

// Handle 404
app.use((req, res) => {
    res.status(404).json({ message: "❌ Route Not Found" });
});

// Server Initialization
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));