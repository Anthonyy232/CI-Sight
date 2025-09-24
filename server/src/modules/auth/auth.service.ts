import axios from 'axios';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {config} from '../../config';
import {prisma} from '../../db';
import {CryptoService} from '../../services/crypto.service';
import {GithubService} from '../../services/github.service';
import {User} from '@prisma/client';

export class AuthService {
  constructor(
    private cryptoService: CryptoService,
    private githubService: GithubService
  ) {}

  generateAuthState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  getGithubAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: config.GITHUB_OAUTH_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'repo,read:user',
      state: state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: config.GITHUB_OAUTH_CLIENT_ID,
        client_secret: config.GITHUB_OAUTH_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      },
      { headers: { Accept: 'application/json' } }
    );

    const accessToken = response.data.access_token;
    if (!accessToken) {
      throw new Error('Failed to retrieve access token from GitHub');
    }
    return accessToken;
  }

  async findOrCreateUser(githubToken: string): Promise<User> {
    const githubUser = await this.githubService.fetchUserFromToken(githubToken);
    const encryptedToken = this.cryptoService.encrypt(githubToken);

    return prisma.user.upsert({
      where: { githubId: githubUser.id },
      update: {
        login: githubUser.login,
        name: githubUser.name,
        avatarUrl: githubUser.avatar_url,
        accessToken: encryptedToken,
      },
      create: {
        githubId: githubUser.id,
        login: githubUser.login,
        name: githubUser.name,
        avatarUrl: githubUser.avatar_url,
        accessToken: encryptedToken,
      },
    });
  }

  /**
   * Create a signed JWT session token for the given user.
   * @returns A compact JWT string set in an HTTP-only cookie by the controller.
   */
  createJwtForUser(user: { id: number; githubId: number }): string {
    const payload = { sub: String(user.id), githubId: user.githubId };
    return jwt.sign(payload, config.SESSION_JWT_SECRET, {
      expiresIn: '7d',
      algorithm: 'HS256',
    });
  }

  /**
   * Persist an encrypted GitHub Personal Access Token for the user.
   * Tokens are encrypted with the project's symmetric key before storage.
   */
  async updateUserPat(userId: number, pat: string): Promise<User> {
    const encryptedPat = this.cryptoService.encrypt(pat);
    return prisma.user.update({
      where: { id: userId },
      data: { githubPat: encryptedPat },
    });
  }
}