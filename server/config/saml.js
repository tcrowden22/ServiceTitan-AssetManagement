const SamlStrategy = require('@node-saml/passport-saml').Strategy;
const fs = require('fs');
const path = require('path');

// SAML Configuration for Okta
const samlConfig = {
  // Okta SAML endpoint - will be provided by Okta
  entryPoint: process.env.OKTA_SAML_ENTRY_POINT,
  
  // Your application's identifier (Entity ID) - must match what's configured in Okta
  issuer: process.env.SAML_ISSUER || 'asset-management',
  
  // Certificate from Okta - can be provided as file path or string
  cert: process.env.OKTA_CERT || (() => {
    const certPath = process.env.OKTA_CERT_PATH;
    if (certPath && fs.existsSync(certPath)) {
      return fs.readFileSync(certPath, 'utf8');
    }
    return null;
  })(),
  
  // Callback URL where Okta will send the SAML response
  callbackUrl: process.env.SAML_CALLBACK_URL || 'http://localhost:3001/api/auth/saml/callback',
  
  // Signature algorithm
  signatureAlgorithm: 'sha256',
  
  // Additional SAML options
  identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  
  // Attribute mapping - Okta will send these attributes
  // Adjust based on your Okta attribute configuration
  acceptedClockSkewMs: -1,
  
  // Logout configuration (optional)
  logoutUrl: process.env.OKTA_LOGOUT_URL,
  logoutCallbackUrl: process.env.SAML_LOGOUT_CALLBACK_URL || 'http://localhost:3001/api/auth/saml/logout/callback',
};

// Create and configure SAML Strategy
const samlStrategy = new SamlStrategy(
  {
    ...samlConfig,
    // Passport callback
    passReqToCallback: true,
  },
  async (req, profile, done) => {
    try {
      // Profile contains the SAML assertion attributes
      // Common attributes from Okta:
      // - NameID (email or username)
      // - http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress
      // - http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name
      // - http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname
      // - http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname
      
      const email = profile.nameID || 
                   profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
                   profile.email ||
                   profile.Email;
      
      const name = profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
                   profile.name ||
                   profile.Name ||
                   email;
      
      const firstName = profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] ||
                        profile.firstName ||
                        profile.givenName;
      
      const lastName = profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'] ||
                       profile.lastName ||
                       profile.surname;
      
      // Role mapping - adjust based on your Okta groups/attributes
      const role = profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/groups'] ||
                   profile.role ||
                   profile.Role ||
                   'user';
      
      if (!email) {
        return done(new Error('Email not found in SAML assertion'));
      }
      
      // Return user profile
      return done(null, {
        email,
        name,
        firstName,
        lastName,
        role: Array.isArray(role) ? role[0] : role,
        samlAttributes: profile, // Store full profile for debugging
      });
    } catch (error) {
      return done(error);
    }
  }
);

module.exports = samlStrategy;
