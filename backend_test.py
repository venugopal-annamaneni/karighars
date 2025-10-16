#!/usr/bin/env python3
"""
KG Interiors ERP Backend API Testing Suite
Tests all major backend endpoints for functionality and data persistence.
"""

import requests
import json
import sys
from datetime import datetime, date
import uuid

# Configuration
BASE_URL = "https://design-flow-6.preview.emergentagent.com/api"
HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
}

# Test data storage
test_data = {
    'customer_id': None,
    'vendor_id': None,
    'project_id': None,
    'estimation_id': None,
    'payment_id': None,
    'boq_id': None
}

def log_test(test_name, status, message="", response_data=None):
    """Log test results with consistent formatting"""
    status_symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{status_symbol} {test_name}: {message}")
    if response_data and isinstance(response_data, dict):
        if 'error' in response_data:
            print(f"   Error: {response_data['error']}")
    print()

def make_request(method, endpoint, data=None, expected_status=200):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}/{endpoint.lstrip('/')}"
    
    try:
        if method.upper() == 'GET':
            response = requests.get(url, headers=HEADERS, timeout=30)
        elif method.upper() == 'POST':
            response = requests.post(url, headers=HEADERS, json=data, timeout=30)
        elif method.upper() == 'PUT':
            response = requests.put(url, headers=HEADERS, json=data, timeout=30)
        elif method.upper() == 'DELETE':
            response = requests.delete(url, headers=HEADERS, timeout=30)
        else:
            return None, f"Unsupported method: {method}"
        
        # Parse response
        try:
            response_data = response.json()
        except:
            response_data = {"raw_response": response.text}
        
        return response, response_data
        
    except requests.exceptions.Timeout:
        return None, "Request timeout"
    except requests.exceptions.ConnectionError:
        return None, "Connection error"
    except Exception as e:
        return None, f"Request error: {str(e)}"

def test_database_connection():
    """Test if the database connection is working by checking a simple endpoint"""
    print("🔍 Testing Database Connection...")
    
    response, data = make_request('GET', '/dashboard/stats')
    
    if response is None:
        log_test("Database Connection", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Database Connection", "WARN", "Authentication required (expected for protected endpoints)")
        return True
    elif response.status_code == 500:
        log_test("Database Connection", "FAIL", "Database connection error", data)
        return False
    else:
        log_test("Database Connection", "PASS", f"Database responding (status: {response.status_code})")
        return True

def test_authentication():
    """Test authentication endpoints"""
    print("🔐 Testing Authentication...")
    
    # Test protected endpoint without auth
    response, data = make_request('GET', '/projects')
    
    if response and response.status_code == 401:
        log_test("Authentication Check", "PASS", "Properly rejecting unauthorized requests")
        return True
    else:
        log_test("Authentication Check", "FAIL", f"Expected 401, got {response.status_code if response else 'No response'}")
        return False

def test_create_customer():
    """Test customer creation"""
    print("👥 Testing Customer Management...")
    
    customer_data = {
        "name": "Rajesh Kumar Enterprises",
        "contact_person": "Rajesh Kumar",
        "phone": "+91-9876543210",
        "email": "rajesh.kumar@example.com",
        "address": "123 MG Road, Bangalore, Karnataka 560001",
        "gst_number": "29ABCDE1234F1Z5"
    }
    
    response, data = make_request('POST', '/customers', customer_data)
    
    if response is None:
        log_test("Create Customer", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Create Customer", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 201 or response.status_code == 200:
        if 'customer' in data and 'id' in data['customer']:
            test_data['customer_id'] = data['customer']['id']
            log_test("Create Customer", "PASS", f"Customer created with ID: {test_data['customer_id']}")
            return True
        else:
            log_test("Create Customer", "FAIL", "Customer created but no ID returned", data)
            return False
    else:
        log_test("Create Customer", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_create_vendor():
    """Test vendor creation"""
    print("🏭 Testing Vendor Management...")
    
    vendor_data = {
        "name": "Premium Interiors Pvt Ltd",
        "vendor_type": "PI",
        "contact_person": "Suresh Sharma",
        "phone": "+91-9876543211",
        "email": "suresh@premiuminteriors.com",
        "gst_number": "29FGHIJ5678K2L6",
        "address": "456 Industrial Area, Bangalore, Karnataka 560002"
    }
    
    response, data = make_request('POST', '/vendors', vendor_data)
    
    if response is None:
        log_test("Create Vendor", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Create Vendor", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 201 or response.status_code == 200:
        if 'vendor' in data and 'id' in data['vendor']:
            test_data['vendor_id'] = data['vendor']['id']
            log_test("Create Vendor", "PASS", f"Vendor created with ID: {test_data['vendor_id']}")
            return True
        else:
            log_test("Create Vendor", "FAIL", "Vendor created but no ID returned", data)
            return False
    else:
        log_test("Create Vendor", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_create_project():
    """Test project creation"""
    print("📋 Testing Project Management...")
    
    if not test_data['customer_id']:
        log_test("Create Project", "SKIP", "No customer ID available")
        return False
    
    project_data = {
        "customer_id": test_data['customer_id'],
        "name": "Luxury Villa Interior Design",
        "location": "Whitefield, Bangalore",
        "phase": "onboarding"
    }
    
    response, data = make_request('POST', '/projects', project_data)
    
    if response is None:
        log_test("Create Project", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Create Project", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 201 or response.status_code == 200:
        if 'project' in data and 'id' in data['project']:
            test_data['project_id'] = data['project']['id']
            log_test("Create Project", "PASS", f"Project created with ID: {test_data['project_id']}")
            return True
        else:
            log_test("Create Project", "FAIL", "Project created but no ID returned", data)
            return False
    else:
        log_test("Create Project", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_get_projects():
    """Test getting projects list"""
    print("📋 Testing Get Projects...")
    
    response, data = make_request('GET', '/projects')
    
    if response is None:
        log_test("Get Projects", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Get Projects", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 200:
        if 'projects' in data:
            log_test("Get Projects", "PASS", f"Retrieved {len(data['projects'])} projects")
            return True
        else:
            log_test("Get Projects", "FAIL", "No projects array in response", data)
            return False
    else:
        log_test("Get Projects", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_get_project_details():
    """Test getting specific project details"""
    print("📋 Testing Get Project Details...")
    
    if not test_data['project_id']:
        log_test("Get Project Details", "SKIP", "No project ID available")
        return False
    
    response, data = make_request('GET', f'/projects/{test_data["project_id"]}')
    
    if response is None:
        log_test("Get Project Details", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Get Project Details", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 200:
        if 'project' in data:
            log_test("Get Project Details", "PASS", f"Retrieved project details for ID: {test_data['project_id']}")
            return True
        else:
            log_test("Get Project Details", "FAIL", "No project data in response", data)
            return False
    elif response.status_code == 404:
        log_test("Get Project Details", "FAIL", "Project not found", data)
        return False
    else:
        log_test("Get Project Details", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_create_estimation():
    """Test estimation creation"""
    print("💰 Testing Estimation Management...")
    
    if not test_data['project_id']:
        log_test("Create Estimation", "SKIP", "No project ID available")
        return False
    
    estimation_data = {
        "project_id": test_data['project_id'],
        "total_value": 500000.00,
        "woodwork_value": 300000.00,
        "misc_internal_value": 100000.00,
        "misc_external_value": 100000.00,
        "remarks": "Initial estimation for luxury villa project",
        "status": "draft",
        "items": [
            {
                "category": "woodwork",
                "description": "Modular Kitchen with Premium Finish",
                "quantity": 1,
                "unit": "set",
                "unit_price": 150000.00,
                "vendor_type": "PI",
                "estimated_cost": 120000.00,
                "estimated_margin": 0.20
            },
            {
                "category": "woodwork",
                "description": "Master Bedroom Wardrobe",
                "quantity": 1,
                "unit": "set",
                "unit_price": 80000.00,
                "vendor_type": "PI",
                "estimated_cost": 65000.00,
                "estimated_margin": 0.19
            },
            {
                "category": "misc_external",
                "description": "Electrical Fittings and Fixtures",
                "quantity": 1,
                "unit": "lot",
                "unit_price": 50000.00,
                "vendor_type": "Other",
                "estimated_cost": 40000.00,
                "estimated_margin": 0.20
            }
        ]
    }
    
    response, data = make_request('POST', '/estimations', estimation_data)
    
    if response is None:
        log_test("Create Estimation", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Create Estimation", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 201 or response.status_code == 200:
        if 'estimation' in data and 'id' in data['estimation']:
            test_data['estimation_id'] = data['estimation']['id']
            log_test("Create Estimation", "PASS", f"Estimation created with ID: {test_data['estimation_id']}")
            return True
        else:
            log_test("Create Estimation", "FAIL", "Estimation created but no ID returned", data)
            return False
    else:
        log_test("Create Estimation", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_get_estimation_items():
    """Test getting estimation items"""
    print("💰 Testing Get Estimation Items...")
    
    if not test_data['estimation_id']:
        log_test("Get Estimation Items", "SKIP", "No estimation ID available")
        return False
    
    response, data = make_request('GET', f'/estimation-items/{test_data["estimation_id"]}')
    
    if response is None:
        log_test("Get Estimation Items", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Get Estimation Items", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 200:
        if 'items' in data:
            log_test("Get Estimation Items", "PASS", f"Retrieved {len(data['items'])} estimation items")
            return True
        else:
            log_test("Get Estimation Items", "FAIL", "No items array in response", data)
            return False
    else:
        log_test("Get Estimation Items", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_create_customer_payment():
    """Test customer payment recording"""
    print("💳 Testing Customer Payment Management...")
    
    if not test_data['project_id'] or not test_data['customer_id']:
        log_test("Create Customer Payment", "SKIP", "Missing project or customer ID")
        return False
    
    payment_data = {
        "project_id": test_data['project_id'],
        "estimation_id": test_data['estimation_id'],
        "customer_id": test_data['customer_id'],
        "payment_type": "advance_10",
        "amount": 50000.00,
        "payment_date": datetime.now().isoformat(),
        "mode": "bank",
        "reference_number": f"TXN{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "remarks": "Initial advance payment for project kickoff"
    }
    
    response, data = make_request('POST', '/customer-payments', payment_data)
    
    if response is None:
        log_test("Create Customer Payment", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Create Customer Payment", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 201 or response.status_code == 200:
        if 'payment' in data and 'id' in data['payment']:
            test_data['payment_id'] = data['payment']['id']
            log_test("Create Customer Payment", "PASS", f"Payment recorded with ID: {test_data['payment_id']}")
            return True
        else:
            log_test("Create Customer Payment", "FAIL", "Payment created but no ID returned", data)
            return False
    else:
        log_test("Create Customer Payment", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_get_customer_payments():
    """Test getting customer payments"""
    print("💳 Testing Get Customer Payments...")
    
    response, data = make_request('GET', '/customer-payments')
    
    if response is None:
        log_test("Get Customer Payments", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Get Customer Payments", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 200:
        if 'payments' in data:
            log_test("Get Customer Payments", "PASS", f"Retrieved {len(data['payments'])} customer payments")
            return True
        else:
            log_test("Get Customer Payments", "FAIL", "No payments array in response", data)
            return False
    else:
        log_test("Get Customer Payments", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_update_project_phase():
    """Test updating project phase"""
    print("📋 Testing Update Project Phase...")
    
    if not test_data['project_id']:
        log_test("Update Project Phase", "SKIP", "No project ID available")
        return False
    
    update_data = {
        "phase": "2D",
        "remarks": "Moving to 2D design phase after advance payment"
    }
    
    response, data = make_request('PUT', f'/projects/{test_data["project_id"]}', update_data)
    
    if response is None:
        log_test("Update Project Phase", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Update Project Phase", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 200:
        if 'project' in data:
            log_test("Update Project Phase", "PASS", f"Project phase updated to: {update_data['phase']}")
            return True
        else:
            log_test("Update Project Phase", "FAIL", "No project data in response", data)
            return False
    else:
        log_test("Update Project Phase", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_create_vendor_boq():
    """Test vendor BOQ creation"""
    print("📊 Testing Vendor BOQ Management...")
    
    if not test_data['project_id'] or not test_data['vendor_id']:
        log_test("Create Vendor BOQ", "SKIP", "Missing project or vendor ID")
        return False
    
    boq_data = {
        "project_id": test_data['project_id'],
        "vendor_id": test_data['vendor_id'],
        "total_value": 280000.00,
        "margin_percentage": 15.00,
        "status": "draft",
        "remarks": "Initial BOQ for woodwork items",
        "items": [
            {
                "description": "Modular Kitchen with Premium Finish",
                "quantity": 1,
                "unit": "set",
                "vendor_rate": 120000.00
            },
            {
                "description": "Master Bedroom Wardrobe",
                "quantity": 1,
                "unit": "set",
                "vendor_rate": 65000.00
            }
        ]
    }
    
    response, data = make_request('POST', '/vendor-boqs', boq_data)
    
    if response is None:
        log_test("Create Vendor BOQ", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Create Vendor BOQ", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 201 or response.status_code == 200:
        if 'boq' in data and 'id' in data['boq']:
            test_data['boq_id'] = data['boq']['id']
            log_test("Create Vendor BOQ", "PASS", f"Vendor BOQ created with ID: {test_data['boq_id']}")
            return True
        else:
            log_test("Create Vendor BOQ", "FAIL", "BOQ created but no ID returned", data)
            return False
    else:
        log_test("Create Vendor BOQ", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_create_vendor_payment():
    """Test vendor payment recording"""
    print("💸 Testing Vendor Payment Management...")
    
    if not test_data['project_id'] or not test_data['vendor_id']:
        log_test("Create Vendor Payment", "SKIP", "Missing project or vendor ID")
        return False
    
    payment_data = {
        "project_id": test_data['project_id'],
        "vendor_id": test_data['vendor_id'],
        "vendor_boq_id": test_data['boq_id'],
        "payment_stage": "advance",
        "amount": 140000.00,
        "payment_date": datetime.now().isoformat(),
        "mode": "bank",
        "reference_number": f"VTXN{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "remarks": "Advance payment to vendor for woodwork"
    }
    
    response, data = make_request('POST', '/vendor-payments', payment_data)
    
    if response is None:
        log_test("Create Vendor Payment", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Create Vendor Payment", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 201 or response.status_code == 200:
        if 'payment' in data and 'id' in data['payment']:
            log_test("Create Vendor Payment", "PASS", f"Vendor payment recorded with ID: {data['payment']['id']}")
            return True
        else:
            log_test("Create Vendor Payment", "FAIL", "Payment created but no ID returned", data)
            return False
    else:
        log_test("Create Vendor Payment", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_get_vendor_payments():
    """Test getting vendor payments"""
    print("💸 Testing Get Vendor Payments...")
    
    response, data = make_request('GET', '/vendor-payments')
    
    if response is None:
        log_test("Get Vendor Payments", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Get Vendor Payments", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 200:
        if 'payments' in data:
            log_test("Get Vendor Payments", "PASS", f"Retrieved {len(data['payments'])} vendor payments")
            return True
        else:
            log_test("Get Vendor Payments", "FAIL", "No payments array in response", data)
            return False
    else:
        log_test("Get Vendor Payments", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_get_vendor_boqs():
    """Test getting vendor BOQs"""
    print("📊 Testing Get Vendor BOQs...")
    
    response, data = make_request('GET', '/vendor-boqs')
    
    if response is None:
        log_test("Get Vendor BOQs", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Get Vendor BOQs", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 200:
        if 'boqs' in data:
            log_test("Get Vendor BOQs", "PASS", f"Retrieved {len(data['boqs'])} vendor BOQs")
            return True
        else:
            log_test("Get Vendor BOQs", "FAIL", "No boqs array in response", data)
            return False
    else:
        log_test("Get Vendor BOQs", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_dashboard_stats():
    """Test dashboard statistics"""
    print("📊 Testing Dashboard Stats...")
    
    response, data = make_request('GET', '/dashboard/stats')
    
    if response is None:
        log_test("Get Dashboard Stats", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Get Dashboard Stats", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 200:
        if 'stats' in data:
            log_test("Get Dashboard Stats", "PASS", "Dashboard statistics retrieved successfully")
            return True
        else:
            log_test("Get Dashboard Stats", "FAIL", "No stats data in response", data)
            return False
    else:
        log_test("Get Dashboard Stats", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_error_scenarios():
    """Test various error scenarios"""
    print("🚨 Testing Error Scenarios...")
    
    # Test with missing required fields
    response, data = make_request('POST', '/customers', {})
    if response and response.status_code in [400, 500]:
        log_test("Missing Fields Validation", "PASS", "Properly handling missing required fields")
    else:
        log_test("Missing Fields Validation", "WARN", f"Unexpected response for missing fields: {response.status_code if response else 'No response'}")
    
    # Test with invalid project ID
    response, data = make_request('GET', '/projects/99999')
    if response and response.status_code == 404:
        log_test("Invalid ID Handling", "PASS", "Properly handling invalid project ID")
    elif response and response.status_code == 401:
        log_test("Invalid ID Handling", "WARN", "Authentication required (cannot test invalid ID)")
    else:
        log_test("Invalid ID Handling", "WARN", f"Unexpected response for invalid ID: {response.status_code if response else 'No response'}")

def run_all_tests():
    """Run all backend tests"""
    print("=" * 60)
    print("🚀 KG INTERIORS ERP BACKEND API TESTING SUITE")
    print("=" * 60)
    print()
    
    test_results = []
    
    # Core infrastructure tests
    test_results.append(("Database Connection", test_database_connection()))
    test_results.append(("Authentication", test_authentication()))
    
    # CRUD operations tests
    test_results.append(("Create Customer", test_create_customer()))
    test_results.append(("Create Vendor", test_create_vendor()))
    test_results.append(("Create Project", test_create_project()))
    test_results.append(("Get Projects", test_get_projects()))
    test_results.append(("Get Project Details", test_get_project_details()))
    
    # Estimation tests
    test_results.append(("Create Estimation", test_create_estimation()))
    test_results.append(("Get Estimation Items", test_get_estimation_items()))
    
    # Payment tests
    test_results.append(("Create Customer Payment", test_create_customer_payment()))
    test_results.append(("Get Customer Payments", test_get_customer_payments()))
    test_results.append(("Update Project Phase", test_update_project_phase()))
    
    # Vendor BOQ tests
    test_results.append(("Create Vendor BOQ", test_create_vendor_boq()))
    test_results.append(("Create Vendor Payment", test_create_vendor_payment()))
    test_results.append(("Get Vendor Payments", test_get_vendor_payments()))
    test_results.append(("Get Vendor BOQs", test_get_vendor_boqs()))
    
    # Dashboard tests
    test_results.append(("Dashboard Stats", test_dashboard_stats()))
    
    # Error scenario tests
    test_error_scenarios()
    
    # Summary
    print("=" * 60)
    print("📋 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print()
    print(f"📊 Results: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed! Backend APIs are working correctly.")
    elif passed > total * 0.7:
        print("⚠️  Most tests passed. Some issues need attention.")
    else:
        print("🚨 Multiple test failures. Backend needs significant fixes.")
    
    print()
    print("💡 Note: Authentication failures are expected without a valid session.")
    print("   The main issue to check is whether the APIs are properly structured")
    print("   and the database connections are working.")
    
    return test_results

if __name__ == "__main__":
    try:
        results = run_all_tests()
    except KeyboardInterrupt:
        print("\n\n⚠️ Testing interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n🚨 Testing failed with error: {str(e)}")
        sys.exit(1)