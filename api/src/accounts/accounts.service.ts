// src/accounts/accounts.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { Currency } from '@prisma/client';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAccountDto) {
    return this.prisma.account.create({
      data: {
        userId,
        bank: dto.bank,
        accountType: dto.accountType,
        accountNumber: dto.accountNumber,
        holderName: dto.holderName,
        rutTitular: dto.rutTitular ?? null,
        alias: dto.alias ?? null,
        provider: dto.provider ?? null,
        providerRef: dto.providerRef ?? null,
        currency: dto.currency ?? Currency.CLP,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.account.findMany({
      where: { userId, active: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    return this.prisma.account.findFirst({
      where: { id, userId },
    });
  }

  async update(userId: string, id: string, dto: UpdateAccountDto) {
    // Seguridad: sólo permitir actualizar cuentas del usuario
    return this.prisma.account.updateMany({
      where: { id, userId },
      data: dto,
    });
  }

  async softDelete(userId: string, id: string) {
    return this.prisma.account.updateMany({
      where: { id, userId },
      data: { active: false },
    });
  }

  async getBalance(userId: string, accountId: string) {
    // balanceCents en la tabla + sumatoria de transacciones si quieres
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
      select: { id: true, balanceCents: true, currency: true },
    });

    return account;
  }
}
