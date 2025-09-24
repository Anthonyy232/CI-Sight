import {BuildsService} from '../modules/builds/builds.service';
import {prisma} from '../db';

jest.mock('../db', () => ({
  prisma: {
    build: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

/**
 * Test suite for the BuildsService.
 * This suite verifies the business logic for retrieving and processing build data.
 */
describe('BuildsService', () => {
  let buildsService: BuildsService;

  beforeEach(() => {
    buildsService = new BuildsService();
    jest.clearAllMocks();
  });

  /**
   * Tests for retrieving a list of recent builds.
   */
  describe('getRecentBuilds', () => {
    /**
     * Verifies that recent builds are fetched and transformed correctly, including
     * project name and a normalized commit identifier.
     */
    it('should return recent builds with project information', async () => {
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

      const result = await buildsService.getRecentBuilds(10);

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
          commit: '12345678',
          startedAt: '2023-01-02T00:00:00.000Z',
          completedAt: null,
        },
      ]);
    });

    /**
     * Ensures the service handles cases where no builds are found.
     */
    it('should handle empty results', async () => {
      (mockedPrisma.build.findMany as jest.Mock).mockResolvedValue([]);

      const result = await buildsService.getRecentBuilds(5);

      expect(result).toEqual([]);
    });

    /**
     * Verifies that if `triggeringCommit` is null, the `githubRunId` is used as a fallback,
     * truncated to 8 characters.
     */
    it('should handle builds without triggering commit', async () => {
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

      const result = await buildsService.getRecentBuilds(10);

      expect(result[0].commit).toBe('98765432');
    });
  });

  /**
   * Tests for retrieving the detailed information of a single build.
   */
  describe('getBuildDetails', () => {
    /**
     * Verifies that build details are fetched and that associated log entries
     * are correctly aggregated into a single string.
     */
    it('should return build details with logs', async () => {
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

      const result = await buildsService.getBuildDetails(123);

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

    /**
     * Ensures that `null` is returned for a build ID that does not exist.
     */
    it('should return null for non-existent build', async () => {
      (mockedPrisma.build.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await buildsService.getBuildDetails(999);

      expect(result).toBeNull();
    });

    /**
     * Verifies that failure-related information is correctly included in the response.
     */
    it('should handle builds with failure information', async () => {
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

      const result = await buildsService.getBuildDetails(456);

      expect(result?.failureReason).toBe('Tests failed');
      expect(result?.errorCategory).toBe('Test Failure');
      expect(result?.logs).toContain('Test failed: expected true, got false');
    });

    /**
     * Ensures that builds with no associated log entries result in an empty log string.
     */
    it('should handle builds without logs', async () => {
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

      const result = await buildsService.getBuildDetails(789);

      expect(result?.logs).toBe('');
    });
  });

  /**
   * Tests for generating analytics on build errors.
   */
  describe('getErrorAnalytics', () => {
    /**
     * Verifies that analytics are correctly calculated, including total failures
     * and a breakdown of error categories with counts and percentages.
     */
    it('should return error analytics with categories', async () => {
      const mockFailedBuilds = [
        { errorCategory: 'Test Failure' },
        { errorCategory: 'Test Failure' },
        { errorCategory: 'Dependency Error' },
        { errorCategory: 'Syntax Error' },
        { errorCategory: 'Test Failure' },
        { errorCategory: null },
      ];

      (mockedPrisma.build.findMany as jest.Mock).mockResolvedValue(mockFailedBuilds);

      const result = await buildsService.getErrorAnalytics();

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

    /**
     * Ensures the service returns a zero-state when there are no failed builds.
     */
    it('should handle no failed builds', async () => {
      (mockedPrisma.build.findMany as jest.Mock).mockResolvedValue([]);

      const result = await buildsService.getErrorAnalytics();

      expect(result).toEqual({
        totalFailed: 0,
        categories: [],
      });
    });

    /**
     * Verifies that builds with a null `errorCategory` are counted in the total
     * but excluded from the category breakdown.
     */
    it('should handle builds with null error categories', async () => {
      const mockFailedBuilds = [
        { errorCategory: null },
        { errorCategory: null },
        { errorCategory: 'Known Error' },
      ];

      (mockedPrisma.build.findMany as jest.Mock).mockResolvedValue(mockFailedBuilds);

      const result = await buildsService.getErrorAnalytics();

      expect(result.totalFailed).toBe(3);
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].category).toBe('Known Error');
    });

    /**
     * Ensures the analytics results are limited to the top 5 most frequent error categories.
     */
    it('should limit to top 5 categories', async () => {
      const mockFailedBuilds = [
        { errorCategory: 'Error 1' },
        { errorCategory: 'Error 1' },
        { errorCategory: 'Error 2' },
        { errorCategory: 'Error 2' },
        { errorCategory: 'Error 3' },
        { errorCategory: 'Error 4' },
        { errorCategory: 'Error 5' },
        { errorCategory: 'Error 6' },
      ];

      (mockedPrisma.build.findMany as jest.Mock).mockResolvedValue(mockFailedBuilds);

      const result = await buildsService.getErrorAnalytics();

      expect(result.categories).toHaveLength(5);
      expect(result.categories.map(c => c.category)).not.toContain('Error 6');
    });

    /**
     * Verifies that the returned categories are sorted in descending order of count.
     */
    it('should sort categories by count descending', async () => {
      const mockFailedBuilds = [
        { errorCategory: 'Least Common' },
        { errorCategory: 'Most Common' },
        { errorCategory: 'Most Common' },
        { errorCategory: 'Most Common' },
        { errorCategory: 'Medium Common' },
        { errorCategory: 'Medium Common' },
      ];

      (mockedPrisma.build.findMany as jest.Mock).mockResolvedValue(mockFailedBuilds);

      const result = await buildsService.getErrorAnalytics();

      expect(result.categories[0].category).toBe('Most Common');
      expect(result.categories[1].category).toBe('Medium Common');
      expect(result.categories[2].category).toBe('Least Common');
    });
  });
});