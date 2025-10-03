import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessedEventService } from '../../application/interfaces/ProcessedEventService';
import { ProcessedEvent } from './entities/ProcessedEvent.entity';
import type { TypeOrmErrorHandler } from './utils/TypeOrmErrorHandler';
import { TYPEORM_ERROR_HANDLER } from './utils/TypeormErrorHandlerProvider';

/**
 * TypeOrm Processed Event Service
 * 処理済みイベント管理（冪等性保証）
 */
@Injectable()
export class TypeOrmProcessedEventService implements ProcessedEventService {
  private readonly logger = new Logger(TypeOrmProcessedEventService.name);

  constructor(
    @InjectRepository(ProcessedEvent)
    private readonly processedEventRepository: Repository<ProcessedEvent>,
    @Inject(TYPEORM_ERROR_HANDLER)
    private readonly errorHandler: TypeOrmErrorHandler,
  ) {}

  async isProcessed(eventId: string): Promise<boolean> {
    this.logger.debug(`Checking if event ${eventId} is processed`);

    const event = await this.processedEventRepository.findOne({
      where: { eventId },
    });

    return event !== null;
  }

  async markAsProcessed(
    eventId: string,
    eventType: string,
    processedAt: Date,
  ): Promise<void> {
    this.logger.debug(`Marking event ${eventId} as processed`, {
      eventType,
      processedAt,
    });

    try {
      await this.processedEventRepository.insert({
        eventId,
        eventType,
        processedAt,
      });
    } catch (error: unknown) {
      // ON CONFLICT DO NOTHING の動作: UNIQUE制約エラーは無視（冪等性保証）
      this.errorHandler.handleUniqueConstraintError(error, eventId, true);
    }
  }
}
