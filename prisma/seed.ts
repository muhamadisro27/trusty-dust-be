import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.userTokenBalance.deleteMany();
  await prisma.postBoost.deleteMany();
  await prisma.postReaction.deleteMany();
  await prisma.postMedia.deleteMany();
  await prisma.post.deleteMany();
  await prisma.jobApplication.deleteMany();
  await prisma.jobEscrow.deleteMany();
  await prisma.job.deleteMany();
  await prisma.user.deleteMany();

  const alice = await prisma.user.create({
    data: {
      walletAddress: '0xalice000000000000000000000000000000000001',
      username: 'alice',
      tier: 'Dust',
      trustScore: 120,
    },
  });

  const bob = await prisma.user.create({
    data: {
      walletAddress: '0xbob0000000000000000000000000000000000002',
      username: 'bob',
      tier: 'Spark',
      trustScore: 360,
    },
  });

  const post = await prisma.post.create({
    data: {
      authorId: alice.id,
      text: 'Hello TrustyDust! This is the first post 🎉',
      ipfsCid: 'bafybeigdyrzt',
      media: {
        create: [{ url: 'https://images.dusty/posts/1.png' }],
      },
    },
    include: { media: true },
  });

  await prisma.postReaction.create({
    data: {
      userId: bob.id,
      postId: post.id,
      type: 'LIKE',
    },
  });

  await prisma.postReaction.create({
    data: {
      userId: bob.id,
      postId: post.id,
      type: 'COMMENT',
      commentText: 'Looks awesome!'
    },
  });

  await prisma.postBoost.create({
    data: {
      postId: post.id,
      userId: alice.id,
      dustSpent: 10,
      note: 'Featured post',
    },
  });

  const job = await prisma.job.create({
    data: {
      creatorId: alice.id,
      title: 'Design TrustyDust badge',
      description: 'Need an icon set for Dust/Spark/Flare/Nova tiers.',
      companyName: 'TrustyDust Labs',
      companyLogo: 'https://images.dusty/company/logo.png',
      location: 'Remote',
      jobType: 'Contract',
      requirements: ['3+ years design', 'Understands SBT concepts'],
      salaryMin: 300,
      salaryMax: 600,
      closeAt: new Date('2030-01-01T00:00:00.000Z'),
      minTrustScore: 200,
      reward: 500,
      status: 'OPEN',
    },
  });

  await prisma.jobApplication.create({
    data: {
      jobId: job.id,
      workerId: bob.id,
      status: 'APPLIED',
    },
  });

  await prisma.jobEscrow.create({
    data: {
      jobId: job.id,
      amount: 500,
      lockTxHash: '0xlock',
    },
  });

  await prisma.token.upsert({
    where: { symbol: 'DUST' },
    update: {},
    create: { symbol: 'DUST', description: 'Seeder token' },
  });

  console.log('Seed data inserted.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
