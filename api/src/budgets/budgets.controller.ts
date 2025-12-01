// api/src/budgets/budgets.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';

@Controller('budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  private getUserId(req: any): string {
    // Log de apoyo para ver qué viene realmente
    // Puedes dejarlo mientras debugueas
    console.log('BudgetsController req.user =', req.user);

    const userId =
      req.user?.userId ?? // lo que usamos en /me
      req.user?.id ??
      req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('No se pudo determinar el usuario desde el token.');
    }

    return String(userId);
  }

  @Post()
  upsert(@Req() req: any, @Body() dto: UpsertBudgetDto) {
    const userId = this.getUserId(req);
    return this.budgetsService.upsert(userId, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.budgetsService.remove(userId, id);
  }

  @Get('overview')
  getOverview(@Req() req: any) {
    const userId = this.getUserId(req);
    return this.budgetsService.getOverview(userId);
  }
}
