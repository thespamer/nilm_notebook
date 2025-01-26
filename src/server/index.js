require('dotenv').config();
const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const cors = require('cors');
const { SerialPort } = require('serialport');
const socketIO = require('socket.io');
const { SimpleLinearRegression } = require('ml-regression');
const ss = require('simple-statistics');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport Google OAuth configuration
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Auth Routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => res.redirect('/')
);

// Power monitoring setup
let serialPort;
try {
    serialPort = new SerialPort({
        path: process.env.SERIAL_PORT || 'COM3',
        baudRate: 9600
    });
} catch (error) {
    console.error('Error opening serial port:', error);
}

// Data storage for analysis
const powerReadings = [];
const maxReadings = 1000;

// Simple NILM analysis
function analyzeDeviceState(currentReading) {
    // Define power thresholds for different states
    const thresholds = {
        idle: 5,
        light: 15,
        medium: 30,
        heavy: 50
    };

    let state = 'unknown';
    if (currentReading <= thresholds.idle) {
        state = 'Idle';
    } else if (currentReading <= thresholds.light) {
        state = 'Light Usage';
    } else if (currentReading <= thresholds.medium) {
        state = 'Normal Usage';
    } else if (currentReading <= thresholds.heavy) {
        state = 'Heavy Usage';
    } else {
        state = 'Maximum Performance';
    }

    return state;
}

// Statistical analysis
function analyzeConsumption(readings) {
    if (readings.length < 2) return null;

    const stats = {
        mean: ss.mean(readings),
        median: ss.median(readings),
        std: ss.standardDeviation(readings),
        min: ss.min(readings),
        max: ss.max(readings)
    };

    // Simple trend analysis using linear regression
    const x = Array.from({ length: readings.length }, (_, i) => i);
    const regression = new SimpleLinearRegression(x, readings);
    stats.trend = regression.slope > 0 ? 'increasing' : 'decreasing';

    return stats;
}

// Start server
const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Socket.IO setup for real-time data
const io = socketIO(server);

io.on('connection', (socket) => {
    console.log('Client connected');

    if (serialPort) {
        serialPort.on('data', (data) => {
            const currentReading = parseFloat(data.toString());
            
            // Store reading
            powerReadings.push(currentReading);
            if (powerReadings.length > maxReadings) {
                powerReadings.shift();
            }

            // Analyze current state
            const deviceState = analyzeDeviceState(currentReading);
            const stats = analyzeConsumption(powerReadings);

            // Send processed data to client
            socket.emit('power_data', {
                timestamp: Date.now(),
                current: currentReading,
                state: deviceState,
                stats: stats
            });
        });
    }

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Mock data for comparison (you can replace this with real data later)
const mockComparisonData = {
    similarNotebooks: {
        average: 45,
        efficient: 30,
        inefficient: 65
    }
};

// API endpoints
app.get('/api/power-data', (req, res) => {
    const stats = analyzeConsumption(powerReadings);
    res.json({
        currentStats: stats,
        historicalData: powerReadings,
        comparison: mockComparisonData
    });
});

app.get('/api/analytics', (req, res) => {
    const stats = analyzeConsumption(powerReadings);
    res.json({
        stats,
        deviceEfficiency: stats ? 
            (stats.mean < mockComparisonData.similarNotebooks.average ? 'Efficient' : 'Needs Improvement') 
            : 'Insufficient Data'
    });
});

// Serve static files
app.use(express.static('public'));
