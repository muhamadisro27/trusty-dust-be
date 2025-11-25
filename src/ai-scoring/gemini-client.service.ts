import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GenerativeModel } from '@google/generative-ai';
import { safeParse } from './ai-normalizer.util';

type GeminiJsonResponse = {
  txnScore?: number;
  tokenScore?: number;
  nftScore?: number;
  defiScore?: number;
  contractScore?: number;
  riskScore?: number;
  finalScore?: number;
  reasoning?: string;
};

@Injectable()
export class GeminiClientService {
  private readonly logger = new Logger(GeminiClientService.name);
  private readonly apiKey?: string;
  private modelPromise?: Promise<GenerativeModel | null>;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY');
  }

  private async getModel(): Promise<GenerativeModel | null> {
    if (!this.apiKey) {
      return null;
    }
    if (!this.modelPromise) {
      this.modelPromise = this.bootstrapModel();
    }
    return this.modelPromise;
  }

  private async bootstrapModel(): Promise<GenerativeModel | null> {
    try {
      const mod = await import('@google/generative-ai');
      const client = new mod.GoogleGenerativeAI(this.apiKey as string);
      return client.getGenerativeModel({ model: 'gemini-pro' });
    } catch (error) {
      this.logger.warn(
        `Gemini SDK unavailable or API key invalid: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async analyze(prompt: string): Promise<GeminiJsonResponse | null> {
    const model = await this.getModel();
    if (!model) {
      return null;
    }
    try {
      const result = await model.generateContent(prompt);
      const text = result.response?.text();
      return safeParse<GeminiJsonResponse>(text ?? '');
    } catch (error) {
      this.logger.warn(
        `Gemini analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
