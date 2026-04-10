const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const { sequelize } = require('./models');

dotenv.config();

const app = express();

// 🔥 IMPORTANT: Azure requires this
const PORT = process.env.PORT || 8080;

const DIST_PATH = path.join(__dirname, '../dist');

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// SAML setup
if (process.env.OKTA_SAML_ENTRY_POINT) {
  const samlStrategy = require('./config/saml');
  passport.use('saml', samlStrategy);

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
}

// API Routes
app.use('/api/auth', require('./routes/auth'));

if (process.env.OKTA_SAML_ENTRY_POINT) {
  app.use('/api/auth', require('./routes/saml'));
}

app.use('/api/assets', require('./routes/assets'));

// Serve frontend
app.use(express.static(DIST_PATH));

app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_PATH, 'index.html'));
});


// 🔥 START SERVER IMMEDIATELY (THIS FIXES AZURE CRASH)
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});


// 🔥 RUN DB AFTER START (non-blocking)
(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    await sequelize.sync();
    console.log('✅ Database synced');
  } catch (err) {
    console.error('❌ Database error:', err);
  }
})();