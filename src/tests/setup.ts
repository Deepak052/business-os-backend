import { prisma } from '../utils/prisma';

beforeAll(async () => {
  // Can connect or reset test db
});

afterAll(async () => {
  await prisma.$disconnect();
});
