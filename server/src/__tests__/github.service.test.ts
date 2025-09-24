import axios from 'axios';
import {GithubService} from '../services/github.service';

const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Test suite for the GithubService.
 * This suite verifies the service's interactions with the GitHub API for
 * fetching user data, repositories, and managing webhooks.
 */
describe('GithubService', () => {
  let githubService: GithubService;
  const mockToken = 'mock-github-token';

  beforeEach(() => {
    githubService = new GithubService();
    jest.clearAllMocks();
  });

  /**
   * Tests for fetching user profile data from a GitHub token.
   */
  describe('fetchUserFromToken', () => {
    /**
     * Verifies a successful API call to fetch user data.
     */
    it('should fetch user data from GitHub API', async () => {
      const mockUserData = {
        id: 123,
        login: 'testuser',
        name: 'Test User',
        avatar_url: 'https://github.com/avatar.png',
      };
      mockedAxios.get.mockResolvedValueOnce({ data: mockUserData });

      const result = await githubService.fetchUserFromToken(mockToken);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
          timeout: 15000,
        })
      );
      expect(result).toEqual(mockUserData);
    });

    /**
     * Ensures that errors from the GitHub API are propagated correctly.
     */
    it('should throw error when API call fails', async () => {
      const error = new Error('API Error');
      mockedAxios.get.mockRejectedValueOnce(error);

      await expect(githubService.fetchUserFromToken(mockToken)).rejects.toThrow('API Error');
    });
  });

  /**
   * Tests for fetching a user's repositories.
   */
  describe('fetchUserRepos', () => {
    /**
     * Verifies a successful API call to fetch a user's repositories and confirms
     * the data is returned in the expected format.
     */
    it('should fetch and transform user repositories', async () => {
      const mockReposData = [
        {
          id: 1,
          full_name: 'user/repo1',
          name: 'repo1',
          private: false,
        },
        {
          id: 2,
          full_name: 'user/repo2',
          name: 'repo2',
          private: true,
        },
      ];
      mockedAxios.get.mockResolvedValueOnce({ data: mockReposData });

      const result = await githubService.fetchUserRepos(mockToken);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.github.com/user/repos?per_page=100&sort=updated',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
      expect(result).toEqual([
        { id: 1, full_name: 'user/repo1', name: 'repo1', private: false },
        { id: 2, full_name: 'user/repo2', name: 'repo2', private: true },
      ]);
    });
  });

  /**
   * Tests for creating a repository webhook.
   */
  describe('createWebhook', () => {
    /**
     * Verifies that the service makes the correct API call to create a webhook
     * with the specified configuration.
     */
    it('should create webhook successfully', async () => {
      const mockWebhookData = { id: 123, url: 'https://example.com/webhook' };
      mockedAxios.post.mockResolvedValueOnce({ data: mockWebhookData });
      const owner = 'testuser';
      const repo = 'testrepo';
      const webhookUrl = 'https://myapp.com/webhook';
      const secret = 'webhook-secret';

      const result = await githubService.createWebhook(owner, repo, mockToken, webhookUrl, secret);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `https://api.github.com/repos/${owner}/${repo}/hooks`,
        {
          name: 'web',
          config: {
            url: webhookUrl,
            content_type: 'json',
            secret: secret,
          },
          events: ['workflow_run'],
          active: true,
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
      expect(result).toEqual(mockWebhookData);
    });

    /**
     * Ensures that errors during webhook creation are properly handled.
     */
    it('should throw error when webhook creation fails', async () => {
      const error = new Error('Webhook creation failed');
      mockedAxios.post.mockRejectedValueOnce(error);

      await expect(
        githubService.createWebhook('owner', 'repo', mockToken, 'url', 'secret')
      ).rejects.toThrow('Webhook creation failed');
    });
  });

  /**
   * Tests for deleting a repository webhook.
   */
  describe('deleteWebhook', () => {
    /**
     * Verifies a successful webhook deletion call and confirms the method returns `true`.
     */
    it('should delete webhook successfully', async () => {
      mockedAxios.delete.mockResolvedValueOnce({ status: 204 });
      const owner = 'testuser';
      const repo = 'testrepo';
      const hookId = 123;

      const result = await githubService.deleteWebhook(owner, repo, hookId, mockToken);

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        `https://api.github.com/repos/${owner}/${repo}/hooks/${hookId}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
      expect(result).toBe(true);
    });

    /**
     * Verifies that the method returns `false` if the API call to delete the webhook fails.
     */
    it('should return false when webhook deletion fails', async () => {
      const error = new Error('Deletion failed');
      mockedAxios.delete.mockRejectedValueOnce(error);

      const result = await githubService.deleteWebhook('owner', 'repo', 123, mockToken);

      expect(result).toBe(false);
    });
  });
});