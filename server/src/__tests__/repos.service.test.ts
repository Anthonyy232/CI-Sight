import {ReposService} from '../modules/repos/repos.service';
import {prisma} from '../db';
import {CryptoService} from '../services/crypto.service';
import {GithubService} from '../services/github.service';
import {AuthenticatedUser} from '../types/express';

jest.mock('../db', () => ({
  prisma: {
    repoLink: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));
jest.mock('../services/crypto.service');
jest.mock('../services/github.service');
jest.mock('../config', () => ({
  config: {
    PUBLIC_URL: 'https://example.com',
    GITHUB_WEBHOOK_SECRET: 'test-secret',
  },
}));
jest.mock('../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedCryptoService = CryptoService as jest.MockedClass<typeof CryptoService>;
const mockedGithubService = GithubService as jest.MockedClass<typeof GithubService>;

/**
 * Test suite for the ReposService.
 * This suite verifies the business logic for managing repository links, including
 * interaction with the GitHub API, token decryption, and database operations.
 */
describe('ReposService', () => {
  let reposService: ReposService;
  let cryptoService: jest.Mocked<CryptoService>;
  let githubService: jest.Mocked<GithubService>;

  const mockUser: AuthenticatedUser = {
    id: 1,
    login: 'testuser',
    accessToken: 'encrypted-token',
  };

  beforeEach(() => {
    cryptoService = new mockedCryptoService() as jest.Mocked<CryptoService>;
    githubService = new mockedGithubService() as jest.Mocked<GithubService>;
    reposService = new ReposService(cryptoService, githubService);
    jest.clearAllMocks();
  });

  /**
   * Tests for listing a user's repositories from GitHub.
   */
  describe('listUserGithubRepos', () => {
    /**
     * Verifies that the user's access token is decrypted and used to fetch their
     * repositories from the GitHub API.
     */
    it('should return user GitHub repos successfully', async () => {
      const mockRepos = [
        { id: 1, full_name: 'owner/repo1', name: 'repo1', private: false },
        { id: 2, full_name: 'owner/repo2', name: 'repo2', private: true },
      ];
      cryptoService.decrypt.mockReturnValue('decrypted-token');
      githubService.fetchUserRepos.mockResolvedValue(mockRepos);

      const result = await reposService.listUserGithubRepos(mockUser);

      expect(cryptoService.decrypt).toHaveBeenCalledWith('encrypted-token');
      expect(githubService.fetchUserRepos).toHaveBeenCalledWith('decrypted-token');
      expect(result).toEqual(mockRepos);
    });

    /**
     * Ensures an error is thrown if the user's access token cannot be decrypted.
     */
    it('should throw error when token decryption fails', async () => {
      cryptoService.decrypt.mockReturnValue('');

      await expect(reposService.listUserGithubRepos(mockUser)).rejects.toThrow(
        'Could not decrypt access token for user.'
      );
      expect(githubService.fetchUserRepos).not.toHaveBeenCalled();
    });
  });

  /**
   * Tests for listing repositories that are linked within the application.
   */
  describe('listLinkedRepos', () => {
    /**
     * Verifies that linked repositories for a user are fetched from the database
     * and formatted correctly for the response.
     */
    it('should return linked repos for user', async () => {
      const mockLinks = [
        {
          id: 1,
          repoFullName: 'owner/repo1',
          webhookId: 123,
          createdAt: new Date('2023-01-01T00:00:00Z'),
          project: { id: 1, name: 'project-1' },
        },
        {
          id: 2,
          repoFullName: 'owner/repo2',
          webhookId: null,
          createdAt: new Date('2023-01-02T00:00:00Z'),
          project: { id: 2, name: 'project-2' },
        },
      ];
      (mockedPrisma.repoLink.findMany as jest.Mock).mockResolvedValue(mockLinks);

      const result = await reposService.listLinkedRepos(1);

      expect(mockedPrisma.repoLink.findMany).toHaveBeenCalledWith({
        where: { userId: 1, deletedAt: null },
        include: { project: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([
        { id: 1, repoFullName: 'owner/repo1', webhookId: 123, project: { id: 1, name: 'project-1' } },
        { id: 2, repoFullName: 'owner/repo2', webhookId: null, project: { id: 2, name: 'project-2' } },
      ]);
    });

    /**
     * Ensures the method returns an empty array if the user has no linked repos.
     */
    it('should handle empty results', async () => {
      (mockedPrisma.repoLink.findMany as jest.Mock).mockResolvedValue([]);

      const result = await reposService.listLinkedRepos(1);

      expect(result).toEqual([]);
    });
  });

  /**
   * Tests for registering a new repository webhook and creating a link.
   */
  describe('registerRepoWebhook', () => {
    /**
     * Verifies the end-to-end process of creating a webhook on GitHub and then
     * creating a corresponding `RepoLink` record in the database.
     */
    it('should register webhook and create repo link successfully', async () => {
      const mockCreatedHook = { id: 123 };
      const mockCreatedLink = { id: 1, userId: 1, projectId: 1, repoFullName: 'owner/repo', webhookId: 123 };
      cryptoService.decrypt.mockReturnValue('decrypted-token');
      githubService.createWebhook.mockResolvedValue(mockCreatedHook);
      (mockedPrisma.repoLink.create as jest.Mock).mockResolvedValue(mockCreatedLink);

      const result = await reposService.registerRepoWebhook(mockUser, 1, 'owner/repo');

      expect(cryptoService.decrypt).toHaveBeenCalledWith('encrypted-token');
      expect(githubService.createWebhook).toHaveBeenCalledWith(
        'owner', 'repo', 'decrypted-token', 'https://example.com/api/webhooks/github', 'test-secret'
      );
      expect(mockedPrisma.repoLink.create).toHaveBeenCalledWith({
        data: { userId: 1, projectId: 1, repoFullName: 'owner/repo', webhookId: 123 },
      });
      expect(result).toEqual(mockCreatedLink);
    });

    /**
     * Verifies that a `RepoLink` record is still created (with a null webhookId)
     * even if the GitHub API call to create the webhook fails.
     */
    it('should create repo link even if webhook creation fails', async () => {
      const mockCreatedLink = { id: 1, userId: 1, projectId: 1, repoFullName: 'owner/repo', webhookId: null };
      cryptoService.decrypt.mockReturnValue('decrypted-token');
      githubService.createWebhook.mockRejectedValue(new Error('Webhook creation failed'));
      (mockedPrisma.repoLink.create as jest.Mock).mockResolvedValue(mockCreatedLink);

      const result = await reposService.registerRepoWebhook(mockUser, 1, 'owner/repo');

      expect(githubService.createWebhook).toHaveBeenCalled();
      expect(mockedPrisma.repoLink.create).toHaveBeenCalledWith({
        data: { userId: 1, projectId: 1, repoFullName: 'owner/repo', webhookId: null },
      });
      expect(result).toEqual(mockCreatedLink);
    });

    /**
     * Ensures an error is thrown if the repository name is not in the "owner/repo" format.
     */
    it('should throw error for invalid repo format', async () => {
      await expect(reposService.registerRepoWebhook(mockUser, 1, 'invalid-repo')).rejects.toThrow(
        'Invalid repository name format. Expected "owner/repo".'
      );
      expect(githubService.createWebhook).not.toHaveBeenCalled();
    });

    /**
     * Ensures an error is thrown if the user's access token cannot be decrypted.
     */
    it('should throw error when token decryption fails', async () => {
      cryptoService.decrypt.mockReturnValue('');
      await expect(reposService.registerRepoWebhook(mockUser, 1, 'owner/repo')).rejects.toThrow(
        'Could not decrypt access token for user.'
      );
      expect(githubService.createWebhook).not.toHaveBeenCalled();
    });
  });

  /**
   * Tests for the soft deletion of a linked repository.
   */
  describe('deleteLinkedRepo', () => {
    /**
     * Verifies that deleting a link also triggers the deletion of the associated
     * webhook on GitHub and sets the `deletedAt` field in the database.
     */
    it('should delete repo link and webhook successfully', async () => {
      const mockLink = { id: 1, userId: 1, repoFullName: 'owner/repo', webhookId: 123 };
      const mockUserRecord = { id: 1, accessToken: 'encrypted-token' };
      (mockedPrisma.repoLink.findFirst as jest.Mock).mockResolvedValue(mockLink);
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUserRecord);
      cryptoService.decrypt.mockReturnValue('decrypted-token');
      githubService.deleteWebhook.mockResolvedValue(true);
      (mockedPrisma.repoLink.update as jest.Mock).mockResolvedValue({ ...mockLink, deletedAt: new Date() });

      await reposService.deleteLinkedRepo(1, 1);

      expect(mockedPrisma.repoLink.findFirst).toHaveBeenCalledWith({ where: { id: 1, userId: 1 } });
      expect(cryptoService.decrypt).toHaveBeenCalledWith('encrypted-token');
      expect(githubService.deleteWebhook).toHaveBeenCalledWith('owner', 'repo', 123, 'decrypted-token');
      expect(mockedPrisma.repoLink.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { deletedAt: expect.any(Date) },
      });
    });

    /**
     * Verifies that a link without a webhook can still be successfully soft-deleted.
     */
    it('should delete repo link without webhook', async () => {
      const mockLink = { id: 1, userId: 1, repoFullName: 'owner/repo', webhookId: null };
      (mockedPrisma.repoLink.findFirst as jest.Mock).mockResolvedValue(mockLink);
      (mockedPrisma.repoLink.update as jest.Mock).mockResolvedValue({ ...mockLink, deletedAt: new Date() });

      await reposService.deleteLinkedRepo(1, 1);

      expect(githubService.deleteWebhook).not.toHaveBeenCalled();
      expect(mockedPrisma.repoLink.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { deletedAt: expect.any(Date) },
      });
    });

    /**
     * Verifies that the repo link is still soft-deleted in the database even if the
     * GitHub API call to delete the webhook fails.
     */
    it('should handle webhook deletion failure gracefully', async () => {
      const mockLink = { id: 1, userId: 1, repoFullName: 'owner/repo', webhookId: 123 };
      const mockUserRecord = { id: 1, accessToken: 'encrypted-token' };
      (mockedPrisma.repoLink.findFirst as jest.Mock).mockResolvedValue(mockLink);
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUserRecord);
      cryptoService.decrypt.mockReturnValue('decrypted-token');
      githubService.deleteWebhook.mockResolvedValue(false);
      (mockedPrisma.repoLink.update as jest.Mock).mockResolvedValue({ ...mockLink, deletedAt: new Date() });

      await reposService.deleteLinkedRepo(1, 1);

      expect(githubService.deleteWebhook).toHaveBeenCalled();
      expect(mockedPrisma.repoLink.update).toHaveBeenCalled();
    });

    /**
     * Ensures an error is thrown if the repo link is not found or does not belong to the user.
     */
    it('should throw error when repo link not found', async () => {
      (mockedPrisma.repoLink.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(reposService.deleteLinkedRepo(1, 999)).rejects.toThrow('Repo link not found or access denied.');
      expect(githubService.deleteWebhook).not.toHaveBeenCalled();
    });

    /**
     * Verifies that the link is still soft-deleted even if token decryption fails,
     * though the webhook cannot be deleted in this case.
     */
    it('should handle token decryption failure gracefully', async () => {
      const mockLink = { id: 1, userId: 1, repoFullName: 'owner/repo', webhookId: 123 };
      const mockUserRecord = { id: 1, accessToken: 'encrypted-token' };
      (mockedPrisma.repoLink.findFirst as jest.Mock).mockResolvedValue(mockLink);
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUserRecord);
      cryptoService.decrypt.mockReturnValue('');
      (mockedPrisma.repoLink.update as jest.Mock).mockResolvedValue({ ...mockLink, deletedAt: new Date() });

      await reposService.deleteLinkedRepo(1, 1);

      expect(githubService.deleteWebhook).not.toHaveBeenCalled();
      expect(mockedPrisma.repoLink.update).toHaveBeenCalled();
    });
  });

  /**
   * Tests for restoring a soft-deleted repository link.
   */
  describe('restoreLinkedRepo', () => {
    /**
     * Verifies that a soft-deleted link can be restored by setting its `deletedAt` field to null.
     */
    it('should restore soft-deleted repo link', async () => {
      const mockLink = { id: 1, userId: 1, repoFullName: 'owner/repo', webhookId: 123, deletedAt: new Date() };
      (mockedPrisma.repoLink.findFirst as jest.Mock).mockResolvedValue(mockLink);
      (mockedPrisma.repoLink.update as jest.Mock).mockResolvedValue({ ...mockLink, deletedAt: null });

      await reposService.restoreLinkedRepo(1, 1);

      expect(mockedPrisma.repoLink.findFirst).toHaveBeenCalledWith({ where: { id: 1, userId: 1 } });
      expect(mockedPrisma.repoLink.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { deletedAt: null },
      });
    });

    /**
     * Ensures an error is thrown if attempting to restore a link that does not exist.
     */
    it('should throw error when repo link not found', async () => {
      (mockedPrisma.repoLink.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(reposService.restoreLinkedRepo(1, 999)).rejects.toThrow('Repo link not found or access denied.');
      expect(mockedPrisma.repoLink.update).not.toHaveBeenCalled();
    });
  });
});