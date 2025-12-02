// api/src/alerts/alerts.controller.ts
import {
  Controller,
  Get,
  Patch,
  Param,
  Req,
  UseGuards,
  Body,
  Delete,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AlertsService } from './alerts.service';

@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  private getUserId(req: any): string {
    const userId =
      req.user?.userId ??
      req.user?.id ??
      req.user?.sub;

    if (!userId) {
      throw new BadRequestException(
        'No se pudo determinar el usuario desde el token',
      );
    }

    return String(userId);
  }

  // GET /alerts → todas las alertas del usuario (activas e inactivas)
  @Get()
  async listMyAlerts(@Req() req: any) {
    const userId = this.getUserId(req);
    return this.alertsService.listForUser(userId);
  }

  // NUEVO: GET /alerts/active → solo alertas activas (isActive = true)
  @Get('active')
  async listMyActiveAlerts(@Req() req: any) {
    const userId = this.getUserId(req);
    return this.alertsService.listActiveForUser(userId);
  }

  // PATCH /alerts/:id/read
  // body esperado: { read: true | false }
  @Patch(':id/read')
  async updateRead(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { read?: boolean },
  ) {
    const userId = this.getUserId(req);

    if (typeof body.read !== 'boolean') {
      throw new BadRequestException('El campo "read" debe ser booleano.');
    }

    return this.alertsService.updateRead(userId, id, body.read);
  }

  // DELETE /alerts/:id
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.alertsService.remove(userId, id);
  }
}
