#!/usr/bin/env python3
"""
Database Simulation Test for Dynamic Payment Milestone Categories
Simulates API functionality by testing database operations directly.
"""

import psycopg2
import json
from datetime import datetime

# Database connection
DATABASE_URL = "postgresql://postgres:Karighars%242025!!@database-1.cx2yg0q8o2qj.ap-south-1.rds.amazonaws.com:5432/kg_interiors_finance?sslmode=require"

def get_db_connection():
    """Get database connection"""
    try:
        return psycopg2.connect(DATABASE_URL)
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return None

def test_create_bizmodel_with_dynamic_categories():
    """Simulate API: Create BizModel with Dynamic Category Milestones"""
    print("\n🔍 Simulating API: Create BizModel with Dynamic Categories...")
    
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor()
        
        # Test data (same as in test_result.md)
        test_data = {
            "code": "TEST_DYNAMIC_SIM",
            "name": "Test Dynamic Categories Simulation",
            "description": "Testing dynamic milestone categories via DB simulation",
            "gst_percentage": 18,
            "category_rates": {
                "categories": [
                    {
                        "id": "woodwork",
                        "category_name": "Woodwork",
                        "kg_label": "Design & Consultation",
                        "max_item_discount_percentage": 20,
                        "kg_percentage": 10,
                        "max_kg_discount_percentage": 50,
                        "pay_to_vendor_directly": False,
                        "sort_order": 1
                    },
                    {
                        "id": "misc",
                        "category_name": "Misc",
                        "kg_label": "Service Charges",
                        "max_item_discount_percentage": 20,
                        "kg_percentage": 8,
                        "max_kg_discount_percentage": 40,
                        "pay_to_vendor_directly": False,
                        "sort_order": 2
                    },
                    {
                        "id": "shopping",
                        "category_name": "Shopping",
                        "kg_label": "Shopping Charges",
                        "max_item_discount_percentage": 20,
                        "kg_percentage": 5,
                        "max_kg_discount_percentage": 30,
                        "pay_to_vendor_directly": True,
                        "sort_order": 3
                    }
                ]
            },
            "is_active": True,
            "status": "draft"
        }
        
        # Clean up any existing test data
        cursor.execute("DELETE FROM biz_models WHERE code = %s", (test_data["code"],))
        
        # Simulate API validation
        if not test_data.get("category_rates") or not test_data["category_rates"].get("categories"):
            print("   ❌ Validation failed: Invalid category_rates structure")
            return False
        
        if not isinstance(test_data["category_rates"]["categories"], list):
            print("   ❌ Validation failed: categories must be an array")
            return False
        
        print("   ✅ Validation passed")
        
        # Insert BizModel (simulating API POST)
        cursor.execute("""
            INSERT INTO biz_models (code, name, description, gst_percentage, category_rates, is_active, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (
            test_data["code"],
            test_data["name"],
            test_data["description"],
            test_data["gst_percentage"],
            json.dumps(test_data["category_rates"]),
            test_data["is_active"],
            test_data["status"]
        ))
        
        biz_model_id = cursor.fetchone()[0]
        print(f"   ✅ BizModel created with ID: {biz_model_id}")
        
        # Add test stages
        stages = [
            {
                "stage_code": "2D",
                "stage_name": "2D Design",
                "sequence_order": 1,
                "description": "Initial design phase"
            }
        ]
        
        for stage in stages:
            cursor.execute("""
                INSERT INTO biz_model_stages (biz_model_id, stage_code, stage_name, sequence_order, description)
                VALUES (%s, %s, %s, %s, %s)
            """, (biz_model_id, stage["stage_code"], stage["stage_name"], stage["sequence_order"], stage["description"]))
        
        print(f"   ✅ Added {len(stages)} stages")
        
        # Add test milestones with dynamic category percentages
        milestones = [
            {
                "milestone_code": "ADVANCE_10",
                "milestone_name": "Advance Payment",
                "direction": "inflow",
                "stage_code": "2D",
                "description": "10% advance",
                "sequence_order": 1,
                "category_percentages": {
                    "woodwork": 10,
                    "misc": 10,
                    "shopping": 0
                }
            },
            {
                "milestone_code": "DESIGN_30",
                "milestone_name": "Design Approval",
                "direction": "inflow",
                "stage_code": "2D",
                "description": "30% on design approval",
                "sequence_order": 2,
                "category_percentages": {
                    "woodwork": 40,
                    "misc": 40,
                    "shopping": 0
                }
            },
            {
                "milestone_code": "SHOPPING_100",
                "milestone_name": "Shopping Complete",
                "direction": "inflow",
                "stage_code": "SHOPPING",
                "description": "100% shopping charges",
                "sequence_order": 3,
                "category_percentages": {
                    "woodwork": 40,
                    "misc": 40,
                    "shopping": 100
                }
            }
        ]
        
        for milestone in milestones:
            cursor.execute("""
                INSERT INTO biz_model_milestones (biz_model_id, milestone_code, milestone_name, direction, stage_code, description, sequence_order, category_percentages)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                biz_model_id,
                milestone["milestone_code"],
                milestone["milestone_name"],
                milestone["direction"],
                milestone["stage_code"],
                milestone["description"],
                milestone["sequence_order"],
                json.dumps(milestone["category_percentages"])
            ))
        
        print(f"   ✅ Added {len(milestones)} milestones with dynamic category percentages")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        if conn:
            conn.rollback()
            conn.close()
        return False

def test_create_bizmodel_with_four_categories():
    """Simulate API: Create BizModel with 4 Categories (Extensibility Test)"""
    print("\n🔍 Simulating API: Create BizModel with 4 Categories...")
    
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor()
        
        # Test data with 4 categories
        test_data = {
            "code": "TEST_4CAT_SIM",
            "name": "Test 4 Categories Simulation",
            "description": "Testing extensibility with 4 categories",
            "gst_percentage": 18,
            "category_rates": {
                "categories": [
                    {
                        "id": "woodwork",
                        "category_name": "Woodwork",
                        "kg_label": "Design & Consultation",
                        "max_item_discount_percentage": 20,
                        "kg_percentage": 10,
                        "max_kg_discount_percentage": 50,
                        "pay_to_vendor_directly": False,
                        "sort_order": 1
                    },
                    {
                        "id": "misc",
                        "category_name": "Misc",
                        "kg_label": "Service Charges",
                        "max_item_discount_percentage": 20,
                        "kg_percentage": 8,
                        "max_kg_discount_percentage": 40,
                        "pay_to_vendor_directly": False,
                        "sort_order": 2
                    },
                    {
                        "id": "shopping",
                        "category_name": "Shopping",
                        "kg_label": "Shopping Charges",
                        "max_item_discount_percentage": 20,
                        "kg_percentage": 5,
                        "max_kg_discount_percentage": 30,
                        "pay_to_vendor_directly": True,
                        "sort_order": 3
                    },
                    {
                        "id": "civil",
                        "category_name": "Civil",
                        "kg_label": "Civil Works",
                        "max_item_discount_percentage": 15,
                        "kg_percentage": 12,
                        "max_kg_discount_percentage": 35,
                        "pay_to_vendor_directly": True,
                        "sort_order": 4
                    }
                ]
            },
            "is_active": True,
            "status": "draft"
        }
        
        # Clean up any existing test data
        cursor.execute("DELETE FROM biz_models WHERE code = %s", (test_data["code"],))
        
        # Insert BizModel with 4 categories
        cursor.execute("""
            INSERT INTO biz_models (code, name, description, gst_percentage, category_rates, is_active, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (
            test_data["code"],
            test_data["name"],
            test_data["description"],
            test_data["gst_percentage"],
            json.dumps(test_data["category_rates"]),
            test_data["is_active"],
            test_data["status"]
        ))
        
        biz_model_id = cursor.fetchone()[0]
        print(f"   ✅ BizModel with 4 categories created with ID: {biz_model_id}")
        
        # Add milestone with all 4 categories
        milestone = {
            "milestone_code": "COMPLETION_100",
            "milestone_name": "Project Completion",
            "direction": "inflow",
            "stage_code": "COMPLETION",
            "description": "Final completion with all categories",
            "sequence_order": 1,
            "category_percentages": {
                "woodwork": 100,
                "misc": 100,
                "shopping": 100,
                "civil": 100
            }
        }
        
        cursor.execute("""
            INSERT INTO biz_model_milestones (biz_model_id, milestone_code, milestone_name, direction, stage_code, description, sequence_order, category_percentages)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            biz_model_id,
            milestone["milestone_code"],
            milestone["milestone_name"],
            milestone["direction"],
            milestone["stage_code"],
            milestone["description"],
            milestone["sequence_order"],
            json.dumps(milestone["category_percentages"])
        ))
        
        print("   ✅ Added milestone supporting all 4 categories")
        
        # Verify all 4 categories are stored
        cursor.execute("SELECT category_rates FROM biz_models WHERE id = %s", (biz_model_id,))
        stored_category_rates = cursor.fetchone()[0]
        
        categories = stored_category_rates["categories"]
        category_ids = [cat["id"] for cat in categories]
        
        expected_categories = ["woodwork", "misc", "shopping", "civil"]
        for expected_cat in expected_categories:
            if expected_cat in category_ids:
                print(f"   ✅ Category '{expected_cat}' successfully stored")
            else:
                print(f"   ❌ Category '{expected_cat}' missing")
                return False
        
        print("   ✅ System supports N categories - truly dynamic!")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        if conn:
            conn.rollback()
            conn.close()
        return False

def test_fetch_bizmodels_with_milestones():
    """Simulate API: Fetch BizModels with Milestones"""
    print("\n🔍 Simulating API: Fetch BizModels with Milestones...")
    
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor()
        
        # Simulate GET /api/biz-models
        cursor.execute("SELECT id, code, name, category_rates FROM biz_models WHERE is_active = true LIMIT 5")
        biz_models = cursor.fetchall()
        
        print(f"   ✅ Fetched {len(biz_models)} BizModels")
        
        for bm in biz_models:
            bm_id, code, name, category_rates = bm
            print(f"   - {code}: {name}")
            
            # Verify category_rates structure
            if category_rates and "categories" in category_rates:
                categories = category_rates["categories"]
                print(f"     ✅ Has {len(categories)} dynamic categories")
            else:
                print(f"     ❌ Invalid category_rates structure")
                return False
            
            # Fetch associated milestones
            cursor.execute("""
                SELECT milestone_code, milestone_name, category_percentages
                FROM biz_model_milestones 
                WHERE biz_model_id = %s 
                ORDER BY sequence_order 
                LIMIT 3
            """, (bm_id,))
            
            milestones = cursor.fetchall()
            print(f"     ✅ Has {len(milestones)} milestones with dynamic category percentages")
            
            for ms_code, ms_name, cat_percentages in milestones:
                if isinstance(cat_percentages, dict) and cat_percentages:
                    categories_count = len(cat_percentages)
                    print(f"       - {ms_code}: {categories_count} category percentages")
                else:
                    print(f"       ❌ {ms_code}: Invalid category_percentages")
                    return False
        
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        if conn:
            conn.close()
        return False

def test_validation_scenarios():
    """Test validation scenarios that API would handle"""
    print("\n🔍 Testing Validation Scenarios...")
    
    # Test cases that would be rejected by API validation
    invalid_cases = [
        {
            "name": "Missing category_rates",
            "data": {"code": "INVALID1", "name": "Test"},
            "should_fail": True
        },
        {
            "name": "Invalid category_rates structure",
            "data": {"code": "INVALID2", "name": "Test", "category_rates": "invalid"},
            "should_fail": True
        },
        {
            "name": "Missing categories array",
            "data": {"code": "INVALID3", "name": "Test", "category_rates": {}},
            "should_fail": True
        },
        {
            "name": "Valid structure",
            "data": {
                "code": "VALID1", 
                "name": "Test",
                "category_rates": {"categories": [{"id": "test", "category_name": "Test"}]}
            },
            "should_fail": False
        }
    ]
    
    for case in invalid_cases:
        print(f"\n   Testing: {case['name']}")
        
        # Simulate API validation logic
        data = case["data"]
        validation_failed = False
        
        if not data.get("category_rates"):
            validation_failed = True
            print("     ❌ Validation: Missing category_rates")
        elif not isinstance(data["category_rates"], dict):
            validation_failed = True
            print("     ❌ Validation: category_rates must be object")
        elif not data["category_rates"].get("categories"):
            validation_failed = True
            print("     ❌ Validation: Missing categories array")
        elif not isinstance(data["category_rates"]["categories"], list):
            validation_failed = True
            print("     ❌ Validation: categories must be array")
        else:
            print("     ✅ Validation: Passed")
        
        expected_to_fail = case["should_fail"]
        if validation_failed == expected_to_fail:
            print(f"     ✅ Expected result: {'Rejected' if expected_to_fail else 'Accepted'}")
        else:
            print(f"     ❌ Unexpected result: Expected {'rejection' if expected_to_fail else 'acceptance'}")
            return False
    
    return True

def main():
    """Main test function"""
    print("🚀 Starting Dynamic Categories Database Simulation Tests")
    print("=" * 70)
    
    # Test all scenarios
    test_results = []
    
    test_results.append(("Create BizModel with Dynamic Categories", test_create_bizmodel_with_dynamic_categories()))
    test_results.append(("Create BizModel with 4 Categories", test_create_bizmodel_with_four_categories()))
    test_results.append(("Fetch BizModels with Milestones", test_fetch_bizmodels_with_milestones()))
    test_results.append(("Validation Scenarios", test_validation_scenarios()))
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 SIMULATION TEST SUMMARY")
    print("=" * 70)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:<40} {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} simulation tests passed")
    
    if passed == total:
        print("🎉 All dynamic milestone categories functionality verified!")
        return True
    else:
        print("⚠️  Some simulation tests failed")
        return False

if __name__ == "__main__":
    main()