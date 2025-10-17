# AWS RDS Setup Instructions

## Current Status ✅

✅ `.env` file updated with RDS connection string  
✅ PostgreSQL client ready  
⏳ **Next Step:** Configure RDS Security Group and Import Schema

---

## Your RDS Details

- **Cluster Endpoint (Primary):** `database-1.cluster-cx2yg0q8o2qj.ap-south-1.rds.amazonaws.com`
- **Instance Endpoint:** `database-1-instance-1.cx2yg0q8o2qj.ap-south-1.rds.amazonaws.com`
- **Username:** `postgres`
- **Password:** `Karighars$2025!!`
- **Port:** `5432`
- **Database:** `kg_interiors_finance` (to be created)
- **Region:** `ap-south-1` (Mumbai)
- **Type:** Aurora PostgreSQL Cluster

💡 **Note:** Using cluster endpoint for automatic failover support

---

## Step 1: Configure RDS Security Group

### Option A: Allow Your IP (Recommended for Development)

1. Go to [AWS RDS Console](https://ap-south-1.console.aws.amazon.com/rds/home?region=ap-south-1)
2. Click on your instance: `database-1-instance-1`
3. Scroll to **Connectivity & security** section
4. Click on the **VPC security groups** link (e.g., `sg-xxxxx`)
5. Click **Edit inbound rules**
6. Click **Add rule**
7. Configure:
   - **Type:** PostgreSQL
   - **Protocol:** TCP
   - **Port:** 5432
   - **Source:** My IP (or Custom: `0.0.0.0/0` for testing)
   - **Description:** KG Interiors Finance App
8. Click **Save rules**

### Option B: Allow All IPs (Testing Only - NOT for Production)

Use source: `0.0.0.0/0` in step 7 above.

⚠️ **Important:** For production, restrict to specific IPs or security groups.

---

## Step 2: Create Database (Choose One Method)

### Method 1: Using psql from Your Local Machine

```bash
# Test connection first
PGPASSWORD='Karighars$2025!!' psql \
  -h database-1.cluster-cx2yg0q8o2qj.ap-south-1.rds.amazonaws.com \
  -U postgres \
  -p 5432 \
  -d postgres \
  -c "SELECT version();"

# If successful, create database
PGPASSWORD='Karighars$2025!!' psql \
  -h database-1.cluster-cx2yg0q8o2qj.ap-south-1.rds.amazonaws.com \
  -U postgres \
  -p 5432 \
  -d postgres \
  -c "CREATE DATABASE kg_interiors_finance;"
```

### Method 2: Using pgAdmin

1. Open pgAdmin
2. Right-click **Servers** → **Create** → **Server**
3. **General tab:**
   - Name: KG Interiors RDS
4. **Connection tab:**
   - Host: `database-1.cluster-cx2yg0q8o2qj.ap-south-1.rds.amazonaws.com`
   - Port: `5432`
   - Database: `postgres`
   - Username: `postgres`
   - Password: `Karighars$2025!!`
   - Save password: ✓
5. Click **Save**
6. Right-click the server → **Create** → **Database**
7. Database name: `kg_interiors_finance`
8. Click **Save**

### Method 3: Using DBeaver

1. Open DBeaver
2. New Connection → PostgreSQL
3. Enter connection details (same as above)
4. Test Connection
5. Right-click connection → SQL Editor → New SQL Script
6. Run: `CREATE DATABASE kg_interiors_finance;`

---

## Step 3: Import Clean Schema

### Using psql (Recommended)

```bash
# Download the schema file from your project
# Then import:

PGPASSWORD='Karighars$2025!!' psql \
  -h database-1.cluster-cx2yg0q8o2qj.ap-south-1.rds.amazonaws.com \
  -U postgres \
  -p 5432 \
  -d kg_interiors_finance \
  -f kg_interiors_clean_schema.sql
```

### Using pgAdmin

1. Connect to your RDS instance
2. Expand **Databases** → **kg_interiors_finance**
3. Right-click → **Query Tool**
4. Click **Open File** icon
5. Select `kg_interiors_clean_schema.sql`
6. Click **Execute** (F5)

### Using DBeaver

1. Connect to your RDS instance
2. Select `kg_interiors_finance` database
3. SQL Editor → Open SQL Script
4. Open `kg_interiors_clean_schema.sql`
5. Execute SQL Script (Ctrl+Alt+X)

---

## Step 4: Verify Import

Run this query to check if tables were created:

```sql
SELECT 
    schemaname,
    tablename
FROM pg_catalog.pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

You should see **30 tables** including:
- users
- customers
- projects
- project_estimations
- customer_payments_in
- biz_models
- biz_model_milestones
- etc.

---

## Step 5: Test Application Connection

Once the schema is imported:

1. Your application `.env` is already configured ✅
2. The Next.js server will auto-reload
3. Visit: https://finance-dashboard-164.preview.emergentagent.com
4. Try to log in with Google OAuth
5. If successful, you should see the dashboard

---

## Troubleshooting

### Connection Timeout

**Problem:** `psql: error: connection to server ... failed: Connection timed out`

**Solution:**
- Check RDS security group (most common issue)
- Verify RDS instance is **publicly accessible** (see RDS console)
- Check your local firewall/VPN

### Authentication Failed

**Problem:** `FATAL: password authentication failed for user "postgres"`

**Solution:**
- Verify password is correct: `Karighars$2025!!`
- Check if special characters are properly escaped in your terminal
- Try resetting RDS master password in AWS console

### Database Already Exists

**Problem:** `ERROR: database "kg_interiors_finance" already exists`

**Solution:**
- Skip database creation step
- Proceed directly to importing schema
- Or drop and recreate: `DROP DATABASE kg_interiors_finance; CREATE DATABASE kg_interiors_finance;`

### SSL/TLS Error

**Problem:** `SSL connection has been closed unexpectedly`

**Solution:**
- Add `?sslmode=require` to connection string (already done in .env)
- Or temporarily use `?sslmode=disable` for testing

---

## Security Checklist

Before going to production:

- [ ] Change default password
- [ ] Restrict security group to specific IPs
- [ ] Enable RDS encryption at rest
- [ ] Enable automatic backups (7-day retention minimum)
- [ ] Enable CloudWatch monitoring
- [ ] Set up read replicas for high availability
- [ ] Configure VPC for private subnet access
- [ ] Use secrets manager for credentials
- [ ] Enable RDS Performance Insights

---

## Connection String Reference

Your application is using this connection string (from `.env`):

```
postgresql://postgres:Karighars$2025!!@database-1.cluster-cx2yg0q8o2qj.ap-south-1.rds.amazonaws.com:5432/kg_interiors_finance?sslmode=require
```

---

## Need Help?

Common issues and solutions:
1. **Can't connect:** Security group not configured
2. **Timeout errors:** RDS not publicly accessible or wrong region
3. **Authentication failed:** Password incorrect or user doesn't exist
4. **Schema import fails:** Database not created or wrong permissions

If you encounter any issues, let me know the exact error message and I'll help troubleshoot!

---

**Next Step:** Configure your RDS security group, then run the commands above to create the database and import the schema.
