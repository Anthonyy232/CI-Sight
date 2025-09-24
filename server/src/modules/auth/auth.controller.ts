import {Request, Response} from 'express';
import {config} from '../../config';
import {prisma} from '../../db';
import {AuthService} from './auth.service';

/**
 * Controller responsible for GitHub OAuth and session endpoints.
 *
 * Security notes:
 * - Uses a short-lived `oauth_state` cookie to mitigate CSRF during OAuth.
 * - Issues a `session` cookie containing a signed JWT on successful login.
 */
export class AuthController {
  constructor(private authService: AuthService) {}

  private getRedirectUri() {
    const baseUrl = config.NODE_ENV === 'development' 
      ? config.FRONTEND_URL 
      : config.PUBLIC_URL;
      
    return `${baseUrl}/api/auth/github/callback`;
  }

  githubLogin = (req: Request, res: Response) => {
    const redirectUri = this.getRedirectUri();
    const state = this.authService.generateAuthState();

    const cookieOptions = {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 1000 * 60 * 5, // 5 minutes
      path: '/',
    };
    
    // Persist state server-side in a cookie for the callback verification
    res.cookie('oauth_state', state, cookieOptions);

    const authUrl = this.authService.getGithubAuthUrl(redirectUri, state);
    res.redirect(authUrl);
  };

  githubCallback = async (req: Request, res: Response) => {
    const { code, state } = req.query;
    const { oauth_state: cookieState } = req.cookies;

    if (!code || !state || !cookieState) {
      return res.status(400).send('Authentication error: Missing required parameters.');
    }

    if (state !== cookieState) {
      return res.status(400).send('Invalid state parameter. Request aborted for security reasons.');
    }

    const redirectUri = this.getRedirectUri();

    try {
      const githubToken = await this.authService.exchangeCodeForToken(String(code), redirectUri);
      const user = await this.authService.findOrCreateUser(githubToken);
      const jwtToken = this.authService.createJwtForUser(user);

      const sessionCookieOptions = {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        path: '/',
      };
      
      // Issue session cookie and redirect to frontend
      res.cookie('session', jwtToken, sessionCookieOptions);
      res.clearCookie('oauth_state');
      res.redirect(config.FRONTEND_URL);

    } catch (error) {
      res.status(500).send('An internal server error occurred during authentication.');
    }
  };

  getCurrentUser = async (req: Request, res: Response) => {
    if (!req.user) {
      return res.json({ user: null });
    }
    
    const user = await prisma.user.findUnique({ 
      where: { id: req.user.id },
      select: { id: true, login: true, name: true, avatarUrl: true, githubPat: true }
    });

    if (!user) {
      return res.json({ user: null });
    }

    res.json({
      user: {
        id: user.id,
        login: user.login,
        name: user.name,
        avatarUrl: user.avatarUrl,
        hasPat: !!user.githubPat,
      },
    });
  };

  logout = (req: Request, res: Response) => {
    res.clearCookie('session', { path: '/' });
    res.status(200).json({ message: 'Logged out successfully' });
  };

  updateGithubPat = async (req: Request, res: Response) => {
    const { pat } = req.body;
    if (!pat || typeof pat !== 'string' || !pat.startsWith('ghp_')) {
      return res.status(400).json({ error: 'Invalid GitHub Personal Access Token format.' });
    }

    try {
      await this.authService.updateUserPat(req.user!.id, pat);
      res.status(200).json({ message: 'Token updated successfully.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update token' });
    }
  };
}