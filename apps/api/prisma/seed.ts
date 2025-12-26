import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create a test user (you'll need to connect with this wallet to see the drop)
  // This is a placeholder pubkey - replace with your actual test wallet
  const testWalletPubkey = '11111111111111111111111111111111'; // System program address as placeholder

  const user = await prisma.user.upsert({
    where: { walletPubkey: testWalletPubkey },
    update: {},
    create: {
      walletPubkey: testWalletPubkey,
    },
  });

  console.log(`✅ Created/found user: ${user.id}`);

  // Create a sample DRAFT drop for UI testing
  // This drop has NO tokenMint - user must go through the real launch flow
  const slug = `test-drop-${nanoid(8)}`;
  
  const drop = await prisma.drop.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      ownerUserId: user.id,
      name: 'Test Stream Token',
      symbol: 'TSTREAM',
      description: 'A test token for LiveDrops development. Go through the launch flow to create a real token.',
      prizePoolWallet: '11111111111111111111111111111111', // Placeholder - replace with real wallet
      streamerBps: 5000, // 50%
      prizePoolBps: 5000, // 50%
      holderThresholdRaw: '1000000', // 1 token with 6 decimals
      initialBuyLamports: '10000000', // 0.01 SOL
      status: 'DRAFT',
    },
  });

  console.log(`✅ Created DRAFT drop: ${drop.slug}`);
  console.log(`   Name: ${drop.name}`);
  console.log(`   Symbol: ${drop.symbol}`);
  console.log(`   Status: ${drop.status}`);
  console.log('');
  console.log('📝 Note: This is a DRAFT drop with no tokenMint.');
  console.log('   Connect your wallet and go through the launch flow to create a real token.');
  console.log('');
  console.log('🔗 URLs after launch:');
  console.log(`   Dashboard: /dashboard`);
  console.log(`   Viewer: /d/${drop.slug}`);
  console.log(`   Overlay: /overlay/${drop.slug}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
