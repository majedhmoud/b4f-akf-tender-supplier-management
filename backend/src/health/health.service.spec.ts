import { PrismaService } from '../prisma/prisma.service.js';
import { HealthService } from './health.service.js';

// Pins the health contract: the API reports the database state instead of
// failing, so the web app can tell "API down" from "database down".
describe('HealthService', () => {
  let prisma: { $queryRaw: ReturnType<typeof vi.fn> };
  let service: HealthService;

  beforeEach(() => {
    prisma = { $queryRaw: vi.fn() };
    service = new HealthService(prisma as unknown as PrismaService);
  });

  it('reports the database as up when a query succeeds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.check()).resolves.toEqual({ status: 'ok', database: 'up' });
  });

  it('reports the database as down, without throwing, when a query fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(service.check()).resolves.toEqual({ status: 'ok', database: 'down' });
  });
});
