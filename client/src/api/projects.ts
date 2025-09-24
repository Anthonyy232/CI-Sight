import {apiClient} from './apiClient';
import {Project} from './types';

/**
 * Fetches a list of all projects.
 *
 * @returns A promise that resolves to an array of projects.
 */
export const fetchProjects = async (): Promise<Project[]> => {
  const { data } = await apiClient.get<Project[]>('/projects');
  return data;
};

/**
 * Fetches a single project by its unique identifier.
 *
 * @param id - The ID of the project to fetch.
 * @returns A promise that resolves to the requested project.
 */
export const fetchProject = async (id: number): Promise<Project> => {
  const { data } = await apiClient.get<Project>(`/projects/${id}`);
  return data;
};

/**
 * Creates a new project.
 *
 * @param name - The user-defined name for the new project.
 * @param githubRepoUrl - The full URL of the associated GitHub repository.
 * @returns A promise that resolves to the newly created project.
 */
export const createProject = async (name: string, githubRepoUrl: string): Promise<Project> => {
  const { data } = await apiClient.post<Project>('/projects', { name, githubRepoUrl });
  return data;
};

/**
 * Deletes a project by its unique identifier.
 *
 * @param id - The ID of the project to delete.
 * @returns A promise that resolves to a confirmation message.
 */
export const deleteProject = async (id: number): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/projects/${id}`);
  return data;
};