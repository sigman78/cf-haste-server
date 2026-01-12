#!/bin/bash

# Test script to verify page reload issue is fixed

echo "Testing page reload fix..."
echo ""

# Create a document
echo "1. Creating a test document..."
RESPONSE=$(curl -s -X POST http://localhost:8787/documents \
    -H "Content-Type: text/plain" \
    -d "Test document
Line 2
Line 3")

KEY=$(echo "$RESPONSE" | grep -o '"key":"[^"]*"' | cut -d'"' -f4)

if [ -z "$KEY" ]; then
    echo "❌ Failed to create document"
    exit 1
fi

echo "✓ Document created with key: $KEY"
echo ""

# Test accessing the document URL (simulating page reload)
echo "2. Testing document URL (simulating browser navigation)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/$KEY)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ Document URL returns 200 OK (was returning 307 redirect before fix)"
else
    echo "❌ Document URL returns $HTTP_CODE (expected 200)"
    exit 1
fi
echo ""

# Test with extension
echo "3. Testing document URL with extension..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/$KEY.js)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ Document URL with extension returns 200 OK"
else
    echo "❌ Document URL with extension returns $HTTP_CODE (expected 200)"
    exit 1
fi
echo ""

# Test fetching document data
echo "4. Testing document data retrieval..."
CONTENT=$(curl -s http://localhost:8787/documents/$KEY | grep -o '"content":"[^"]*"' | cut -d'"' -f4)

if [ -n "$CONTENT" ]; then
    echo "✓ Document data retrieved successfully"
    echo "  Content: ${CONTENT:0:50}..."
else
    echo "❌ Failed to retrieve document data"
    exit 1
fi
echo ""

echo "=========================================="
echo "✓ All tests passed! Page reload is working."
echo "=========================================="
echo ""
echo "What was fixed:"
echo "  - Document URLs now return 200 OK instead of 307 redirect"
echo "  - Page reloads on document URLs work correctly"
echo "  - SPA can fetch document data after reload"
