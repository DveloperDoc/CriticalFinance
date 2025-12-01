import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

type MlPredictInput = {
  description?: string | null;
  merchant?: string | null;
  valueCents: number;
  bookedAt: Date | string;
  accountType: string; // 'CUENTA_CORRIENTE' | ...
  currency: string;    // 'CLP', etc.
  type: string;        // 'debit' | 'credit'
  isRecurring?: boolean;
  balanceAfterCents?: number | null;
};

type MlPredictResponse = {
  category: string;
  confidence: number;
};

@Injectable()
export class MlService {
  private readonly logger = new Logger(MlService.name);
  private readonly baseUrl = process.env.ML_BASE_URL ?? 'http://localhost:8001';

  async predictCategory(input: MlPredictInput): Promise<MlPredictResponse | null> {
    try {
      const url = `${this.baseUrl}/ml/predict-category`;

      const { data } = await axios.post<MlPredictResponse>(url, {
        description: input.description ?? '',
        merchant: input.merchant ?? '',
        valueCents: input.valueCents,
        bookedAt: input.bookedAt,
        accountType: input.accountType,
        currency: input.currency,
        type: input.type,
        isRecurring: input.isRecurring ?? false,
        balanceAfterCents: input.balanceAfterCents ?? 0,
      });

      return data;
    } catch (err) {
      this.logger.error('Error llamando a ML', err instanceof Error ? err.stack : String(err));
      return null; // si falla ML, no rompemos el flujo de negocio
    }
  }
}
