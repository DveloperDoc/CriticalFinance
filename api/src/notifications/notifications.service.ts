// api/src/notifications/notifications.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async sendTestPush(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        pushTokens: {
          select: {
            token: true,
            platform: true,
          },
        },
      },
    });

    if (!user || !user.pushTokens || user.pushTokens.length === 0) {
      throw new BadRequestException(
        'El usuario no tiene pushTokens registrados.',
      );
    }

    // Por ahora usamos el primer token registrado del usuario
    const primaryToken = user.pushTokens[0]?.token;

    if (!primaryToken) {
      throw new BadRequestException(
        'No se encontró un token de push válido para el usuario.',
      );
    }

    const message = {
      to: primaryToken,
      title: 'CriticalFinance',
      body: 'Notificación de prueba: tus push están funcionando.',
      data: { type: 'test_notification' },
    };

    const response = await axios.post(
      'https://exp.host/--/api/v2/push/send',
      message,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    return {
      ok: true,
      expoResponse: response.data,
    };
  }
}
