import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import type { Express } from 'express';

export interface PinataUploadResult {
  cid: string;
  uri: string;
}

interface PinataUploadOptions {
  file: Express.Multer.File;
  metadata?: Record<string, string>;
}

@Injectable()
export class PinataService {
  private readonly logger = new Logger(PinataService.name);
  private readonly pinataJwt?: string;

  constructor(private readonly configService: ConfigService) {
    this.pinataJwt = this.configService.get<string>('PINATA_JWT');
  }

  async uploadFile({ file, metadata }: PinataUploadOptions): Promise<PinataUploadResult> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File missing or empty');
    }
    return this.uploadBuffer(
      file.buffer,
      file.originalname || 'asset.bin',
      file.mimetype || 'application/octet-stream',
      metadata,
    );
  }

  async uploadJson(payload: unknown, metadata?: Record<string, string>): Promise<PinataUploadResult> {
    const buffer = Buffer.from(JSON.stringify(payload));
    return this.uploadBuffer(buffer, 'metadata.json', 'application/json', metadata);
  }

  private ensureConfigured() {
    if (!this.pinataJwt) {
      this.logger.error('PINATA_JWT missing from configuration');
      throw new BadRequestException('Pinata credentials missing');
    }
  }

  private async uploadBuffer(
    buffer: Buffer,
    filename: string,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<PinataUploadResult> {
    this.ensureConfigured();

    const form = new FormData();
    form.append('file', buffer, {
      filename,
      contentType,
    });
    form.append(
      'pinataMetadata',
      JSON.stringify({
        name: metadata?.name ?? filename,
        keyvalues: metadata ?? {},
      }),
    );
    form.append(
      'pinataOptions',
      JSON.stringify({
        cidVersion: 1,
      }),
    );

    return this.executeUpload(form);
  }

  private async executeUpload(form: FormData): Promise<PinataUploadResult> {
    try {
      const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', form, {
        headers: {
          Authorization: `Bearer ${this.pinataJwt}`,
          ...form.getHeaders(),
        },
        maxBodyLength: Infinity,
      });
      const cid = response.data?.IpfsHash as string;
      if (!cid) {
        throw new Error('Pinata response missing IpfsHash');
      }
      return { cid, uri: `ipfs://${cid}` };
    } catch (error) {
      this.logger.error(`Pinata upload failed: ${error instanceof Error ? error.message : error}`);
      throw new BadRequestException('Failed to upload asset to IPFS');
    }
  }
}

