declare global {
  var prisma: PrismaClient | undefined;
}
import {PrismaClient} from '@prisma/client';

/**
 * Singleton Prisma client.
 */
declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}