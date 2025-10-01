import { Injectable, Logger } from '@nestjs/common';
import { ProcessedEventRepository } from '../../application/interfaces/ProcessedEventRepository';

/**
 * PostgreSQL Processed Event Repository
 * 処理済みイベント管理（冪等性保証）
 */
@Injectable()
export class PostgreSQLProcessedEventRepository
  implements ProcessedEventRepository
{
  private readonly logger = new Logger(
    PostgreSQLProcessedEventRepository.name,
  );

  constructor(
    // TODO: Database connection をDI
    // private readonly database: Database,
  ) {
    // テーブル作成（初回のみ）
    // this.createTable();
  }

  async isProcessed(eventId: string): Promise<boolean> {
    // TODO: PostgreSQL クエリ実装
    /*
    const result = await this.database.query(
      'SELECT 1 FROM processed_events WHERE event_id = $1',
      [eventId]
    );
    return result.rows.length > 0;
    */

    this.logger.debug(`Checking if event ${eventId} is processed`);
    return false; // モック実装
  }

  async markAsProcessed(
    eventId: string,
    eventType: string,
    processedAt: Date,
  ): Promise<void> {
    // TODO: PostgreSQL INSERT 実装
    /*
    await this.database.query(
      `INSERT INTO processed_events (event_id, event_type, processed_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, eventType, processedAt]
    );
    */

    this.logger.debug(`Marked event ${eventId} as processed`, {
      eventType,
      processedAt,
    });
  }

  private async createTable(): Promise<void> {
    // TODO: テーブル作成
    /*
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS processed_events (
        event_id VARCHAR(255) PRIMARY KEY,
        event_type VARCHAR(255) NOT NULL,
        processed_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    */

    this.logger.debug('Processed events table created');
  }
}
