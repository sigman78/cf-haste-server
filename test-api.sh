#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL for the API
BASE_URL="http://localhost:8787"

echo "========================================"
echo "   Haste Server API Test Suite"
echo "========================================"
echo ""

# Counter for tests
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local expected="$2"
    local result="$3"

    if [ "$result" = "$expected" ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $test_name"
        echo -e "  Expected: $expected"
        echo -e "  Got: $result"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Function to check if server is running
check_server() {
    echo -e "${YELLOW}Checking if server is running...${NC}"
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health" 2>/dev/null)
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✓${NC} Server is running at $BASE_URL"
        return 0
    else
        echo -e "${RED}✗${NC} Server is not running. Start it with: npm run dev"
        echo ""
        echo "Run this in another terminal:"
        echo "  npm run dev"
        echo ""
        exit 1
    fi
}

echo "Test 1: Health Check Endpoint"
echo "------------------------------"
check_server
echo ""

echo "Test 2: Create Document"
echo "------------------------------"
# Create a test document
test_content="console.log('Hello, World!');\n// This is a test paste"
response=$(curl -s -X POST "$BASE_URL/documents" \
    -H "Content-Type: text/plain" \
    -d "$test_content")

# Extract the key from response
key=$(echo "$response" | grep -o '"key":"[^"]*"' | cut -d'"' -f4)

if [ -n "$key" ]; then
    echo -e "${GREEN}✓${NC} Document created with key: $key"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗${NC} Failed to create document"
    echo "Response: $response"
    ((TESTS_FAILED++))
    exit 1
fi
echo ""

echo "Test 3: Retrieve Document"
echo "------------------------------"
# Retrieve the document
response=$(curl -s "$BASE_URL/documents/$key")
retrieved_content=$(echo "$response" | grep -o '"content":"[^"]*"' | cut -d'"' -f4)

if [ -n "$retrieved_content" ]; then
    echo -e "${GREEN}✓${NC} Document retrieved successfully"
    ((TESTS_PASSED++))
    echo "Content preview: ${retrieved_content:0:50}..."
else
    echo -e "${RED}✗${NC} Failed to retrieve document"
    echo "Response: $response"
    ((TESTS_FAILED++))
fi
echo ""

echo "Test 4: Retrieve Raw Document"
echo "------------------------------"
raw_response=$(curl -s "$BASE_URL/raw/$key")
if [ -n "$raw_response" ]; then
    echo -e "${GREEN}✓${NC} Raw document retrieved successfully"
    ((TESTS_PASSED++))
    echo "Raw content preview: ${raw_response:0:50}..."
else
    echo -e "${RED}✗${NC} Failed to retrieve raw document"
    ((TESTS_FAILED++))
fi
echo ""

echo "Test 5: Verify in Database"
echo "------------------------------"
echo "Querying local D1 database..."
db_query=$(npx wrangler d1 execute haste-db --local --command "SELECT id, LENGTH(content) as content_length, created_at FROM documents WHERE id='$key'" 2>/dev/null | grep -A 20 "results")

if echo "$db_query" | grep -q "$key"; then
    echo -e "${GREEN}✓${NC} Document found in database!"
    echo "$db_query"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗${NC} Document NOT found in database"
    echo "This means data is not being persisted to D1!"
    ((TESTS_FAILED++))
fi
echo ""

echo "Test 6: Create Multiple Documents"
echo "------------------------------"
keys=()
for i in {1..3}; do
    content="Test document $i\nContent line 2\nContent line 3"
    response=$(curl -s -X POST "$BASE_URL/documents" \
        -H "Content-Type: text/plain" \
        -d "$content")
    new_key=$(echo "$response" | grep -o '"key":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$new_key" ]; then
        keys+=("$new_key")
        echo -e "${GREEN}✓${NC} Document $i created: $new_key"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} Failed to create document $i"
        ((TESTS_FAILED++))
    fi
done
echo ""

echo "Test 7: Verify All Documents in Database"
echo "------------------------------"
db_count=$(npx wrangler d1 execute haste-db --local --command "SELECT COUNT(*) as count FROM documents" 2>/dev/null | grep -o '"count":[0-9]*' | cut -d':' -f2)
echo "Total documents in database: $db_count"
if [ "$db_count" -ge 4 ]; then
    echo -e "${GREEN}✓${NC} All documents persisted to database"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗${NC} Expected at least 4 documents, found $db_count"
    ((TESTS_FAILED++))
fi
echo ""

echo "Test 8: Invalid Document Retrieval"
echo "------------------------------"
response_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/documents/nonexistent")
if [ "$response_code" = "404" ]; then
    echo -e "${GREEN}✓${NC} Correctly returns 404 for non-existent document"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗${NC} Expected 404, got $response_code"
    ((TESTS_FAILED++))
fi
echo ""

echo "Test 9: Empty Content Validation"
echo "------------------------------"
response_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/documents" \
    -H "Content-Type: text/plain" \
    -d "")
if [ "$response_code" = "400" ]; then
    echo -e "${GREEN}✓${NC} Correctly rejects empty content (400)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗${NC} Expected 400, got $response_code"
    ((TESTS_FAILED++))
fi
echo ""

echo "Test 10: View Count Increment"
echo "------------------------------"
# Get document twice and check if view count increases
first_view=$(curl -s "$BASE_URL/documents/$key" > /dev/null)
second_view=$(curl -s "$BASE_URL/documents/$key" > /dev/null)
view_count=$(npx wrangler d1 execute haste-db --local --command "SELECT views FROM documents WHERE id='$key'" 2>/dev/null | grep -o '"views":[0-9]*' | cut -d':' -f2)
if [ "$view_count" -ge 2 ]; then
    echo -e "${GREEN}✓${NC} View count incremented correctly (views: $view_count)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗${NC} View count not incrementing (views: $view_count)"
    ((TESTS_FAILED++))
fi
echo ""

echo "========================================"
echo "   Test Summary"
echo "========================================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
