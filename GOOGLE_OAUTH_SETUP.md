# Google OAuth Setup Guide

## Current Configuration

**Application URL:** https://kgint-finance.preview.emergentagent.com

**OAuth Credentials:**
- Client ID: `912678435959-s152i7nqggkk2qh7jkl0ivngfnmik0d2.apps.googleusercontent.com`
- Client Secret: `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`

## Required Setup in Google Cloud Console

### 1. Go to Google Cloud Console
https://console.cloud.google.com/apis/credentials

### 2. Select Your OAuth 2.0 Client ID
Find the client ID: `912678435959-s152i7nqggkk2qh7jkl0ivngfnmik0d2`

### 3. Add Authorized Redirect URI
**CRITICAL:** Add this exact URI to "Authorized redirect URIs":

```
https://kgint-finance.preview.emergentagent.com/api/auth/callback/google
```

### 4. Also Add (Optional but Recommended)
For JavaScript origins:
```
https://kgint-finance.preview.emergentagent.com
```

### 5. Save Changes
Click "Save" at the bottom of the page.

## Testing Access

After configuring the redirect URI, test by:
1. Going to: https://kgint-finance.preview.emergentagent.com
2. Click "Sign In" button
3. Sign in with Google account

## Troubleshooting

### If you still get "AccessDenied" error:

**Check 1:** Verify your email exists in the database
```sql
SELECT * FROM users WHERE email = 'your-email@example.com';
```

**Check 2:** Check application logs
```bash
tail -f /var/log/supervisor/nextjs.out.log
```

**Check 3:** Verify the redirect URI is EXACTLY as shown above (including https://, no trailing slash)

### Current Users in Database
- Venugopal A (email in database with admin role)

If you're using a different email, it will be created automatically with 'sales' role on first login.

## Current Error
You're getting: `https://kgint-finance.preview.emergentagent.com/auth/error?error=AccessDenied`

This is because either:
1. ❌ The redirect URI is not configured in Google Cloud Console
2. ❌ The signin callback returned false (check backend logs for errors)

## Quick Fix Steps:
1. Open Google Cloud Console
2. Navigate to APIs & Services > Credentials
3. Click on your OAuth 2.0 Client ID
4. Add the callback URL to "Authorized redirect URIs"
5. Save and wait 1-2 minutes for changes to propagate
6. Try signing in again
