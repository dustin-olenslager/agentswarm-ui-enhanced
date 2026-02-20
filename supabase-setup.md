# Supabase Authentication Setup

## Overview
This document provides step-by-step instructions for setting up Supabase authentication for the AgentSwarm UI Enhanced deployment.

## Prerequisites
- VPS deployed with the main application
- Domain configured (swarm.metajibe.com)
- Basic authentication framework already integrated

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Organization: Select your organization or create one
4. Project Name: "AgentSwarm UI Enhanced"
5. Database Password: Generate a strong password and save it
6. Region: Choose the closest to your VPS location
7. Click "Create new project"

## Step 2: Configure Authentication

1. In your Supabase dashboard, go to Authentication > Settings
2. Configure Site URL:
   - Site URL: `https://swarm.metajibe.com`
   - Redirect URLs: 
     - `https://swarm.metajibe.com/auth/callback`
     - `https://swarm.metajibe.com/login`

3. Configure Email Settings:
   - Enable "Confirm email" if desired
   - Enable "Email change confirmations" if desired
   - Set up SMTP (optional, uses Supabase's built-in email service by default)

## Step 3: Create User Account

1. Go to Authentication > Users
2. Click "Add User"
3. Email: `dustin.olenslager@gmail.com`
4. Password: Generate a secure password
5. Email Confirm: Check if you want to skip email confirmation
6. Click "Create User"

## Step 4: Get API Keys

1. Go to Settings > API
2. Copy the following values:
   - Project URL
   - anon/public key
   - service_role/secret key (keep this secure!)

## Step 5: Configure Environment Variables

SSH into your VPS and update the environment file:

```bash
# Connect to VPS
ssh root@37.27.200.128

# Edit environment file
nano /opt/agentswarm/.env
```

Add/update these values in the `.env` file:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_JWT_SECRET=your-jwt-secret-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Authentication Configuration
AUTH_ENABLED=true
JWT_SECRET=your-jwt-secret-here
SESSION_TIMEOUT=24h

# Admin Configuration
ADMIN_EMAIL=dustin.olenslager@gmail.com
```

## Step 6: Restart Services

After updating the environment variables, restart the services:

```bash
systemctl restart agentswarm-main
systemctl restart agentswarm-dashboard
systemctl restart nginx
```

## Step 7: Test Authentication

1. Visit `https://swarm.metajibe.com`
2. You should be redirected to the login page
3. Enter the credentials for `dustin.olenslager@gmail.com`
4. Upon successful login, you should be redirected to the dashboard

## Step 8: Configure Row Level Security (Optional)

For additional security, you can set up Row Level Security in Supabase:

1. Go to Table Editor
2. Create custom tables if needed for application data
3. Set up RLS policies to restrict access

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for client-side | Yes |
| `SUPABASE_JWT_SECRET` | JWT secret for token verification | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for admin operations | Optional |
| `AUTH_ENABLED` | Enable/disable authentication | Optional (default: true) |
| `ADMIN_EMAIL` | Admin user email | Optional |

## Troubleshooting

### Login Issues
- Check that the Site URL in Supabase matches your domain exactly
- Verify redirect URLs are configured correctly
- Check browser console for any CORS errors

### Environment Variables
- Ensure all required variables are set in `/opt/agentswarm/.env`
- Restart services after changing environment variables
- Check service logs: `journalctl -u agentswarm-dashboard -f`

### SSL/HTTPS Issues
- Ensure SSL certificate is properly installed
- Check that redirects are working correctly
- Verify security headers are not blocking authentication requests

## Security Best Practices

1. **Never expose service role keys** in client-side code
2. **Use environment variables** for all sensitive configuration
3. **Enable RLS** on any custom database tables
4. **Monitor authentication logs** in Supabase dashboard
5. **Regularly rotate JWT secrets** and API keys
6. **Use HTTPS only** for all authentication flows

## Production Checklist

- [ ] Supabase project created and configured
- [ ] User account created for admin access
- [ ] Environment variables set correctly
- [ ] Services restarted and running
- [ ] Authentication flow tested end-to-end
- [ ] SSL certificate valid and working
- [ ] Security headers configured
- [ ] Rate limiting in place for auth endpoints
- [ ] Backup strategy for environment variables
- [ ] Monitoring set up for authentication failures

## Support

If you encounter issues:

1. Check service logs: `journalctl -u agentswarm-dashboard -f`
2. Verify Supabase dashboard for authentication attempts
3. Test API endpoints directly with curl
4. Check browser developer tools for client-side errors

## API Endpoints

The authentication system exposes these endpoints:

- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout and clear session
- `GET /api/auth/me` - Get current user information
- `GET /auth/callback` - OAuth callback (if using OAuth providers)

## Next Steps

After authentication is working:

1. Consider adding OAuth providers (Google, GitHub, etc.)
2. Implement role-based access control if needed
3. Set up user management interface
4. Add audit logging for security events
5. Configure backup strategy for user data