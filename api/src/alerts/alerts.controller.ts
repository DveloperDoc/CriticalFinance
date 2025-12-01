// api/src/alerts/alerts.controller.ts
import { Controller, Get, Patch, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AlertsService } from './alerts.service';

@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  // GET /alerts
  @Get()
  async listMyAlerts(@Req() req: any) {
    const userId = req.user.id as string;
    return this.alertsService.listForUser(userId);
  }

  // PATCH /alerts/:id/read
  @Patch(':id/read')
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id as string;
    return this.alertsService.markAsRead(userId, id);
  }
}
