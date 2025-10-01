import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessedEventService } from '../../application/interfaces/ProcessedEventService';
import { ProcessedEvent } from './entities/ProcessedEvent.entity';

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
      // ON CONFLICT DO NOTHING の動作: 重複キーエラーは無視
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === '23505'
      ) {
        // PostgreSQL unique violation error code
        this.logger.debug(
          `Event ${eventId} already processed, skipping insert`,
        );
        return;
      }
      throw error;
    }
  }
}
