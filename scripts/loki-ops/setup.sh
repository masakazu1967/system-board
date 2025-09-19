#!/bin/bash

set -euo pipefail

# System Board Grafana Loki Setup Script
# This script sets up the complete Grafana Loki logging stack

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_DIR="$PROJECT_ROOT/config"
LOGS_DIR="$PROJECT_ROOT/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi

    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed or not in PATH"
        exit 1
    fi

    log_info "Prerequisites check passed"
}

# Create necessary directories
create_directories() {
    log_info "Creating necessary directories..."

    # Create configuration directories
    mkdir -p "$CONFIG_DIR"/{loki,promtail,grafana/{provisioning/{datasources,dashboards},dashboards/json},prometheus}

    # Create logs directory with proper permissions
    mkdir -p "$LOGS_DIR"
    chmod 755 "$LOGS_DIR"

    # Create backup directory
    mkdir -p "$PROJECT_ROOT/backups/loki"

    log_info "Directories created successfully"
}

# Set up environment file
setup_environment() {
    log_info "Setting up environment configuration..."

    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        if [ -f "$PROJECT_ROOT/.env.example" ]; then
            cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
            log_info "Created .env file from .env.example"
        else
            log_warn ".env.example not found, creating basic .env file"
            cat > "$PROJECT_ROOT/.env" << EOF
# Database Configuration
POSTGRES_DB=system_board
POSTGRES_USER=system_board
POSTGRES_PASSWORD=system-board-dev-2025
POSTGRES_PORT=5432

# EventStore Configuration
EVENTSTORE_TCP_PORT=1113
EVENTSTORE_HTTP_PORT=2113

# Redis Configuration
REDIS_PORT=6379

# Kafka Configuration
KAFKA_PORT=9092
ZOOKEEPER_PORT=2181

# Grafana Loki Configuration
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=system-board-grafana-2025
LOKI_RETENTION_PERIOD=720h

# Monitoring Configuration
PROMETHEUS_PORT=9090
LOKI_PORT=3100
GRAFANA_PORT=3000

# Application Configuration
LOG_LEVEL=info
NODE_ENV=development
EOF
        fi
    else
        log_info ".env file already exists"
    fi
}

# Validate configuration files
validate_configuration() {
    log_info "Validating configuration files..."

    # Check Loki configuration
    if [ -f "$CONFIG_DIR/loki/local-config.yaml" ]; then
        log_info "Loki configuration found"
    else
        log_error "Loki configuration not found at $CONFIG_DIR/loki/local-config.yaml"
        exit 1
    fi

    # Check Promtail configuration
    if [ -f "$CONFIG_DIR/promtail/config.yml" ]; then
        log_info "Promtail configuration found"
    else
        log_error "Promtail configuration not found at $CONFIG_DIR/promtail/config.yml"
        exit 1
    fi

    # Check Prometheus configuration
    if [ -f "$CONFIG_DIR/prometheus/prometheus.yml" ]; then
        log_info "Prometheus configuration found"
    else
        log_error "Prometheus configuration not found at $CONFIG_DIR/prometheus/prometheus.yml"
        exit 1
    fi

    # Check Grafana configuration
    if [ -f "$CONFIG_DIR/grafana/provisioning/datasources/datasources.yml" ]; then
        log_info "Grafana datasource configuration found"
    else
        log_error "Grafana datasource configuration not found"
        exit 1
    fi

    log_info "Configuration validation passed"
}

# Start the logging stack
start_logging_stack() {
    log_info "Starting Grafana Loki logging stack..."

    cd "$PROJECT_ROOT"

    # Start the logging services
    docker-compose -f docker-compose.dev.yaml up -d loki promtail grafana prometheus

    # Wait for services to be ready
    log_info "Waiting for services to start..."
    sleep 10

    # Check service health
    check_service_health
}

# Check service health
check_service_health() {
    log_info "Checking service health..."

    # Check Loki
    if curl -s -f "http://localhost:3100/ready" > /dev/null 2>&1; then
        log_info "✓ Loki is healthy"
    else
        log_error "✗ Loki is not responding"
    fi

    # Check Prometheus
    if curl -s -f "http://localhost:9090/-/healthy" > /dev/null 2>&1; then
        log_info "✓ Prometheus is healthy"
    else
        log_error "✗ Prometheus is not responding"
    fi

    # Check Grafana
    if curl -s -f "http://localhost:3000/api/health" > /dev/null 2>&1; then
        log_info "✓ Grafana is healthy"
    else
        log_error "✗ Grafana is not responding"
    fi

    # Show running containers
    log_info "Running containers:"
    docker-compose -f docker-compose.dev.yaml ps loki promtail grafana prometheus
}

# Install logging package
install_logging_package() {
    log_info "Installing System Board logging package..."

    cd "$PROJECT_ROOT/apps/packages/logging"

    # Install dependencies
    pnpm install

    # Build the package
    pnpm build

    log_info "Logging package installed successfully"
}

# Display access information
show_access_info() {
    log_info "Setup completed successfully!"
    echo
    echo "Access Information:"
    echo "==================="
    echo "• Grafana Dashboard: http://localhost:3000"
    echo "  Username: admin"
    echo "  Password: system-board-grafana-2025"
    echo
    echo "• Prometheus: http://localhost:9090"
    echo "• Loki API: http://localhost:3100"
    echo
    echo "Log Files Location: $LOGS_DIR"
    echo
    echo "To test log ingestion, run:"
    echo "  echo 'Test log entry' > $LOGS_DIR/test.log"
    echo
    echo "To view logs in Grafana:"
    echo "  1. Open http://localhost:3000"
    echo "  2. Go to Explore"
    echo "  3. Select Loki datasource"
    echo "  4. Use query: {job=\"system-board\"}"
}

# Create test log entries
create_test_logs() {
    log_info "Creating test log entries..."

    # Create sample structured logs
    cat > "$LOGS_DIR/test-app.log" << EOF
{"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)","level":"info","message":"Application started","service":"backend","environment":"development","request_id":"req_test_001"}
{"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)","level":"warn","message":"High memory usage detected","service":"backend","environment":"development","error_id":"warn_memory_001","memory_usage_bytes":1073741824}
{"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)","level":"error","message":"Database connection failed","service":"backend","environment":"development","error_id":"err_db_connection_001","error_category":"infrastructure","stack_trace":"Error: Connection timeout"}
EOF

    log_info "Test logs created at $LOGS_DIR/test-app.log"
}

# Main execution
main() {
    log_info "Starting System Board Grafana Loki setup..."

    check_prerequisites
    create_directories
    setup_environment
    validate_configuration
    install_logging_package
    start_logging_stack
    create_test_logs
    show_access_info

    log_info "Setup completed successfully!"
}

# Handle script arguments
case "${1:-}" in
    "health")
        check_service_health
        ;;
    "test")
        create_test_logs
        ;;
    "install")
        install_logging_package
        ;;
    *)
        main
        ;;
esac