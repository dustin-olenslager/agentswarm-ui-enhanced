#!/usr/bin/env node
/**
 * AgentSwarm UI - Credential Generation Script
 * Generates secure credentials for production deployment
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function generateJWTSecret() {
  return crypto.randomBytes(64).toString('base64');
}

async function hashPassword(password) {
  const saltRounds = 12; // High security for production
  return await bcrypt.hash(password, saltRounds);
}

async function main() {
  console.log('🔐 AgentSwarm UI - Credential Generator');
  console.log('====================================');
  console.log('');

  // Generate JWT secret
  const jwtSecret = generateJWTSecret();
  console.log('✓ Generated JWT secret');

  // Get admin credentials
  console.log('\n👤 Admin Account Setup:');
  const adminUsername = await question('Admin username (default: admin): ') || 'admin';
  const adminPassword = await question('Admin password (min 8 chars): ');
  
  if (adminPassword.length < 8) {
    console.log('❌ Password must be at least 8 characters');
    process.exit(1);
  }

  const adminHash = await hashPassword(adminPassword);
  console.log('✓ Generated admin password hash');

  // Get viewer credentials
  console.log('\n👁️  Viewer Account Setup:');
  const viewerUsername = await question('Viewer username (default: viewer): ') || 'viewer';
  const viewerPassword = await question('Viewer password (min 8 chars): ');
  
  if (viewerPassword.length < 8) {
    console.log('❌ Password must be at least 8 characters');
    process.exit(1);
  }

  const viewerHash = await hashPassword(viewerPassword);
  console.log('✓ Generated viewer password hash');

  // Generate production.env content
  const envContent = `# AgentSwarm UI - Production Environment Configuration
# Generated on ${new Date().toISOString()}

# User Credentials
ADMIN_USERNAME=${adminUsername}
ADMIN_PASSWORD_HASH=${adminHash}
VIEWER_USERNAME=${viewerUsername}
VIEWER_PASSWORD_HASH=${viewerHash}

# JWT Secret (keep this secure!)
JWT_SECRET=${jwtSecret}

# Production settings
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
DB_PATH=/app/data/agentswarm.db

# Logging
LOG_LEVEL=warn

# Rate limiting (per 15 minutes)
LOGIN_RATE_LIMIT=5

# Session settings
SESSION_TIMEOUT=86400`;

  console.log('\n📄 Generated production.env:');
  console.log('================================');
  console.log(envContent);
  console.log('================================');

  console.log('\n💾 Save this as production.env file');
  console.log('\n🚨 SECURITY WARNINGS:');
  console.log('• Store these credentials securely');
  console.log('• Never commit production.env to version control');
  console.log('• Change credentials regularly');
  console.log('• Use strong, unique passwords');
  console.log('• Monitor access logs for suspicious activity');

  console.log('\n🔗 Test your credentials:');
  console.log(`Admin: ${adminUsername} / ${adminPassword}`);
  console.log(`Viewer: ${viewerUsername} / ${viewerPassword}`);

  rl.close();
}

main().catch(console.error);