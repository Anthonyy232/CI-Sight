import { ReposController } from '../modules/repos/repos.controller';

/**
 * Test suite for the ReposController.
 * This suite verifies the controller's handling of requests related to
 * user repositories, including listing, linking, and managing repository links.
 */
describe('ReposController', () => {
  const mockService: any = {
    listUserGithubRepos: jest.fn(),
    listLinkedRepos: jest.fn(),
    registerRepoWebhook: jest.fn(),
    deleteLinkedRepo: jest.fn(),
    restoreLinkedRepo: jest.fn(),
  };

  let controller: ReposController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ReposController(mockService);
  });

  /**
   * Verifies that the controller correctly fetches and returns a user's GitHub repositories.
   */
  it('should return GitHub repositories for the authenticated user', async () => {
    const req: any = { user: { id: 1 } };
    const res: any = { json: jest.fn() };
    mockService.listUserGithubRepos.mockResolvedValue([{ full_name: 'a/b' }]);

    await controller.listUserGithubRepos(req, res);
    expect(res.json).toHaveBeenCalledWith([{ full_name: 'a/b' }]);
  });

  /**
   * Verifies that the controller correctly fetches and returns repositories that have been
   * linked to projects within the application.
   */
  it('should return linked repositories', async () => {
    const req: any = { user: { id: 1 } };
    const res: any = { json: jest.fn() };
    mockService.listLinkedRepos.mockResolvedValue([{ id: 2 }]);

    await controller.listLinkedRepos(req, res);
    expect(res.json).toHaveBeenCalledWith([{ id: 2 }]);
  });

  /**
   * Verifies input validation and the successful registration of a repository webhook.
   */
  it('should validate input and register a repository', async () => {
    const reqBad: any = { params: { projectId: 'x' }, body: {}, user: { id: 1 } };
    const res400: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.registerRepo(reqBad, res400);
    expect(res400.status).toHaveBeenCalledWith(400);

    const reqGood: any = { params: { projectId: '3' }, body: { repoFullName: 'org/repo' }, user: { id: 1 } };
    const res201: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    mockService.registerRepoWebhook.mockResolvedValue({ id: 9 });

    await controller.registerRepo(reqGood, res201);
    expect(res201.status).toHaveBeenCalledWith(201);
    expect(res201.json).toHaveBeenCalledWith({ message: 'Repository linked successfully', link: { id: 9 } });
  });

  /**
   * Verifies that the delete and restore endpoints validate the link ID and
   * correctly call the corresponding service methods.
   */
  it('should validate id and call service for delete and restore actions', async () => {
    const res400: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.deleteRepoLink({ params: { id: 'bad' }, user: { id: 1 } } as any, res400);
    expect(res400.status).toHaveBeenCalledWith(400);

    const resOk: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.deleteRepoLink({ params: { id: '4' }, user: { id: 1 } } as any, resOk);
    expect(mockService.deleteLinkedRepo).toHaveBeenCalledWith(1, 4);
    expect(resOk.status).toHaveBeenCalledWith(200);

    await controller.restoreRepoLink({ params: { id: '5' }, user: { id: 1 } } as any, resOk);
    expect(mockService.restoreLinkedRepo).toHaveBeenCalledWith(1, 5);
  });
});