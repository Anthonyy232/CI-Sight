import {Request, Response} from 'express';
import {BuildsService} from './builds.service';

/**
 * Controller exposing HTTP endpoints related to builds.
 *
 * Endpoints:
 * - GET /builds (limit: number) => recent builds summary
 * - GET /builds/:id => full build details
 * - GET /builds/analytics/errors => aggregated error analytics
 */
export class BuildsController {
  constructor(private buildsService: BuildsService) {}

  listRecentBuilds = async (req: Request, res: Response) => {
    // Cap client-requested limits to avoid heavy queries
    const limit = Math.min(50, Number(req.query.limit) || 20);
    const builds = await this.buildsService.getRecentBuilds(limit);
    res.json(builds);
  };

  getBuildById = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid build ID' });
    }

    const buildDetails = await this.buildsService.getBuildDetails(id);
    if (!buildDetails) {
      return res.status(404).json({ error: 'Build not found' });
    }
    res.json(buildDetails);
  };

  getErrorAnalytics = async (req: Request, res: Response) => {
    const analytics = await this.buildsService.getErrorAnalytics();
    res.json(analytics);
  };
}