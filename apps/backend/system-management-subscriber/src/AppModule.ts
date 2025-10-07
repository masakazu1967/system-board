import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventStoreModule } from '@system-board/shared';
import { SystemManagementModule } from '@system-board/system-management';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    EventStoreModule.forRoot(),
    SystemManagementModule,
  ],
})
export class AppModule {}
