#!/bin/bash

# Smoke test script to verify HTTP server works after infrastructure changes
# Usage: ./scripts/smoke-test.sh [build|dev]

set -e  # Exit on any error

# Configuration
SERVER_HOST="${SERVER_HOST:-localhost}"
SERVER_PORT="${SERVER_PORT:-3000}"
TIMEOUT="${TIMEOUT:-30}"
HEALTH_URL="http://${SERVER_HOST}:${SERVER_PORT}/healthz"
READY_URL="http://${SERVER_HOST}:${SERVER_PORT}/ready"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if server is responding
check_server() {
    local url=$1
    local expected_status=${2:-200}

    local response
    response=$(curl -s -w "HTTP_STATUS:%{http_code}" --max-time 5 --head "$url" 2>/dev/null)

    if [ $? -eq 0 ]; then
        local status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
        if [ "$status" = "$expected_status" ]; then
            return 0
        fi
    fi
    return 1
}

# Function to wait for server to be ready
wait_for_server() {
    local url=$1
    local timeout=$2

    log_info "Waiting for server to be ready at $url..."

    local count=0
    while [ $count -lt $timeout ]; do
        if check_server "$url"; then
            log_info "Server is ready!"
            return 0
        fi

        count=$((count + 1))
        sleep 1

        if [ $((count % 5)) -eq 0 ]; then
            log_warn "Still waiting... ($count/$timeout seconds)"
        fi
    done

    log_error "Server failed to start within $timeout seconds"
    return 1
}

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}

    log_info "Testing $name endpoint: $url"

    local response_file=$(mktemp)
    local status
    status=$(curl -s -w "%{http_code}" -o "$response_file" "$url" 2>/dev/null)
    local body=$(cat "$response_file")
    rm -f "$response_file"

    if [ "$status" = "$expected_status" ]; then
        log_info "$name endpoint responded with expected status $status"

        # For health endpoints, validate JSON structure
        if [[ "$url" == *"/healthz" ]] || [[ "$url" == *"/ready" ]]; then
            if echo "$body" | jq -e '.status' >/dev/null 2>&1; then
                log_info "$name response contains valid JSON with status field"
            else
                log_error "$name response is not valid JSON or missing status field"
                echo "Response body: $body"
                return 1
            fi
        fi

        return 0
    else
        log_error "$name endpoint failed with status $status (expected $expected_status)"
        echo "Response body: $body"
        return 1
    fi
}

# Main script
main() {
    local mode=${1:-dev}

    log_info "Starting smoke test (mode: $mode)"
    log_info "Server will run on http://${SERVER_HOST}:${SERVER_PORT}"

    # In CI environment, env vars are passed directly via GitHub Actions
    # Locally, we require a .env file with real configuration
    if [ -n "$CI" ]; then
        log_info "Running in CI environment - using environment variables directly"
    elif [ -f ".env" ]; then
        log_info "Loading configuration from .env file"
        # Export all variables from .env file
        while IFS='=' read -r key value; do
            # Skip comments and empty lines
            [[ $key =~ ^[[:space:]]*# ]] && continue
            [[ -z "$key" ]] && continue
            # Remove quotes from value if present
            value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")
            export "$key=$value"
        done < .env
    else
        log_error "No .env file found - smoke test requires real configuration"
        log_error "Set CI=true to run without .env file (for CI environments)"
        exit 1
    fi

    # Validate that critical configuration variables are set
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL not configured"
        exit 1
    fi

    if [ -z "$CORE_API_KEY" ]; then
        log_error "CORE_API_KEY not configured"
        exit 1
    fi

    if [ -z "$API_BEARER_TOKENS" ]; then
        log_error "API_BEARER_TOKENS not configured"
        exit 1
    fi

    if [ -z "$VIES_API_KEY" ]; then
        log_error "VIES_API_KEY not configured"
        exit 1
    fi

    log_info "✅ Configuration validated"

    # Set minimal environment overrides for smoke test
    export NODE_ENV="${NODE_ENV:-test}"
    export LOG_LEVEL="${LOG_LEVEL:-error}"
    export PORT="${PORT:-${SERVER_PORT:-3000}}"
    export HOST="${HOST:-${SERVER_HOST:-localhost}}"

    # Start server based on mode - NO FALLBACKS, use real .env configuration only
    if [ "$mode" = "build" ]; then
        log_info "Starting built server..."
        npm run start &
        SERVER_PID=$!
    else
        log_info "Starting dev server..."
        npm run dev &
        SERVER_PID=$!
    fi

    # Trap to ensure server is killed on exit
    trap "log_info 'Stopping server (PID: $SERVER_PID)'; kill $SERVER_PID 2>/dev/null || true; exit" EXIT INT TERM

    # Wait for server to start
    if ! wait_for_server "$HEALTH_URL" "$TIMEOUT"; then
        log_error "Smoke test failed: Server did not start"
        exit 1
    fi

    # Test health endpoints
    log_info "Running smoke tests..."

    local tests_passed=0
    local tests_total=0

    # Test healthz endpoint
    tests_total=$((tests_total + 1))
    if test_endpoint "Health" "$HEALTH_URL" 200; then
        tests_passed=$((tests_passed + 1))
    fi

    # Test ready endpoint
    tests_total=$((tests_total + 1))
    if test_endpoint "Readiness" "$READY_URL" 200; then
        tests_passed=$((tests_passed + 1))
    fi

    # Test API docs endpoint
    tests_total=$((tests_total + 1))
    if test_endpoint "API Docs" "http://${SERVER_HOST}:${SERVER_PORT}/docs" 200; then
        tests_passed=$((tests_passed + 1))
    fi

    # Summary
    log_info "Smoke test results: $tests_passed/$tests_total tests passed"

    if [ $tests_passed -eq $tests_total ]; then
        log_info "✅ Smoke test PASSED - HTTP server is working correctly"
        exit 0
    else
        log_error "❌ Smoke test FAILED - $((tests_total - tests_passed)) tests failed"
        exit 1
    fi
}

# Run main function with arguments
main "$@"