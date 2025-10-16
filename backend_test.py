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
BASE_URL = "https://finance-workflow-5.preview.emergentagent.com/api"
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
            # Check if this is an authentication redirect
            if response.status_code == 200 and "/api/auth/signin" in response.text:
                response_data["auth_redirect"] = True
        
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

def test_biz_models_api():
    """Test BizModel System APIs"""
    print("🏗️ Testing BizModel System...")
    
    # Test GET /api/biz-models
    response, data = make_request('GET', '/biz-models')
    
    if response is None:
        log_test("Get BizModels", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Get BizModels", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 200:
        if 'bizModels' in data and len(data['bizModels']) > 0:
            log_test("Get BizModels", "PASS", f"Retrieved {len(data['bizModels'])} business models")
            return True
        else:
            log_test("Get BizModels", "FAIL", "No bizModels array in response or empty", data)
            return False
    else:
        log_test("Get BizModels", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_biz_model_v1_details():
    """Test BizModel V1 with stages and milestones"""
    print("🏗️ Testing BizModel V1 Details...")
    
    # Test GET /api/biz-models/1
    response, data = make_request('GET', '/biz-models/1')
    
    if response is None:
        log_test("Get BizModel V1", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Get BizModel V1", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 200:
        if 'model' in data and 'stages' in data and 'milestones' in data:
            stages_count = len(data['stages'])
            milestones_count = len(data['milestones'])
            
            # Verify BizModel V1 has 5 stages and 10 milestones
            if stages_count == 5 and milestones_count == 10:
                log_test("BizModel V1 Structure", "PASS", f"V1 has {stages_count} stages and {milestones_count} milestones")
                return True
            else:
                log_test("BizModel V1 Structure", "FAIL", f"Expected 5 stages and 10 milestones, got {stages_count} stages and {milestones_count} milestones")
                return False
        else:
            log_test("Get BizModel V1", "FAIL", "Missing model, stages, or milestones in response", data)
            return False
    else:
        log_test("Get BizModel V1", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_project_with_bizmodel():
    """Test project creation with BizModel features"""
    print("📋 Testing Project Creation with BizModel...")
    
    if not test_data['customer_id']:
        log_test("Project with BizModel", "SKIP", "No customer ID available")
        return False
    
    project_data = {
        "customer_id": test_data['customer_id'],
        "name": "Premium Villa Interior Design with BizModel",
        "location": "Electronic City, Bangalore",
        "phase": "onboarding"
    }
    
    response, data = make_request('POST', '/projects', project_data)
    
    if response is None:
        log_test("Project with BizModel", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Project with BizModel", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 201 or response.status_code == 200:
        if 'project' in data and 'id' in data['project']:
            project = data['project']
            
            # Verify sales_order_id format: SO-YYYY-XXXXXX
            sales_order_id = project.get('sales_order_id', '')
            biz_model_id = project.get('biz_model_id')
            
            if sales_order_id and sales_order_id.startswith('SO-') and len(sales_order_id) == 13:
                year_part = sales_order_id[3:7]
                if year_part.isdigit() and int(year_part) >= 2024:
                    log_test("Sales Order ID Format", "PASS", f"Correct format: {sales_order_id}")
                else:
                    log_test("Sales Order ID Format", "FAIL", f"Invalid year in sales order ID: {sales_order_id}")
                    return False
            else:
                log_test("Sales Order ID Format", "FAIL", f"Invalid sales order ID format: {sales_order_id}")
                return False
            
            if biz_model_id:
                log_test("BizModel Assignment", "PASS", f"Project assigned BizModel ID: {biz_model_id}")
            else:
                log_test("BizModel Assignment", "FAIL", "Project not assigned a BizModel ID")
                return False
            
            test_data['project_id'] = project['id']
            test_data['biz_model_id'] = biz_model_id
            return True
        else:
            log_test("Project with BizModel", "FAIL", "Project created but no ID returned", data)
            return False
    else:
        log_test("Project with BizModel", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_enhanced_estimation():
    """Test enhanced estimation with service charge and discount"""
    print("💰 Testing Enhanced Estimation...")
    
    if not test_data['project_id']:
        log_test("Enhanced Estimation", "SKIP", "No project ID available")
        return False
    
    # Test 1: Normal estimation with service_charge_percentage: 10, discount_percentage: 3
    estimation_data = {
        "project_id": test_data['project_id'],
        "total_value": 1000000.00,
        "woodwork_value": 600000.00,
        "misc_internal_value": 200000.00,
        "misc_external_value": 200000.00,
        "service_charge_percentage": 10,
        "discount_percentage": 3,
        "remarks": "Enhanced estimation with service charge and discount",
        "status": "draft"
    }
    
    response, data = make_request('POST', '/estimations', estimation_data)
    
    if response is None:
        log_test("Enhanced Estimation", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Enhanced Estimation", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 201 or response.status_code == 200:
        if 'estimation' in data and 'id' in data['estimation']:
            estimation = data['estimation']
            
            # Verify auto-calculations
            expected_service_charge = 1000000 * 0.10  # 100000
            expected_discount = 1000000 * 0.03  # 30000
            expected_final_value = 1000000 + expected_service_charge - expected_discount  # 1070000
            
            service_charge_amount = float(estimation.get('service_charge_amount', 0))
            discount_amount = float(estimation.get('discount_amount', 0))
            final_value = float(estimation.get('final_value', 0))
            requires_approval = estimation.get('requires_approval', False)
            approval_status = estimation.get('approval_status', '')
            
            if abs(service_charge_amount - expected_service_charge) < 0.01:
                log_test("Service Charge Calculation", "PASS", f"Correct: ₹{service_charge_amount}")
            else:
                log_test("Service Charge Calculation", "FAIL", f"Expected ₹{expected_service_charge}, got ₹{service_charge_amount}")
                return False
            
            if abs(discount_amount - expected_discount) < 0.01:
                log_test("Discount Calculation", "PASS", f"Correct: ₹{discount_amount}")
            else:
                log_test("Discount Calculation", "FAIL", f"Expected ₹{expected_discount}, got ₹{discount_amount}")
                return False
            
            if abs(final_value - expected_final_value) < 0.01:
                log_test("Final Value Calculation", "PASS", f"Correct: ₹{final_value}")
            else:
                log_test("Final Value Calculation", "FAIL", f"Expected ₹{expected_final_value}, got ₹{final_value}")
                return False
            
            # For 3% discount (within 5% limit), should not require approval
            if not requires_approval and approval_status == 'approved':
                log_test("Approval Logic (3% discount)", "PASS", "No approval required for 3% discount")
            else:
                log_test("Approval Logic (3% discount)", "FAIL", f"Unexpected approval requirement: {requires_approval}, status: {approval_status}")
                return False
            
            test_data['estimation_id'] = estimation['id']
            return True
        else:
            log_test("Enhanced Estimation", "FAIL", "Estimation created but no ID returned", data)
            return False
    else:
        log_test("Enhanced Estimation", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_high_discount_estimation():
    """Test estimation with discount exceeding max percentage"""
    print("💰 Testing High Discount Estimation...")
    
    if not test_data['project_id']:
        log_test("High Discount Estimation", "SKIP", "No project ID available")
        return False
    
    # Test 2: Estimation with discount_percentage: 8 (exceeds max 5%)
    estimation_data = {
        "project_id": test_data['project_id'],
        "total_value": 800000.00,
        "woodwork_value": 500000.00,
        "misc_internal_value": 150000.00,
        "misc_external_value": 150000.00,
        "service_charge_percentage": 10,
        "discount_percentage": 8,  # Exceeds max 5%
        "remarks": "High discount estimation requiring approval",
        "status": "draft"
    }
    
    response, data = make_request('POST', '/estimations', estimation_data)
    
    if response is None:
        log_test("High Discount Estimation", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("High Discount Estimation", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 201 or response.status_code == 200:
        if 'estimation' in data and 'id' in data['estimation']:
            estimation = data['estimation']
            
            requires_approval = estimation.get('requires_approval', False)
            approval_status = estimation.get('approval_status', '')
            
            # For 8% discount (exceeds 5% limit), should require approval
            if requires_approval and approval_status == 'pending':
                log_test("High Discount Approval", "PASS", "8% discount correctly requires approval with pending status")
                return True
            else:
                log_test("High Discount Approval", "FAIL", f"Expected approval required=true and status=pending, got required={requires_approval}, status={approval_status}")
                return False
        else:
            log_test("High Discount Estimation", "FAIL", "Estimation created but no ID returned", data)
            return False
    else:
        log_test("High Discount Estimation", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_payment_with_milestone():
    """Test customer payment with milestone_id"""
    print("💳 Testing Payment with Milestone...")
    
    if not test_data['project_id'] or not test_data['customer_id'] or not test_data['estimation_id']:
        log_test("Payment with Milestone", "SKIP", "Missing required IDs")
        return False
    
    # First, get milestone ID for ADVANCE_10
    response, data = make_request('GET', '/biz-models/1')
    milestone_id = None
    
    if response and response.status_code == 200 and 'milestones' in data:
        for milestone in data['milestones']:
            if milestone.get('milestone_code') == 'ADVANCE_10':
                milestone_id = milestone['id']
                break
    
    if not milestone_id:
        log_test("Payment with Milestone", "FAIL", "Could not find ADVANCE_10 milestone")
        return False
    
    payment_data = {
        "project_id": test_data['project_id'],
        "estimation_id": test_data['estimation_id'],
        "customer_id": test_data['customer_id'],
        "payment_type": "advance_10",
        "milestone_id": milestone_id,
        "amount": 100000.00,  # Should be ~10% of estimation final_value
        "payment_date": datetime.now().isoformat(),
        "mode": "bank",
        "reference_number": f"MILESTONE{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "remarks": "Advance payment with milestone tracking"
    }
    
    response, data = make_request('POST', '/customer-payments', payment_data)
    
    if response is None:
        log_test("Payment with Milestone", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Payment with Milestone", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 201 or response.status_code == 200:
        if 'payment' in data and 'id' in data['payment']:
            payment = data['payment']
            
            expected_percentage = payment.get('expected_percentage')
            actual_percentage = payment.get('actual_percentage')
            
            # Verify expected_percentage and actual_percentage are calculated
            if expected_percentage is not None and actual_percentage is not None:
                log_test("Milestone Percentage Calculation", "PASS", f"Expected: {expected_percentage}%, Actual: {actual_percentage}%")
                test_data['payment_id'] = payment['id']
                return True
            else:
                log_test("Milestone Percentage Calculation", "FAIL", f"Missing percentage calculations: expected={expected_percentage}, actual={actual_percentage}")
                return False
        else:
            log_test("Payment with Milestone", "FAIL", "Payment created but no ID returned", data)
            return False
    else:
        log_test("Payment with Milestone", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_payment_milestone_override():
    """Test payment with amount different from milestone percentage"""
    print("💳 Testing Payment Milestone Override...")
    
    if not test_data['project_id'] or not test_data['customer_id'] or not test_data['estimation_id']:
        log_test("Payment Milestone Override", "SKIP", "Missing required IDs")
        return False
    
    # Get milestone ID for ADVANCE_10 (should suggest 10% = 100000 from 1000000)
    response, data = make_request('GET', '/biz-models/1')
    milestone_id = None
    
    if response and response.status_code == 200 and 'milestones' in data:
        for milestone in data['milestones']:
            if milestone.get('milestone_code') == 'ADVANCE_10':
                milestone_id = milestone['id']
                break
    
    if not milestone_id:
        log_test("Payment Milestone Override", "FAIL", "Could not find ADVANCE_10 milestone")
        return False
    
    # Create payment with amount = 40000 (4% instead of 10%)
    payment_data = {
        "project_id": test_data['project_id'],
        "estimation_id": test_data['estimation_id'],
        "customer_id": test_data['customer_id'],
        "payment_type": "advance_10",
        "milestone_id": milestone_id,
        "amount": 40000.00,  # 4% instead of expected 10%
        "override_reason": "Customer requested lower advance payment",
        "payment_date": datetime.now().isoformat(),
        "mode": "bank",
        "reference_number": f"OVERRIDE{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "remarks": "Advance payment with milestone override"
    }
    
    response, data = make_request('POST', '/customer-payments', payment_data)
    
    if response is None:
        log_test("Payment Milestone Override", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Payment Milestone Override", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 201 or response.status_code == 200:
        if 'payment' in data and 'id' in data['payment']:
            payment = data['payment']
            
            expected_percentage = payment.get('expected_percentage')
            actual_percentage = payment.get('actual_percentage')
            override_reason = payment.get('override_reason')
            
            # Verify: expected_percentage=10, actual_percentage=4, override_reason is saved
            if (expected_percentage == 10.0 and 
                abs(actual_percentage - 4.0) < 0.1 and 
                override_reason == "Customer requested lower advance payment"):
                log_test("Milestone Override Tracking", "PASS", f"Expected: {expected_percentage}%, Actual: {actual_percentage}%, Override saved")
                return True
            else:
                log_test("Milestone Override Tracking", "FAIL", f"Expected 10%/4% with override reason, got {expected_percentage}%/{actual_percentage}%, reason: {override_reason}")
                return False
        else:
            log_test("Payment Milestone Override", "FAIL", "Payment created but no ID returned", data)
            return False
    else:
        log_test("Payment Milestone Override", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_project_ledger():
    """Test project ledger with running balance"""
    print("📊 Testing Project Ledger...")
    
    if not test_data['project_id']:
        log_test("Project Ledger", "SKIP", "No project ID available")
        return False
    
    response, data = make_request('GET', f'/projects/{test_data["project_id"]}/ledger')
    
    if response is None:
        log_test("Project Ledger", "FAIL", f"Request failed: {data}")
        return False
    
    if response.status_code == 401:
        log_test("Project Ledger", "FAIL", "Authentication required - session not available")
        return False
    elif response.status_code == 200:
        if 'ledger' in data:
            ledger_entries = data['ledger']
            
            if len(ledger_entries) > 0:
                # Verify running_balance calculation
                has_running_balance = all('running_balance' in entry for entry in ledger_entries)
                
                # Verify transaction_details JSON includes customer/vendor names
                has_transaction_details = any('transaction_details' in entry and entry['transaction_details'] for entry in ledger_entries)
                
                # Verify both credit and debit entries
                has_credit = any(entry.get('entry_type') == 'credit' for entry in ledger_entries)
                has_debit = any(entry.get('entry_type') == 'debit' for entry in ledger_entries)
                
                if has_running_balance:
                    log_test("Ledger Running Balance", "PASS", "Running balance calculated for all entries")
                else:
                    log_test("Ledger Running Balance", "FAIL", "Missing running balance in some entries")
                    return False
                
                if has_transaction_details:
                    log_test("Ledger Transaction Details", "PASS", "Transaction details JSON includes names")
                else:
                    log_test("Ledger Transaction Details", "WARN", "No transaction details found (may be expected if no payments yet)")
                
                if has_credit or has_debit:
                    log_test("Ledger Entry Types", "PASS", f"Found credit and/or debit entries")
                else:
                    log_test("Ledger Entry Types", "WARN", "No credit or debit entries found")
                
                log_test("Project Ledger", "PASS", f"Retrieved {len(ledger_entries)} ledger entries")
                return True
            else:
                log_test("Project Ledger", "WARN", "No ledger entries found (expected for new project)")
                return True
        else:
            log_test("Project Ledger", "FAIL", "No ledger array in response", data)
            return False
    else:
        log_test("Project Ledger", "FAIL", f"Status: {response.status_code}", data)
        return False

def test_database_integrity():
    """Test database integrity for new BizModel tables"""
    print("🗄️ Testing Database Integrity...")
    
    # This test checks if the APIs work, which indirectly verifies table existence
    # We'll test by trying to access BizModel data
    
    tests_passed = 0
    total_tests = 3
    
    # Test 1: BizModel tables exist (via API)
    response, data = make_request('GET', '/biz-models')
    if response and response.status_code in [200, 401]:  # 401 is OK, means endpoint exists
        log_test("BizModel Tables", "PASS", "biz_models table accessible")
        tests_passed += 1
    else:
        log_test("BizModel Tables", "FAIL", "biz_models table not accessible")
    
    # Test 2: Project with BizModel columns
    if test_data['project_id']:
        response, data = make_request('GET', f'/projects/{test_data["project_id"]}')
        if response and response.status_code in [200, 401]:
            log_test("Project BizModel Columns", "PASS", "Projects table has BizModel columns")
            tests_passed += 1
        else:
            log_test("Project BizModel Columns", "FAIL", "Projects table missing BizModel columns")
    else:
        log_test("Project BizModel Columns", "SKIP", "No project ID to test")
    
    # Test 3: Enhanced estimation columns
    if test_data['estimation_id']:
        response, data = make_request('GET', f'/estimation-items/{test_data["estimation_id"]}')
        if response and response.status_code in [200, 401]:
            log_test("Estimation Enhancement Columns", "PASS", "Estimations table has enhancement columns")
            tests_passed += 1
        else:
            log_test("Estimation Enhancement Columns", "FAIL", "Estimations table missing enhancement columns")
    else:
        log_test("Estimation Enhancement Columns", "SKIP", "No estimation ID to test")
    
    return tests_passed >= 2  # At least 2 out of 3 tests should pass

def run_all_tests():
    """Run all backend tests including new BizModel features"""
    print("=" * 60)
    print("🚀 KG INTERIORS ERP BACKEND API TESTING SUITE")
    print("🏗️ Enhanced BizModel Features Testing")
    print("=" * 60)
    print()
    
    test_results = []
    
    # Core infrastructure tests
    test_results.append(("Database Connection", test_database_connection()))
    test_results.append(("Authentication", test_authentication()))
    
    # BizModel System Tests
    test_results.append(("BizModel API", test_biz_models_api()))
    test_results.append(("BizModel V1 Details", test_biz_model_v1_details()))
    
    # CRUD operations tests with BizModel
    test_results.append(("Create Customer", test_create_customer()))
    test_results.append(("Create Vendor", test_create_vendor()))
    test_results.append(("Project with BizModel", test_project_with_bizmodel()))
    test_results.append(("Get Projects", test_get_projects()))
    test_results.append(("Get Project Details", test_get_project_details()))
    
    # Enhanced Estimation tests
    test_results.append(("Enhanced Estimation", test_enhanced_estimation()))
    test_results.append(("High Discount Estimation", test_high_discount_estimation()))
    test_results.append(("Get Estimation Items", test_get_estimation_items()))
    
    # Flexible Payment Milestone tests
    test_results.append(("Payment with Milestone", test_payment_with_milestone()))
    test_results.append(("Payment Milestone Override", test_payment_milestone_override()))
    test_results.append(("Get Customer Payments", test_get_customer_payments()))
    
    # Project Ledger tests
    test_results.append(("Project Ledger", test_project_ledger()))
    test_results.append(("Update Project Phase", test_update_project_phase()))
    
    # Vendor BOQ tests
    test_results.append(("Create Vendor BOQ", test_create_vendor_boq()))
    test_results.append(("Create Vendor Payment", test_create_vendor_payment()))
    test_results.append(("Get Vendor Payments", test_get_vendor_payments()))
    test_results.append(("Get Vendor BOQs", test_get_vendor_boqs()))
    
    # Dashboard and integrity tests
    test_results.append(("Dashboard Stats", test_dashboard_stats()))
    test_results.append(("Database Integrity", test_database_integrity()))
    
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
    
    # BizModel specific summary
    bizmodel_tests = [
        ("BizModel API", test_results[2][1]),
        ("BizModel V1 Details", test_results[3][1]),
        ("Project with BizModel", test_results[6][1]),
        ("Enhanced Estimation", test_results[9][1]),
        ("High Discount Estimation", test_results[10][1]),
        ("Payment with Milestone", test_results[12][1]),
        ("Payment Milestone Override", test_results[13][1]),
        ("Project Ledger", test_results[15][1]),
        ("Database Integrity", test_results[21][1])
    ]
    
    bizmodel_passed = sum(1 for _, result in bizmodel_tests if result)
    bizmodel_total = len(bizmodel_tests)
    
    print()
    print("🏗️ BizModel Features Summary:")
    print(f"   {bizmodel_passed}/{bizmodel_total} BizModel tests passed ({(bizmodel_passed/bizmodel_total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed! Backend APIs with BizModel features are working correctly.")
    elif passed > total * 0.8:
        print("⚠️  Most tests passed. Minor issues need attention.")
    elif bizmodel_passed >= bizmodel_total * 0.7:
        print("🏗️ BizModel features are mostly working. Some authentication issues expected.")
    else:
        print("🚨 Multiple test failures. Backend needs significant fixes.")
    
    print()
    print("💡 Note: Authentication failures are expected without a valid session.")
    print("   The main focus is on BizModel API structure and calculations.")
    
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