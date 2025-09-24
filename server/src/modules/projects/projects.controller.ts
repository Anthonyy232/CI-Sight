import {Request, Response} from 'express';
import {ProjectsService} from './projects.service';
import {ReposService} from '../repos/repos.service';
import {Prisma} from '@prisma/client';
import {logger} from '../../utils/logger';

/**
 * Controller handling HTTP endpoints for project management.
 *
 * Methods assume `authMiddleware` has attached `req.user` when required.
 */
export class ProjectsController {
  constructor(
    private projectsService: ProjectsService,
    private reposService: ReposService
  ) {}

  listAllProjects = async (req: Request, res: Response) => {
    const projects = await this.projectsService.listProjects();
    res.json(projects);
  };

  getProject = async (req: Request, res: Response) => {
    const projectId = Number(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }
    const project = await this.projectsService.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  };

  deleteProject = async (req: Request, res: Response) => {
    const projectId = Number(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }
    await this.projectsService.deleteProject(req.user!.id, projectId);
    res.status(200).json({ message: 'Project deleted successfully' });
  };

  listProjectBuilds = async (req: Request, res: Response) => {
    const projectId = Number(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }
    const builds = await this.projectsService.getBuildsForProject(projectId);
    res.json(builds);
  };

  createProject = async (req: Request, res: Response) => {
    const { name, githubRepoUrl } = req.body;
    if (!name || !githubRepoUrl) {
      return res.status(400).json({ error: 'Missing name or githubRepoUrl' });
    }

    try {
      const project = await this.projectsService.createProject(name, githubRepoUrl);

  // Automatically link the repository and set up the webhook for the user creating it.
      await this.reposService.registerRepoWebhook(req.user!, project.id, project.githubRepoUrl);

      res.status(201).json(project);
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        logger.warn('Attempted to create a project that already exists', { githubRepoUrl });
        return res.status(409).json({ error: 'A project with that GitHub repo already exists' });
      }
      // Re-throw for the global error handler
      throw err;
    }
  };
}