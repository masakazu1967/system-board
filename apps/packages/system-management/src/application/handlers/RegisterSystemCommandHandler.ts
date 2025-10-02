import { Injectable, Logger } from '@nestjs/common';
import type { EventPublisher } from 'shared';
import { RegisterSystemCommand } from '../commands/RegisterSystemCommand';
import { System } from '../../domain/aggregates/System';
import { SystemName } from '../../domain/value-objects/SystemName';
import { SystemType, SystemTypeHelper } from '../../domain/value-objects/SystemType';
import { HostConfiguration } from '../../domain/value-objects/HostConfiguration';
import { SystemPackages } from '../../domain/value-objects/SystemPackages';
import { Package } from '../../domain/value-objects/Package';
import {
  SecurityClassification,
  SecurityClassificationHelper,
} from '../../domain/value-objects/SecurityClassification';
import { CriticalityLevel } from '../../domain/value-objects/CriticalityLevel';
import { SystemId } from '../../domain/value-objects/SystemId';

/**
 * RegisterSystem Command Handler
 * システム新規登録コマンドハンドラー
 */
@Injectable()
export class RegisterSystemCommandHandler {
  private readonly logger = new Logger(RegisterSystemCommandHandler.name);

  constructor(
    private readonly eventPublisher: EventPublisher,
    // private readonly systemRepository: SystemRepository,
  ) {}

  async handle(command: RegisterSystemCommand): Promise<SystemId> {
    this.logger.debug('Handling RegisterSystemCommand', {
      name: command.name,
      correlationId: command.correlationId,
    });

    // Value Objects 作成
    const name = SystemName.create(command.name);
    const type = SystemTypeHelper.fromString(command.type);
    const host = HostConfiguration.create(command.host);
    const securityClassification = SecurityClassificationHelper.fromString(
      command.securityClassification,
    );
    const criticality = CriticalityLevel.create(command.criticality);

    // Packages 作成
    const packages = SystemPackages.fromArray(
      command.packages.map((p) =>
        Package.create({
          name: p.name,
          version: p.version,
          dependencies: p.dependencies,
          vulnerabilities: p.vulnerabilities,
        }),
      ),
    );

    // System 集約を作成
    const system = System.register(
      name,
      type,
      host,
      packages,
      securityClassification,
      criticality,
      command.correlationId,
    );

    // 未コミットのイベントを取得して発行（Kafka First）
    const events = system.getUncommittedEvents();
    await this.eventPublisher.publishAll(events);

    // イベントをコミット済みとしてマーク
    system.markEventsAsCommitted();

    // TODO: リポジトリに保存（現時点ではスキップ）
    // await this.systemRepository.save(system);

    this.logger.log('System registered successfully', {
      systemId: system.getIdValue(),
      name: name.getValue(),
      correlationId: command.correlationId,
    });

    return system.getId();
  }
}
