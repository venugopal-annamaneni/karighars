#!/usr/bin/env python3
"""
Backend API Testing for KG Interiors ERP - GST Refactoring
Tests the GST refactoring implementation where GST has been moved from payment collection to estimation level.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://kgint-finance.preview.emergentagent.com/api"
TEST_USER = {
    "name": "Venugopal A",
    "email": "venugopal@example.com",
    "role": "admin"
}

class GST_RefactorTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'KG-ERP-Backend-Tester/1.0'
        })
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            'test': test_name,
            'success': success,
            'message': message,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details:
            print(f"   Details: {details}")
    
    def test_schema_migration(self):
        """Test 1: Schema Migration - CRITICAL - Must be done first"""
        print("\n=== Testing Schema Migration ===")
        
        try:
            # Apply GST refactor schema migration
            migration_data = {"migrationFile": "gst_refactor_schema.sql"}
            response = self.session.post(f"{BASE_URL}/admin/migrate", json=migration_data)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    self.log_result(
                        "Schema Migration", 
                        True, 
                        "GST refactor schema applied successfully",
                        f"Applied {result.get('fileName', 'gst_refactor_schema.sql')}"
                    )
                    return True
                else:
                    self.log_result(
                        "Schema Migration", 
                        False, 
                        "Migration endpoint returned success=false",
                        result
                    )
                    return False
            else:
                self.log_result(
                    "Schema Migration", 
                    False, 
                    f"Migration failed with status {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Schema Migration", 
                False, 
                f"Migration request failed: {str(e)}",
                None
            )
            return False
    
    def test_estimation_api_with_gst(self):
        """Test 2: Estimation API with GST Fields"""
        print("\n=== Testing Estimation API with GST ===")
        
        try:
            # First create a customer for the project
            customer_data = {
                "name": "Test Customer GST",
                "contact_person": "John Doe",
                "phone": "9876543210",
                "email": "testcustomer@example.com",
                "address": "Test Address",
                "gst_number": "29ABCDE1234F1Z5"
            }
            
            customer_response = self.session.post(f"{BASE_URL}/customers", json=customer_data)
            if customer_response.status_code != 200:
                self.log_result(
                    "Estimation API - Customer Creation", 
                    False, 
                    f"Failed to create test customer: {customer_response.status_code}",
                    customer_response.text
                )
                return False
            
            customer_id = customer_response.json()['customer']['id']
            
            # Create a project
            project_data = {
                "customer_id": customer_id,
                "name": "GST Test Project",
                "location": "Test Location",
                "phase": "onboarding"
            }
            
            project_response = self.session.post(f"{BASE_URL}/projects", json=project_data)
            if project_response.status_code != 200:
                self.log_result(
                    "Estimation API - Project Creation", 
                    False, 
                    f"Failed to create test project: {project_response.status_code}",
                    project_response.text
                )
                return False
            
            project_id = project_response.json()['project']['id']
            
            # Create estimation with GST
            estimation_data = {
                "project_id": project_id,
                "total_value": 100000.00,
                "woodwork_value": 80000.00,
                "misc_internal_value": 15000.00,
                "misc_external_value": 5000.00,
                "service_charge_percentage": 10.00,
                "discount_percentage": 2.00,
                "gst_percentage": 18.00,  # GST field
                "status": "draft",
                "remarks": "Test estimation with GST"
            }
            
            estimation_response = self.session.post(f"{BASE_URL}/estimations", json=estimation_data)
            
            if estimation_response.status_code == 200:
                estimation = estimation_response.json()['estimation']
                
                # Verify GST fields are present and calculated correctly
                expected_final_value = 100000 + (100000 * 0.10) - (100000 * 0.02)  # 108000
                expected_gst_amount = expected_final_value * 0.18  # 19440
                
                gst_percentage = estimation.get('gst_percentage')
                gst_amount = estimation.get('gst_amount')
                
                if gst_percentage is not None and gst_amount is not None:
                    if abs(float(gst_amount) - expected_gst_amount) < 0.01:
                        self.log_result(
                            "Estimation API - GST Calculation", 
                            True, 
                            f"GST calculated correctly: {gst_percentage}% = ₹{gst_amount}",
                            f"Expected: ₹{expected_gst_amount}, Got: ₹{gst_amount}"
                        )
                        
                        # Store for later tests
                        self.test_project_id = project_id
                        self.test_customer_id = customer_id
                        self.test_estimation_id = estimation['id']
                        return True
                    else:
                        self.log_result(
                            "Estimation API - GST Calculation", 
                            False, 
                            f"GST amount incorrect. Expected: ₹{expected_gst_amount}, Got: ₹{gst_amount}",
                            estimation
                        )
                        return False
                else:
                    self.log_result(
                        "Estimation API - GST Fields", 
                        False, 
                        "GST fields missing in estimation response",
                        estimation
                    )
                    return False
            else:
                self.log_result(
                    "Estimation API - Creation", 
                    False, 
                    f"Failed to create estimation: {estimation_response.status_code}",
                    estimation_response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Estimation API", 
                False, 
                f"Estimation API test failed: {str(e)}",
                None
            )
            return False
    
    def test_calculate_payment_api_gst_inclusion(self):
        """Test 3: Calculate Payment API - GST Inclusion"""
        print("\n=== Testing Calculate Payment API - GST Inclusion ===")
        
        if not hasattr(self, 'test_project_id'):
            self.log_result(
                "Calculate Payment API", 
                False, 
                "No test project available (estimation test must pass first)",
                None
            )
            return False
        
        try:
            # Get BizModel milestones to test with
            bizmodels_response = self.session.get(f"{BASE_URL}/biz-models")
            if bizmodels_response.status_code != 200:
                self.log_result(
                    "Calculate Payment API - BizModel Fetch", 
                    False, 
                    f"Failed to fetch BizModels: {bizmodels_response.status_code}",
                    bizmodels_response.text
                )
                return False
            
            bizmodels = bizmodels_response.json()['bizModels']
            if not bizmodels:
                self.log_result(
                    "Calculate Payment API - BizModel", 
                    False, 
                    "No BizModels found",
                    None
                )
                return False
            
            # Get first BizModel details
            bizmodel_id = bizmodels[0]['id']
            bizmodel_response = self.session.get(f"{BASE_URL}/biz-models/{bizmodel_id}")
            if bizmodel_response.status_code != 200:
                self.log_result(
                    "Calculate Payment API - BizModel Details", 
                    False, 
                    f"Failed to fetch BizModel details: {bizmodel_response.status_code}",
                    bizmodel_response.text
                )
                return False
            
            milestones = bizmodel_response.json()['milestones']
            inflow_milestones = [m for m in milestones if m['direction'] == 'inflow' and m['milestone_code'] != 'MISC_PAYMENT']
            
            if not inflow_milestones:
                self.log_result(
                    "Calculate Payment API - Milestones", 
                    False, 
                    "No inflow milestones found",
                    None
                )
                return False
            
            # Test calculate payment with first milestone
            milestone_id = inflow_milestones[0]['id']
            calc_response = self.session.get(f"{BASE_URL}/calculate-payment/{self.test_project_id}/{milestone_id}")
            
            if calc_response.status_code == 200:
                calc_data = calc_response.json()
                
                # Verify GST is included in calculations
                woodwork_value = calc_data.get('woodwork_value', 0)
                misc_value = calc_data.get('misc_value', 0)
                
                # Expected values should include GST
                # From estimation: woodwork=80000, misc=20000, final_value=108000, gst=19440
                # GST distribution: woodwork_gst = (80000/100000) * 19440 = 15552, misc_gst = (20000/100000) * 19440 = 3888
                # Total with GST: woodwork = 80000 + 15552 = 95552, misc = 20000 + 3888 = 23888
                
                expected_woodwork_with_gst = 95552  # Approximate
                expected_misc_with_gst = 23888      # Approximate
                
                if (abs(woodwork_value - expected_woodwork_with_gst) < 1000 and 
                    abs(misc_value - expected_misc_with_gst) < 1000):
                    self.log_result(
                        "Calculate Payment API - GST Inclusion", 
                        True, 
                        f"Values include GST correctly: Woodwork=₹{woodwork_value}, Misc=₹{misc_value}",
                        f"Expected approx: Woodwork=₹{expected_woodwork_with_gst}, Misc=₹{expected_misc_with_gst}"
                    )
                    return True
                else:
                    self.log_result(
                        "Calculate Payment API - GST Inclusion", 
                        False, 
                        f"Values don't include GST. Got: Woodwork=₹{woodwork_value}, Misc=₹{misc_value}",
                        f"Expected approx: Woodwork=₹{expected_woodwork_with_gst}, Misc=₹{expected_misc_with_gst}"
                    )
                    return False
            else:
                self.log_result(
                    "Calculate Payment API", 
                    False, 
                    f"Calculate payment failed: {calc_response.status_code}",
                    calc_response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Calculate Payment API", 
                False, 
                f"Calculate payment test failed: {str(e)}",
                None
            )
            return False
    
    def test_payment_api_gst_removal(self):
        """Test 4: Payment API - GST Removal"""
        print("\n=== Testing Payment API - GST Removal ===")
        
        if not hasattr(self, 'test_project_id'):
            self.log_result(
                "Payment API", 
                False, 
                "No test project available (estimation test must pass first)",
                None
            )
            return False
        
        try:
            # Create payment WITHOUT GST fields
            payment_data = {
                "project_id": self.test_project_id,
                "estimation_id": self.test_estimation_id,
                "customer_id": self.test_customer_id,
                "payment_type": "advance_10",
                "amount": 20000.00,
                "payment_date": "2025-01-15",
                "mode": "bank",
                "reference_number": "TXN123456",
                "remarks": "Test payment without GST fields",
                "woodwork_amount": 15000.00,
                "misc_amount": 5000.00
                # NOTE: NO gst_amount, is_gst_applicable, gst_percentage fields
            }
            
            payment_response = self.session.post(f"{BASE_URL}/customer-payments", json=payment_data)
            
            if payment_response.status_code == 200:
                payment = payment_response.json()['payment']
                
                # Verify GST fields are NOT present in response
                gst_fields = ['gst_amount', 'is_gst_applicable', 'gst_percentage']
                gst_fields_present = [field for field in gst_fields if field in payment]
                
                if not gst_fields_present:
                    self.log_result(
                        "Payment API - GST Removal", 
                        True, 
                        "Payment created successfully without GST fields",
                        f"Payment ID: {payment['id']}, Amount: ₹{payment['amount']}"
                    )
                    return True
                else:
                    self.log_result(
                        "Payment API - GST Removal", 
                        False, 
                        f"GST fields still present in payment: {gst_fields_present}",
                        payment
                    )
                    return False
            else:
                self.log_result(
                    "Payment API - Creation", 
                    False, 
                    f"Failed to create payment: {payment_response.status_code}",
                    payment_response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Payment API", 
                False, 
                f"Payment API test failed: {str(e)}",
                None
            )
            return False
    
    def test_migration_endpoint(self):
        """Test 5: Migration Endpoint - GST Schema Application"""
        print("\n=== Testing Migration Endpoint ===")
        
        try:
            # Test migration endpoint with different file (should handle gracefully)
            migration_data = {"migrationFile": "nonexistent_file.sql"}
            response = self.session.post(f"{BASE_URL}/admin/migrate", json=migration_data)
            
            # Should return error for non-existent file
            if response.status_code == 500:
                self.log_result(
                    "Migration Endpoint - Error Handling", 
                    True, 
                    "Migration endpoint correctly handles non-existent files",
                    "Returns 500 error as expected"
                )
            else:
                self.log_result(
                    "Migration Endpoint - Error Handling", 
                    False, 
                    f"Unexpected response for non-existent file: {response.status_code}",
                    response.text
                )
            
            # Test with correct file again (should be idempotent)
            migration_data = {"migrationFile": "gst_refactor_schema.sql"}
            response = self.session.post(f"{BASE_URL}/admin/migrate", json=migration_data)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    self.log_result(
                        "Migration Endpoint - Idempotency", 
                        True, 
                        "Migration endpoint is idempotent (can be run multiple times)",
                        f"Applied {result.get('fileName', 'gst_refactor_schema.sql')}"
                    )
                    return True
                else:
                    self.log_result(
                        "Migration Endpoint - Idempotency", 
                        False, 
                        "Migration endpoint returned success=false on second run",
                        result
                    )
                    return False
            else:
                self.log_result(
                    "Migration Endpoint - Idempotency", 
                    False, 
                    f"Migration failed on second run: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Migration Endpoint", 
                False, 
                f"Migration endpoint test failed: {str(e)}",
                None
            )
            return False
    
    def run_all_tests(self):
        """Run all GST refactoring tests in priority order"""
        print("🚀 Starting GST Refactoring Backend Tests")
        print(f"Base URL: {BASE_URL}")
        print(f"Test User: {TEST_USER['name']} ({TEST_USER['role']})")
        
        # Test in priority order as specified
        tests = [
            ("Schema Migration", self.test_schema_migration),
            ("Estimation API with GST", self.test_estimation_api_with_gst),
            ("Calculate Payment API - GST Inclusion", self.test_calculate_payment_api_gst_inclusion),
            ("Payment API - GST Removal", self.test_payment_api_gst_removal),
            ("Migration Endpoint", self.test_migration_endpoint)
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ CRITICAL ERROR in {test_name}: {str(e)}")
                failed += 1
        
        # Summary
        print(f"\n📊 Test Summary:")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        # Critical issues
        critical_failures = [r for r in self.test_results if not r['success'] and 
                           ('Schema Migration' in r['test'] or 'Estimation API' in r['test'])]
        
        if critical_failures:
            print(f"\n🚨 CRITICAL ISSUES FOUND:")
            for failure in critical_failures:
                print(f"   - {failure['test']}: {failure['message']}")
        
        return passed, failed

def main():
    """Main test execution"""
    tester = GST_RefactorTester()
    
    try:
        passed, failed = tester.run_all_tests()
        
        # Exit with appropriate code
        if failed == 0:
            print("\n🎉 All tests passed! GST refactoring is working correctly.")
            sys.exit(0)
        else:
            print(f"\n⚠️  {failed} test(s) failed. Please review the issues above.")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n💥 Test execution failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()