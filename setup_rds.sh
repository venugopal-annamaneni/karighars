#!/bin/bash
# RDS Database Setup Script
# Run this from your local machine where nc test succeeded

set -e

HOST="database-1.cx2yg0q8o2qj.ap-south-1.rds.amazonaws.com"
PORT="5432"
USER="postgres"
PGPASSWORD="Karighars\$2025!!"
DBNAME="kg_interiors_finance"

export PGPASSWORD

echo "🔍 Testing connection to RDS..."
psql -h $HOST -U $USER -p $PORT -d postgres -c "SELECT version();" || {
    echo "❌ Connection failed. Please check:"
    echo "   - RDS security group allows your IP"
    echo "   - Credentials are correct"
    exit 1
}

echo ""
echo "✅ Connection successful!"
echo ""

echo "📦 Checking if database exists..."
DB_EXISTS=$(psql -h $HOST -U $USER -p $PORT -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DBNAME'")

if [ "$DB_EXISTS" = "1" ]; then
    echo "⚠️  Database '$DBNAME' already exists."
    read -p "Do you want to drop and recreate it? (yes/no): " CONFIRM
    if [ "$CONFIRM" = "yes" ]; then
        echo "🗑️  Dropping existing database..."
        psql -h $HOST -U $USER -p $PORT -d postgres -c "DROP DATABASE $DBNAME;"
        echo "📦 Creating database '$DBNAME'..."
        psql -h $HOST -U $USER -p $PORT -d postgres -c "CREATE DATABASE $DBNAME;"
    else
        echo "⏭️  Skipping database creation..."
    fi
else
    echo "📦 Creating database '$DBNAME'..."
    psql -h $HOST -U $USER -p $PORT -d postgres -c "CREATE DATABASE $DBNAME;"
fi

echo ""
echo "📥 Importing schema..."
if [ ! -f "kg_interiors_clean_schema.sql" ]; then
    echo "❌ Schema file 'kg_interiors_clean_schema.sql' not found!"
    echo "   Please ensure the file is in the current directory."
    exit 1
fi

psql -h $HOST -U $USER -p $PORT -d $DBNAME -f kg_interiors_clean_schema.sql

echo ""
echo "✅ Schema imported successfully!"
echo ""

echo "🔍 Verifying tables..."
TABLE_COUNT=$(psql -h $HOST -U $USER -p $PORT -d $DBNAME -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'")
echo "   Found $TABLE_COUNT tables"

if [ "$TABLE_COUNT" -ge "30" ]; then
    echo "✅ All tables created successfully!"
else
    echo "⚠️  Expected 30+ tables but found $TABLE_COUNT"
fi

echo ""
echo "🎉 Database setup complete!"
echo ""
echo "📝 Connection details:"
echo "   Host: $HOST"
echo "   Port: $PORT"
echo "   Database: $DBNAME"
echo "   User: $USER"
echo ""
echo "🔗 Connection string:"
echo "   postgresql://$USER:$PGPASSWORD@$HOST:$PORT/$DBNAME?sslmode=require"
echo ""
echo "✅ Your application is now ready to use!"
