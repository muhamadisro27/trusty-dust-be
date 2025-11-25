import { EscrowService } from './escrow.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EscrowService', () => {
  const blockchain = {
    lockEscrow: jest.fn(),
    releaseEscrow: jest.fn(),
    refundEscrow: jest.fn(),
  } as unknown as BlockchainService;
  const prisma = {
    jobEscrow: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  let service: EscrowService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EscrowService(blockchain, prisma);
  });

  it('lock writes upsert with blockchain tx hash', async () => {
    (blockchain.lockEscrow as jest.Mock).mockResolvedValue('0xlock');
    (prisma.jobEscrow.upsert as jest.Mock).mockResolvedValue({ id: 'escrow' });

    const result = await service.lock('job', 1, 'poster', 'worker', 500);

    expect(blockchain.lockEscrow).toHaveBeenCalledWith(1, 'poster', 'worker', BigInt(500));
    expect(prisma.jobEscrow.upsert).toHaveBeenCalledWith({
      where: { jobId: 'job' },
      update: { lockTxHash: '0xlock', amount: 500 },
      create: { jobId: 'job', lockTxHash: '0xlock', amount: 500 },
    });
    expect(result).toEqual({ id: 'escrow' });
  });

  it('release updates escrow entry', async () => {
    (blockchain.releaseEscrow as jest.Mock).mockResolvedValue('0xrel');
    (prisma.jobEscrow.update as jest.Mock).mockResolvedValue({ releaseTxHash: '0xrel' });
    const result = await service.release('job', 3);
    expect(blockchain.releaseEscrow).toHaveBeenCalledWith(3);
    expect(prisma.jobEscrow.update).toHaveBeenCalledWith({
      where: { jobId: 'job' },
      data: { releaseTxHash: '0xrel' },
    });
    expect(result).toEqual({ releaseTxHash: '0xrel' });
  });

  it('refund updates escrow entry', async () => {
    (blockchain.refundEscrow as jest.Mock).mockResolvedValue('0xref');
    (prisma.jobEscrow.update as jest.Mock).mockResolvedValue({ refundTxHash: '0xref' });
    const result = await service.refund('job', 4);
    expect(blockchain.refundEscrow).toHaveBeenCalledWith(4);
    expect(prisma.jobEscrow.update).toHaveBeenCalledWith({
      where: { jobId: 'job' },
      data: { refundTxHash: '0xref' },
    });
    expect(result).toEqual({ refundTxHash: '0xref' });
  });
});
