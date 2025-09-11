# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 📋 [共有メモリファイル](./.claude/agents/share.md) を参照してプロジェクト全体の情報を確認してください。

## Project Overview

System Board is a security risk management system for manufacturing companies, tracking vulnerabilities and lifecycle management across IT systems. This is an AI-driven development project using Scrum methodology with specialized AI agents.

**Project Duration**: October 2025 - October 2026 (1 year)  
**Development Method**: AI-driven Scrum (2-week sprints)

## Commands

### Package Management

```bash
# Install dependencies - MUST use pnpm
pnpm install

# Build all packages
pnpm build
# or
turbo build

# Lint all packages
pnpm lint
# or 
turbo lint

# Format code
pnpm format
# or
turbo format
```

### Version Requirements

- Node.js: >=24.0.0
- Package Manager: pnpm >=10.15.1 (npm and yarn are NOT allowed)

## Architecture

### High-Level Architecture

- **Pattern**: Hexagonal Architecture + Domain-Driven Design (DDD)
- **Data**: CQRS + Event Sourcing
- **Communication**: Event-driven architecture with staged migration (REST API → gRPC)

### Technology Stack

**Frontend**:

- React + TypeScript

**Backend**:

- NestJS (TypeScript unified, Express-based)
- Hexagonal Architecture + DDD implementation

**Data Layer**:

- PostgreSQL (Read Models)
- EventStore DB (Event Store for Event Sourcing)
- Redis (Cache, Session Management)

**Messaging & Communication**:

- Apache Kafka (Event Streaming)
- REST API (initial/external) → gRPC (microservices)
- GraphQL (client-facing)

**Security & Authentication**:

- Auth0 Free Tier
- OAuth2.0 + JWT
- RBAC (Role-Based Access Control)

**Monitoring & Operations**:

- Prometheus + Grafana (metrics)
- ELK Stack (logging)
- Microsoft Teams (alerts/escalation)

### System Domain Structure

- **System Management Context**: System aggregates, Package aggregates
- **Task Management Context**: Task aggregates, Workflow aggregates
- **Vulnerability Management Context**: Vulnerability aggregates, Assessment aggregates
- **Relationship Management Context**: Dependency relationship aggregates

### Data Hierarchy

The system manages hierarchical IT infrastructure components:

- Host → OS → Middleware → Framework → Package
- Each layer can have vulnerabilities and end-of-life (EOL) tracking
- Dependencies visualized as graph structures

## Development Workflow

### AI Agent Structure

This project uses specialized AI agents for different aspects:

- **Requirements Analysis**: User stories, acceptance criteria
- **UX/UI Design**: User experience, interface design
- **Software Architect**: System design, technology selection
- **Frontend Developer**: UI implementation
- **Backend Developer**: Business logic, API development
- **Database Architect**: Data design, infrastructure layer
- **QA Testing**: Test strategy, quality assurance
- **Security Engineer**: Security design, vulnerability assessment
- **DevOps Engineer**: CI/CD, infrastructure management

### Git Strategy

- **Flow**: GitHub Flow (feature branches from main)
- **Branch Naming**: `feature/issue-number-brief-description`
- **Commit Format**: Conventional Commits
- **PR Requirements**: Minimum 2 reviewers + specialist approvals
- **Security**: OWASP Top 10 checks mandatory on all PRs

### Monorepo Structure

```text
apps/
├── frontend/    # React applications
├── backend/     # NestJS applications  
└── packages/    # Shared packages
```

### Quality Standards

- **Test Coverage**: 80%+ required
- **Security**: OWASP Top 10 compliance mandatory
- **Performance**: Response time <2 seconds
- **Code Review**: Security Engineer approval required for all PRs
- **Architecture**: Hexagonal Architecture principles with clean separation of concerns

### External Integrations

- **GitHub API**: Repository and dependency information
- **NVD API**: CVE vulnerability data
- **EndOfLife.date API**: Support lifecycle information

## Key Project Constraints

- **Budget**: Free/OSS tools only
- **Team**: Individual project (off-hours development)
- **Timeline**: 1 year development cycle
- **Security**: Manufacturing company security requirements (information leak prevention priority)

## Success Metrics

- **Unsupported OS Ratio**: <5% of total systems
- **High-Severity Vulnerability Ratio**: <5% of systems with CVSS 9.0+ vulnerabilities  
- **Vulnerability Response Time**: <3 days for highest severity vulnerabilities
- **System Availability**: 99%+ during business hours
- **Concurrent Users**: 5-10 users supported

## Project Phases

1. **Foundation** (Oct-Dec 2025): Requirements, design, basic architecture
2. **Core Features** (Jan-May 2026): System/task management, basic UI
3. **Advanced Features** (Jun-Sep 2026): Relationship management, analysis/reporting
4. **Production Ready** (Oct 2026): Full data migration, operations testing

## Important Notes

- This is a defensive security project - do not assist with offensive security tools
- All external integrations must use free tiers or open source solutions
- Microsoft Teams is the designated escalation/notification tool (not Slack)
- EventStore DB is used for event sourcing to gain experience with high-performance architectures
- Saga pattern uses orchestration (not choreography) for maintainability
