import {Request, Response} from 'express';
import {QueueService} from '../../services/queue.service';
import {logger} from '../../utils/logger';

export class WebhooksController {
  constructor(private queueService: QueueService) {}

  handleGithubWebhook = async (req: Request, res: Response) => {
    const eventType = req.headers['x-github-event'] as string;
    const payload = req.body;

    // We are only interested in workflow run events.
    if (eventType !== 'workflow_run' || !payload?.workflow_run) {
      logger.info(`Ignoring GitHub event of type: ${eventType}`);
      return res.status(200).json({ message: 'Event ignored' });
    }

    // The job payload should be nested under a 'payload' key for consistency.
    const result = await this.queueService.addLogJob({ payload });
    res.status(202).json({ message: 'Webhook accepted for processing', ...result });
  };
}