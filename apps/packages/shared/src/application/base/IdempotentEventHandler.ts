import { Injectable, Logger } from '@nestjs/common';
import { DomainEvent } from '../../domain/base/DomainEvent';
import type { ProcessedEventService } from '../interfaces/ProcessedEventService';

/**
 * Idempotent Event Handler
 * 冪等性を保証するイベントハンドラー
 */
@Injectable()
export class IdempotentEventHandler {
  private readonly logger = new Logger(IdempotentEventHandler.name);

  constructor(private readonly processedEventService: ProcessedEventService) {}

  /**
   * 冪等性を保証してイベントを処理
   */
  async handleWithIdempotency<T extends DomainEvent>(
    event: T,
    handler: (event: T) => Promise<void>,
  ): Promise<void> {
    // 処理済みイベントチェック
    const isProcessed = await this.processedEventService.isProcessed(
      event.eventId,
    );

    if (isProcessed) {
      this.logger.debug('Event already processed, skipping', {
        eventId: event.eventId,
        eventType: event.eventType,
      });
      return;
    }

    try {
      // イベント処理実行
      await handler(event);

      // 処理済みマーク
      await this.processedEventService.markAsProcessed(
        event.eventId,
        event.eventType,
        new Date(),
      );

      this.logger.debug('Event processed successfully', {
        eventId: event.eventId,
        eventType: event.eventType,
      });
    } catch (error) {
      this.logger.error('Event processing failed', {
        eventId: event.eventId,
        eventType: event.eventType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
