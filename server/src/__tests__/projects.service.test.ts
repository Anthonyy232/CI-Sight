import {ProjectsService} from '../modules/projects/projects.service';
import {prisma} from '../db';
import {CryptoService} from '../services/crypto.service';
import {GithubService} from '../services/github.service';
import {Prisma} from '@prisma/client';

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

/**
 * Test suite for the ProjectsService.
 * This suite verifies the business logic for managing projects, including listing,
 * creation, deletion, and handling associated resources like webhooks.
 */
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

  /**
   * Tests for listing all projects.
   */
  describe('listProjects', () => {
    /**
     * Verifies that all projects are fetched from the database, ordered by creation date.
     */
    it('should return all projects ordered by creation date', async () => {
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

      const result = await projectsService.listProjects();

      expect(mockedPrisma.project.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, githubRepoUrl: true, createdAt: true },
      });
      expect(result).toEqual(mockProjects);
    });

    /**
     * Ensures the method returns an empty array when no projects exist.
     */
    it('should handle empty results', async () => {
      (mockedPrisma.project.findMany as jest.Mock).mockResolvedValue([]);

      const result = await projectsService.listProjects();

      expect(result).toEqual([]);
    });
  });

  /**
   * Tests for retrieving a single project by its ID.
   */
  describe('getProject', () => {
    /**
     * Verifies that a project is correctly fetched by its ID.
     */
    it('should return project by ID', async () => {
      const mockProject = {
        id: 123,
        name: 'test-project',
        githubRepoUrl: 'owner/repo',
        createdAt: new Date('2023-01-01T00:00:00Z'),
      };

      (mockedPrisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);

      const result = await projectsService.getProject(123);

      expect(mockedPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: 123 },
        select: { id: true, name: true, githubRepoUrl: true, createdAt: true },
      });
      expect(result).toEqual(mockProject);
    });

    /**
     * Ensures that `null` is returned if no project with the given ID exists.
     */
    it('should return null for non-existent project', async () => {
      (mockedPrisma.project.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await projectsService.getProject(999);

      expect(result).toBeNull();
    });
  });

  /**
   * Tests for the internal GitHub URL normalization utility.
   */
  describe('normalizeGithubUrl', () => {
    /**
     * Verifies that full HTTPS and HTTP URLs are correctly stripped to the 'owner/repo' format.
     */
    it('should normalize full GitHub URL', () => {
      expect((projectsService as any).normalizeGithubUrl('https://github.com/owner/repo')).toBe('owner/repo');
      expect((projectsService as any).normalizeGithubUrl('https://github.com/owner/repo.git')).toBe('owner/repo');
      expect((projectsService as any).normalizeGithubUrl('http://github.com/owner/repo')).toBe('owner/repo');
    });

    /**
     * Verifies that strings already in or close to the 'owner/repo' format are correctly normalized.
     */
    it('should normalize owner/repo format', () => {
      expect((projectsService as any).normalizeGithubUrl('owner/repo')).toBe('owner/repo');
      expect((projectsService as any).normalizeGithubUrl('owner/repo.git')).toBe('owner/repo');
      expect((projectsService as any).normalizeGithubUrl('owner/repo/')).toBe('owner/repo');
    });

    /**
     * Ensures that invalid or non-URL strings are handled without crashing.
     */
    it('should handle invalid URLs gracefully', () => {
      expect((projectsService as any).normalizeGithubUrl('not-a-url')).toBe('not-a-url');
      expect((projectsService as any).normalizeGithubUrl('')).toBe('');
    });
  });

  /**
   * Tests for the project creation logic.
   */
  describe('createProject', () => {
    /**
     * Verifies the successful creation of a new project with a normalized URL.
     */
    it('should create new project successfully', async () => {
      const mockCreatedProject = {
        id: 1,
        name: 'test-project',
        githubRepoUrl: 'owner/repo',
        createdAt: new Date('2023-01-01T00:00:00Z'),
      };
      (mockedPrisma.project.create as jest.Mock).mockResolvedValue(mockCreatedProject);

      const result = await projectsService.createProject('test-project', 'https://github.com/owner/repo');

      expect(mockedPrisma.project.create).toHaveBeenCalledWith({
        data: { name: 'test-project', githubRepoUrl: 'owner/repo' },
        select: { id: true, name: true, githubRepoUrl: true, createdAt: true },
      });
      expect(result).toEqual(mockCreatedProject);
    });

    /**
     * Verifies that if a project with the same repository URL already exists,
     * the service gracefully handles the unique constraint error and returns the existing project.
     */
    it('should handle project already exists (upsert)', async () => {
      const existingProject = {
        id: 2,
        name: 'existing-project',
        githubRepoUrl: 'owner/repo',
        createdAt: new Date('2023-01-01T00:00:00Z'),
      };
      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '4.0.0',
        meta: {},
      });
      (mockedPrisma.project.create as jest.Mock).mockRejectedValue(prismaError);
      (mockedPrisma.project.findUnique as jest.Mock).mockResolvedValue(existingProject);

      const result = await projectsService.createProject('existing-project', 'owner/repo');

      expect(mockedPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { githubRepoUrl: 'owner/repo' },
        select: { id: true, name: true, githubRepoUrl: true, createdAt: true },
      });
      expect(result).toEqual(existingProject);
    });

    /**
     * Ensures an error is thrown for URLs that do not match the 'owner/repo' format.
     */
    it('should throw error for invalid GitHub URL format', async () => {
      await expect(projectsService.createProject('test', 'invalid-url')).rejects.toThrow(
        'Invalid githubRepoUrl format; expected owner/repo'
      );
    });

    /**
     * Ensures an error is thrown for URLs from domains other than GitHub.
     */
    it('should throw error for non-GitHub URL', async () => {
      await expect(projectsService.createProject('test', 'https://gitlab.com/owner/repo')).rejects.toThrow(
        'Invalid githubRepoUrl format; expected owner/repo'
      );
    });

    /**
     * Ensures an error is thrown for malformed input strings.
     */
    it('should throw error for malformed URL', async () => {
      await expect(projectsService.createProject('test', 'not-a-url-at-all')).rejects.toThrow(
        'Invalid githubRepoUrl format; expected owner/repo'
      );
    });
  });

  /**
   * Tests for retrieving builds associated with a specific project.
   */
  describe('getBuildsForProject', () => {
    /**
     * Verifies that builds are fetched for a project and that commit identifiers
     * are correctly chosen and truncated.
     */
    it('should return builds for project with commit truncation', async () => {
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

      const result = await projectsService.getBuildsForProject(123);

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
          commit: '98765432',
          startedAt: '2023-01-02T00:00:00.000Z',
          completedAt: null,
        },
      ]);
    });

    /**
     * Ensures an empty array is returned if a project has no builds.
     */
    it('should handle empty builds', async () => {
      (mockedPrisma.build.findMany as jest.Mock).mockResolvedValue([]);

      const result = await projectsService.getBuildsForProject(456);

      expect(result).toEqual([]);
    });
  });

  /**
   * Tests for the project deletion logic.
   */
  describe('deleteProject', () => {
    /**
     * Verifies that deleting a project also triggers the deletion of all associated
     * GitHub webhooks.
     */
    it('should delete project and clean up webhooks', async () => {
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

      const result = await projectsService.deleteProject(1, 123);

      expect(mockedPrisma.repoLink.findMany).toHaveBeenCalledWith({
        where: { projectId: 123 },
        include: { user: true },
      });
      expect(cryptoService.decrypt).toHaveBeenCalledWith('encrypted-token-1');
      expect(githubService.deleteWebhook).toHaveBeenCalledWith('owner', 'repo1', 'webhook-1', 'decrypted-token-1');
      expect(mockedPrisma.project.delete).toHaveBeenCalledWith({ where: { id: 123 } });
      expect(result).toEqual({ id: 123 });
    });

    /**
     * Ensures project deletion succeeds even if there are no webhooks to clean up.
     */
    it('should handle projects without webhooks', async () => {
      (mockedPrisma.repoLink.findMany as jest.Mock).mockResolvedValue([]);
      (mockedPrisma.project.delete as jest.Mock).mockResolvedValue({ id: 456 });

      const result = await projectsService.deleteProject(1, 456);

      expect(githubService.deleteWebhook).not.toHaveBeenCalled();
      expect(mockedPrisma.project.delete).toHaveBeenCalledWith({ where: { id: 456 } });
      expect(result).toEqual({ id: 456 });
    });

    /**
     * Verifies that the project is still deleted from the database even if the
     * GitHub API call to delete a webhook fails.
     */
    it('should handle webhook deletion failures gracefully', async () => {
      const mockRepoLinks = [{ repoFullName: 'owner/repo', webhookId: 'webhook-1', user: { accessToken: 'encrypted-token' } }];
      (mockedPrisma.repoLink.findMany as jest.Mock).mockResolvedValue(mockRepoLinks);
      cryptoService.decrypt.mockReturnValue('decrypted-token');
      githubService.deleteWebhook.mockResolvedValue(false);
      (mockedPrisma.project.delete as jest.Mock).mockResolvedValue({ id: 789 });

      const result = await projectsService.deleteProject(1, 789);

      expect(githubService.deleteWebhook).toHaveBeenCalled();
      expect(mockedPrisma.project.delete).toHaveBeenCalledWith({ where: { id: 789 } });
      expect(result).toEqual({ id: 789 });
    });

    /**
     * Ensures that no attempt is made to delete a webhook if the `webhookId` is null.
     */
    it('should handle null webhook IDs', async () => {
      const mockRepoLinks = [{ repoFullName: 'owner/repo', webhookId: null, user: { accessToken: 'encrypted-token' } }];
      (mockedPrisma.repoLink.findMany as jest.Mock).mockResolvedValue(mockRepoLinks);
      (mockedPrisma.project.delete as jest.Mock).mockResolvedValue({ id: 101 });

      const result = await projectsService.deleteProject(1, 101);

      expect(githubService.deleteWebhook).not.toHaveBeenCalled();
      expect(mockedPrisma.project.delete).toHaveBeenCalledWith({ where: { id: 101 } });
      expect(result).toEqual({ id: 101 });
    });
  });
});