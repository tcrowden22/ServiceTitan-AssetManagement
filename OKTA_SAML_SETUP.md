# Okta SAML Authentication Setup Guide

This guide will help you configure Okta SAML authentication for the Asset Management application.

## Prerequisites

1. An Okta account with admin access
2. The application server running and accessible

## Step 1: Configure Environment Variables

Create a `.env` file in the `server/` directory (or root directory) with the following variables:

```env
# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# JWT Secret (change in production!)
JWT_SECRET=your_jwt_secret_key_change_in_production

# Session Secret (change in production!)
SESSION_SECRET=your_session_secret_key_change_in_production

# Okta SAML Configuration
OKTA_SAML_ENTRY_POINT=https://your-okta-domain.okta.com/app/your-app-name/your-app-id/sso/saml
OKTA_CERT_PATH=./server/config/okta-cert.pem
SAML_ISSUER=asset-management
SAML_CALLBACK_URL=http://localhost:3001/api/auth/saml/callback
OKTA_LOGOUT_URL=https://your-okta-domain.okta.com/logout
```

## Step 2: Create Okta Application

1. Log in to your Okta Admin Console
2. Navigate to **Applications** → **Applications**
3. Click **Create App Integration**
4. Select **SAML 2.0** as the sign-in method
5. Click **Next**

## Step 3: Configure SAML Settings in Okta

### General Settings
- **App name**: Asset Management (or your preferred name)
- **App logo**: (Optional)
- Click **Next**

### SAML Settings

Configure the following:

1. **Single sign on URL** (ACS URL):
   ```
   http://localhost:3001/api/auth/saml/callback
   ```
   (For production, use your production URL)

2. **Audience URI (SP Entity ID)**:
   ```
   asset-management
   ```
   (This should match your `SAML_ISSUER` environment variable)

3. **Name ID format**:
   ```
   EmailAddress
   ```

4. **Application username**:
   ```
   Email
   ```

5. **Attribute Statements** (add these):
   - **Name**: `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress`
     - **Value**: `user.email`
   - **Name**: `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name`
     - **Value**: `user.firstName + " " + user.lastName`
   - **Name**: `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname`
     - **Value**: `user.firstName`
   - **Name**: `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname`
     - **Value**: `user.lastName`
   - **Name**: `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/groups` (optional, for role mapping)
     - **Value**: `user.getGroups()`

6. Click **Next**

### Feedback
- Select **I'm an Okta customer adding an internal app**
- Click **Finish**

## Step 4: Get Okta Certificate

1. In your Okta application settings, go to the **Sign On** tab
2. Scroll down to **SAML Signing Certificates**
3. Click on the certificate (usually "SHA-256" or "RSA SHA-256")
4. Copy the certificate content
5. Save it to `server/config/okta-cert.pem` (or update `OKTA_CERT_PATH` in your `.env`)

The certificate should look like:
```
-----BEGIN CERTIFICATE-----
MIIDpDCCAoygAwIBAgIGAV2ka+60MA0GCSqGSIb3DQEBCQUAMIGSMQswCQYDVQQG
...
-----END CERTIFICATE-----
```

Alternatively, you can set `OKTA_CERT` directly in your `.env` file as a single-line string (remove newlines).

## Step 5: Get SAML URLs from Okta

1. In your Okta application, go to the **Sign On** tab
2. Find the **SAML 2.0** section
3. Copy the following URLs:
   - **Identity Provider Single Sign-On URL**: This is your `OKTA_SAML_ENTRY_POINT`
   - **Identity Provider Issuer**: Usually `http://www.okta.com/exk...` (not needed for our config)

## Step 6: Update Environment Variables

Update your `.env` file with the actual values from Okta:

```env
OKTA_SAML_ENTRY_POINT=https://your-okta-domain.okta.com/app/your-app-name/your-app-id/sso/saml
```

## Step 7: Assign Users/Groups (Optional)

1. In your Okta application, go to the **Assignments** tab
2. Click **Assign** → **Assign to People** or **Assign to Groups**
3. Assign users or groups who should have access

## Step 8: Test the Integration

1. Start your application:
   ```bash
   npm run dev
   ```

2. Navigate to the login page
3. Click **Sign in with Okta SSO**
4. You should be redirected to Okta for authentication
5. After successful authentication, you'll be redirected back to the application

## Troubleshooting

### Common Issues

1. **"Invalid SAML response" error**:
   - Verify the certificate is correct
   - Check that the callback URL matches exactly in Okta
   - Ensure the Entity ID matches

2. **"Email not found in SAML assertion"**:
   - Check the attribute statements in Okta
   - Verify the email attribute is being sent
   - Check the SAML response in browser developer tools

3. **Redirect loop**:
   - Verify `FRONTEND_URL` is correct
   - Check CORS settings
   - Ensure session middleware is configured

4. **Certificate errors**:
   - Ensure the certificate file is readable
   - Check file permissions
   - Verify certificate format (should include BEGIN/END markers)

### Debugging

Enable debug logging by setting:
```env
NODE_ENV=development
```

Check server logs for SAML-related errors. The SAML strategy will log detailed information about the authentication flow.

## Production Considerations

1. **HTTPS**: Always use HTTPS in production
2. **Secure Cookies**: Update session cookie settings for production
3. **Environment Variables**: Use secure secret management
4. **Certificate Rotation**: Plan for Okta certificate rotation
5. **Error Handling**: Implement proper error pages for SAML failures

## Role Mapping

To map Okta groups to application roles:

1. In Okta, configure group attributes
2. Add the groups attribute to SAML attribute statements
3. Update `server/config/saml.js` to map groups to roles:

```javascript
const role = profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/groups'];
// Map Okta groups to app roles
const roleMapping = {
  'okta-admin-group': 'admin',
  'okta-user-group': 'user'
};
const mappedRole = roleMapping[role] || 'user';
```

## Additional Resources

- [Okta SAML Documentation](https://developer.okta.com/docs/guides/saml-application-setup/overview/)
- [Passport SAML Documentation](https://github.com/node-saml/passport-saml)
