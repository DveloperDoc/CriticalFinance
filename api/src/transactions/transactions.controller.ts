import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  Param,
  NotFoundException,
  Patch,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';
import { UpdateTransactionCategoryDto } from './dto/update-transaction-category.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateTransactionDto) {
    const userId = req.user.id as string;
    return this.transactionsService.create(userId, dto);
  }

  @Get()
  findAll(@Req() req: any, @Query() filter: FilterTransactionsDto) {
    const userId = req.user.id as string;
    return this.transactionsService.findAll(userId, filter);
  }

  // RESUMEN ML
  @Get('ml-summary')
  getMlSummary(@Req() req: any) {
    const userId = req.user.id as string;
    return this.transactionsService.getMlSummary(userId);
  }

  // NUEVO: movimientos inusuales / anomalías
  @Get('anomalies')
  getAnomalies(@Req() req: any) {
    const userId = req.user.id as string;
    return this.transactionsService.getAnomalies(userId);
  }

  // GET /transactions/:id
  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id as string;
    const tx = await this.transactionsService.findOne(userId, id);

    // el service ya lanza NotFoundException, esto es redundante pero lo dejo por claridad
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    return tx;
  }

  // PATCH /transactions/:id/category
  // Confirmar o cambiar categoría de una transacción
  @Patch(':id/category')
  updateCategory(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionCategoryDto,
  ) {
    const userId = req.user.id as string;
    return this.transactionsService.updateCategory(userId, id, dto);
  }
}
