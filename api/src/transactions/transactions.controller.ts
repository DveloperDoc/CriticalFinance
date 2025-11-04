// src/transactions/transactions.controller.ts
import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('transactions')
@UseGuards(JwtAuthGuard) // exige JWT en todas las rutas
export class TransactionsController {
  constructor(private readonly svc: TransactionsService) {}

  @Get()
  async getAll(
    @Req() req: any,
    @Query('accountId') accountId?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    // El guard decodifica el JWT y agrega req.user
    const userId = req.user.userId as string;

    // Pasa el userId al servicio para filtrar solo sus cuentas
    return this.svc.findAll({
      userId,
      accountId,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
      from,
      to,
    });
  }
}