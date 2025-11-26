import { Injectable, Logger } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { LoginByWalletDto } from './dto/login-by-wallet.dto';
import { ethers } from 'ethers';

@Injectable()
export class AuthService {
  private readonly http: AxiosInstance;
  private readonly logger = new Logger(AuthService.name);

  async verifySignature(dto: LoginByWalletDto) {
    let invalidReason = '';

    const walletAddress = dto.walletAddress.toLowerCase();

    const parts = dto.message.split('on ');
    if (parts.length < 2) {
      return 'invalid message format';
    }

    const timestampStr = parts[1].trim();
    const timestamp = new Date(timestampStr).getTime();

    if (Number.isNaN(timestamp)) {
      return 'invalid timestamp format';
    }

    // if (Date.now() - timestamp > 60000) {
    //   invalidReason = 'invalid timestamp';
    // }

    const signer = ethers.verifyMessage(dto.message, dto.signature);
    if (walletAddress !== signer.toLowerCase()) {
      invalidReason = 'invalid signer';
    }

    return invalidReason;
  }
}
