# ServiceTitan Asset Management

A comprehensive asset management application for tracking IT assets, employee assignments, and compliance status. Built with React and Node.js, featuring SAML authentication via Okta.

## Features

### 📊 Dashboard
- Real-time asset overview and statistics
- Visual analytics with charts and graphs
- Health score tracking
- Compliance status monitoring

### 💻 Asset Inventory
- Complete asset tracking with detailed information
- Search and filter capabilities
- Bulk edit operations
- Asset history timeline
- Export to CSV/Excel

### 📥 Data Import
- Import assets from CSV or Excel files
- Field mapping and validation
- Batch processing with conflict resolution
- Import history tracking

### 👥 Employee Management
- Employee-asset assignment tracking
- Multiple asset assignment detection
- Unassigned asset identification
- Department and location tracking

### ⚠️ Compliance & Issues
- MDM enrollment tracking
- SentinelOne (S1) status monitoring
- Okta enrollment verification
- Compliance issue identification and resolution

### ⚙️ Settings
- User management
- System configuration
- Data cleanup tools
- Duplicate detection and resolution

## Tech Stack

### Frontend
- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **Recharts** - Data visualization
- **Lucide React** - Icon library
- **PapaParse** - CSV parsing
- **XLSX** - Excel file handling

### Backend
- **Node.js** - Runtime environment
- **Express 5** - Web framework
- **Sequelize** - ORM
- **SQLite** - Database
- **Passport.js** - Authentication
- **@node-saml/passport-saml** - SAML authentication

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Okta account (for SAML authentication)

## Installation

1. **Clone the repository**
   ```bash
   git clone git@github.com:tcrowden22/ServiceTitan-AssetManagement.git
   cd ServiceTitan-AssetManagement
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies (frontend)
   npm install
   
   # Install server dependencies
   cd server
   npm install
   cd ..
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory or `server/` directory:
   ```env
   # Server Configuration
   PORT=3001
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173
   
   # JWT Secret (change in production!)
   JWT_SECRET=your_jwt_secret_key_change_in_production
   
   # Session Secret (change in production!)
   SESSION_SECRET=your_session_secret_key_change_in_production
   
   # Okta SAML Configuration (optional - see OKTA_SAML_SETUP.md)
   OKTA_SAML_ENTRY_POINT=https://your-okta-domain.okta.com/app/your-app-name/your-app-id/sso/saml
   OKTA_CERT_PATH=./server/config/okta-cert.pem
   SAML_ISSUER=asset-management
   SAML_CALLBACK_URL=http://localhost:3001/api/auth/saml/callback
   OKTA_LOGOUT_URL=https://your-okta-domain.okta.com/logout
   ```

4. **Set up the database**
   
   The SQLite database will be created automatically on first run. The database file is located at `server/local.db`.

## Running the Application

### Development Mode

Run both frontend and backend concurrently:
```bash
npm run dev
```

This will start:
- Frontend dev server on `http://localhost:5173`
- Backend API server on `http://localhost:3001`

### Individual Services

Run frontend only:
```bash
npm run client
```

Run backend only:
```bash
npm run server
```

### Production Build

Build the frontend for production:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Authentication

The application supports two authentication methods:

### 1. Local Authentication
- Email/password registration and login
- JWT-based session management

### 2. SAML Authentication (Okta)
- Single Sign-On (SSO) via Okta
- See `OKTA_SAML_SETUP.md` for detailed configuration instructions

## Project Structure

```
asset-management/
├── src/                    # Frontend React application
│   ├── components/         # React components
│   ├── context/           # React context providers
│   └── services/          # API service layer
├── server/                # Backend Node.js application
│   ├── config/            # Configuration files
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Express middleware
│   ├── models/            # Sequelize models
│   └── routes/            # API routes
├── dist/                  # Production build output
└── package.json           # Root package configuration
```

## API Endpoints

### Assets
- `GET /api/assets` - Get all assets
- `POST /api/assets` - Create new asset
- `PUT /api/assets/:id` - Update asset
- `DELETE /api/assets/:id` - Delete asset
- `GET /api/assets/:id/history` - Get asset history

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/saml` - Initiate SAML login
- `POST /api/auth/saml/callback` - SAML callback

### Imports
- `POST /api/imports` - Create import batch
- `GET /api/imports` - Get import history

## Database Models

- **Asset** - Asset information and metadata
- **AssetHistory** - Change tracking for assets
- **User** - User accounts and authentication
- **ImportBatch** - Import operation tracking
- **FieldAssignment** - Field mapping configurations

## Development

### Code Style
- ES6+ JavaScript
- React functional components with hooks
- Express.js RESTful API design

### Adding New Features
1. Create models in `server/models/`
2. Add routes in `server/routes/`
3. Create React components in `src/components/`
4. Update API service in `src/services/api.js`

## Troubleshooting

### Database Issues
- Ensure SQLite is properly installed
- Check file permissions for `server/local.db`
- Verify database migrations have run

### Authentication Issues
- Verify environment variables are set correctly
- Check Okta SAML configuration (see `OKTA_SAML_SETUP.md`)
- Review server logs for authentication errors

### Import Issues
- Verify file format (CSV or Excel)
- Check field mapping configuration
- Review import batch logs in the Imports view

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

ISC

## Support

For issues and questions, please open an issue on GitHub.

---

Built with ❤️ for ServiceTitan
