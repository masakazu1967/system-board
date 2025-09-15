#!/bin/bash

set -euo pipefail

# System Board Loki Maintenance Script
# Handles log rotation, cleanup, backup, and monitoring

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOGS_DIR="$PROJECT_ROOT/logs"
BACKUP_DIR="$PROJECT_ROOT/backups/loki"
CONFIG_DIR="$PROJECT_ROOT/config"

# Configuration
RETENTION_DAYS=${RETENTION_DAYS:-30}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
LOG_SIZE_THRESHOLD_MB=${LOG_SIZE_THRESHOLD_MB:-100}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

# Check if Loki is running
check_loki_status() {
    if curl -s -f "http://localhost:3100/ready" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Rotate log files
rotate_logs() {
    log_info "Starting log rotation..."

    # Find log files larger than threshold
    find "$LOGS_DIR" -name "*.log" -type f -size "+${LOG_SIZE_THRESHOLD_MB}M" | while read -r log_file; do
        log_info "Rotating large log file: $(basename "$log_file")"

        # Create timestamped backup
        timestamp=$(date +%Y%m%d_%H%M%S)
        backup_file="${log_file}.${timestamp}"

        mv "$log_file" "$backup_file"
        touch "$log_file"

        # Compress the backup
        gzip "$backup_file"
        log_info "Compressed rotated log: ${backup_file}.gz"
    done

    # Remove old rotated logs
    find "$LOGS_DIR" -name "*.log.*.gz" -mtime +$RETENTION_DAYS -delete
    log_info "Log rotation completed"
}

# Clean up old Loki data
cleanup_loki_data() {
    log_info "Starting Loki data cleanup..."

    if ! check_loki_status; then
        log_warn "Loki is not running, skipping data cleanup"
        return 0
    fi

    # Calculate retention timestamp (30 days ago)
    retention_timestamp=$(date -d "-${RETENTION_DAYS} days" +%s)
    retention_ns="${retention_timestamp}000000000"  # Convert to nanoseconds

    # Use Loki's delete API to remove old data
    delete_response=$(curl -s -X POST \
        "http://localhost:3100/loki/api/v1/delete" \
        -H "Content-Type: application/json" \
        -d "{
            \"query\": \"{job=\\\"system-board\\\"}\",
            \"start\": \"0\",
            \"end\": \"${retention_ns}\"
        }" || echo "delete_failed")

    if [[ "$delete_response" == *"delete_failed"* ]]; then
        log_warn "Loki data cleanup may have failed"
    else
        log_info "Loki data cleanup completed successfully"
    fi
}

# Backup Loki data and configuration
backup_loki() {
    log_info "Starting Loki backup..."

    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_name="loki_backup_${timestamp}"
    backup_path="$BACKUP_DIR/$backup_name"

    mkdir -p "$backup_path"

    # Backup Loki data volume
    if docker volume inspect system-board_loki_data > /dev/null 2>&1; then
        log_info "Backing up Loki data volume..."
        docker run --rm \
            -v system-board_loki_data:/data \
            -v "$backup_path":/backup \
            alpine \
            tar czf /backup/loki_data.tar.gz -C /data .

        log_info "Loki data backed up to: $backup_path/loki_data.tar.gz"
    else
        log_warn "Loki data volume not found"
    fi

    # Backup configuration files
    log_info "Backing up configuration files..."
    tar czf "$backup_path/loki_config.tar.gz" -C "$PROJECT_ROOT" config/

    # Backup application logs
    if [ -d "$LOGS_DIR" ] && [ "$(ls -A "$LOGS_DIR")" ]; then
        log_info "Backing up application logs..."
        tar czf "$backup_path/app_logs.tar.gz" -C "$PROJECT_ROOT" logs/
    fi

    # Create backup manifest
    cat > "$backup_path/manifest.json" << EOF
{
    "backup_date": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "retention_days": $RETENTION_DAYS,
    "loki_version": "$(docker image inspect grafana/loki:3.1.0 --format '{{.Config.Labels.version}}' 2>/dev/null || echo 'unknown')",
    "files": [
        "loki_data.tar.gz",
        "loki_config.tar.gz",
        "app_logs.tar.gz"
    ],
    "total_size_mb": $(du -sm "$backup_path" | cut -f1)
}
EOF

    log_info "Backup completed: $backup_path"

    # Clean up old backups
    find "$BACKUP_DIR" -type d -name "loki_backup_*" -mtime +$BACKUP_RETENTION_DAYS -exec rm -rf {} +
    log_info "Old backups cleaned up (retention: ${BACKUP_RETENTION_DAYS} days)"
}

# Monitor Loki health and performance
monitor_loki() {
    log_info "Monitoring Loki health and performance..."

    if ! check_loki_status; then
        log_error "Loki is not running or not responding"
        return 1
    fi

    # Get Loki metrics
    metrics=$(curl -s "http://localhost:3100/metrics" 2>/dev/null || echo "")

    if [ -z "$metrics" ]; then
        log_warn "Could not retrieve Loki metrics"
        return 1
    fi

    # Parse key metrics
    ingestion_rate=$(echo "$metrics" | grep "loki_distributor_ingester_appends_total" | tail -1 | awk '{print $2}' || echo "0")
    query_duration=$(echo "$metrics" | grep "loki_logql_querystats_duration_seconds" | grep "quantile=\"0.99\"" | awk '{print $2}' || echo "0")
    active_streams=$(echo "$metrics" | grep "loki_ingester_streams" | tail -1 | awk '{print $2}' || echo "0")

    log_info "Loki Performance Metrics:"
    log_info "  Ingestion Rate: $ingestion_rate logs/sec"
    log_info "  99th Percentile Query Duration: ${query_duration}s"
    log_info "  Active Streams: $active_streams"

    # Check disk usage
    if command -v docker &> /dev/null; then
        volume_size=$(docker system df -v | grep "system-board_loki_data" | awk '{print $3}' || echo "unknown")
        log_info "  Loki Data Volume Size: $volume_size"
    fi

    # Check for high error rates
    error_rate=$(echo "$metrics" | grep "loki_distributor_lines_received_total" | grep "status=\"error\"" | awk '{print $2}' || echo "0")
    total_rate=$(echo "$metrics" | grep "loki_distributor_lines_received_total" | grep -v "status=" | awk '{print $2}' || echo "1")

    if [ "$total_rate" != "0" ] && [ "$total_rate" != "1" ]; then
        error_percentage=$(awk "BEGIN {printf \"%.2f\", ($error_rate / $total_rate) * 100}")
        log_info "  Error Rate: ${error_percentage}%"

        if (( $(echo "$error_percentage > 5.0" | bc -l) )); then
            log_warn "High error rate detected: ${error_percentage}%"
        fi
    fi
}

# Optimize Loki performance
optimize_loki() {
    log_info "Running Loki optimization..."

    if ! check_loki_status; then
        log_warn "Loki is not running, skipping optimization"
        return 0
    fi

    # Trigger compaction
    log_info "Triggering Loki compaction..."
    curl -s -X POST "http://localhost:3100/loki/api/v1/flush" > /dev/null 2>&1 || log_warn "Compaction trigger may have failed"

    # Clear query cache if needed
    log_info "Clearing query cache..."
    curl -s -X POST "http://localhost:3100/loki/api/v1/delete_cache" > /dev/null 2>&1 || log_debug "Cache clear endpoint may not be available"

    log_info "Optimization completed"
}

# Generate maintenance report
generate_report() {
    log_info "Generating maintenance report..."

    report_file="$PROJECT_ROOT/maintenance_report_$(date +%Y%m%d_%H%M%S).txt"

    cat > "$report_file" << EOF
System Board Loki Maintenance Report
Generated: $(date)

=== System Status ===
Loki Status: $(check_loki_status && echo "HEALTHY" || echo "UNHEALTHY")
Docker Containers:
$(docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yaml" ps loki promtail grafana prometheus 2>/dev/null || echo "Could not retrieve container status")

=== Disk Usage ===
Logs Directory: $(du -sh "$LOGS_DIR" 2>/dev/null | cut -f1 || echo "unknown")
Backup Directory: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "unknown")
Available Disk Space: $(df -h "$PROJECT_ROOT" | tail -1 | awk '{print $4}')

=== Log File Summary ===
$(find "$LOGS_DIR" -name "*.log" -type f -exec ls -lh {} \; 2>/dev/null | head -20)

=== Recent Backups ===
$(find "$BACKUP_DIR" -name "loki_backup_*" -type d -exec ls -ld {} \; 2>/dev/null | sort -r | head -5)

=== Configuration Status ===
Loki Config: $([ -f "$CONFIG_DIR/loki/local-config.yaml" ] && echo "EXISTS" || echo "MISSING")
Promtail Config: $([ -f "$CONFIG_DIR/promtail/config.yml" ] && echo "EXISTS" || echo "MISSING")
Grafana Config: $([ -f "$CONFIG_DIR/grafana/provisioning/datasources/datasources.yml" ] && echo "EXISTS" || echo "MISSING")

=== Recommendations ===
EOF

    # Add recommendations based on analysis
    if [ "$(du -sm "$LOGS_DIR" 2>/dev/null | cut -f1 || echo 0)" -gt 1000 ]; then
        echo "- Consider increasing log rotation frequency (logs directory > 1GB)" >> "$report_file"
    fi

    if [ "$(find "$BACKUP_DIR" -name "loki_backup_*" -type d | wc -l)" -gt 10 ]; then
        echo "- Consider reducing backup retention period (more than 10 backups)" >> "$report_file"
    fi

    log_info "Maintenance report generated: $report_file"
}

# Main function
run_maintenance() {
    log_info "Starting System Board Loki maintenance..."

    case "${1:-all}" in
        "rotate")
            rotate_logs
            ;;
        "cleanup")
            cleanup_loki_data
            ;;
        "backup")
            backup_loki
            ;;
        "monitor")
            monitor_loki
            ;;
        "optimize")
            optimize_loki
            ;;
        "report")
            generate_report
            ;;
        "all")
            rotate_logs
            cleanup_loki_data
            backup_loki
            monitor_loki
            optimize_loki
            generate_report
            ;;
        *)
            echo "Usage: $0 [rotate|cleanup|backup|monitor|optimize|report|all]"
            exit 1
            ;;
    esac

    log_info "Maintenance operation completed"
}

# Execute based on command line arguments
run_maintenance "${1:-all}"