// api/src/alerts/alerts.module.ts
import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AlertsController],
  providers: [AlertsService, PrismaService],
  exports: [AlertsService], // exportamos el servicio para otros módulos
})
export class AlertsModule {}
