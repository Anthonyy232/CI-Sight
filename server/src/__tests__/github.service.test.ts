import axios from 'axios';
import {GithubService} from '../services/github.service';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GithubService', () => {
  let githubService: GithubService;
  const mockToken = 'mock-github-token';

  beforeEach(() => {
    githubService = new GithubService();
    jest.clearAllMocks();
  });

  describe('fetchUserFromToken', () => {
    it('should fetch user data from GitHub API', async () => {
      // Arrange
      const mockUserData = {
        id: 123,
        login: 'testuser',
        name: 'Test User',
        avatar_url: 'https://github.com/avatar.png',
      };
      mockedAxios.get.mockResolvedValueOnce({ data: mockUserData });

      // Act
      const result = await githubService.fetchUserFromToken(mockToken);

      // Assert
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

    it('should throw error when API call fails', async () => {
      // Arrange
      const error = new Error('API Error');
      mockedAxios.get.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(githubService.fetchUserFromToken(mockToken)).rejects.toThrow('API Error');
    });
  });

  describe('fetchUserRepos', () => {
    it('should fetch and transform user repositories', async () => {
      // Arrange
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

      // Act
      const result = await githubService.fetchUserRepos(mockToken);

      // Assert
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

  describe('createWebhook', () => {
    it('should create webhook successfully', async () => {
      // Arrange
      const mockWebhookData = { id: 123, url: 'https://example.com/webhook' };
      mockedAxios.post.mockResolvedValueOnce({ data: mockWebhookData });
      const owner = 'testuser';
      const repo = 'testrepo';
      const webhookUrl = 'https://myapp.com/webhook';
      const secret = 'webhook-secret';

      // Act
      const result = await githubService.createWebhook(owner, repo, mockToken, webhookUrl, secret);

      // Assert
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

    it('should throw error when webhook creation fails', async () => {
      // Arrange
      const error = new Error('Webhook creation failed');
      mockedAxios.post.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(
        githubService.createWebhook('owner', 'repo', mockToken, 'url', 'secret')
      ).rejects.toThrow('Webhook creation failed');
    });
  });

  describe('deleteWebhook', () => {
    it('should delete webhook successfully', async () => {
      // Arrange
      mockedAxios.delete.mockResolvedValueOnce({ status: 204 });
      const owner = 'testuser';
      const repo = 'testrepo';
      const hookId = 123;

      // Act
      const result = await githubService.deleteWebhook(owner, repo, hookId, mockToken);

      // Assert
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

    it('should return false when webhook deletion fails', async () => {
      // Arrange
      const error = new Error('Deletion failed');
      mockedAxios.delete.mockRejectedValueOnce(error);

      // Act
      const result = await githubService.deleteWebhook('owner', 'repo', 123, mockToken);

      // Assert
      expect(result).toBe(false);
    });
  });
});