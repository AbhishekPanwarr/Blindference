#!/usr/bin/env python3
"""Quick diagnostic script to test Pinata JWT connectivity."""

import os
import sys
import requests


def test_pinata_jwt(jwt: str | None = None) -> None:
    """Test if a Pinata JWT is valid by making a test API call."""
    
    if jwt is None:
        jwt = os.getenv("PINATA_JWT")
    
    if not jwt:
        print("❌ No JWT provided. Set PINATA_JWT environment variable or pass as argument.")
        print("\nUsage:")
        print("  export PINATA_JWT='your-jwt-here'")
        print("  python test_pinata.py")
        print("\n  or:")
        print("  python test_pinata.py 'your-jwt-here'")
        sys.exit(1)
    
    # Strip quotes if present
    original_jwt = jwt
    jwt = jwt.strip().strip('"').strip("'")
    if jwt != original_jwt:
        print("⚠️  JWT had quotes around it - stripping them")
    
    print(f"🔍 Testing Pinata JWT (length: {len(jwt)}, starts with: {jwt[:20]}...)")
    
    # Test 1: Auth test endpoint
    print("\n1️⃣ Testing Pinata Authentication API...")
    try:
        response = requests.get(
            "https://api.pinata.cloud/data/testAuthentication",
            headers={"Authorization": f"Bearer {jwt}"},
            timeout=30
        )
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text[:200]}")
        
        if response.status_code == 200:
            print("   ✅ JWT is valid!")
        elif response.status_code == 401:
            print("   ❌ JWT is invalid or expired (401)")
        elif response.status_code == 403:
            print("   ❌ JWT is revoked or account suspended (403)")
        elif response.status_code == 429:
            print("   ⚠️  Rate limited (429) - Pinata is throttling requests")
        else:
            print(f"   ⚠️  Unexpected status: {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"   ❌ Network error: {e}")
    
    # Test 2: Pin a small test file
    print("\n2️⃣ Testing Pinata Pinning API...")
    try:
        response = requests.post(
            "https://api.pinata.cloud/pinning/pinFileToIPFS",
            files={"file": ("test.txt", b"Hello from Blindference diagnostic")},
            headers={"Authorization": f"Bearer {jwt}"},
            timeout=30
        )
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            cid = data.get("IpfsHash") or data.get("data", {}).get("cid")
            print(f"   ✅ Successfully pinned! CID: {cid}")
        elif response.status_code in (401, 403):
            print(f"   ❌ Pinning failed: {response.text[:200]}")
        elif response.status_code == 429:
            print("   ⚠️  Rate limited (429)")
        else:
            print(f"   ⚠️  Unexpected: {response.status_code} - {response.text[:200]}")
            
    except requests.exceptions.RequestException as e:
        print(f"   ❌ Network error: {e}")
    
    # Test 3: Check Pinata status page
    print("\n3️⃣ Checking if Pinata API is reachable...")
    try:
        response = requests.get("https://api.pinata.cloud", timeout=10)
        print(f"   Status: {response.status_code} (API is {'up' if response.status_code < 500 else 'down'})")
    except requests.exceptions.RequestException as e:
        print(f"   ❌ Cannot reach Pinata API: {e}")


if __name__ == "__main__":
    jwt = sys.argv[1] if len(sys.argv) > 1 else None
    test_pinata_jwt(jwt)
