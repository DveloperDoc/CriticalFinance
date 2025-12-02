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
  Query,
} from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateBudgetDto } from './dto/create-budget.dto';

@Controller('budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  private getUserId(req: any): string {
    console.log('BudgetsController req.user =', req.user);

    const userId =
      req.user?.userId ?? // lo que usamos en /me
      req.user?.id ??
      req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'No se pudo determinar el usuario desde el token.',
      );
    }

    return String(userId);
  }

  // POST /budgets → crea/actualiza presupuesto (upsert)
  @Post()
  upsert(@Req() req: any, @Body() dto: CreateBudgetDto) {
    const userId = this.getUserId(req);
    return this.budgetsService.upsert(userId, dto);
  }

  // GET /budgets → lista simple de presupuestos (todas las cuentas del usuario)
  @Get()
  getAll(@Req() req: any) {
    const userId = this.getUserId(req);
    return this.budgetsService.getAll(userId);
  }

  // GET /budgets/overview → overview + alertas (filtrable por cuenta)
  // /budgets/overview?accountId=xxxxx
  @Get('overview')
  getOverview(
    @Req() req: any,
    @Query('accountId') accountId?: string,
  ) {
    const userId = this.getUserId(req);
    return this.budgetsService.getOverview(userId, accountId || undefined);
  }

  // DELETE /budgets/:id
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.budgetsService.remove(userId, id);
  }
}
