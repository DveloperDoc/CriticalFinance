// src/transactions/transactions.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateTransactionDto) {
    const userId = req.user.id;
    return this.transactionsService.create(userId, dto);
  }

  @Get()
  findAll(@Req() req: any, @Query() filter: FilterTransactionsDto) {
    const userId = req.user.id;
    return this.transactionsService.findAll(userId, filter);
  }
}
