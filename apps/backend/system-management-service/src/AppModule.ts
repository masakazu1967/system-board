import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SystemManagementModule } from '@system-board/system-management';
// 他のコンテキストモジュールもインポート

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    SystemManagementModule,
  ],
})
export class AppModule {}
