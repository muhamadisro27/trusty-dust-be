import { ConfigService } from '@nestjs/config';
import { BlockchainService } from './blockchain.service';
import { AbiLoaderService } from './abi-loader.service';

jest.mock('viem', () => ({
  createPublicClient: jest.fn(() => ({ readContract: jest.fn().mockResolvedValue(true) })),
  createWalletClient: jest.fn(() => ({ writeContract: jest.fn().mockResolvedValue('0xtx') })),
  http: jest.fn(),
}));
jest.mock('viem/accounts', () => ({ privateKeyToAccount: jest.fn(() => ({ address: '0xabc' })) }));

describe('BlockchainService', () => {
  const mockConfig = {
    get: jest.fn(),
  } as unknown as ConfigService;
  const mockAbiLoader = {
    loadAbi: jest.fn(() => []),
  } as unknown as AbiLoaderService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when TRUST_VERIFICATION_ADDRESS missing', async () => {
    (mockConfig.get as jest.Mock).mockReturnValueOnce(undefined); // RPC_URL
    (mockConfig.get as jest.Mock).mockReturnValueOnce(undefined); // TRUST_VERIFICATION_ADDRESS
    const service = new BlockchainService(mockConfig, mockAbiLoader);
    const result = await service.verifyTrustProof({ proof: '0xproof', publicInputs: [] });
    expect(result).toBe(true);
  });

  it('falls back to simulated lock when wallet missing', async () => {
    (mockConfig.get as jest.Mock)
      .mockReturnValueOnce('https://rpc')
      .mockReturnValueOnce('0xContract')
      .mockReturnValueOnce(undefined); // ESCROW_SIGNER_KEY
    const service = new BlockchainService(mockConfig, mockAbiLoader);
    const result = await service.lockEscrow(1, 'poster', 'worker', BigInt(10));
    expect(result).toContain('simulated-lock');
  });

  it('burnDustBoost uses wallet client when configured', async () => {
    (mockConfig.get as jest.Mock)
      .mockReturnValueOnce('https://rpc')
      .mockReturnValueOnce('0xDust')
      .mockReturnValueOnce('0xkey');
    const service = new BlockchainService(mockConfig, mockAbiLoader);
    const result = await service.burnDustBoost('0xUser', BigInt(10), 5);
    expect(result).toEqual('0xtx');
  });
});
