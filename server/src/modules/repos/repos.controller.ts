import {Request, Response} from 'express';
import {ReposService} from './repos.service';

export class ReposController {
  constructor(private reposService: ReposService) {}

  listUserGithubRepos = async (req: Request, res: Response) => {
    const repos = await this.reposService.listUserGithubRepos(req.user!);
    res.json(repos);
  };

  listLinkedRepos = async (req: Request, res: Response) => {
    const links = await this.reposService.listLinkedRepos(req.user!.id);
    res.json(links);
  };

  registerRepo = async (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    const { repoFullName } = req.body;

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }
    if (!repoFullName) {
      return res.status(400).json({ error: 'Missing repoFullName in body' });
    }

    // Returns the newly created link record, including webhook id if created.
    const link = await this.reposService.registerRepoWebhook(req.user!, projectId, repoFullName);
    res.status(201).json({ message: 'Repository linked successfully', link });
  };

  deleteRepoLink = async (req: Request, res: Response) => {
    const linkId = Number(req.params.id);
    if (isNaN(linkId)) {
      return res.status(400).json({ error: 'Invalid link ID' });
    }

    await this.reposService.deleteLinkedRepo(req.user!.id, linkId);
    res.status(200).json({ message: 'Repository link deleted' });
  };

  restoreRepoLink = async (req: Request, res: Response) => {
    const linkId = Number(req.params.id);
    if (isNaN(linkId)) {
      return res.status(400).json({ error: 'Invalid link ID' });
    }

    await this.reposService.restoreLinkedRepo(req.user!.id, linkId);
    res.status(200).json({ message: 'Repository link restored' });
  };
}