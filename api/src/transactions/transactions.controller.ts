import { Controller, Get, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly svc: TransactionsService) {}

  @Get()
  getAll(
    @Query('accountId') accountId?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.findAll({
      accountId,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
      from,
      to,
    });
  }
}