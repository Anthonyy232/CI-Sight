import {prisma} from '../../db';
import {CryptoService} from '../../services/crypto.service';
import {GithubService} from '../../services/github.service';
import {AuthenticatedUser} from '../../types/express';
import {config} from '../../config';
import {logger} from '../../utils/logger';

export class ReposService {
  constructor(
    private cryptoService: CryptoService,
    private githubService: GithubService
  ) {}

  /**
   * Service responsible for linking GitHub repositories to projects and
   * managing remote webhooks. Tokens used for GitHub API calls are
   * decrypted per-request and never logged.
   *
   * Why: Keeps GitHub integration concerns in one place so controllers can
   * remain thin and focus on request/response shaping.
   */

  /**
   * Return the authenticated user's GitHub repositories by calling the
   * `GithubService` with the decrypted OAuth token.
   *
   * Inputs: `user` (from `req.user` populated by `auth.middleware`).
   * Returns: the array returned by `GithubService.fetchUserRepos`.
   */
  async listUserGithubRepos(user: AuthenticatedUser) {
    const token = this.cryptoService.decrypt(user.accessToken);
    if (!token) {
      throw new Error('Could not decrypt access token for user.');
    }
    return this.githubService.fetchUserRepos(token);
  }

  /**
   * List repositories the user has linked into CI-Sight projects.
   *
   * This returns a sanitized view of `repoLink` rows including the linked
   * project metadata. Deleted (soft-deleted) links are excluded.
   */
  async listLinkedRepos(userId: number) {
    const links = await prisma.repoLink.findMany({
      where: { userId, deletedAt: null }, // Only show active links
      include: { project: true },
      orderBy: { createdAt: 'desc' },
    });

    return links.map(link => ({
      id: link.id,
      repoFullName: link.repoFullName,
      webhookId: link.webhookId,
      project: {
        id: link.project.id,
        name: link.project.name,
      },
    }));
  }

  /**
   * Registers a webhook on the given GitHub repository and stores the link.
   *
   * Behaviour: Attempts to create the webhook on GitHub but will still
   * create the local `repoLink` record even if webhook creation fails. This
   * avoids trapping the user in an inconsistent state if GitHub rejects the
   * hook (e.g., missing permissions).
   */
  async registerRepoWebhook(user: AuthenticatedUser, projectId: number, repoFullName: string) {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) {
      throw new Error('Invalid repository name format. Expected "owner/repo".');
    }

    const token = this.cryptoService.decrypt(user.accessToken);
    if (!token) {
      throw new Error('Could not decrypt access token for user.');
    }

    const webhookUrl = `${config.PUBLIC_URL}/api/webhooks/github`;
    let createdHook: { id: number } | null = null;
    try {
      createdHook = await this.githubService.createWebhook(owner, repo, token, webhookUrl, config.GITHUB_WEBHOOK_SECRET);
    } catch (err) {
      logger.error('GitHub webhook creation failed, but repo link will still be created.', {
        repoFullName,
        error: (err as any)?.response?.data || (err as Error).message,
      });
    }

    return prisma.repoLink.create({
      data: {
        userId: user.id,
        projectId,
        repoFullName,
        webhookId: createdHook?.id ?? null,
      },
    });
  }

  /**
   * Soft-delete a linked repository. If a webhook exists the service will
   * attempt to delete it on GitHub but will proceed to mark the local
   * `repoLink` as deleted regardless of remote success.
   */
  async deleteLinkedRepo(userId: number, linkId: number) {
    const link = await prisma.repoLink.findFirst({
      where: { id: linkId, userId },
    });

    if (!link) {
      throw new Error('Repo link not found or access denied.');
    }

    if (link.webhookId) {
      const [owner, repo] = link.repoFullName.split('/');
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const token = user ? this.cryptoService.decrypt(user.accessToken) : null;
      if (token) {
        // This will log errors but not prevent deletion of the local record.
        await this.githubService.deleteWebhook(owner, repo, link.webhookId, token);
      }
    }

    // Soft-delete: set deletedAt so we can restore if needed.
    await prisma.repoLink.update({ where: { id: linkId }, data: { deletedAt: new Date() } });
  }

  /**
   * Restore a previously soft-deleted repo link. Note: this does not
   * re-create a missing webhook on GitHub; restoring only affects the local
   * database row.
   */
  async restoreLinkedRepo(userId: number, linkId: number) {
    const link = await prisma.repoLink.findFirst({ where: { id: linkId, userId } });
    if (!link) {
      throw new Error('Repo link not found or access denied.');
    }

    // Note: Does not automatically re-create the webhook if it was deleted, may need to re-link to re-establish the webhook.
    await prisma.repoLink.update({ where: { id: linkId }, data: { deletedAt: null } });
  }
}