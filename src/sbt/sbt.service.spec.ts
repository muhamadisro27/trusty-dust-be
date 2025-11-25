import { SbtService } from './sbt.service';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';

describe('SbtService', () => {
  const prisma = {
    sbtToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;
  const blockchain = { updateSbtMetadata: jest.fn() } as unknown as BlockchainService;

  let service: SbtService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SbtService(prisma, blockchain);
  });

  it('mints new SBT when none exists', async () => {
    (prisma.sbtToken.findUnique as jest.Mock).mockResolvedValue(null);
    (blockchain.updateSbtMetadata as jest.Mock).mockResolvedValue('0xmint');
    (prisma.sbtToken.create as jest.Mock).mockResolvedValue({ id: 'sbt', tokenId: 1 });

    const sbt = await service.ensureSbt('user', 'Spark', '0xabc');

    expect(blockchain.updateSbtMetadata).toHaveBeenCalledWith(expect.any(Number), 'Spark', 'mint', '0xabc');
    expect(prisma.sbtToken.create).toHaveBeenCalled();
    expect(sbt).toEqual({ id: 'sbt', tokenId: 1 });
  });

  it('updates SBT when exists', async () => {
    (prisma.sbtToken.findUnique as jest.Mock).mockResolvedValue({ id: 'sbt', tokenId: 10 });
    (blockchain.updateSbtMetadata as jest.Mock).mockResolvedValue('0xupdate');
    (prisma.sbtToken.update as jest.Mock).mockResolvedValue({ id: 'sbt', tier: 'Nova' });

    const sbt = await service.ensureSbt('user', 'Nova', '0xabc');
    expect(blockchain.updateSbtMetadata).toHaveBeenCalledWith(10, 'Nova', 'update');
    expect(sbt).toEqual({ id: 'sbt', tier: 'Nova' });
  });
});
