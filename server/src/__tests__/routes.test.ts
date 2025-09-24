import { createAuthRouter } from '../modules/auth/auth.routes';
import { createBuildsRouter } from '../modules/builds/builds.routes';
import { createDevRouter } from '../modules/dev/dev.routes';
import { createProjectsRouter } from '../modules/projects/projects.routes';
import { createReposRouter } from '../modules/repos/repos.routes';
import { createWebhooksRouter } from '../modules/webhooks/webhooks.routes';

/**
 * Test suite for verifying the structure of Express routers.
 * These are simple "smoke tests" to ensure that all expected routes are
 * registered on their respective routers, preventing accidental route removals.
 */
describe('route modules', () => {
  /**
   * Verifies that the authentication router exposes all expected endpoints.
   */
  it('should expose expected routes for the auth router', () => {
    const router = createAuthRouter({} as any, {} as any);
    const paths = router.stack.filter((l: any) => l.route).map((l: any) => l.route.path);
    expect(paths).toEqual(expect.arrayContaining(['/github', '/github/callback', '/logout', '/me', '/pat']));
  });

  /**
   * Verifies that the builds router exposes all expected endpoints.
   */
  it('should expose expected routes for the builds router', () => {
    const router = createBuildsRouter();
    const paths = router.stack.filter((l: any) => l.route).map((l: any) => l.route.path);
    expect(paths).toEqual(expect.arrayContaining(['/builds', '/builds/:id', '/builds/analytics/errors']));
  });

  /**
   * Verifies that the development router exposes its seeding endpoint.
   */
  it('should expose the seed route for the dev router', () => {
    const router = createDevRouter();
    const paths = router.stack.filter((l: any) => l.route).map((l: any) => l.route.path);
    expect(paths).toEqual(expect.arrayContaining(['/seed']));
  });

  /**
   * Verifies that the projects router exposes all expected endpoints.
   */
  it('should expose expected routes for the projects router', () => {
    const router = createProjectsRouter();
    const paths = router.stack.filter((l: any) => l.route).map((l: any) => l.route.path);
    expect(paths).toEqual(expect.arrayContaining(['/projects', '/projects/:id', '/projects/:id/builds']));
  });

  /**
   * Verifies that the repositories router exposes all expected endpoints.
   */
  it('should expose expected routes for the repos router', () => {
    const router = createReposRouter({} as any, {} as any);
    const paths = router.stack.filter((l: any) => l.route).map((l: any) => l.route.path);
    expect(paths).toEqual(expect.arrayContaining(['/github/repos', '/my/repos', '/repos/:projectId/register', '/repos/:id', '/repos/:id/restore']));
  });

  /**
   * Verifies that the webhooks router exposes the GitHub webhook endpoint.
   */
  it('should expose the GitHub webhook route for the webhooks router', () => {
    const router = createWebhooksRouter({ addLogJob: jest.fn() } as any);
    const paths = router.stack.filter((l: any) => l.route).map((l: any) => l.route.path);
    expect(paths).toEqual(expect.arrayContaining(['/github']));
  });
});