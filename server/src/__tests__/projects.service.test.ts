import {ProjectsService} from '../modules/projects/projects.service';
import {prisma} from '../db';
import {CryptoService} from '../services/crypto.service';
import {GithubService} from '../services/github.service';
import {Prisma} from '@prisma/client';

// Mock dependencies
jest.mock('../db', () => ({
  prisma: {
    project: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    build: {
      findMany: jest.fn(),
    },
    repoLink: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../services/crypto.service');
jest.mock('../services/github.service');
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedCryptoService = CryptoService as jest.MockedClass<typeof CryptoService>;
const mockedGithubService = GithubService as jest.MockedClass<typeof GithubService>;

describe('ProjectsService', () => {
  let projectsService: ProjectsService;
  let cryptoService: jest.Mocked<CryptoService>;
  let githubService: jest.Mocked<GithubService>;

  beforeEach(() => {
    cryptoService = new mockedCryptoService() as jest.Mocked<CryptoService>;
    githubService = new mockedGithubService() as jest.Mocked<GithubService>;
    projectsService = new ProjectsService(cryptoService, githubService);
    jest.clearAllMocks();
  });

  describe('listProjects', () => {
    it('should return all projects ordered by creation date', async () => {
      // Arrange
      const mockProjects = [
        {
          id: 1,
          name: 'project-1',
          githubRepoUrl: 'owner/repo1',
          createdAt: new Date('2023-01-01T00:00:00Z'),
        },
        {
          id: 2,
          name: 'project-2',
          githubRepoUrl: 'owner/repo2',
          createdAt: new Date('2023-01-02T00:00:00Z'),
        },
      ];

      (mockedPrisma.project.findMany as jest.Mock).mockResolvedValue(mockProjects);

      // Act
      const result = await projectsService.listProjects();

      // Assert
      expect(mockedPrisma.project.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, githubRepoUrl: true, createdAt: true },
      });
      expect(result).toEqual(mockProjects);
    });

    it('should handle empty results', async () => {
      // Arrange
      (mockedPrisma.project.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await projectsService.listProjects();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getProject', () => {
    it('should return project by ID', async () => {
      // Arrange
      const mockProject = {
        id: 123,
        name: 'test-project',
        githubRepoUrl: 'owner/repo',
        createdAt: new Date('2023-01-01T00:00:00Z'),
      };

      (mockedPrisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);

      // Act
      const result = await projectsService.getProject(123);

      // Assert
      expect(mockedPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: 123 },
        select: { id: true, name: true, githubRepoUrl: true, createdAt: true },
      });
      expect(result).toEqual(mockProject);
    });

    it('should return null for non-existent project', async () => {
      // Arrange
      (mockedPrisma.project.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await projectsService.getProject(999);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('normalizeGithubUrl', () => {
    it('should normalize full GitHub URL', () => {
      // Act & Assert
      expect((projectsService as any).normalizeGithubUrl('https://github.com/owner/repo')).toBe('owner/repo');
      expect((projectsService as any).normalizeGithubUrl('https://github.com/owner/repo.git')).toBe('owner/repo');
      expect((projectsService as any).normalizeGithubUrl('http://github.com/owner/repo')).toBe('owner/repo');
    });

    it('should normalize owner/repo format', () => {
      // Act & Assert
      expect((projectsService as any).normalizeGithubUrl('owner/repo')).toBe('owner/repo');
      expect((projectsService as any).normalizeGithubUrl('owner/repo.git')).toBe('owner/repo');
      expect((projectsService as any).normalizeGithubUrl('owner/repo/')).toBe('owner/repo');
    });

    it('should handle invalid URLs gracefully', () => {
      // Act & Assert
      expect((projectsService as any).normalizeGithubUrl('not-a-url')).toBe('not-a-url');
      expect((projectsService as any).normalizeGithubUrl('')).toBe('');
    });
  });

  describe('createProject', () => {
    it('should create new project successfully', async () => {
      // Arrange
      const mockCreatedProject = {
        id: 1,
        name: 'test-project',
        githubRepoUrl: 'owner/repo',
        createdAt: new Date('2023-01-01T00:00:00Z'),
      };

      (mockedPrisma.project.create as jest.Mock).mockResolvedValue(mockCreatedProject);

      // Act
      const result = await projectsService.createProject('test-project', 'https://github.com/owner/repo');

      // Assert
      expect(mockedPrisma.project.create).toHaveBeenCalledWith({
        data: { name: 'test-project', githubRepoUrl: 'owner/repo' },
        select: { id: true, name: true, githubRepoUrl: true, createdAt: true },
      });
      expect(result).toEqual(mockCreatedProject);
    });

    it('should handle project already exists (upsert)', async () => {
      // Arrange
      const existingProject = {
        id: 2,
        name: 'existing-project',
        githubRepoUrl: 'owner/repo',
        createdAt: new Date('2023-01-01T00:00:00Z'),
      };

      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '4.0.0',
      });

      (mockedPrisma.project.create as jest.Mock).mockRejectedValue(prismaError);
      (mockedPrisma.project.findUnique as jest.Mock).mockResolvedValue(existingProject);

      // Act
      const result = await projectsService.createProject('existing-project', 'owner/repo');

      // Assert
      expect(mockedPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { githubRepoUrl: 'owner/repo' },
        select: { id: true, name: true, githubRepoUrl: true, createdAt: true },
      });
      expect(result).toEqual(existingProject);
    });

    it('should throw error for invalid GitHub URL format', async () => {
      // Act & Assert
      await expect(projectsService.createProject('test', 'invalid-url')).rejects.toThrow(
        'Invalid githubRepoUrl format; expected owner/repo'
      );
    });

    it('should throw error for non-GitHub URL', async () => {
      // Act & Assert
      await expect(projectsService.createProject('test', 'https://gitlab.com/owner/repo')).rejects.toThrow(
        'Invalid githubRepoUrl format; expected owner/repo'
      );
    });

    it('should throw error for malformed URL', async () => {
      // Act & Assert
      await expect(projectsService.createProject('test', 'not-a-url-at-all')).rejects.toThrow(
        'Invalid githubRepoUrl format; expected owner/repo'
      );
    });
  });

  describe('getBuildsForProject', () => {
    it('should return builds for project with commit truncation', async () => {
      // Arrange
      const mockBuilds = [
        {
          id: 1,
          status: 'SUCCESS',
          startedAt: new Date('2023-01-01T00:00:00Z'),
          completedAt: new Date('2023-01-01T00:05:00Z'),
          githubRunId: '123456789',
          triggeringCommit: 'abc123',
        },
        {
          id: 2,
          status: 'FAILURE',
          startedAt: new Date('2023-01-02T00:00:00Z'),
          completedAt: null,
          githubRunId: '987654321',
          triggeringCommit: null,
        },
      ];

      (mockedPrisma.build.findMany as jest.Mock).mockResolvedValue(mockBuilds);

      // Act
      const result = await projectsService.getBuildsForProject(123);

      // Assert
      expect(mockedPrisma.build.findMany).toHaveBeenCalledWith({
        where: { projectId: 123 },
        orderBy: { startedAt: 'desc' },
        take: 50,
        select: { id: true, status: true, startedAt: true, completedAt: true, githubRunId: true, triggeringCommit: true },
      });

      expect(result).toEqual([
        {
          id: 1,
          status: 'SUCCESS',
          commit: 'abc123',
          startedAt: '2023-01-01T00:00:00.000Z',
          completedAt: '2023-01-01T00:05:00.000Z',
        },
        {
          id: 2,
          status: 'FAILURE',
          commit: '98765432', // truncated to 8 chars
          startedAt: '2023-01-02T00:00:00.000Z',
          completedAt: null,
        },
      ]);
    });

    it('should handle empty builds', async () => {
      // Arrange
      (mockedPrisma.build.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await projectsService.getBuildsForProject(456);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('deleteProject', () => {
    it('should delete project and clean up webhooks', async () => {
      // Arrange
      const mockRepoLinks = [
        {
          repoFullName: 'owner/repo1',
          webhookId: 'webhook-1',
          user: { accessToken: 'encrypted-token-1' },
        },
        {
          repoFullName: 'owner/repo2',
          webhookId: 'webhook-2',
          user: { accessToken: 'encrypted-token-2' },
        },
      ];

      (mockedPrisma.repoLink.findMany as jest.Mock).mockResolvedValue(mockRepoLinks);
      cryptoService.decrypt.mockReturnValueOnce('decrypted-token-1').mockReturnValueOnce('decrypted-token-2');
      githubService.deleteWebhook.mockResolvedValue(true);
      (mockedPrisma.project.delete as jest.Mock).mockResolvedValue({ id: 123 });

      // Act
      const result = await projectsService.deleteProject(1, 123);

      // Assert
      expect(mockedPrisma.repoLink.findMany).toHaveBeenCalledWith({
        where: { projectId: 123 },
        include: { user: true },
      });

      expect(cryptoService.decrypt).toHaveBeenCalledWith('encrypted-token-1');
      expect(cryptoService.decrypt).toHaveBeenCalledWith('encrypted-token-2');

      expect(githubService.deleteWebhook).toHaveBeenCalledWith('owner', 'repo1', 'webhook-1', 'decrypted-token-1');
      expect(githubService.deleteWebhook).toHaveBeenCalledWith('owner', 'repo2', 'webhook-2', 'decrypted-token-2');

      expect(mockedPrisma.project.delete).toHaveBeenCalledWith({ where: { id: 123 } });
      expect(result).toEqual({ id: 123 });
    });

    it('should handle projects without webhooks', async () => {
      // Arrange
      (mockedPrisma.repoLink.findMany as jest.Mock).mockResolvedValue([]);
      (mockedPrisma.project.delete as jest.Mock).mockResolvedValue({ id: 456 });

      // Act
      const result = await projectsService.deleteProject(1, 456);

      // Assert
      expect(githubService.deleteWebhook).not.toHaveBeenCalled();
      expect(mockedPrisma.project.delete).toHaveBeenCalledWith({ where: { id: 456 } });
      expect(result).toEqual({ id: 456 });
    });

    it('should handle webhook deletion failures gracefully', async () => {
      // Arrange
      const mockRepoLinks = [
        {
          repoFullName: 'owner/repo',
          webhookId: 'webhook-1',
          user: { accessToken: 'encrypted-token' },
        },
      ];

      (mockedPrisma.repoLink.findMany as jest.Mock).mockResolvedValue(mockRepoLinks);
      cryptoService.decrypt.mockReturnValue('decrypted-token');
      githubService.deleteWebhook.mockResolvedValue(false);
      (mockedPrisma.project.delete as jest.Mock).mockResolvedValue({ id: 789 });

      // Act
      const result = await projectsService.deleteProject(1, 789);

      // Assert
      expect(githubService.deleteWebhook).toHaveBeenCalled();
      expect(mockedPrisma.project.delete).toHaveBeenCalledWith({ where: { id: 789 } });
      expect(result).toEqual({ id: 789 });
    });

    it('should handle null webhook IDs', async () => {
      // Arrange
      const mockRepoLinks = [
        {
          repoFullName: 'owner/repo',
          webhookId: null,
          user: { accessToken: 'encrypted-token' },
        },
      ];

      (mockedPrisma.repoLink.findMany as jest.Mock).mockResolvedValue(mockRepoLinks);
      (mockedPrisma.project.delete as jest.Mock).mockResolvedValue({ id: 101 });

      // Act
      const result = await projectsService.deleteProject(1, 101);

      // Assert
      expect(githubService.deleteWebhook).not.toHaveBeenCalled();
      expect(mockedPrisma.project.delete).toHaveBeenCalledWith({ where: { id: 101 } });
      expect(result).toEqual({ id: 101 });
    });
  });
});