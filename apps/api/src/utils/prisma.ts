import { PrismaClient } from '@prisma/client';

declare global {
  // allow global `var` declarations
  // eslint-disable-next-line no-var
  var prisma: any | undefined;
}

function createPrismaClient() {
  const basePrisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  return basePrisma.$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        const executeWithRetry = async (retries = 2): Promise<any> => {
          try {
            return await query(args);
          } catch (error: any) {
            const msg = error?.message || '';
            const isConnectionDrop =
              msg.includes('Server has closed the connection') ||
              msg.includes('Connection closed') ||
              msg.includes('connection reset') ||
              msg.includes('connection terminated') ||
              msg.includes("Can't reach database server");

            if (isConnectionDrop && retries > 0) {
              console.warn(
                `[Prisma Auto-Reconnect] Retrying ${String(model)}.${String(operation)} after connection drop... (${retries} retries left)`
              );
              await new Promise((res) => setTimeout(res, 300));
              return await executeWithRetry(retries - 1);
            }
            throw error;
          }
        };
        return executeWithRetry();
      },
    },
  });
}

export const prisma = (global.prisma || createPrismaClient()) as PrismaClient & {
  authorizedTeacher: any;
  examKeyUsage: any;
};

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
