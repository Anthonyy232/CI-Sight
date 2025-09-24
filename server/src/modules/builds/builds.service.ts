import {prisma} from '../../db';

/**
 * Service containing business logic around builds.
 */
export class BuildsService {
  /**
   * Returns recent builds formatted for UI consumption.
   * @param limit Maximum number of builds to return.
   */
  async getRecentBuilds(limit: number) {
    const builds = await prisma.build.findMany({
      take: limit,
      orderBy: { startedAt: 'desc' },
      include: { project: { select: { name: true } } },
    });

    return builds.map(b => ({
      id: b.id,
      projectName: b.project.name,
      status: b.status,
      // Use triggeringCommit when available; otherwise derive a short id from the run id
      commit: b.triggeringCommit || String(b.githubRunId).slice(0, 8),
      startedAt: b.startedAt.toISOString(),
      completedAt: b.completedAt?.toISOString() ?? null,
    }));
  }

  /**
   * Return detailed build payload including concatenated logs.
   * The logs are returned as a single string (lines joined by \n) for the client to virtualize.
   */
  async getBuildDetails(id: number) {
    const build = await prisma.build.findUnique({
      where: { id },
      include: {
        project: { select: { name: true, githubRepoUrl: true } },
        logEntries: { orderBy: { lineNumber: 'asc' }, select: { lineNumber: true, content: true } },
      },
    });

    if (!build) {
      return null;
    }

    return {
      id: build.id,
      projectName: build.project.name,
      githubRepoUrl: build.project.githubRepoUrl,
      githubRunId: build.githubRunId,
      status: build.status,
      startedAt: build.startedAt.toISOString(),
      completedAt: build.completedAt?.toISOString() ?? null,
      failureReason: build.failureReason,
      errorCategory: build.errorCategory,
      logs: build.logEntries.map(l => l.content).join('\n'),
    };
  }

  /**
   * Aggregate recent failed builds to produce simple error analytics.
   * Returns top categories and their counts.
   */
  async getErrorAnalytics() {
    const failedBuilds = await prisma.build.findMany({
      where: { status: 'FAILURE' },
      select: { errorCategory: true },
      orderBy: { startedAt: 'desc' },
      take: 100, // Last 100 failed builds
    });

    const categoryCounts: Record<string, number> = {};
    failedBuilds.forEach(build => {
      if (build.errorCategory) {
        categoryCounts[build.errorCategory] = (categoryCounts[build.errorCategory] || 0) + 1;
      }
    });

    const totalFailed = failedBuilds.length;
    const categories = Object.entries(categoryCounts)
      .map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / totalFailed) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 categories

    return {
      totalFailed,
      categories,
    };
  }
}