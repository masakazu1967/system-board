import { NestFactory } from '@nestjs/core';
import { AppModule } from './AppModule';
import { EventSerializerRegistry } from '@system-board/shared';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Kafkaマイクロサービスの設定
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
      },
      consumer: {
        groupId: 'event-store-consumer',
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000);

  // 登録されたシリアライザーのログ出力
  const registeredEvents = EventSerializerRegistry.getRegisteredEventTypes();
  console.log('Registered Event Serializers:', registeredEvents);
}
void bootstrap();
