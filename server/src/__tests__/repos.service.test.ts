import {ReposService} from '../modules/repos/repos.service';
import {prisma} from '../db';
import {CryptoService} from '../services/crypto.service';
import {GithubService} from '../services/github.service';
import {AuthenticatedUser} from '../types/express';

// Mock dependencies
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

  describe('listUserGithubRepos', () => {
    it('should return user GitHub repos successfully', async () => {
      // Arrange
      const mockRepos = [
        { id: 1, full_name: 'owner/repo1', name: 'repo1', private: false },
        { id: 2, full_name: 'owner/repo2', name: 'repo2', private: true },
      ];

      cryptoService.decrypt.mockReturnValue('decrypted-token');
      githubService.fetchUserRepos.mockResolvedValue(mockRepos);

      // Act
      const result = await reposService.listUserGithubRepos(mockUser);

      // Assert
      expect(cryptoService.decrypt).toHaveBeenCalledWith('encrypted-token');
      expect(githubService.fetchUserRepos).toHaveBeenCalledWith('decrypted-token');
      expect(result).toEqual(mockRepos);
    });

    it('should throw error when token decryption fails', async () => {
      // Arrange
      cryptoService.decrypt.mockReturnValue('');

      // Act & Assert
      await expect(reposService.listUserGithubRepos(mockUser)).rejects.toThrow(
        'Could not decrypt access token for user.'
      );
      expect(githubService.fetchUserRepos).not.toHaveBeenCalled();
    });
  });

  describe('listLinkedRepos', () => {
    it('should return linked repos for user', async () => {
      // Arrange
      const mockLinks = [
        {
          id: 1,
          repoFullName: 'owner/repo1',
          webhookId: 123,
          createdAt: new Date('2023-01-01T00:00:00Z'),
          project: {
            id: 1,
            name: 'project-1',
          },
        },
        {
          id: 2,
          repoFullName: 'owner/repo2',
          webhookId: null,
          createdAt: new Date('2023-01-02T00:00:00Z'),
          project: {
            id: 2,
            name: 'project-2',
          },
        },
      ];

      (mockedPrisma.repoLink.findMany as jest.Mock).mockResolvedValue(mockLinks);

      // Act
      const result = await reposService.listLinkedRepos(1);

      // Assert
      expect(mockedPrisma.repoLink.findMany).toHaveBeenCalledWith({
        where: { userId: 1, deletedAt: null },
        include: { project: true },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toEqual([
        {
          id: 1,
          repoFullName: 'owner/repo1',
          webhookId: 123,
          project: {
            id: 1,
            name: 'project-1',
          },
        },
        {
          id: 2,
          repoFullName: 'owner/repo2',
          webhookId: null,
          project: {
            id: 2,
            name: 'project-2',
          },
        },
      ]);
    });

    it('should handle empty results', async () => {
      // Arrange
      (mockedPrisma.repoLink.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await reposService.listLinkedRepos(1);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('registerRepoWebhook', () => {
    it('should register webhook and create repo link successfully', async () => {
      // Arrange
      const mockCreatedHook = { id: 123 };
      const mockCreatedLink = {
        id: 1,
        userId: 1,
        projectId: 1,
        repoFullName: 'owner/repo',
        webhookId: 123,
      };

      cryptoService.decrypt.mockReturnValue('decrypted-token');
      githubService.createWebhook.mockResolvedValue(mockCreatedHook);
      (mockedPrisma.repoLink.create as jest.Mock).mockResolvedValue(mockCreatedLink);

      // Act
      const result = await reposService.registerRepoWebhook(mockUser, 1, 'owner/repo');

      // Assert
      expect(cryptoService.decrypt).toHaveBeenCalledWith('encrypted-token');
      expect(githubService.createWebhook).toHaveBeenCalledWith(
        'owner',
        'repo',
        'decrypted-token',
        'https://example.com/api/webhooks/github',
        'test-secret'
      );
      expect(mockedPrisma.repoLink.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          projectId: 1,
          repoFullName: 'owner/repo',
          webhookId: 123,
        },
      });
      expect(result).toEqual(mockCreatedLink);
    });

    it('should create repo link even if webhook creation fails', async () => {
      // Arrange
      const mockCreatedLink = {
        id: 1,
        userId: 1,
        projectId: 1,
        repoFullName: 'owner/repo',
        webhookId: null,
      };

      cryptoService.decrypt.mockReturnValue('decrypted-token');
      githubService.createWebhook.mockRejectedValue(new Error('Webhook creation failed'));
      (mockedPrisma.repoLink.create as jest.Mock).mockResolvedValue(mockCreatedLink);

      // Act
      const result = await reposService.registerRepoWebhook(mockUser, 1, 'owner/repo');

      // Assert
      expect(githubService.createWebhook).toHaveBeenCalled();
      expect(mockedPrisma.repoLink.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          projectId: 1,
          repoFullName: 'owner/repo',
          webhookId: null,
        },
      });
      expect(result).toEqual(mockCreatedLink);
    });

    it('should throw error for invalid repo format', async () => {
      // Act & Assert
      await expect(reposService.registerRepoWebhook(mockUser, 1, 'invalid-repo')).rejects.toThrow(
        'Invalid repository name format. Expected "owner/repo".'
      );
      expect(githubService.createWebhook).not.toHaveBeenCalled();
    });

    it('should throw error when token decryption fails', async () => {
      // Arrange
      cryptoService.decrypt.mockReturnValue('');

      // Act & Assert
      await expect(reposService.registerRepoWebhook(mockUser, 1, 'owner/repo')).rejects.toThrow(
        'Could not decrypt access token for user.'
      );
      expect(githubService.createWebhook).not.toHaveBeenCalled();
    });
  });

  describe('deleteLinkedRepo', () => {
    it('should delete repo link and webhook successfully', async () => {
      // Arrange
      const mockLink = {
        id: 1,
        userId: 1,
        repoFullName: 'owner/repo',
        webhookId: 123,
      };

      const mockUserRecord = {
        id: 1,
        accessToken: 'encrypted-token',
      };

      (mockedPrisma.repoLink.findFirst as jest.Mock).mockResolvedValue(mockLink);
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUserRecord);
      cryptoService.decrypt.mockReturnValue('decrypted-token');
      githubService.deleteWebhook.mockResolvedValue(true);
      (mockedPrisma.repoLink.update as jest.Mock).mockResolvedValue({ ...mockLink, deletedAt: new Date() });

      // Act
      await reposService.deleteLinkedRepo(1, 1);

      // Assert
      expect(mockedPrisma.repoLink.findFirst).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 },
      });
      expect(cryptoService.decrypt).toHaveBeenCalledWith('encrypted-token');
      expect(githubService.deleteWebhook).toHaveBeenCalledWith('owner', 'repo', 123, 'decrypted-token');
      expect(mockedPrisma.repoLink.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should delete repo link without webhook', async () => {
      // Arrange
      const mockLink = {
        id: 1,
        userId: 1,
        repoFullName: 'owner/repo',
        webhookId: null,
      };

      (mockedPrisma.repoLink.findFirst as jest.Mock).mockResolvedValue(mockLink);
      (mockedPrisma.repoLink.update as jest.Mock).mockResolvedValue({ ...mockLink, deletedAt: new Date() });

      // Act
      await reposService.deleteLinkedRepo(1, 1);

      // Assert
      expect(githubService.deleteWebhook).not.toHaveBeenCalled();
      expect(mockedPrisma.repoLink.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should handle webhook deletion failure gracefully', async () => {
      // Arrange
      const mockLink = {
        id: 1,
        userId: 1,
        repoFullName: 'owner/repo',
        webhookId: 123,
      };

      const mockUserRecord = {
        id: 1,
        accessToken: 'encrypted-token',
      };

      (mockedPrisma.repoLink.findFirst as jest.Mock).mockResolvedValue(mockLink);
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUserRecord);
      cryptoService.decrypt.mockReturnValue('decrypted-token');
      githubService.deleteWebhook.mockResolvedValue(false); // Webhook deletion failed
      (mockedPrisma.repoLink.update as jest.Mock).mockResolvedValue({ ...mockLink, deletedAt: new Date() });

      // Act
      await reposService.deleteLinkedRepo(1, 1);

      // Assert
      expect(githubService.deleteWebhook).toHaveBeenCalled();
      expect(mockedPrisma.repoLink.update).toHaveBeenCalled(); // Still updates the link
    });

    it('should throw error when repo link not found', async () => {
      // Arrange
      (mockedPrisma.repoLink.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(reposService.deleteLinkedRepo(1, 999)).rejects.toThrow(
        'Repo link not found or access denied.'
      );
      expect(githubService.deleteWebhook).not.toHaveBeenCalled();
    });

    it('should handle token decryption failure gracefully', async () => {
      // Arrange
      const mockLink = {
        id: 1,
        userId: 1,
        repoFullName: 'owner/repo',
        webhookId: 123,
      };

      const mockUserRecord = {
        id: 1,
        accessToken: 'encrypted-token',
      };

      (mockedPrisma.repoLink.findFirst as jest.Mock).mockResolvedValue(mockLink);
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUserRecord);
      cryptoService.decrypt.mockReturnValue(''); // Token decryption failed
      (mockedPrisma.repoLink.update as jest.Mock).mockResolvedValue({ ...mockLink, deletedAt: new Date() });

      // Act
      await reposService.deleteLinkedRepo(1, 1);

      // Assert
      expect(githubService.deleteWebhook).not.toHaveBeenCalled();
      expect(mockedPrisma.repoLink.update).toHaveBeenCalled(); // Still updates the link
    });
  });

  describe('restoreLinkedRepo', () => {
    it('should restore soft-deleted repo link', async () => {
      // Arrange
      const mockLink = {
        id: 1,
        userId: 1,
        repoFullName: 'owner/repo',
        webhookId: 123,
        deletedAt: new Date('2023-01-01T00:00:00Z'),
      };

      (mockedPrisma.repoLink.findFirst as jest.Mock).mockResolvedValue(mockLink);
      (mockedPrisma.repoLink.update as jest.Mock).mockResolvedValue({ ...mockLink, deletedAt: null });

      // Act
      await reposService.restoreLinkedRepo(1, 1);

      // Assert
      expect(mockedPrisma.repoLink.findFirst).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 },
      });
      expect(mockedPrisma.repoLink.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { deletedAt: null },
      });
    });

    it('should throw error when repo link not found', async () => {
      // Arrange
      (mockedPrisma.repoLink.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(reposService.restoreLinkedRepo(1, 999)).rejects.toThrow(
        'Repo link not found or access denied.'
      );
      expect(mockedPrisma.repoLink.update).not.toHaveBeenCalled();
    });
  });
});