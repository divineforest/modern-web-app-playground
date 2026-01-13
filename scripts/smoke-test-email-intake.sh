#!/bin/bash

# Email Intake Workflow Smoke Test
# Runs E2E test from webhook reception through Temporal workflow execution

set -e  # Exit on any error

# Configuration
SERVER_HOST="${SERVER_HOST:-localhost}"
SERVER_PORT="${SERVER_PORT:-3000}"
TIMEOUT="${TIMEOUT:-60}"
WEBHOOK_URL="http://${SERVER_HOST}:${SERVER_PORT}/api/v2/webhooks/postmark/inbound"

# Test data
TEST_TOKEN="smoke-test-$(uuidgen | tr '[:upper:]' '[:lower:]')"
TEST_MESSAGE_ID="smoke-test-$(uuidgen)"
TEST_COMPANY_ID=""
WORKFLOW_ID=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up test data..."
    
    # Remove test company from database if created
    if [ -n "$TEST_COMPANY_ID" ]; then
        psql "${DATABASE_URL}" -c "DELETE FROM companies WHERE id = '${TEST_COMPANY_ID}';" >/dev/null 2>&1 || true
        log_info "Deleted test company: ${TEST_COMPANY_ID}"
    fi
}

# Trap to ensure cleanup on exit
trap cleanup EXIT INT TERM

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."
    
    # Check required commands
    local missing_commands=()
    for cmd in psql curl jq aws temporal; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_commands+=("$cmd")
        fi
    done
    
    if [ ${#missing_commands[@]} -gt 0 ]; then
        log_error "Missing required commands: ${missing_commands[*]}"
        log_error "Install them before running this test:"
        log_error "  - psql: PostgreSQL client (brew install postgresql)"
        log_error "  - curl: HTTP client (usually pre-installed)"
        log_error "  - jq: JSON processor (brew install jq)"
        log_error "  - aws: AWS CLI (brew install awscli)"
        log_error "  - temporal: Temporal CLI (brew install temporal)"
        exit 1
    fi
    
    # Check DATABASE_URL is set (dev default - use accounting_dev database)
    : "${DATABASE_URL:=postgresql://user:password@localhost:5432/accounting_dev}"
    
    # Check PostgreSQL connection
    if ! psql "${DATABASE_URL}" -c "SELECT 1;" >/dev/null 2>&1; then
        log_error "Cannot connect to PostgreSQL at ${DATABASE_URL}"
        log_error "Start docker-compose services: docker-compose up -d"
        exit 1
    fi
    log_info "✓ PostgreSQL is accessible"
    
    # Check LocalStack S3
    AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url=http://localhost:4566 s3 ls >/dev/null 2>&1
    if [ $? -ne 0 ]; then
        log_error "Cannot connect to LocalStack S3 at http://localhost:4566"
        log_error "Start docker-compose services: docker-compose up -d"
        exit 1
    fi
    log_info "✓ LocalStack S3 is accessible"
    
    # Check HTTP server
    if ! curl -sf "http://${SERVER_HOST}:${SERVER_PORT}/healthz" >/dev/null 2>&1; then
        log_error "HTTP server not responding at http://${SERVER_HOST}:${SERVER_PORT}"
        log_error "Start the server: pnpm dev"
        exit 1
    fi
    log_info "✓ HTTP server is running"
    
    # Check Temporal server
    if ! temporal workflow list --limit 1 >/dev/null 2>&1; then
        log_error "Cannot connect to Temporal server"
        log_error "Start Temporal: temporal server start-dev"
        exit 1
    fi
    log_info "✓ Temporal server is accessible"
    
    # Check Temporal worker (approximate check - verify task queue exists)
    log_warn "Make sure Temporal worker is running: pnpm temporal:worker"
    
    log_info "✓ All prerequisites met"
}

# Create test company in database
create_test_company() {
    log_step "Creating test company with billing token: ${TEST_TOKEN}"
    
    # Insert company and capture the ID
    TEST_COMPANY_ID=$(psql "${DATABASE_URL}" -t -c "
        INSERT INTO companies (name, status, billing_inbound_token, billing_settings, company_details)
        VALUES ('Smoke Test Company', 'active', '${TEST_TOKEN}', '{}', '{}')
        RETURNING id;
    " | xargs)
    
    if [ -z "$TEST_COMPANY_ID" ]; then
        log_error "Failed to create test company"
        exit 1
    fi
    
    log_info "✓ Created test company: ${TEST_COMPANY_ID}"
}

# Send Postmark webhook
send_webhook() {
    log_step "Sending Postmark webhook..."
    
    # Get the directory where this script is located
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local project_root="$(cd "${script_dir}/.." && pwd)"
    local invoice_path="${project_root}/tests/fixtures/Invoice-UJYG5HZG-0007.pdf"
    
    # Check if invoice file exists
    if [ ! -f "$invoice_path" ]; then
        log_error "Invoice file not found at: ${invoice_path}"
        exit 1
    fi
    
    # Convert invoice PDF to base64
    local invoice_base64=$(base64 -i "$invoice_path" | tr -d '\n')
    local invoice_size=$(stat -f%z "$invoice_path" 2>/dev/null || stat -c%s "$invoice_path" 2>/dev/null)
    
    log_info "Using real Temporal invoice: Invoice-UJYG5HZG-0007.pdf (${invoice_size} bytes)"
    
    # Create Postmark webhook payload with attachment
    local payload=$(cat <<EOF
{
  "FromName": "Temporal Technologies",
  "From": "AR@temporal.io",
  "FromFull": {
    "Email": "AR@temporal.io",
    "Name": "Temporal Technologies"
  },
  "To": "EasyBiz <${TEST_TOKEN}@example.com>",
  "ToFull": [
    {
      "Email": "${TEST_TOKEN}@example.com",
      "Name": "EasyBiz"
    }
  ],
  "Cc": "",
  "CcFull": [],
  "Bcc": "",
  "BccFull": [],
  "OriginalRecipient": "${TEST_TOKEN}@example.com",
  "Subject": "Invoice UJYG5HZG-0007 from Temporal Technologies",
  "MessageID": "${TEST_MESSAGE_ID}",
  "Date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "TextBody": "Please find attached your invoice UJYG5HZG-0007 for the service period Dec 01 2025 - Dec 31 2025. Amount due: \$100.00 USD by February 1, 2026.",
  "HtmlBody": "<html><body><p>Please find attached your invoice <strong>UJYG5HZG-0007</strong> for the service period Dec 01 2025 - Dec 31 2025.</p><p>Amount due: <strong>\$100.00 USD</strong> by February 1, 2026.</p></body></html>",
  "Headers": [
    {
      "Name": "X-Smoke-Test",
      "Value": "true"
    }
  ],
  "Attachments": [
    {
      "Name": "Invoice-UJYG5HZG-0007.pdf",
      "Content": "${invoice_base64}",
      "ContentType": "application/pdf",
      "ContentLength": ${invoice_size}
    }
  ]
}
EOF
)
    
    # Send webhook and capture response
    local response=$(curl -sf -X POST "${WEBHOOK_URL}" \
        -H "Content-Type: application/json" \
        -d "$payload" 2>&1)
    
    if [ $? -ne 0 ]; then
        log_error "Failed to send webhook: ${response}"
        exit 1
    fi
    
    # Extract workflow ID from response
    WORKFLOW_ID=$(echo "$response" | jq -r '.workflowId // empty')
    
    if [ -z "$WORKFLOW_ID" ]; then
        log_error "No workflow ID in response: ${response}"
        exit 1
    fi
    
    log_info "✓ Webhook sent, workflow started: ${WORKFLOW_ID}"
}

# Wait for workflow to reach terminal state (completed or failed)
# OR for activity to be retrying with expected Core API failure
wait_for_workflow() {
    log_step "Waiting for workflow to reach terminal state or activity retry (timeout: ${TIMEOUT}s)..."
    log_info "NOTE: Workflow is expected to FAIL or RETRY due to Core API being unavailable"
    
    local elapsed=0
    local status=""
    
    while [ $elapsed -lt $TIMEOUT ]; do
        # Query workflow status and details
        local workflow_json=$(temporal workflow describe \
            --workflow-id "${WORKFLOW_ID}" \
            --output json 2>/dev/null || echo "{}")
        
        status=$(echo "$workflow_json" | jq -r '.workflowExecutionInfo.status // "unknown"')
        
        if [ "$status" = "WORKFLOW_EXECUTION_STATUS_COMPLETED" ]; then
            log_info "✓ Workflow completed successfully"
            return 0
        elif [ "$status" = "WORKFLOW_EXECUTION_STATUS_FAILED" ]; then
            log_warn "Workflow failed as expected (Core API unavailable)"
            return 0
        elif [ "$status" = "WORKFLOW_EXECUTION_STATUS_TERMINATED" ] || [ "$status" = "WORKFLOW_EXECUTION_STATUS_CANCELED" ]; then
            log_error "Workflow was terminated or canceled unexpectedly: ${status}"
            temporal workflow describe --workflow-id "${WORKFLOW_ID}"
            exit 1
        elif [ "$status" = "WORKFLOW_EXECUTION_STATUS_RUNNING" ]; then
            # Check if activity is retrying with fetch/Core API failure
            local pending_activities=$(echo "$workflow_json" | jq -r '.pendingActivities // []')
            local has_fetch_failure=$(echo "$pending_activities" | jq -r '.[].lastFailure.message // ""' | grep -i "fetch failed" || true)
            
            if [ -n "$has_fetch_failure" ] && [ $elapsed -ge 20 ]; then
                log_warn "Workflow is running with expected Core API fetch failures (activity retrying)"
                log_info "✓ This is expected behavior for smoke test"
                return 0
            fi
        fi
        
        sleep 2
        elapsed=$((elapsed + 2))
        
        if [ $((elapsed % 10)) -eq 0 ]; then
            local readable_status=$(echo "$status" | sed 's/WORKFLOW_EXECUTION_STATUS_//')
            log_info "Still waiting... (${elapsed}s elapsed, status: ${readable_status:-unknown})"
        fi
    done
    
    log_error "Workflow did not reach expected state within ${TIMEOUT} seconds"
    log_error "Current status: ${status:-unknown}"
    temporal workflow describe --workflow-id "${WORKFLOW_ID}"
    exit 1
}

# Verify S3 archival
verify_s3_archival() {
    log_step "Verifying S3 archival..."
    
    # Generate expected S3 key
    local date_path=$(date -u +"%Y/%m/%d")
    local s3_key="inbound-emails/${date_path}/${TEST_MESSAGE_ID}.json"
    
    log_info "Expected S3 key: s3://backend-accounting-documents/${s3_key}"
    
    # Check if object exists in LocalStack
    AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url=http://localhost:4566 \
        s3api head-object \
        --bucket backend-accounting-documents \
        --key "${s3_key}" >/dev/null 2>&1
    
    if [ $? -ne 0 ]; then
        log_error "Payload not found in S3 at: ${s3_key}"
        log_error "Listing S3 contents for debug:"
        AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url=http://localhost:4566 \
            s3 ls s3://backend-accounting-documents/inbound-emails/ --recursive | tail -n 10
        exit 1
    fi
    
    log_info "✓ Payload archived to S3 successfully"
}

# Verify workflow executed through S3 archival stage
verify_workflow_execution() {
    log_step "Verifying workflow execution..."
    
    # Get workflow details including pending activities
    local workflow_json=$(temporal workflow describe \
        --workflow-id "${WORKFLOW_ID}" \
        --output json 2>/dev/null || echo "{}")
    
    # Check if activity was scheduled (either completed, pending, or failed)
    local pending_activities=$(echo "$workflow_json" | jq -r '.pendingActivities // [] | length')
    local history=$(temporal workflow show \
        --workflow-id "${WORKFLOW_ID}" \
        --output json 2>/dev/null || echo '{"events":[]}')
    local completed_activities=$(echo "$history" | jq '[.events[] | select(.activityTaskCompletedEventAttributes != null)] | length')
    
    if [ "$pending_activities" -gt 0 ]; then
        log_info "✓ Activity is pending/retrying (${pending_activities} activities)"
    elif [ "$completed_activities" -gt 0 ]; then
        log_info "✓ Activity completed (${completed_activities} activities)"
    else
        log_error "No activities found - workflow may have failed before activity execution"
        exit 1
    fi
}

# Main test execution
main() {
    log_info "==================================="
    log_info "Email Intake Workflow Smoke Test"
    log_info "==================================="
    log_info ""
    log_warn "NOTE: This test expects Core API to be unavailable."
    log_warn "The workflow will fail at file upload stage - this is expected."
    log_info ""
    
    check_prerequisites
    create_test_company
    send_webhook
    wait_for_workflow
    verify_s3_archival
    verify_workflow_execution
    
    log_info ""
    log_info "==================================="
    log_info "✅ SMOKE TEST PASSED"
    log_info "==================================="
    log_info "Workflow ID: ${WORKFLOW_ID}"
    log_info "Company ID: ${TEST_COMPANY_ID}"
    log_info "Billing Token: ${TEST_TOKEN}"
    log_info "Message ID: ${TEST_MESSAGE_ID}"
    log_info ""
    log_info "View workflow in Temporal UI:"
    log_info "  http://localhost:8233/namespaces/default/workflows/${WORKFLOW_ID}"
}

# Run main function
main "$@"
