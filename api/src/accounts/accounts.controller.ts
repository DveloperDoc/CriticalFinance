// src/accounts/accounts.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { JwtAuthGuard } from '../auth/jwt.guard'; // ajusta ruta

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateAccountDto) {
    const userId = req.user.id; // ajusta según tu estrategia
    return this.accountsService.create(userId, dto);
  }

  @Get()
  findAll(@Req() req: any) {
    const userId = req.user.id;
    return this.accountsService.findAll(userId);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    return this.accountsService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    const userId = req.user.id;
    return this.accountsService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    return this.accountsService.softDelete(userId, id);
  }

  @Get(':id/balance')
  getBalance(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    return this.accountsService.getBalance(userId, id);
  }
}
