import axios from 'axios';
import {logger} from '../utils/logger';

const GITHUB_API_BASE = 'https://api.github.com';
const API_VERSION = '2022-11-28';
const TIMEOUT = 15000; // 15-second timeout for API calls

/**
 * Thin wrapper around GitHub REST API calls used by the application.
 *
 * Keeps HTTP details (headers, timeouts) centralized and converts shapes
 * to the minimal data the app requires.
 */
export class GithubService {
  private getHeaders(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': API_VERSION,
    };
  }

  async fetchUserFromToken(token: string) {
    const { data } = await axios.get(`${GITHUB_API_BASE}/user`, {
      headers: this.getHeaders(token),
      timeout: TIMEOUT,
    });
    return data;
  }

  async fetchUserRepos(token: string) {
    const { data } = await axios.get(`${GITHUB_API_BASE}/user/repos?per_page=100&sort=updated`, {
      headers: this.getHeaders(token),
      timeout: TIMEOUT,
    });
    return data.map((r: any) => ({
      id: r.id,
      full_name: r.full_name,
      name: r.name,
      private: r.private,
    }));
  }

  async createWebhook(owner: string, repo: string, token: string, webhookUrl: string, secret: string) {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/hooks`;
    try {
      const { data } = await axios.post(
        url,
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
        { headers: this.getHeaders(token), timeout: TIMEOUT }
      );
      logger.info(`Successfully created webhook for ${owner}/${repo}`);
      return data;
    } catch (err) {
      logger.error(`Failed to create webhook for ${owner}/${repo}`, {
        status: (err as any).response?.status,
        responseData: (err as any).response?.data,
      });
      throw err;
    }
  }

  async deleteWebhook(owner: string, repo: string, hookId: number, token: string): Promise<boolean> {
    try {
      const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/hooks/${hookId}`;
      const response = await axios.delete(url, { headers: this.getHeaders(token), timeout: TIMEOUT });
      logger.info(`Successfully deleted webhook ${hookId} for ${owner}/${repo}`);
      return response.status === 204;
    } catch (error) {
      logger.warn(`Failed to delete remote webhook ${hookId} for ${owner}/${repo}`, {
        status: (error as any).response?.status,
      });
      // Don't throw; allow the local record to be deleted anyway.
      return false;
    }
  }
}