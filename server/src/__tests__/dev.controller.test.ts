import { DevController } from '../modules/dev/dev.controller';
import { prisma } from '../db';
import { config } from '../config';

jest.mock('../config');

/**
 * Test suite for the DevController.
 * This suite verifies the functionality of development-only endpoints,
 * primarily focusing on the database seeding mechanism.
 */
describe('DevController', () => {
  let controller: DevController;

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new DevController();
  });

  /**
   * Verifies that the database seeding endpoint is disabled and returns a 403 Forbidden
   * response when the `DEV_SEED` configuration flag is false.
   */
  it('should return 403 when DEV_SEED is disabled', async () => {
    (config as any).DEV_SEED = false;
    const req: any = {};
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.seedDatabase(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Seeding is disabled' });
  });

  /**
   * Verifies that the database seeding logic is executed when the `DEV_SEED`
   * configuration flag is true.
   */
  it('should run seeding when DEV_SEED is true', async () => {
    (config as any).DEV_SEED = true;
    const db = require('../db');
    db.prisma.logEntry = { deleteMany: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({}) };
    db.prisma.build = { deleteMany: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({ id: 1 }) };
    db.prisma.project = { deleteMany: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({ id: 2 }) };

    const req: any = {};
    const res: any = { json: jest.fn() };

    await controller.seedDatabase(req, res);

    expect(prisma.project.deleteMany).toHaveBeenCalled();
    expect(prisma.build.deleteMany).toHaveBeenCalled();
    expect(prisma.logEntry.deleteMany).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, message: 'Database seeded successfully.' });
  });
});