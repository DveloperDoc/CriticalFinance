// api/src/ml/ml.service.ts
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

type MlPredictInput = {
  description?: string | null;
  merchant?: string | null;
  valueCents: number;
  bookedAt: Date | string;

  // Por ahora los mantenemos para no romper firmas existentes,
  // aunque el microservicio actual no los use.
  accountType: string; // 'CUENTA_CORRIENTE' | ...
  currency: string;    // 'CLP', etc.
  type: string;        // 'debit' | 'credit'
  isRecurring?: boolean;
  balanceAfterCents?: number | null;
};

export type MlPredictResponse = {
  category: string;
  isGastoHormiga: boolean;
  confidence?: number; // opcional, por compatibilidad
};

// Respuesta real del microservicio FastAPI
type MlApiResponse = {
  category: string;
  is_gasto_hormiga: boolean;
};

@Injectable()
export class MlService {
  private readonly logger = new Logger(MlService.name);
  private readonly baseUrl = process.env.ML_BASE_URL ?? 'http://localhost:8001';

  private toIsoString(bookedAt: Date | string): string {
    if (bookedAt instanceof Date) return bookedAt.toISOString();
    const d = new Date(bookedAt);
    if (isNaN(d.getTime())) return new Date().toISOString();
    return d.toISOString();
  }

  async predictCategory(input: MlPredictInput): Promise<MlPredictResponse | null> {
    try {
      // Nuevo endpoint del microservicio
      const url = `${this.baseUrl}/predict`;

      const payload = {
        date: this.toIsoString(input.bookedAt),
        description: input.description ?? '',
        merchant: input.merchant ?? '',
        amount_clp: Math.abs(input.valueCents) / 100,
      };

      const { data } = await axios.post<MlApiResponse>(url, payload, {
        timeout: 2000,
      });

      // Adaptamos la respuesta del microservicio al tipo usado en el backend
      return {
        category: data.category,
        isGastoHormiga: data.is_gasto_hormiga,
        // de momento podemos asumir 1 o dejarlo undefined
        confidence: 1,
      };
    } catch (err) {
      this.logger.error(
        'Error llamando a ML',
        err instanceof Error ? err.stack : String(err),
      );
      return null; // si falla ML, no rompemos el flujo de negocio
    }
  }
}
