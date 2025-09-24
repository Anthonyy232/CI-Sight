import {prisma} from '../../db';
import {Prisma} from '@prisma/client';
import {logger} from '../../utils/logger';
import {CryptoService} from '../../services/crypto.service';
import {GithubService} from '../../services/github.service';

/**
 * Domain logic for projects.
 *
 * Responsibilities include normalizing GitHub repo input, creating project
 * records, and coordinating cleanup of remote webhooks when a project is deleted.
 */
export class ProjectsService {
  constructor(
    private cryptoService: CryptoService,
    private githubService: GithubService
  ) {}

  async listProjects() {
    return prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, githubRepoUrl: true, createdAt: true },
    });
  }

  async getProject(projectId: number) {
    return prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, githubRepoUrl: true, createdAt: true },
    });
  }

  private normalizeGithubUrl(url: string): string {
    try {
      // Use URL constructor for robust parsing, then extract pathname.
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname.toLowerCase() !== 'github.com') {
        throw new Error('URL is not a github.com URL');
      }
      // Pathname will be like '/owner/repo.git', remove leading slash and trailing '.git'
      return parsedUrl.pathname.substring(1).replace(/\.git$/, '');
    } catch {
      // Fallback for 'owner/repo' format
      return url.trim().replace(/\.git$/, '').replace(/\/$/, '');
    }
  }

  async createProject(name: string, githubRepoUrl: string) {
    const normalizedUrl = this.normalizeGithubUrl(githubRepoUrl);
    logger.info('Attempting to create project', { name, originalUrl: githubRepoUrl, normalizedUrl });

    const parts = normalizedUrl.split('/');
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      throw new Error('Invalid githubRepoUrl format; expected owner/repo');
    }

    try {
      return await prisma.project.create({
        data: { name, githubRepoUrl: normalizedUrl },
        select: { id: true, name: true, githubRepoUrl: true, createdAt: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        logger.warn('Project already exists, fetching existing record', { githubRepoUrl: normalizedUrl });
        const existing = await prisma.project.findUnique({
          where: { githubRepoUrl: normalizedUrl },
          select: { id: true, name: true, githubRepoUrl: true, createdAt: true },
        });
        if (existing) return existing;
      }
      throw err;
    }
  }

  async getBuildsForProject(projectId: number) {
    const builds = await prisma.build.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      take: 50,
      select: { id: true, status: true, startedAt: true, completedAt: true, githubRunId: true, triggeringCommit: true },
    });

    return builds.map(b => ({
      id: b.id,
      status: b.status,
      commit: b.triggeringCommit || String(b.githubRunId).slice(0, 8),
      startedAt: b.startedAt.toISOString(),
      completedAt: b.completedAt?.toISOString() ?? null,
    }));
  }

  async deleteProject(userId: number, projectId: number) {
    logger.info('Attempting to delete project', { userId, projectId });

    // Find all repo links for this project to delete remote webhooks.
    const links = await prisma.repoLink.findMany({
      where: { projectId },
      include: { user: true },
    });

    for (const link of links) {
      if (link.webhookId) {
        const [owner, repo] = link.repoFullName.split('/');
        const token = this.cryptoService.decrypt(link.user.accessToken);
        if (token) {
          await this.githubService.deleteWebhook(owner, repo, link.webhookId, token);
        }
      }
    }

    // The database will cascade delete all related builds, logs, and repo links.
    return prisma.project.delete({ where: { id: projectId } });
  }
}