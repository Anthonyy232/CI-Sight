const FakePrismaError = function FakePrismaError(this: any) { Error.call(this); } as any;
FakePrismaError.prototype = Object.create(Error.prototype);
const prismaClientModule: any = require('@prisma/client');
prismaClientModule.Prisma = prismaClientModule.Prisma || {};
prismaClientModule.Prisma.PrismaClientKnownRequestError = FakePrismaError;

const { ProjectsController } = require('../modules/projects/projects.controller');

/**
 * Test suite for the ProjectsController.
 * This suite verifies the handling of HTTP requests for project-related operations,
 * including listing, creating, deleting, and retrieving associated builds.
 */
describe('ProjectsController', () => {
  const mockProjectsService: any = {
    listProjects: jest.fn(),
    getProject: jest.fn(),
    deleteProject: jest.fn(),
    getBuildsForProject: jest.fn(),
    createProject: jest.fn(),
  };
  const mockReposService: any = { registerRepoWebhook: jest.fn() };

  let controller: any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProjectsController(mockProjectsService, mockReposService);
  });

  /**
   * Verifies that the controller correctly fetches and returns a list of all projects.
   */
  it('should list all projects and return them', async () => {
    mockProjectsService.listProjects.mockResolvedValue([{ id: 1 }]);
    const req: any = {};
    const res: any = { json: jest.fn() };

    await controller.listAllProjects(req, res);
    expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
  });

  /**
   * Verifies error handling for the getProject endpoint, including invalid ID formats
   * and cases where the project is not found.
   */
  it('should handle invalid id and not found scenarios for getProject', async () => {
    const res400: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.getProject({ params: { id: 'x' } } as any, res400);
    expect(res400.status).toHaveBeenCalledWith(400);

    const res404: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    mockProjectsService.getProject.mockResolvedValue(null);
    await controller.getProject({ params: { id: '10' } } as any, res404);
    expect(res404.status).toHaveBeenCalledWith(404);
  });

  /**
   * Verifies that the deleteProject endpoint validates the project ID and correctly
   * invokes the service method.
   */
  it('should validate id and call service for deleteProject', async () => {
    const res400: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.deleteProject({ params: { id: 'nope' }, user: { id: 99 } } as any, res400);
    expect(res400.status).toHaveBeenCalledWith(400);

    const resOk: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.deleteProject({ params: { id: '5' }, user: { id: 99 } } as any, resOk);
    expect(mockProjectsService.deleteProject).toHaveBeenCalledWith(99, 5);
    expect(resOk.status).toHaveBeenCalledWith(200);
  });

  /**
   * Verifies that the listProjectBuilds endpoint validates the project ID and returns
   * the builds fetched from the service.
   */
  it('should validate id and return builds for listProjectBuilds', async () => {
    const res400: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.listProjectBuilds({ params: { id: 'bad' } } as any, res400);
    expect(res400.status).toHaveBeenCalledWith(400);

    const resOk: any = { json: jest.fn() };
    mockProjectsService.getBuildsForProject.mockResolvedValue([{ id: 1 }]);
    await controller.listProjectBuilds({ params: { id: '2' } } as any, resOk);
    expect(resOk.json).toHaveBeenCalledWith([{ id: 1 }]);
  });

  /**
   * Verifies input validation for project creation and the correct handling of a unique
   * constraint violation (P2002) from the database, returning a 409 Conflict status.
   */
  it('should validate inputs and handle unique constraint for createProject', async () => {
    const res400: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.createProject({ body: {} , user: { id: 1 } } as any, res400);
    expect(res400.status).toHaveBeenCalledWith(400);

    const resConflict: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const err: any = new Error('unique');
    err.code = 'P2002';

    const { Prisma } = require('@prisma/client');
    const FakePrisma = (Prisma && Prisma.PrismaClientKnownRequestError) || function FakePrismaError() {};
    Object.setPrototypeOf(err, FakePrisma.prototype);
    (err as any).constructor = FakePrisma;

    mockProjectsService.createProject.mockRejectedValue(err);

    await controller.createProject({ body: { name: 'n', githubRepoUrl: 'u' }, user: { id: 1 } } as any, resConflict);
    expect(resConflict.status).toHaveBeenCalledWith(409);
    expect(resConflict.json).toHaveBeenCalledWith({ error: 'A project with that GitHub repo already exists' });
  });
});