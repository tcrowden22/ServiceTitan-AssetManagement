#!/bin/bash

# Git Setup Script for Asset Management Project
# Run this script after accepting the Xcode license agreement

echo "🚀 Setting up Git repository..."

# Initialize Git repository
git init

# Add all files
git add .

# Make initial commit
git commit -m "Initial commit: Asset Management application

- React frontend with Vite
- Node.js/Express backend
- Asset management functionality
- SAML authentication setup
- Database models and routes"

echo "✅ Git repository initialized and initial commit created!"
echo ""
echo "Next steps:"
echo "  - Set up remote repository: git remote add origin <your-repo-url>"
echo "  - Push to remote: git push -u origin main"
echo ""
echo "Current branch: $(git branch --show-current)"
