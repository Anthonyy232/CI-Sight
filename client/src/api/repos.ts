import {apiClient} from './apiClient';
import {GithubRepo, LinkedRepo} from './types';

/**
 * Fetches a list of GitHub repositories accessible to the authenticated user.
 *
 * @remarks
 * This calls the GitHub API via our backend to let the user pick a repo to link.
 * @returns A promise that resolves to an array of available GitHub repositories.
 */
export const fetchGithubRepos = async (): Promise<GithubRepo[]> => {
  const { data } = await apiClient.get<GithubRepo[]>('/github/repos');
  return data;
};

/**
 * Fetches repositories that have already been linked to projects in this application.
 *
 * @returns A promise that resolves to an array of linked repositories.
 */
export const fetchMyLinkedRepos = async (): Promise<LinkedRepo[]> => {
  const { data } = await apiClient.get<LinkedRepo[]>('/my/repos');
  return data;
};

/**
 * Links a GitHub repository to a specific project within the application.
 *
 * @param projectId - The ID of the project to link the repository to.
 * @param repoFullName - The full name of the repository (e.g., "owner/repo-name").
 * @returns A promise that resolves when the registration is complete.
 */
export const registerRepo = async (projectId: number, repoFullName: string) => {
  const { data } = await apiClient.post(`/repos/${projectId}/register`, { repoFullName });
  return data;
};

/**
 * Deletes the link between a repository and a project.
 *
 * @remarks
 * This action typically "soft-deletes" the link, allowing it to be restored.
 * @param id - The unique identifier of the repository link.
 * @returns A promise that resolves when the link is deleted.
 */
export const deleteRepoLink = async (id: number) => {
  const { data } = await apiClient.delete(`/repos/${id}`);
  return data;
};

/**
 * Restores a previously deleted repository link.
 *
 * @param id - The unique identifier of the repository link to restore.
 * @returns A promise that resolves when the link is restored.
 */
export const restoreRepoLink = async (id: number) => {
  const { data } = await apiClient.post(`/repos/${id}/restore`);
  return data;
};