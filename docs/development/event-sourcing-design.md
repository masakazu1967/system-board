# Event Sourcing Design

このドキュメントはSystem Boardプロジェクトのイベントソーシング設計をPlantUMLで視覚化します。

## Overview

System Boardでは以下のBounded Contextでイベントソーシングを実装します：

- **System Management Context**: システム・パッケージの管理
- **Vulnerability Management Context**: 脆弱性・評価の管理
- **Task Management Context**: タスク・ワークフローの管理
- **Relationship Management Context**: 依存関係の管理

## System Management Context Events

```plantuml
@startuml SystemManagementEvents
!theme plain

participant "UI" as UI
participant "Command Handler" as CH
participant "System Aggregate" as SA
participant "Event Store" as ES
participant "Read Model" as RM

== System Registration ==
UI -> CH: RegisterSystemCommand
CH -> SA: RegisterSystem()
SA -> ES: SystemRegisteredEvent
ES -> RM: Update System Read Model

== Package Addition ==
UI -> CH: AddPackageCommand
CH -> SA: AddPackage()
SA -> ES: PackageAddedEvent
ES -> RM: Update Package Read Model

== EOL Status Update ==
UI -> CH: UpdateEOLStatusCommand
CH -> SA: UpdateEOLStatus()
SA -> ES: EOLStatusUpdatedEvent
ES -> RM: Update EOL Read Model

@enduml
```

## Vulnerability Management Context Events

```plantuml
@startuml VulnerabilityManagementEvents
!theme plain

participant "CVE Scanner" as CVE
participant "Command Handler" as CH
participant "Vulnerability Aggregate" as VA
participant "Event Store" as ES
participant "Read Model" as RM

== Vulnerability Detection ==
CVE -> CH: DetectVulnerabilityCommand
CH -> VA: DetectVulnerability()
VA -> ES: VulnerabilityDetectedEvent
ES -> RM: Update Vulnerability Read Model

== Risk Assessment ==
UI -> CH: AssessRiskCommand
CH -> VA: AssessRisk()
VA -> ES: RiskAssessedEvent
ES -> RM: Update Risk Assessment Read Model

== Mitigation Planning ==
UI -> CH: PlanMitigationCommand
CH -> VA: PlanMitigation()
VA -> ES: MitigationPlannedEvent
ES -> RM: Update Mitigation Read Model

@enduml
```

## Task Management Context Events

```plantuml
@startuml TaskManagementEvents
!theme plain

participant "User" as U
participant "Command Handler" as CH
participant "Task Aggregate" as TA
participant "Event Store" as ES
participant "Read Model" as RM

== Task Creation ==
U -> CH: CreateTaskCommand
CH -> TA: CreateTask()
TA -> ES: TaskCreatedEvent
ES -> RM: Update Task Read Model

== Task Assignment ==
U -> CH: AssignTaskCommand
CH -> TA: AssignTask()
TA -> ES: TaskAssignedEvent
ES -> RM: Update Assignment Read Model

== Task Completion ==
U -> CH: CompleteTaskCommand
CH -> TA: CompleteTask()
TA -> ES: TaskCompletedEvent
ES -> RM: Update Task Status Read Model

@enduml
```

## Cross-Context Event Flow

```plantuml
@startuml CrossContextEventFlow
!theme plain

participant "Vulnerability Context" as VC
participant "Event Bus" as EB
participant "Task Context" as TC
participant "System Context" as SC

== Vulnerability Detection Triggers Task Creation ==
VC -> EB: VulnerabilityDetectedEvent
EB -> TC: Handle VulnerabilityDetectedEvent
TC -> TC: CreateMitigationTask()
TC -> EB: TaskCreatedEvent

== System EOL Triggers Vulnerability Scan ==
SC -> EB: EOLStatusUpdatedEvent
EB -> VC: Handle EOLStatusUpdatedEvent
VC -> VC: TriggerVulnerabilityScan()
VC -> EB: VulnerabilityScanTriggeredEvent

@enduml
```

## Event Store Schema

```plantuml
@startuml KurrentSchema
!theme plain

class Kurrent {
  +stream_id: UUID
  +event_type: String
  +event_data: JSONB
  +event_metadata: JSONB
  +event_version: Integer
  +created_at: Timestamp
}

class StreamMetadata {
  +stream_id: UUID
  +stream_version: Integer
  +stream_type: String
  +created_at: Timestamp
  +updated_at: Timestamp
}

class Snapshot {
  +aggregate_id: UUID
  +aggregate_type: String
  +snapshot_data: JSONB
  +snapshot_version: Integer
  +created_at: Timestamp
}

Kurrent ||--|| StreamMetadata
Kurrent ||--o{ Snapshot

@enduml
```

## Read Model Projections

```plantuml
@startuml ReadModelProjections
!theme plain

participant "Event Store" as ES
participant "Projection Engine" as PE
participant "System Read Model" as SRM
participant "Vulnerability Read Model" as VRM
participant "Task Read Model" as TRM

ES -> PE: SystemRegisteredEvent
PE -> SRM: Update System View

ES -> PE: VulnerabilityDetectedEvent
PE -> VRM: Update Vulnerability View
PE -> TRM: Create Mitigation Task View

ES -> PE: TaskCompletedEvent
PE -> TRM: Update Task Status View
PE -> VRM: Update Mitigation Status

@enduml
```

## Saga Orchestration Pattern

```plantuml
@startuml SagaOrchestration
!theme plain

participant "Vulnerability Detected" as VD
participant "Mitigation Saga" as MS
participant "Task Context" as TC
participant "Notification Context" as NC
participant "System Context" as SC

VD -> MS: VulnerabilityDetectedEvent
MS -> TC: CreateMitigationTaskCommand
TC -> MS: TaskCreatedEvent
MS -> NC: SendNotificationCommand
NC -> MS: NotificationSentEvent
MS -> SC: UpdateSystemRiskCommand
SC -> MS: SystemRiskUpdatedEvent
MS -> MS: CompleteSaga()

@enduml
```
