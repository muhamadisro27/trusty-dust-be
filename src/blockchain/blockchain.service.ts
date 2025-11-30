import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AbiLoaderService } from './abi-loader.service';
import {
  Address,
  PublicClient,
  WalletClient,
  Chain,
  createPublicClient,
  createWalletClient,
  http,
  type Account,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const DUST_UNIT = 10n ** 18n;
type SocialAction = 'LIKE' | 'COMMENT' | 'REPOST';
import { ContentAbi } from '../abis/ContentAbi';
import { JobsAbi } from '../abis/JobsAbi';
import { CoreAbi } from '../abis/CoreAbi';
import { DustTokenAbi } from '../abis/DustTokenAbi';

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private publicClient?: PublicClient;
  private walletClient?: WalletClient;
  private walletAccount?: Account;
  private readonly chain: Chain | undefined;
  private readonly rpcUrl: string | undefined;
  private readonly dustContract?: Address;
  private readonly identityContract?: Address;
  private readonly coreContract?: Address;
  private readonly contentContract?: Address;
  private readonly jobsContract?: Address;
  private readonly verifierContract?: Address;
  private readonly escrowFactoryContract?: Address;
  private readonly sbtContract?: Address;

  constructor(private readonly configService: ConfigService, private readonly abiLoader: AbiLoaderService) {
    this.rpcUrl = this.configService.get<string>('RPC_URL');
    this.chain = undefined;
    if (this.rpcUrl) {
      this.publicClient = createPublicClient({ transport: http(this.rpcUrl) });
    }
    this.dustContract = this.getAddress('DUST_CONTRACT', 'DUST_TOKEN_ADDRESS');
    this.identityContract = this.getAddress('IDENTITY_CONTRACT');
    this.coreContract = this.getAddress('CORE_CONTRACT');
    this.contentContract = this.getAddress('CONTENT_CONTRACT');
    this.jobsContract = this.getAddress('JOBS_CONTRACT');
    this.verifierContract = this.getAddress('VERIFIER_CONTRACT', 'TRUST_VERIFICATION_ADDRESS');
    this.escrowFactoryContract = this.getAddress('ESCROW_FACTORY_ADDRESS');
    this.sbtContract = this.getAddress('SBT_CONTRACT_ADDRESS');
  }

  private getAddress(...keys: string[]): Address | undefined {
    for (const key of keys) {
      const value = this.configService.get<string>(key);
      if (value) {
        return this.normalizeAddress(value);
      }
    }
    return undefined;
  }

  private normalizeAddress(address: string): Address {
    return (address.startsWith('0x') ? address : `0x${address}`) as Address;
  }

  private toDustWei(amount: number | bigint) {
    const base = typeof amount === 'number' ? BigInt(amount) : amount;
    return base * DUST_UNIT;
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
    const privateKey =
      this.configService.get<string>('PRIVATE_KEY') ??
      this.configService.get<string>('ESCROW_SIGNER_KEY');
    if (!rpcUrl || !privateKey) {
      this.logger.warn(
        'Wallet client not fully configured (RPC_URL or PRIVATE_KEY missing), returning undefined - calls will be simulated',
      );
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
    const contractAddress = this.verifierContract;
    if (!contractAddress) {
      this.logger.warn('VERIFIER_CONTRACT missing, skipping on-chain verification');
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
    const contractAddress = this.escrowFactoryContract;
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
    const contractAddress = this.escrowFactoryContract;
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
    const contractAddress = this.escrowFactoryContract;
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
    const contractAddress = this.sbtContract;
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

  async mintPost(metadataUri?: string) {
    if (!this.contentContract) {
      this.logger.warn('CONTENT_CONTRACT missing, skipping mintPost');
      return null;
    }
    const wallet = this.getWalletClient();
    if (!wallet || !this.walletAccount) {
      this.logger.warn('Wallet client missing, skipping mintPost');
      return null;
    }
    try {
      const txHash = await wallet.writeContract({
        address: this.contentContract,
        abi: ContentAbi,
        functionName: 'mintPost',
        args: [metadataUri ?? ''],
        chain: this.chain,
        account: this.walletAccount,
      });
      this.logger.log(`mintPost tx=${txHash}`);
      return txHash as string;
    } catch (error) {
      this.logger.error(`Failed to mint post NFT: ${error}`);
      return null;
    }
  }

  async rewardSocial(user: string, action: SocialAction) {
    if (!this.coreContract) {
      this.logger.warn('CORE_CONTRACT missing, skipping rewardSocial');
      return null;
    }
    const wallet = this.getWalletClient();
    if (!wallet || !this.walletAccount) {
      this.logger.warn('Wallet client missing, skipping rewardSocial');
      return null;
    }
    try {
      const actionCode = this.mapSocialAction(action);
      const txHash = await wallet.writeContract({
        address: this.coreContract,
        abi: CoreAbi,
        functionName: 'rewardSocial',
        args: [this.normalizeAddress(user), actionCode],
        chain: this.chain,
        account: this.walletAccount,
      });
      this.logger.log(`rewardSocial user=${user} action=${action} tx=${txHash}`);
      return txHash as string;
    } catch (error) {
      this.logger.error(`Failed to reward social action: ${error}`);
      return null;
    }
  }

  async createJobOnChain(minScore: number, cid: string) {
    if (!this.jobsContract) {
      this.logger.warn('JOBS_CONTRACT missing, skipping createJob');
      return { jobId: null, txHash: null } as const;
    }
    const wallet = this.getWalletClient();
    if (!wallet || !this.walletAccount) {
      this.logger.warn('Wallet client missing, skipping createJob');
      return { jobId: null, txHash: null } as const;
    }
    try {
      const client = this.getPublicClient();
      const nextJobId = (await client.readContract({
        address: this.jobsContract,
        abi: JobsAbi,
        functionName: 'nextJobId',
      })) as bigint;
      const txHash = await wallet.writeContract({
        address: this.jobsContract,
        abi: JobsAbi,
        functionName: 'createJob',
        args: [BigInt(minScore), cid],
        chain: this.chain,
        account: this.walletAccount,
      });
      this.logger.log(`createJob id=${nextJobId} tx=${txHash}`);
      return { jobId: nextJobId, txHash: txHash as string } as const;
    } catch (error) {
      this.logger.error(`Failed to create on-chain job: ${error}`);
      return { jobId: null, txHash: null } as const;
    }
  }

  async assignJobWorker(jobId: bigint, worker: string) {
    if (!this.jobsContract) {
      this.logger.warn('JOBS_CONTRACT missing, skipping assignWorker');
      return null;
    }
    const wallet = this.getWalletClient();
    if (!wallet || !this.walletAccount) {
      this.logger.warn('Wallet client missing, skipping assignWorker');
      return null;
    }
    try {
      const txHash = await wallet.writeContract({
        address: this.jobsContract,
        abi: JobsAbi,
        functionName: 'assignWorker',
        args: [jobId, this.normalizeAddress(worker)],
        chain: this.chain,
        account: this.walletAccount,
      });
      this.logger.log(`assignWorker job=${jobId} worker=${worker} tx=${txHash}`);
      return txHash as string;
    } catch (error) {
      this.logger.error(`Failed to assign worker on-chain: ${error}`);
      return null;
    }
  }

  async approveJob(jobId: bigint, rating: number) {
    if (!this.jobsContract) {
      this.logger.warn('JOBS_CONTRACT missing, skipping approveJob');
      return null;
    }
    const wallet = this.getWalletClient();
    if (!wallet || !this.walletAccount) {
      this.logger.warn('Wallet client missing, skipping approveJob');
      return null;
    }
    try {
      const normalizedRating = Number(rating);
      const txHash = await wallet.writeContract({
        address: this.jobsContract,
        abi: JobsAbi,
        functionName: 'approveJob',
        args: [jobId, normalizedRating],
        chain: this.chain,
        account: this.walletAccount,
      });
      this.logger.log(`approveJob job=${jobId} rating=${rating} tx=${txHash}`);
      return txHash as string;
    } catch (error) {
      this.logger.error(`Failed to approve job on-chain: ${error}`);
      return null;
    }
  }

  private mapSocialAction(action: SocialAction) {
    switch (action) {
      case 'LIKE':
        return 0;
      case 'COMMENT':
        return 1;
      case 'REPOST':
      default:
        return 2;
    }
  }

  async burnDustBoost(user: string, amountDust: bigint | number, postId?: number) {
    return this.writeDustBurn(user, amountDust, `post-${postId ?? 'n/a'}`, true);
  }

  async burnDust(user: string, amountDust: bigint | number) {
    return this.writeDustBurn(user, amountDust, 'spend');
  }

  async getDustBalance(user: string) {
    if (!this.dustContract) {
      throw new Error('DUST_CONTRACT missing');
    }
    try {
      const client = this.getPublicClient();
      const balance = (await client.readContract({
        address: this.dustContract,
        abi: DustTokenAbi,
        functionName: 'balanceOf',
        args: [this.normalizeAddress(user)],
      })) as bigint;

      console.log('balance', balance);
      return balance;
    } catch (error) {
      this.logger.error(`Failed to read DUST balance: ${error}`);
      throw new Error('Unable to fetch DUST balance');
    }
  }

  private async writeDustBurn(
    user: string,
    amountDust: bigint | number,
    context: string,
    allowSimulation = false,
  ) {
    const contractAddress = this.dustContract;
    if (!contractAddress) {
      if (allowSimulation) {
        return `offchain-burn-${context}-${Date.now()}`;
      }
      throw new Error('DUST_CONTRACT missing');
    }
    const wallet = this.getWalletClient();
    if (!wallet || !this.walletAccount) {
      if (allowSimulation) {
        return `simulated-burn-${context}-${Date.now()}`;
      }
      throw new Error('Wallet client missing for dust burn');
    }
    const amountWei = this.toDustWei(amountDust);
    this.logger.log(`burnDust context=${context} amount=${amountWei}`);
    try {
      return wallet.writeContract({
        address: contractAddress,
        abi: DustTokenAbi,
        functionName: 'burn',
        args: [this.normalizeAddress(user), amountWei],
        chain: this.chain,
        account: this.walletAccount,
      });
    } catch (error) {
      this.logger.error(`Failed to burn DUST (${context}): ${error}`);
      if (allowSimulation) {
        return `simulated-burn-${context}-${Date.now()}`;
      }
      throw error;
    }
  }
}
