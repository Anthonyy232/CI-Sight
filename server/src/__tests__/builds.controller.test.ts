import { BuildsController } from '../modules/builds/builds.controller';

/**
 * Test suite for the BuildsController.
 * This suite verifies the controller's handling of requests related to builds,
 * including listing recent builds, fetching build details, and retrieving analytics.
 */
describe('BuildsController', () => {
  let controller: BuildsController;
  const mockService: any = {
    getRecentBuilds: jest.fn(),
    getBuildDetails: jest.fn(),
    getErrorAnalytics: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new BuildsController(mockService);
  });

  /**
   * Verifies that the controller fetches recent builds using the default limit of 20
   * when no limit is specified in the request.
   */
  it('should return builds with default limit', async () => {
    const req: any = { query: {} };
    const res: any = { json: jest.fn() };
    mockService.getRecentBuilds.mockResolvedValue([{ id: 1 }]);

    await controller.listRecentBuilds(req, res);

    expect(mockService.getRecentBuilds).toHaveBeenCalledWith(20);
    expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
  });

  /**
   * Verifies that the controller respects the `limit` query parameter and caps it
   * at a maximum value of 50 to prevent excessive data retrieval.
   */
  it('should respect provided limit and cap at 50', async () => {
    const req: any = { query: { limit: '5' } };
    const res: any = { json: jest.fn() };
    mockService.getRecentBuilds.mockResolvedValue([{ id: 2 }]);

    await controller.listRecentBuilds(req, res);

    expect(mockService.getRecentBuilds).toHaveBeenCalledWith(5);
    expect(res.json).toHaveBeenCalledWith([{ id: 2 }]);

    req.query.limit = '500';
    await controller.listRecentBuilds(req, res);
    expect(mockService.getRecentBuilds).toHaveBeenCalledWith(50);
  });

  /**
   * Ensures the controller returns a 400 Bad Request response when provided with
   * a non-numeric build ID.
   */
  it('should return 400 on invalid id', async () => {
    const req: any = { params: { id: 'abc' } };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.getBuildById(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid build ID' });
  });

  /**
   * Verifies that the controller returns a 404 Not Found response when the
   * requested build does not exist.
   */
  it('should return 404 when not found', async () => {
    const req: any = { params: { id: '123' } };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    mockService.getBuildDetails.mockResolvedValue(null);

    await controller.getBuildById(req, res);

    expect(mockService.getBuildDetails).toHaveBeenCalledWith(123);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Build not found' });
  });

  /**
   * Verifies that the controller successfully returns build details when a
   * valid build ID is provided and the build is found.
   */
  it('should return details when found', async () => {
    const req: any = { params: { id: '7' } };
    const res: any = { json: jest.fn() };
    mockService.getBuildDetails.mockResolvedValue({ id: 7, name: 'ok' });

    await controller.getBuildById(req, res);

    expect(res.json).toHaveBeenCalledWith({ id: 7, name: 'ok' });
  });

  /**
   * Ensures the controller correctly fetches and returns error analytics data.
   */
  it('should return error analytics', async () => {
    const req: any = {};
    const res: any = { json: jest.fn() };
    mockService.getErrorAnalytics.mockResolvedValue({ totalErrors: 5 });

    await controller.getErrorAnalytics(req, res);

    expect(mockService.getErrorAnalytics).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ totalErrors: 5 });
  });
});