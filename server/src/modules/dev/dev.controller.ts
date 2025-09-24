import {Request, Response} from 'express';
import {config} from '../../config';
import {prisma} from '../../db';
import {BuildStatus} from '@prisma/client';
import {logger} from '../../utils/logger';

/**
 * Development-only controller used to seed the database with sample data.
 *
 * Why: Tests and local UI development need predictable sample projects, builds,
 * and log entries. This endpoint centralizes that seed logic so developers can
 * quickly populate the DB when `DEV_SEED` is enabled.
 *
 * Safety: The endpoint checks the `DEV_SEED` flag and will return 403 when
 * seeding is intentionally disabled in non-dev environments.
 */
export class DevController {
  seedDatabase = async (req: Request, res: Response) => {
    if (!config.DEV_SEED) {
      return res.status(403).json({ error: 'Seeding is disabled' });
    }

    logger.info('Starting database seed...');

    // Clear existing sample data to make the operation idempotent for local dev.
    await prisma.logEntry.deleteMany({});
    await prisma.build.deleteMany({});
    await prisma.project.deleteMany({});

    // Create a single sample project used by the generated builds.
    const project = await prisma.project.create({
      data: { name: 'sample-repo', githubRepoUrl: 'org/sample-repo' },
    });

    const now = new Date();
    const buildsData = [
      // Successful finished build (older)
      { projectId: project.id, githubRunId: `run-${Date.now()}-1`, status: BuildStatus.SUCCESS, startedAt: new Date(now.getTime() - 600000), completedAt: new Date(now.getTime() - 480000), triggeringCommit: 'a1b2c3d' },
      // Failed build with a short failure reason to show error paths
      { projectId: project.id, githubRunId: `run-${Date.now()}-2`, status: BuildStatus.FAILURE, startedAt: new Date(now.getTime() - 300000), completedAt: new Date(now.getTime() - 240000), triggeringCommit: 'd4e5f6g', failureReason: 'Test suite failed', errorCategory: 'Test Failure' },
      // In-progress build (no completion time)
      { projectId: project.id, githubRunId: `run-${Date.now()}-3`, status: BuildStatus.RUNNING, startedAt: new Date(now.getTime() - 60000), completedAt: null, triggeringCommit: 'h7i8j9k' },
    ];

    // Persist builds and a few associated log lines for each.
    for (const b of buildsData) {
      const build = await prisma.build.create({ data: b as any });
      await prisma.logEntry.createMany({
        data: [
          { buildId: build.id, lineNumber: 1, content: `[INFO] Starting build for commit ${b.triggeringCommit}` },
          { buildId: build.id, lineNumber: 2, content: `[INFO] Running tests...` },
          // Add an error line for failed builds so the UI can surface it.
          ...(b.status === BuildStatus.FAILURE ? [{ buildId: build.id, lineNumber: 3, content: `[ERROR] Assertion failed: expected true but got false.` }] : []),
          // For finished builds, append a summary line.
          ...(b.status !== BuildStatus.RUNNING ? [{ buildId: build.id, lineNumber: 4, content: `[INFO] Build finished with status: ${b.status}` }] : []),
        ],
      });
    }

    logger.info('Database seeded successfully.');
    res.json({ ok: true, message: 'Database seeded successfully.' });
  };
}