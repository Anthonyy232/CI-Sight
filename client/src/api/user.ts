import {apiClient} from './apiClient';
import {MeResponse} from './types';

/**
 * Fetches the session information for the currently authenticated user.
 *
 * @returns A promise that resolves to the user's session data, or null if not authenticated.
 */
export const getMe = async (): Promise<MeResponse> => {
  const { data } = await apiClient.get<MeResponse>('/auth/me');
  return data;
};

/**
 * Logs the current user out by destroying their session on the server.
 *
 * @returns A promise that resolves to a confirmation message.
 */
export const logout = async (): Promise<{ message: string }> => {
  const { data } = await apiClient.post('/auth/logout');
  return data;
};

/**
 * Updates or sets the user's GitHub Personal Access Token (PAT).
 *
 * @remarks
 * The PAT is used by the backend to perform GitHub API actions on the user's behalf.
 * @param pat - The Personal Access Token string.
 * @returns A promise that resolves to a confirmation message.
 */
export const updateGithubPat = async (pat: string): Promise<{ message: string }> => {
  const { data } = await apiClient.post('/auth/pat', { pat });
  return data;
};