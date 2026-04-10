const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Initialize SAML authentication
router.get('/sso', 
  passport.authenticate('saml', {
    failureRedirect: '/login?error=saml_failed',
    session: false
  })
);

// SAML callback - Okta redirects here after authentication
router.post('/saml/callback',
  passport.authenticate('saml', {
    failureRedirect: '/login?error=saml_failed',
    session: false
  }),
  async (req, res) => {
    try {
      const samlUser = req.user;
      
      if (!samlUser || !samlUser.email) {
        return res.redirect('/login?error=invalid_saml_response');
      }

      // Find or create user based on email
      let user = await User.findOne({ 
        where: { 
          email: samlUser.email 
        } 
      });

      if (!user) {
        // Create new user from SAML assertion
        user = await User.create({
          email: samlUser.email,
          username: samlUser.email.split('@')[0], // Use email prefix as username
          name: samlUser.name || samlUser.email,
          firstName: samlUser.firstName,
          lastName: samlUser.lastName,
          role: samlUser.role || 'user',
          authProvider: 'saml', // Mark as SAML user
          // No password_hash needed for SAML users
        });
      } else {
        // Update user info from SAML (in case name/role changed in Okta)
        await user.update({
          name: samlUser.name || user.name,
          firstName: samlUser.firstName || user.firstName,
          lastName: samlUser.lastName || user.lastName,
          role: samlUser.role || user.role,
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user.id, 
          role: user.role,
          email: user.email 
        }, 
        JWT_SECRET, 
        {
          expiresIn: 86400 // 24 hours
        }
      );

      // Redirect to frontend with token
      // The frontend will extract the token from the URL and store it
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role
      }))}`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('SAML callback error:', error);
      res.redirect('/login?error=server_error');
    }
  }
);

// Logout - redirect to Okta logout if configured
router.get('/logout', (req, res) => {
  const logoutUrl = process.env.OKTA_LOGOUT_URL;
  
  if (logoutUrl) {
    // Redirect to Okta logout
    res.redirect(logoutUrl);
  } else {
    // Just redirect to login
    res.redirect('/login');
  }
});

// Logout callback from Okta
router.get('/logout/callback', (req, res) => {
  res.redirect('/login?logout=success');
});

// Metadata endpoint - Okta can use this to configure the app
router.get('/metadata', (req, res) => {
  const samlStrategy = require('../config/saml');
  res.type('application/xml');
  res.send(samlStrategy.generateServiceProviderMetadata(
    process.env.SAML_CERT || '',
    process.env.SAML_KEY || ''
  ));
});

module.exports = router;
