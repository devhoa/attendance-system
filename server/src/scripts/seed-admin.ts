import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@attendance.local';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123';

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: passwordHash,
      role: 'ADMIN',
    },
    create: {
      email,
      password: passwordHash,
      role: 'ADMIN',
    },
  });

  console.log(`Admin account ready: ${user.email} | role=${user.role}`);
}

main()
  .catch((error) => {
    console.error('Failed to seed admin account:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
