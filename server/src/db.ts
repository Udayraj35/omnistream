
 import { PrismaClient } from '@prisma/client';

 export const prisma = new PrismaClient();

// In environments where `prisma generate` has not been run, the @prisma/client package 
// does not export PrismaClient. We provide a mock implementation here to allow the 
// server to start and run in demo mode.


