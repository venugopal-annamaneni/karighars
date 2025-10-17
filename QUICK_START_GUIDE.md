# Quick Start Guide - PostgreSQL Setup

## For Your Local Instance

### Step 1: Install PostgreSQL
Choose based on your operating system:

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Windows:**
Download from: https://www.postgresql.org/download/windows/

### Step 2: Create Database and User

```bash
# Access PostgreSQL as postgres user
sudo -u postgres psql

# Or on macOS/Windows:
psql postgres
```

Then run these commands in the PostgreSQL prompt:

```sql
-- Create the database
CREATE DATABASE kg_interiors_finance;

-- Create a user with password
CREATE USER kg_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE kg_interiors_finance TO kg_user;

-- Grant schema privileges (PostgreSQL 15+)
\c kg_interiors_finance
GRANT ALL ON SCHEMA public TO kg_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO kg_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO kg_user;

-- Exit
\q
```

### Step 3: Import the Clean Schema

```bash
# Navigate to the directory containing the schema file
cd /path/to/your/kg_interiors_project

# Import the schema
psql -U kg_user -d kg_interiors_finance -f kg_interiors_clean_schema.sql

# You'll be prompted for the password you set in Step 2
```

### Step 4: Create Your .env File

Create a `.env` file in your project root with:

```env
# PostgreSQL Database Connection
POSTGRES_URL=postgresql://kg_user:your_secure_password_here@localhost:5432/kg_interiors_finance

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-generate-a-random-string

# Google OAuth (if using)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Next.js Public URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Step 5: Verify Connection

Test your database connection:

```bash
psql -U kg_user -d kg_interiors_finance
```

If connected successfully, run:

```sql
-- Check tables were created
\dt

-- Should show all 30 tables
-- Exit with:
\q
```

### Step 6: Share Connection Details

Once your database is set up, share these details:

**Connection String Format:**
```
postgresql://username:password@host:port/database_name
```

**Example:**
```
postgresql://kg_user:MySecurePass123@localhost:5432/kg_interiors_finance
```

---

## For Cloud Databases (Production)

### AWS RDS PostgreSQL
1. Go to AWS RDS Console
2. Create PostgreSQL 15+ instance
3. Note down the endpoint (e.g., `mydb.abc123.us-east-1.rds.amazonaws.com`)
4. Configure security groups to allow your IP
5. Use this connection string:
   ```
   postgresql://username:password@endpoint:5432/kg_interiors_finance?sslmode=require
   ```

### Google Cloud SQL
1. Go to Cloud SQL Console
2. Create PostgreSQL 15+ instance
3. Note the connection name
4. Use Cloud SQL Proxy or direct connection:
   ```
   postgresql://username:password@instance-ip:5432/kg_interiors_finance
   ```

### DigitalOcean Managed Database
1. Create PostgreSQL cluster
2. Create database `kg_interiors_finance`
3. Copy connection string from dashboard
4. Add `?sslmode=require` to connection string

---

## Troubleshooting

### Connection Refused
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start if not running
sudo systemctl start postgresql
```

### Authentication Failed
```bash
# Check pg_hba.conf file
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Ensure this line exists:
# local   all             all                                     md5
# host    all             all             127.0.0.1/32            md5

# Restart PostgreSQL after changes
sudo systemctl restart postgresql
```

### Permission Denied
```sql
-- Connect as postgres user and grant privileges
sudo -u postgres psql
\c kg_interiors_finance
GRANT ALL ON SCHEMA public TO kg_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO kg_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO kg_user;
```

---

## Next Steps After Setup

Once your database is running:

1. **Update your application's .env** with the new POSTGRES_URL
2. **Test the connection** by starting your Next.js application
3. **Verify data** - existing data should be accessible if migrating
4. **Run the application** and test core functionality

---

## Security Notes

⚠️ **Important Security Practices:**

1. **Never commit .env files** - Add to .gitignore
2. **Use strong passwords** - At least 16 characters, mixed case, numbers, symbols
3. **Enable SSL** - Use `?sslmode=require` in production
4. **Restrict access** - Configure firewall/security groups properly
5. **Regular backups** - Set up automated backups for production

---

## Support Files Included

1. **kg_interiors_clean_schema.sql** - The database schema to import
2. **SCHEMA_CLEANUP_SUMMARY.md** - Detailed documentation of schema changes
3. **QUICK_START_GUIDE.md** - This file

---

**Ready to go!** 🚀

Once you have your PostgreSQL instance set up and have imported the schema, you can provide your connection string to update your application.
