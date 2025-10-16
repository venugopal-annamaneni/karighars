#!/usr/bin/env python3
"""
Direct API testing to understand the authentication flow
"""

import requests
import json

BASE_URL = "https://finance-workflow-5.preview.emergentagent.com"

def test_api_response(endpoint):
    """Test API endpoint and show actual response"""
    url = f"{BASE_URL}/api/{endpoint}"
    print(f"\n🔍 Testing: {url}")
    
    try:
        response = requests.get(url, allow_redirects=False)
        print(f"Status Code: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code in [301, 302, 307, 308]:
            print(f"Redirect Location: {response.headers.get('Location', 'Not specified')}")
            
    except Exception as e:
        print(f"Error: {e}")

def test_auth_endpoints():
    """Test authentication related endpoints"""
    print("🔐 Testing Authentication Endpoints...")
    
    # Test session endpoint
    test_api_response("auth/session")
    
    # Test providers endpoint
    test_api_response("auth/providers")

def test_protected_endpoints():
    """Test protected endpoints"""
    print("\n🛡️ Testing Protected Endpoints...")
    
    endpoints = [
        "dashboard/stats",
        "projects", 
        "customers",
        "vendors"
    ]
    
    for endpoint in endpoints:
        test_api_response(endpoint)

if __name__ == "__main__":
    test_auth_endpoints()
    test_protected_endpoints()