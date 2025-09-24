import {BuildsService} from '../modules/builds/builds.service';
import {prisma} from '../db';

// Mock prisma
jest.mock('../db', () => ({
  prisma: {
    build: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

describe('BuildsService', () => {
  let buildsService: BuildsService;

  beforeEach(() => {
    buildsService = new BuildsService();
    jest.clearAllMocks();
  });

  describe('getRecentBuilds', () => {
    it('should return recent builds with project information', async () => {
      // Arrange
      const mockBuilds = [
        {
          id: 1,
          project: { name: 'test-project' },
          status: 'SUCCESS',
          triggeringCommit: 'abc123',
          startedAt: new Date('2023-01-01T00:00:00Z'),
          completedAt: new Date('2023-01-01T00:05:00Z'),
        },
        {
          id: 2,
          project: { name: 'another-project' },
          status: 'FAILURE',
          triggeringCommit: null,
          githubRunId: '123456789',
          startedAt: new Date('2023-01-02T00:00:00Z'),
          completedAt: null,
        },
      ];

      (mockedPrisma.build.findMany as jest.Mock).mockResolvedValue(mockBuilds);

      // Act
      const result = await buildsService.getRecentBuilds(10);

      // Assert
      expect(mockedPrisma.build.findMany).toHaveBeenCalledWith({
        take: 10,
        orderBy: { startedAt: 'desc' },
        include: { project: { select: { name: true } } },
      });

      expect(result).toEqual([
        {
          id: 1,
          projectName: 'test-project',
          status: 'SUCCESS',
          commit: 'abc123',
          startedAt: '2023-01-01T00:00:00.000Z',
          completedAt: '2023-01-01T00:05:00.000Z',
        },
        {
          id: 2,
          projectName: 'another-project',
          status: 'FAILURE',
          commit: '12345678', // githubRunId truncated to 8 chars
          startedAt: '2023-01-02T00:00:00.000Z',
          completedAt: null,
        },
      ]);
    });

    it('should handle empty results', async () => {
      // Arrange
      (mockedPrisma.build.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await buildsService.getRecentBuilds(5);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle builds without triggering commit', async () => {
      // Arrange
      const mockBuilds = [
        {
          id: 1,
          project: { name: 'test-project' },
          status: 'RUNNING',
          triggeringCommit: null,
          githubRunId: '987654321',
          startedAt: new Date('2023-01-01T00:00:00Z'),
          completedAt: null,
        },
      ];

      (mockedPrisma.build.findMany as jest.Mock).mockResolvedValue(mockBuilds);

      // Act
      const result = await buildsService.getRecentBuilds(10);

      // Assert
      expect(result[0].commit).toBe('98765432'); // githubRunId truncated to 8 chars
    });
  });

  describe('getBuildDetails', () => {
    it('should return build details with logs', async () => {
      // Arrange
      const mockBuild = {
        id: 123,
        project: {
          name: 'test-project',
          githubRepoUrl: 'https://github.com/owner/repo',
        },
        githubRunId: '123456789',
        status: 'SUCCESS',
        startedAt: new Date('2023-01-01T00:00:00Z'),
        completedAt: new Date('2023-01-01T00:05:00Z'),
        failureReason: null,
        errorCategory: null,
        logEntries: [
          { lineNumber: 1, content: 'Starting build...' },
          { lineNumber: 2, content: 'Running tests...' },
          { lineNumber: 3, content: 'Build successful!' },
        ],
      };

      (mockedPrisma.build.findUnique as jest.Mock).mockResolvedValue(mockBuild);

      // Act
      const result = await buildsService.getBuildDetails(123);

      // Assert
      expect(mockedPrisma.build.findUnique).toHaveBeenCalledWith({
        where: { id: 123 },
        include: {
          project: { select: { name: true, githubRepoUrl: true } },
          logEntries: { orderBy: { lineNumber: 'asc' }, select: { lineNumber: true, content: true } },
        },
      });

      expect(result).toEqual({
        id: 123,
        projectName: 'test-project',
        githubRepoUrl: 'https://github.com/owner/repo',
        githubRunId: '123456789',
        status: 'SUCCESS',
        startedAt: '2023-01-01T00:00:00.000Z',
        completedAt: '2023-01-01T00:05:00.000Z',
        failureReason: null,
        errorCategory: null,
        logs: 'Starting build...\nRunning tests...\nBuild successful!',
      });
    });

    it('should return null for non-existent build', async () => {
      // Arrange
      (mockedPrisma.build.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await buildsService.getBuildDetails(999);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle builds with failure information', async () => {
      // Arrange
      const mockBuild = {
        id: 456,
        project: {
          name: 'failing-project',
          githubRepoUrl: 'https://github.com/owner/failing-repo',
        },
        githubRunId: '987654321',
        status: 'FAILURE',
        startedAt: new Date('2023-01-01T00:00:00Z'),
        completedAt: new Date('2023-01-01T00:02:00Z'),
        failureReason: 'Tests failed',
        errorCategory: 'Test Failure',
        logEntries: [
          { lineNumber: 1, content: 'Starting build...' },
          { lineNumber: 2, content: 'Running tests...' },
          { lineNumber: 3, content: 'Test failed: expected true, got false' },
        ],
      };

      (mockedPrisma.build.findUnique as jest.Mock).mockResolvedValue(mockBuild);

      // Act
      const result = await buildsService.getBuildDetails(456);

      // Assert
      expect(result?.failureReason).toBe('Tests failed');
      expect(result?.errorCategory).toBe('Test Failure');
      expect(result?.logs).toContain('Test failed: expected true, got false');
    });

    it('should handle builds without logs', async () => {
      // Arrange
      const mockBuild = {
        id: 789,
        project: {
          name: 'no-logs-project',
          githubRepoUrl: 'https://github.com/owner/no-logs-repo',
        },
        githubRunId: '111111111',
        status: 'RUNNING',
        startedAt: new Date('2023-01-01T00:00:00Z'),
        completedAt: null,
        failureReason: null,
        errorCategory: null,
        logEntries: [],
      };

      (mockedPrisma.build.findUnique as jest.Mock).mockResolvedValue(mockBuild);

      // Act
      const result = await buildsService.getBuildDetails(789);

      // Assert
      expect(result?.logs).toBe('');
    });
  });

  describe('getErrorAnalytics', () => {
    it('should return error analytics with categories', async () => {
      // Arrange
      const mockFailedBuilds = [
        { errorCategory: 'Test Failure' },
        { errorCategory: 'Test Failure' },
        { errorCategory: 'Dependency Error' },
        { errorCategory: 'Syntax Error' },
        { errorCategory: 'Test Failure' },
        { errorCategory: null },
      ];

      (mockedPrisma.build.findMany as jest.Mock).mockResolvedValue(mockFailedBuilds);

      // Act
      const result = await buildsService.getErrorAnalytics();

      // Assert
      expect(mockedPrisma.build.findMany).toHaveBeenCalledWith({
        where: { status: 'FAILURE' },
        select: { errorCategory: true },
        orderBy: { startedAt: 'desc' },
        take: 100,
      });

      expect(result).toEqual({
        totalFailed: 6,
        categories: [
          {
            category: 'Test Failure',
            count: 3,
            percentage: 50,
          },
          {
            category: 'Dependency Error',
            count: 1,
            percentage: 17,
          },
          {
            category: 'Syntax Error',
            count: 1,
            percentage: 17,
          },
        ],
      });
    });

    it('should handle no failed builds', async () => {
      // Arrange
      (mockedPrisma.build.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await buildsService.getErrorAnalytics();

      // Assert
      expect(result).toEqual({
        totalFailed: 0,
        categories: [],
      });
    });

    it('should handle builds with null error categories', async () => {
      // Arrange
      const mockFailedBuilds = [
        { errorCategory: null },
        { errorCategory: null },
        { errorCategory: 'Known Error' },
      ];

      (mockedPrisma.build.findMany as jest.Mock).mockResolvedValue(mockFailedBuilds);

      // Act
      const result = await buildsService.getErrorAnalytics();

      // Assert
      expect(result.totalFailed).toBe(3);
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].category).toBe('Known Error');
    });

    it('should limit to top 5 categories', async () => {
      // Arrange
      const mockFailedBuilds = [
        { errorCategory: 'Error 1' },
        { errorCategory: 'Error 1' },
        { errorCategory: 'Error 2' },
        { errorCategory: 'Error 2' },
        { errorCategory: 'Error 3' },
        { errorCategory: 'Error 4' },
        { errorCategory: 'Error 5' },
        { errorCategory: 'Error 6' }, // This should be excluded
      ];

      (mockedPrisma.build.findMany as jest.Mock).mockResolvedValue(mockFailedBuilds);

      // Act
      const result = await buildsService.getErrorAnalytics();

      // Assert
      expect(result.categories).toHaveLength(5);
      expect(result.categories.map(c => c.category)).not.toContain('Error 6');
    });

    it('should sort categories by count descending', async () => {
      // Arrange
      const mockFailedBuilds = [
        { errorCategory: 'Least Common' },
        { errorCategory: 'Most Common' },
        { errorCategory: 'Most Common' },
        { errorCategory: 'Most Common' },
        { errorCategory: 'Medium Common' },
        { errorCategory: 'Medium Common' },
      ];

      (mockedPrisma.build.findMany as jest.Mock).mockResolvedValue(mockFailedBuilds);

      // Act
      const result = await buildsService.getErrorAnalytics();

      // Assert
      expect(result.categories[0].category).toBe('Most Common');
      expect(result.categories[1].category).toBe('Medium Common');
      expect(result.categories[2].category).toBe('Least Common');
    });
  });
});