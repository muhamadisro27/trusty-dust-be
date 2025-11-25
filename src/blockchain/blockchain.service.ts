import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AbiLoaderService } from './abi-loader.service';
import { Address, PublicClient, WalletClient, Chain, createPublicClient, createWalletClient, http, type Account } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private publicClient?: PublicClient;
  private walletClient?: WalletClient;
  private walletAccount?: Account;
  private readonly chain: Chain | undefined;
  private readonly rpcUrl: string | undefined;

  constructor(private readonly configService: ConfigService, private readonly abiLoader: AbiLoaderService) {
    this.rpcUrl = this.configService.get<string>('RPC_URL');
    this.chain = undefined;
    if (this.rpcUrl) {
      this.publicClient = createPublicClient({ transport: http(this.rpcUrl) });
    }
  }

  private normalizeAddress(address: string): Address {
    return (address.startsWith('0x') ? address : `0x${address}`) as Address;
  }

  private getPublicClient() {
    if (!this.publicClient) {
      if (!this.rpcUrl) {
        throw new Error('RPC_URL missing for viem client');
      }
      this.publicClient = createPublicClient({ transport: http(this.rpcUrl) });
    }
    return this.publicClient;
  }

  private getWalletClient() {
    if (this.walletClient) {
      return this.walletClient;
    }
    const rpcUrl = this.rpcUrl;
    const privateKey = this.configService.get<string>('ESCROW_SIGNER_KEY');
    if (!rpcUrl || !privateKey) {
      this.logger.warn('Wallet client not fully configured, returning undefined - calls will be simulated');
      return undefined;
    }
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    this.walletClient = createWalletClient({
      account,
      transport: http(rpcUrl),
    });
    this.walletAccount = account;
    return this.walletClient;
  }

  async verifyTrustProof(params: { proof: string; publicInputs: string[]; minScore?: number }) {
    const { proof, publicInputs, minScore } = params;
    const contractAddress = this.configService.get<string>('TRUST_VERIFICATION_ADDRESS');
    if (!contractAddress) {
      this.logger.warn('TRUST_VERIFICATION_ADDRESS missing, skipping on-chain verification');
      return true;
    }
    const abi = this.abiLoader.loadAbi('trust-verification.json');
    const formattedProof = proof.startsWith('0x') ? (proof as `0x${string}`) : (`0x${proof}` as `0x${string}`);
    const client = this.getPublicClient();
    const toBytes32 = (value: string) => {
      const normalized = value.startsWith('0x') ? value.slice(2) : BigInt(value).toString(16);
      return (`0x${normalized.padStart(64, '0')}`) as `0x${string}`;
    };
    const publicInputBytes = publicInputs.map((value) => toBytes32(value));
    return client.readContract({
      address: contractAddress as Address,
      abi,
      functionName: 'verifyProof',
      args: [formattedProof, publicInputBytes],
    }) as Promise<boolean>;
  }

  async lockEscrow(jobId: number, poster: string, worker: string, amount: bigint) {
    const contractAddress = this.configService.get<string>('ESCROW_FACTORY_ADDRESS');
    if (!contractAddress) {
      this.logger.warn('ESCROW_FACTORY_ADDRESS missing, returning offchain placeholder');
      return `offchain-lock-${jobId}-${Date.now()}`;
    }
    const wallet = this.getWalletClient();
    if (!wallet) {
      this.logger.warn('Wallet client missing, simulating lockEscrow');
      return `simulated-lock-${jobId}-${Date.now()}`;
    }
    const abi = this.abiLoader.loadAbi('escrow-factory.json');
    this.logger.log(`writeContract lockEscrow job ${jobId}`);
    return wallet.writeContract({
      address: contractAddress as Address,
      abi,
      functionName: 'lock',
      args: [BigInt(jobId), this.normalizeAddress(poster), this.normalizeAddress(worker), amount],
      chain: this.chain,
      account: this.walletAccount ?? null,
    });
  }

  async releaseEscrow(jobId: number) {
    const contractAddress = this.configService.get<string>('ESCROW_FACTORY_ADDRESS');
    if (!contractAddress) {
      this.logger.warn('ESCROW_FACTORY_ADDRESS missing, returning offchain release');
      return `offchain-release-${jobId}-${Date.now()}`;
    }
    const wallet = this.getWalletClient();
    if (!wallet) {
      this.logger.warn('Wallet client missing, simulating releaseEscrow');
      return `simulated-release-${jobId}-${Date.now()}`;
    }
    const abi = this.abiLoader.loadAbi('escrow-factory.json');
    this.logger.log(`writeContract releaseEscrow job ${jobId}`);
    return wallet.writeContract({
      address: contractAddress as Address,
      abi,
      functionName: 'release',
      args: [BigInt(jobId)],
      chain: this.chain,
      account: this.walletAccount ?? null,
    });
  }

  async refundEscrow(jobId: number) {
    const contractAddress = this.configService.get<string>('ESCROW_FACTORY_ADDRESS');
    if (!contractAddress) {
      this.logger.warn('ESCROW_FACTORY_ADDRESS missing, returning offchain refund');
      return `offchain-refund-${jobId}-${Date.now()}`;
    }
    const wallet = this.getWalletClient();
    if (!wallet) {
      this.logger.warn('Wallet client missing, simulating refundEscrow');
      return `simulated-refund-${jobId}-${Date.now()}`;
    }
    const abi = this.abiLoader.loadAbi('escrow-factory.json');
    this.logger.log(`writeContract refundEscrow job ${jobId}`);
    return wallet.writeContract({
      address: contractAddress as Address,
      abi,
      functionName: 'refund',
      args: [BigInt(jobId)],
      chain: this.chain,
      account: this.walletAccount ?? null,
    });
  }

  async updateSbtMetadata(tokenId: number, tier: string, action: 'mint' | 'update', owner?: string) {
    const contractAddress = this.configService.get<string>('SBT_CONTRACT_ADDRESS');
    if (!contractAddress) {
      return `offchain-sbt-${action}-${tokenId}`;
    }
    const wallet = this.getWalletClient();
    if (!wallet) {
      return `simulated-sbt-${action}-${tokenId}`;
    }
    const abi = this.abiLoader.loadAbi('sbt.json');
    const functionName = action === 'mint' ? 'mint' : 'updateMetadata';
    const args = action === 'mint'
      ? [this.normalizeAddress(owner as string), BigInt(tokenId), tier]
      : [BigInt(tokenId), tier];
    this.logger.log(`writeContract SBT ${functionName} token ${tokenId}`);
    return wallet.writeContract({
      address: contractAddress as Address,
      abi,
      functionName,
      args,
      chain: this.chain,
      account: this.walletAccount ?? null,
    });
  }

  async burnDustBoost(user: string, amount: bigint, postId: number) {
    const contractAddress = this.configService.get<string>('DUST_TOKEN_ADDRESS');
    if (!contractAddress) {
      return `offchain-burn-${postId}-${Date.now()}`;
    }
    const wallet = this.getWalletClient();
    if (!wallet) {
      return `simulated-burn-${postId}-${Date.now()}`;
    }
    const abi = this.abiLoader.loadAbi('dust-token.json');
    this.logger.log(`writeContract burnDustBoost post ${postId} amount ${amount}`);
    return wallet.writeContract({
      address: contractAddress as Address,
      abi,
      functionName: 'burnBoost',
      args: [this.normalizeAddress(user), amount, BigInt(postId)],
      chain: this.chain,
      account: this.walletAccount ?? null,
    });
  }
}
