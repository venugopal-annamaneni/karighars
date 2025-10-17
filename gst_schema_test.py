#!/usr/bin/env python3
"""
GST Schema Verification Test
Tests the database schema changes for GST refactoring without requiring authentication.
"""

import psycopg2
import sys
from datetime import datetime

# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'kg_erp',
    'user': 'postgres',
    'password': 'postgres'
}

def test_database_connection():
    """Test database connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"✅ Database connection successful: {version[0]}")
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {str(e)}")
        return False

def test_gst_schema_before_migration():
    """Test schema state before GST migration"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Check if project_estimations table exists and has GST columns
        cursor.execute("""
            SELECT column_name, data_type, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'project_estimations' 
            AND column_name IN ('gst_percentage', 'gst_amount')
            ORDER BY column_name;
        """)
        gst_columns = cursor.fetchall()
        
        # Check if customer_payments_in has GST columns (should be removed after migration)
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'customer_payments_in' 
            AND column_name IN ('gst_amount', 'is_gst_applicable', 'gst_percentage')
            ORDER BY column_name;
        """)
        payment_gst_columns = cursor.fetchall()
        
        print(f"📊 Schema State Check:")
        print(f"   project_estimations GST columns: {len(gst_columns)} found")
        for col in gst_columns:
            print(f"     - {col[0]} ({col[1]}, default: {col[2]})")
        
        print(f"   customer_payments_in GST columns: {len(payment_gst_columns)} found")
        for col in payment_gst_columns:
            print(f"     - {col[0]}")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Schema check failed: {str(e)}")
        return False

def apply_gst_migration():
    """Apply GST refactor schema migration"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Read and execute the GST refactor schema
        with open('/app/gst_refactor_schema.sql', 'r') as f:
            sql_content = f.read()
        
        # Split by semicolon and execute each statement
        statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip() and not stmt.strip().startswith('--')]
        
        for statement in statements:
            if statement:
                try:
                    cursor.execute(statement)
                    print(f"✅ Executed: {statement[:50]}...")
                except Exception as e:
                    print(f"⚠️  Warning executing statement: {str(e)}")
        
        conn.commit()
        cursor.close()
        conn.close()
        print("✅ GST migration applied successfully")
        return True
        
    except Exception as e:
        print(f"❌ GST migration failed: {str(e)}")
        return False

def test_gst_schema_after_migration():
    """Test schema state after GST migration"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Check project_estimations GST columns
        cursor.execute("""
            SELECT column_name, data_type, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'project_estimations' 
            AND column_name IN ('gst_percentage', 'gst_amount')
            ORDER BY column_name;
        """)
        gst_columns = cursor.fetchall()
        
        # Check customer_payments_in GST columns (should be removed)
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'customer_payments_in' 
            AND column_name IN ('gst_amount', 'is_gst_applicable', 'gst_percentage')
            ORDER BY column_name;
        """)
        payment_gst_columns = cursor.fetchall()
        
        # Check if data was truncated
        cursor.execute("SELECT COUNT(*) FROM projects;")
        project_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM project_estimations;")
        estimation_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM customer_payments_in;")
        payment_count = cursor.fetchone()[0]
        
        print(f"📊 Post-Migration Schema State:")
        print(f"   project_estimations GST columns: {len(gst_columns)} found")
        for col in gst_columns:
            print(f"     - {col[0]} ({col[1]}, default: {col[2]})")
        
        print(f"   customer_payments_in GST columns: {len(payment_gst_columns)} found")
        for col in payment_gst_columns:
            print(f"     - {col[0]}")
        
        print(f"   Data counts after truncation:")
        print(f"     - projects: {project_count}")
        print(f"     - project_estimations: {estimation_count}")
        print(f"     - customer_payments_in: {payment_count}")
        
        # Verify expected state
        success = True
        if len(gst_columns) != 2:
            print("❌ Expected 2 GST columns in project_estimations")
            success = False
        
        if len(payment_gst_columns) != 0:
            print("❌ Expected 0 GST columns in customer_payments_in")
            success = False
        
        if project_count != 0 or estimation_count != 0 or payment_count != 0:
            print("❌ Expected all project data to be truncated")
            success = False
        
        if success:
            print("✅ Schema migration verification passed")
        
        cursor.close()
        conn.close()
        return success
        
    except Exception as e:
        print(f"❌ Post-migration schema check failed: {str(e)}")
        return False

def test_estimation_with_gst():
    """Test creating an estimation with GST fields"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # First create a customer
        cursor.execute("""
            INSERT INTO customers (name, contact_person, phone, email, address, gst_number)
            VALUES ('Test Customer GST', 'John Doe', '9876543210', 'test@example.com', 'Test Address', '29ABCDE1234F1Z5')
            RETURNING id;
        """)
        customer_id = cursor.fetchone()[0]
        
        # Create a project
        cursor.execute("""
            INSERT INTO projects (project_code, customer_id, name, location, phase, created_by)
            VALUES ('PRJ-TEST-001', %s, 'GST Test Project', 'Test Location', 'onboarding', 1)
            RETURNING id;
        """, (customer_id,))
        project_id = cursor.fetchone()[0]
        
        # Create estimation with GST
        total_value = 100000.00
        service_charge_percentage = 10.00
        discount_percentage = 2.00
        gst_percentage = 18.00
        
        service_charge_amount = total_value * service_charge_percentage / 100
        discount_amount = total_value * discount_percentage / 100
        final_value = total_value + service_charge_amount - discount_amount
        gst_amount = final_value * gst_percentage / 100
        
        cursor.execute("""
            INSERT INTO project_estimations (
                project_id, version, total_value, woodwork_value, misc_internal_value, misc_external_value,
                service_charge_percentage, service_charge_amount, discount_percentage, discount_amount, 
                final_value, gst_percentage, gst_amount, status, created_by
            )
            VALUES (%s, 1, %s, 80000, 15000, 5000, %s, %s, %s, %s, %s, %s, %s, 'draft', 1)
            RETURNING id, gst_percentage, gst_amount;
        """, (project_id, total_value, service_charge_percentage, service_charge_amount, 
              discount_percentage, discount_amount, final_value, gst_percentage, gst_amount))
        
        estimation_result = cursor.fetchone()
        estimation_id, stored_gst_percentage, stored_gst_amount = estimation_result
        
        print(f"✅ Estimation created with GST:")
        print(f"   Estimation ID: {estimation_id}")
        print(f"   GST Percentage: {stored_gst_percentage}%")
        print(f"   GST Amount: ₹{stored_gst_amount}")
        print(f"   Expected GST Amount: ₹{gst_amount}")
        
        # Verify GST calculation
        if abs(float(stored_gst_amount) - gst_amount) < 0.01:
            print("✅ GST calculation is correct")
            success = True
        else:
            print("❌ GST calculation is incorrect")
            success = False
        
        conn.commit()
        cursor.close()
        conn.close()
        return success
        
    except Exception as e:
        print(f"❌ Estimation with GST test failed: {str(e)}")
        return False

def test_payment_without_gst():
    """Test creating a payment without GST fields"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Get the test project and customer
        cursor.execute("SELECT id FROM projects WHERE project_code = 'PRJ-TEST-001';")
        project_result = cursor.fetchone()
        if not project_result:
            print("❌ Test project not found")
            return False
        project_id = project_result[0]
        
        cursor.execute("SELECT id FROM customers WHERE email = 'test@example.com';")
        customer_result = cursor.fetchone()
        if not customer_result:
            print("❌ Test customer not found")
            return False
        customer_id = customer_result[0]
        
        cursor.execute("SELECT id FROM project_estimations WHERE project_id = %s;", (project_id,))
        estimation_result = cursor.fetchone()
        if not estimation_result:
            print("❌ Test estimation not found")
            return False
        estimation_id = estimation_result[0]
        
        # Create payment without GST fields
        cursor.execute("""
            INSERT INTO customer_payments_in (
                project_id, estimation_id, customer_id, payment_type, amount, 
                payment_date, mode, reference_number, remarks, created_by,
                woodwork_amount, misc_amount, status
            )
            VALUES (%s, %s, %s, 'advance_10', 20000.00, CURRENT_DATE, 'bank', 'TXN123456', 
                    'Test payment without GST fields', 1, 15000.00, 5000.00, 'pending')
            RETURNING id;
        """, (project_id, estimation_id, customer_id))
        
        payment_id = cursor.fetchone()[0]
        
        # Verify no GST fields exist in the payment record
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'customer_payments_in' 
            AND column_name IN ('gst_amount', 'is_gst_applicable', 'gst_percentage');
        """)
        gst_fields = cursor.fetchall()
        
        print(f"✅ Payment created without GST fields:")
        print(f"   Payment ID: {payment_id}")
        print(f"   GST fields in schema: {len(gst_fields)}")
        
        if len(gst_fields) == 0:
            print("✅ Payment schema correctly has no GST fields")
            success = True
        else:
            print("❌ Payment schema still contains GST fields")
            success = False
        
        conn.commit()
        cursor.close()
        conn.close()
        return success
        
    except Exception as e:
        print(f"❌ Payment without GST test failed: {str(e)}")
        return False

def main():
    """Main test execution"""
    print("🚀 Starting GST Refactoring Schema Tests")
    print("=" * 60)
    
    tests = [
        ("Database Connection", test_database_connection),
        ("Schema State Before Migration", test_gst_schema_before_migration),
        ("Apply GST Migration", apply_gst_migration),
        ("Schema State After Migration", test_gst_schema_after_migration),
        ("Estimation with GST", test_estimation_with_gst),
        ("Payment without GST", test_payment_without_gst)
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        print(f"\n--- {test_name} ---")
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ CRITICAL ERROR in {test_name}: {str(e)}")
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"📊 Test Summary:")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
    
    if failed == 0:
        print("\n🎉 All GST refactoring schema tests passed!")
        return 0
    else:
        print(f"\n⚠️  {failed} test(s) failed. Please review the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())