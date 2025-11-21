import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { SavingsService } from './savings.service';
import { CreateSavingsRuleDto } from './dto/create-savings-rule.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('savings')
@UseGuards(JwtAuthGuard)
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  @Post('rules')
  async createRule(@Req() req: any, @Body() dto: CreateSavingsRuleDto) {
    const userId = req.user.id; // <--- ahora SIEMPRE existe
    return this.savingsService.createRule(userId, dto);
  }

  @Get('rules')
  async listRules(@Req() req: any) {
    const userId = req.user.id;
    return this.savingsService.listRules(userId);
  }

  @Get('alerts')
  async listAlerts(@Req() req: any) {
    const userId = req.user.id;
    return this.savingsService.listAlerts(userId);
  }
}
