import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KafkaEventPublisher } from './KafkaEventPublisher';

/**
 * Kafka Module
 * Kafka クライアントの設定とプロバイダーの登録
 */
@Module({
  imports: [
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_CLIENT',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: configService.get<string>(
                'KAFKA_CLIENT_ID',
                'system-board',
              ),
              brokers: (
                configService.get<string>('KAFKA_BROKERS', 'localhost:9092') ||
                ''
              ).split(','),
            },
            consumer: {
              groupId: configService.get<string>(
                'KAFKA_CONSUMER_GROUP_ID',
                'system-board-consumer',
              ),
              // 冪等性保証のため、at-least-once配信
              allowAutoTopicCreation: false,
              sessionTimeout: 30000,
              heartbeatInterval: 3000,
            },
            producer: {
              // トランザクション設定
              idempotent: true,
              maxInFlightRequests: 5,
              transactionalId: configService.get<string>(
                'KAFKA_PRODUCER_TRANSACTIONAL_ID',
                'system-board-producer',
              ),
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [KafkaEventPublisher],
  exports: [KafkaEventPublisher, ClientsModule],
})
export class KafkaModule {}
