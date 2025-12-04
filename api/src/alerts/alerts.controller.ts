// api/src/alerts/alerts.controller.ts
import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AlertsService } from './alerts.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  private getUserId(req: any): string {
    const userId =
      req.user?.userId ??
      req.user?.id ??
      req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'No se pudo determinar el usuario desde el token.',
      );
    }

    return String(userId);
  }

  @Get('alerts')
  listAll(@Req() req: any) {
    const userId = this.getUserId(req);
    return this.alertsService.listForUser(userId);
  }

  @Get('alerts/active')
  listActive(@Req() req: any) {
    const userId = this.getUserId(req);
    return this.alertsService.listActiveForUser(userId);
  }

  @Get('savings/alerts/active')
  listActiveForSavings(@Req() req: any) {
    const userId = this.getUserId(req);
    return this.alertsService.listActiveForUser(userId);
  }

  @Patch('alerts/:id/read')
  markRead(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.alertsService.markAsRead(userId, id);
  }

  @Patch('savings/alerts/:id/read')
  markReadSavings(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.alertsService.markAsRead(userId, id);
  }

  @Delete('alerts/:id')
  remove(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.alertsService.remove(userId, id);
  }
}
