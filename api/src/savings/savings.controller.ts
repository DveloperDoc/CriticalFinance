// api/src/savings/savings.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  BadRequestException,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { SavingsService } from './savings.service';
import { CreateSavingsRuleDto } from './dto/create-savings-rule.dto';
import { UpdateSavingsRuleDto } from './dto/update-savings-rule.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SavingsRuleEvaluatorService } from './savings-rule-evaluator.service';

@Controller('savings')
@UseGuards(JwtAuthGuard)
export class SavingsController {
  constructor(
    private readonly savingsService: SavingsService,
    private readonly savingsRuleEvaluator: SavingsRuleEvaluatorService,
  ) {}

  private getUserId(req: any): string {
    const userId =
      req.user?.userId ??
      req.user?.id ??
      req.user?.sub;

    if (!userId) {
      throw new BadRequestException('No se pudo determinar el usuario desde el token');
    }

    return String(userId);
  }

  // --------- REGLAS DE AHORRO ---------

  @Post('rules')
  async createRule(@Req() req: any, @Body() dto: CreateSavingsRuleDto) {
    const userId = this.getUserId(req);
    return this.savingsService.createRule(userId, dto);
  }

  @Get('rules')
  async listRules(@Req() req: any) {
    const userId = this.getUserId(req);
    return this.savingsService.listRules(userId);
  }

  @Patch('rules/:id')
  async updateRule(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSavingsRuleDto,
  ) {
    const userId = this.getUserId(req);
    return this.savingsService.updateRule(userId, id, dto);
  }

  @Delete('rules/:id')
  async deleteRule(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.savingsService.deleteRule(userId, id);
  }

  @Post('rules/evaluate')
  async evaluateRules(@Req() req: any) {
    const userId = this.getUserId(req);
    await this.savingsRuleEvaluator.evaluateAllForUser(userId);
    return { ok: true };
  }

  // --------- ALERTAS / OVERVIEW ---------

  @Get('alerts')
  async listAlerts(@Req() req: any) {
    const userId = this.getUserId(req);
    return this.savingsService.listAlerts(userId);
  }

  // NUEVO: solo alertas activas (para badge/global)
  @Get('alerts/active')
  async listActiveAlerts(@Req() req: any) {
    const userId = this.getUserId(req);
    return this.savingsService.listActiveAlerts(userId);
  }

  // NUEVO: marcar una alerta como leída/resuelta
  @Patch('alerts/:id/read')
  async markAlertRead(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.savingsService.markAlertRead(userId, id);
  }

  // GET /savings/overview → dashboard de ahorro
  @Get('overview')
  async getOverview(@Req() req: any) {
    const userId = this.getUserId(req);
    return this.savingsService.getOverview(userId);
  }
}
