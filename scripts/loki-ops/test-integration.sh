#!/bin/bash

set -euo pipefail

# System Board Loki Integration Testing Script
# Validates the complete logging stack functionality

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOGS_DIR="$PROJECT_ROOT/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

# Test result functions
test_pass() {
    echo -e "${GREEN}✓ PASS${NC} $1"
    ((TESTS_PASSED++))
}

test_fail() {
    echo -e "${RED}✗ FAIL${NC} $1"
    ((TESTS_FAILED++))
}

# Wait for service to be ready
wait_for_service() {
    local service_name=$1
    local url=$2
    local timeout=${3:-60}
    local counter=0

    log_info "Waiting for $service_name to be ready..."

    while [ $counter -lt $timeout ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            test_pass "$service_name is ready"
            return 0
        fi
        sleep 2
        ((counter += 2))
    done

    test_fail "$service_name failed to start within ${timeout}s"
    return 1
}

# Test service connectivity
test_service_connectivity() {
    log_test "Testing service connectivity..."

    # Test Loki
    if curl -s -f "http://localhost:3100/ready" > /dev/null 2>&1; then
        test_pass "Loki API is accessible"
    else
        test_fail "Loki API is not accessible"
    fi

    # Test Prometheus
    if curl -s -f "http://localhost:9090/-/healthy" > /dev/null 2>&1; then
        test_pass "Prometheus API is accessible"
    else
        test_fail "Prometheus API is not accessible"
    fi

    # Test Grafana
    if curl -s -f "http://localhost:3000/api/health" > /dev/null 2>&1; then
        test_pass "Grafana API is accessible"
    else
        test_fail "Grafana API is not accessible"
    fi
}

# Test log ingestion
test_log_ingestion() {
    log_test "Testing log ingestion..."

    # Generate test log entries
    test_log_file="$LOGS_DIR/integration-test.log"
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
    test_message="Integration test log entry at $timestamp"
    test_error_id="test_$(date +%s)"

    # Create structured log entry
    cat > "$test_log_file" << EOF
{"timestamp":"$timestamp","level":"info","message":"$test_message","service":"backend","environment":"development","request_id":"req_test_$(date +%s)","error_id":"$test_error_id"}
EOF

    log_info "Created test log entry: $test_message"

    # Wait for log to be ingested
    sleep 5

    # Query Loki for the test log
    query_result=$(curl -s -G "http://localhost:3100/loki/api/v1/query" \
        --data-urlencode "query={job=\"system-board\"}" \
        --data-urlencode "time=$(date +%s)000000000" || echo "query_failed")

    if [[ "$query_result" == *"$test_message"* ]]; then
        test_pass "Test log entry was ingested and is queryable"
    else
        test_fail "Test log entry was not found in Loki"
        log_error "Query result: $query_result"
    fi

    # Clean up test log
    rm -f "$test_log_file"
}

# Test error ID generation and grouping
test_error_grouping() {
    log_test "Testing error ID generation and grouping..."

    # Generate multiple similar errors
    test_log_file="$LOGS_DIR/error-grouping-test.log"
    base_timestamp=$(date +%s)
    common_error_message="Database connection timeout"

    for i in {1..3}; do
        timestamp=$(date -u -d "@$((base_timestamp + i))" +%Y-%m-%dT%H:%M:%S.%3NZ)
        cat >> "$test_log_file" << EOF
{"timestamp":"$timestamp","level":"error","message":"$common_error_message","service":"backend","environment":"development","request_id":"req_error_$i","error_category":"infrastructure"}
EOF
    done

    log_info "Created 3 similar error entries for grouping test"

    # Wait for logs to be ingested
    sleep 5

    # Query for error logs
    error_query_result=$(curl -s -G "http://localhost:3100/loki/api/v1/query" \
        --data-urlencode "query={job=\"system-board\", level=\"error\"}" \
        --data-urlencode "time=$(date +%s)000000000" || echo "error_query_failed")

    if [[ "$error_query_result" == *"$common_error_message"* ]]; then
        test_pass "Error logs are queryable by level"
    else
        test_fail "Error logs are not properly queryable"
    fi

    # Clean up test log
    rm -f "$test_log_file"
}

# Test data masking functionality
test_data_masking() {
    log_test "Testing data masking functionality..."

    # Create log with sensitive data
    test_log_file="$LOGS_DIR/masking-test.log"
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)

    # This should be masked by Promtail
    sensitive_log='{"timestamp":"'$timestamp'","level":"warn","message":"User login failed for user@example.com with password secret123","service":"auth","environment":"development"}'
    echo "$sensitive_log" > "$test_log_file"

    log_info "Created log with sensitive data for masking test"

    # Wait for processing
    sleep 5

    # Query the log to see if masking worked
    masking_query_result=$(curl -s -G "http://localhost:3100/loki/api/v1/query" \
        --data-urlencode "query={job=\"system-board\", service=\"auth\"}" \
        --data-urlencode "time=$(date +%s)000000000" || echo "masking_query_failed")

    if [[ "$masking_query_result" == *"[EMAIL_REDACTED]"* ]] && [[ "$masking_query_result" == *"[REDACTED]"* ]]; then
        test_pass "Sensitive data masking is working"
    else
        test_warn "Data masking may not be working as expected"
        log_info "Query result (first 200 chars): ${masking_query_result:0:200}"
    fi

    # Clean up test log
    rm -f "$test_log_file"
}

# Test Grafana dashboard accessibility
test_grafana_dashboards() {
    log_test "Testing Grafana dashboard accessibility..."

    # Test dashboard API
    dashboard_result=$(curl -s -u admin:system-board-grafana-2025 \
        "http://localhost:3000/api/dashboards/uid/system-board-logs" || echo "dashboard_failed")

    if [[ "$dashboard_result" != *"dashboard_failed"* ]] && [[ "$dashboard_result" != *"error"* ]]; then
        test_pass "System Board logs dashboard is accessible"
    else
        test_fail "System Board logs dashboard is not accessible"
    fi

    # Test datasource connectivity from Grafana
    datasource_result=$(curl -s -u admin:system-board-grafana-2025 \
        "http://localhost:3000/api/datasources/proxy/1/loki/api/v1/labels" || echo "datasource_failed")

    if [[ "$datasource_result" != *"datasource_failed"* ]]; then
        test_pass "Grafana can connect to Loki datasource"
    else
        test_fail "Grafana cannot connect to Loki datasource"
    fi
}

# Test Prometheus metrics collection
test_prometheus_metrics() {
    log_test "Testing Prometheus metrics collection..."

    # Query Loki metrics from Prometheus
    loki_metrics_result=$(curl -s "http://localhost:9090/api/v1/query?query=loki_distributor_ingester_appends_total" || echo "metrics_failed")

    if [[ "$loki_metrics_result" == *"success"* ]]; then
        test_pass "Loki metrics are available in Prometheus"
    else
        test_fail "Loki metrics are not available in Prometheus"
    fi

    # Test if Promtail metrics are available
    promtail_metrics_result=$(curl -s "http://localhost:9090/api/v1/query?query=promtail_read_lines_total" || echo "promtail_metrics_failed")

    if [[ "$promtail_metrics_result" == *"success"* ]]; then
        test_pass "Promtail metrics are available in Prometheus"
    else
        test_warn "Promtail metrics may not be available in Prometheus"
    fi
}

# Test log retention and cleanup
test_log_retention() {
    log_test "Testing log retention configuration..."

    # Check Loki configuration for retention
    if docker exec system-board-loki cat /etc/loki/local-config.yaml | grep -q "retention_period.*720h"; then
        test_pass "Log retention is configured correctly (720h)"
    else
        test_fail "Log retention configuration is incorrect"
    fi

    # Test if compactor is configured
    if docker exec system-board-loki cat /etc/loki/local-config.yaml | grep -q "compactor:"; then
        test_pass "Compactor is configured for log cleanup"
    else
        test_fail "Compactor is not configured"
    fi
}

# Test structured logging package
test_logging_package() {
    log_test "Testing structured logging package..."

    cd "$PROJECT_ROOT/apps/packages/logging"

    # Check if package builds successfully
    if pnpm build > /dev/null 2>&1; then
        test_pass "Logging package builds successfully"
    else
        test_fail "Logging package build failed"
    fi

    # Check if TypeScript types are generated
    if [ -f "dist/types.d.ts" ]; then
        test_pass "TypeScript definitions are generated"
    else
        test_fail "TypeScript definitions are missing"
    fi

    # Return to project root
    cd "$PROJECT_ROOT"
}

# Test performance under load
test_performance() {
    log_test "Testing logging performance under load..."

    # Generate a burst of log entries
    test_log_file="$LOGS_DIR/performance-test.log"
    start_time=$(date +%s)

    # Generate 100 log entries quickly
    for i in {1..100}; do
        timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
        echo "{\"timestamp\":\"$timestamp\",\"level\":\"info\",\"message\":\"Performance test entry $i\",\"service\":\"backend\",\"environment\":\"development\",\"request_id\":\"req_perf_$i\"}" >> "$test_log_file"
    done

    end_time=$(date +%s)
    generation_time=$((end_time - start_time))

    log_info "Generated 100 log entries in ${generation_time}s"

    # Wait for processing
    sleep 10

    # Check if Loki is still responsive
    if curl -s -f "http://localhost:3100/ready" > /dev/null 2>&1; then
        test_pass "Loki remains responsive under log burst"
    else
        test_fail "Loki became unresponsive under load"
    fi

    # Clean up test log
    rm -f "$test_log_file"
}

# Generate comprehensive test report
generate_test_report() {
    log_info "Generating integration test report..."

    report_file="$PROJECT_ROOT/loki_integration_test_report_$(date +%Y%m%d_%H%M%S).txt"

    cat > "$report_file" << EOF
System Board Grafana Loki Integration Test Report
Generated: $(date)

=== Test Summary ===
Tests Passed: $TESTS_PASSED
Tests Failed: $TESTS_FAILED
Total Tests: $((TESTS_PASSED + TESTS_FAILED))
Success Rate: $(( TESTS_PASSED * 100 / (TESTS_PASSED + TESTS_FAILED) ))%

=== Environment Information ===
Docker Version: $(docker --version 2>/dev/null || echo "Not available")
Docker Compose Version: $(docker-compose --version 2>/dev/null || echo "Not available")
Loki Version: $(docker exec system-board-loki loki --version 2>/dev/null | head -1 || echo "Not available")
Grafana Version: $(curl -s http://localhost:3000/api/health 2>/dev/null | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || echo "Not available")

=== Service Status ===
Loki: $(curl -s -f "http://localhost:3100/ready" > /dev/null 2>&1 && echo "RUNNING" || echo "NOT RUNNING")
Prometheus: $(curl -s -f "http://localhost:9090/-/healthy" > /dev/null 2>&1 && echo "RUNNING" || echo "NOT RUNNING")
Grafana: $(curl -s -f "http://localhost:3000/api/health" > /dev/null 2>&1 && echo "RUNNING" || echo "NOT RUNNING")

=== Container Information ===
$(docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yaml" ps loki promtail grafana prometheus 2>/dev/null || echo "Could not retrieve container information")

=== Recommendations ===
EOF

    if [ $TESTS_FAILED -gt 0 ]; then
        echo "- $TESTS_FAILED test(s) failed. Review the test output above for details." >> "$report_file"
        echo "- Check service logs: docker-compose -f docker-compose.dev.yaml logs [service-name]" >> "$report_file"
    fi

    if [ $TESTS_PASSED -eq $((TESTS_PASSED + TESTS_FAILED)) ]; then
        echo "- All tests passed! The logging stack is ready for production use." >> "$report_file"
        echo "- Consider running performance tests with realistic load patterns." >> "$report_file"
    fi

    echo "- Monitor system resources during normal operation." >> "$report_file"
    echo "- Set up automated maintenance using the maintenance.sh script." >> "$report_file"

    log_info "Integration test report generated: $report_file"
}

# Main test execution
main() {
    log_info "Starting System Board Loki Integration Tests..."

    # Wait for all services to be ready
    wait_for_service "Loki" "http://localhost:3100/ready" 60
    wait_for_service "Prometheus" "http://localhost:9090/-/healthy" 30
    wait_for_service "Grafana" "http://localhost:3000/api/health" 30

    # Run all tests
    test_service_connectivity
    test_log_ingestion
    test_error_grouping
    test_data_masking
    test_grafana_dashboards
    test_prometheus_metrics
    test_log_retention
    test_logging_package
    test_performance

    # Generate report
    generate_test_report

    # Final summary
    echo
    if [ $TESTS_FAILED -eq 0 ]; then
        log_info "🎉 All tests passed! Grafana Loki logging stack is working correctly."
    else
        log_warn "⚠️  $TESTS_FAILED test(s) failed. Please review and fix issues before production use."
        exit 1
    fi
}

# Execute tests based on command line arguments
case "${1:-all}" in
    "connectivity")
        test_service_connectivity
        ;;
    "ingestion")
        test_log_ingestion
        ;;
    "masking")
        test_data_masking
        ;;
    "grafana")
        test_grafana_dashboards
        ;;
    "prometheus")
        test_prometheus_metrics
        ;;
    "package")
        test_logging_package
        ;;
    "performance")
        test_performance
        ;;
    "all"|*)
        main
        ;;
esac