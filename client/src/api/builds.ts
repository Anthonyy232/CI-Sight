import {apiClient} from './apiClient';
import {BuildDetails, BuildSummary} from './types';

/**
 * Fetch recent build summaries for the dashboard.
 */
export const getRecentBuilds = async (): Promise<BuildSummary[]> => {
  const { data } = await apiClient.get<BuildSummary[]>('/builds');
  return data;
};

/**
 * Fetch full build details including logs.
 */
export const getBuildDetails = async (id: number): Promise<BuildDetails> => {
  const { data } = await apiClient.get<BuildDetails>(`/builds/${id}`);
  return data;
};

/**
 * Builds for a specific project.
 */
export const getProjectBuilds = async (projectId: number): Promise<BuildSummary[]> => {
  const { data } = await apiClient.get<BuildSummary[]>(`/projects/${projectId}/builds`);
  return data;
};

/**
 * Error analytics used by the ErrorInsights card.
 */
export const getErrorAnalytics = async (): Promise<{
  totalFailed: number;
  categories: Array<{ category: string; count: number; percentage: number }>;
}> => {
  const { data } = await apiClient.get('/builds/analytics/errors');
  return data;
};