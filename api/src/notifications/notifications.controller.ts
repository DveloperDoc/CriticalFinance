// api/src/notifications/notifications.controller.ts
import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('test')
  async sendTest(@Req() req: any) {
    // según tu JwtStrategy: req.user.id
    const userId = req.user.id as string;
    return this.notificationsService.sendTestPush(userId);
  }
}
