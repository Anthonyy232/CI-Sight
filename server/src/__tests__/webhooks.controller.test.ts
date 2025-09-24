import { WebhooksController } from '../modules/webhooks/webhooks.controller';

/**
 * Test suite for the WebhooksController.
 * This suite verifies the controller's logic for handling incoming GitHub webhooks,
 * primarily focusing on event filtering and job queuing.
 */
describe('WebhooksController', () => {
  let controller: WebhooksController;
  const mockQueue: any = { addLogJob: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new WebhooksController(mockQueue);
  });

  /**
   * Verifies that the controller correctly identifies and ignores events that are not
   * of the 'workflow_run' type, returning a 200 OK status.
   */
  it('should ignore events that are not workflow_run', async () => {
    const req: any = { headers: { 'x-github-event': 'push' }, body: {} };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.handleGithubWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Event ignored' });
  });

  /**
   * Verifies that 'workflow_run' events are accepted and passed to the queue service
   * for background processing, returning a 202 Accepted status.
   */
  it('should enqueue workflow_run events for processing', async () => {
    const payload = { workflow_run: { id: 1 } };
    mockQueue.addLogJob.mockResolvedValue({ jobId: 'job-1' });
    const req: any = { headers: { 'x-github-event': 'workflow_run' }, body: { workflow_run: payload.workflow_run } };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.handleGithubWebhook(req, res);

    expect(mockQueue.addLogJob).toHaveBeenCalledWith({ payload: req.body });
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Webhook accepted for processing' }));
  });
});

