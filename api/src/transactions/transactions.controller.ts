// api/src/transactions/transactions.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  Param,
  Patch,
  BadRequestException,
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

  @Post()
  create(@Req() req: any, @Body() dto: CreateTransactionDto) {
    const userId = this.getUserId(req);
    return this.transactionsService.create(userId, dto);
  }

  @Get()
  findAll(@Req() req: any, @Query() filter: FilterTransactionsDto) {
    const userId = this.getUserId(req);
    return this.transactionsService.findAll(userId, filter);
  }

  // RESUMEN ML
  @Get('ml-summary')
  getMlSummary(@Req() req: any) {
    const userId = this.getUserId(req);
    return this.transactionsService.getMlSummary(userId);
  }

  // Movimientos inusuales / anomalías
  @Get('anomalies')
  getAnomalies(@Req() req: any) {
    const userId = this.getUserId(req);
    return this.transactionsService.getAnomalies(userId);
  }

  // GET /transactions/:id
  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    // El service ya lanza NotFoundException si no existe
    return this.transactionsService.findOne(userId, id);
  }

  // PATCH /transactions/:id/category
  @Patch(':id/category')
  updateCategory(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionCategoryDto,
  ) {
    const userId = this.getUserId(req);
    return this.transactionsService.updateCategory(userId, id, dto);
  }

  // PATCH /transactions/:id/anomaly-resolved
  @Patch(':id/anomaly-resolved')
  setAnomalyResolved(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { resolved?: boolean },
  ) {
    const userId = this.getUserId(req);
    const resolved = body?.resolved ?? true;
    return this.transactionsService.setAnomalyResolved(userId, id, resolved);
  }
}
