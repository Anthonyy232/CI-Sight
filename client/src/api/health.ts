import {apiClient} from './apiClient';
import {HealthStatus} from './types';

/**
 * Checks the health of the backend API.
 *
 * @remarks
 * This is typically used to verify that the server is running and responsive.
 * @returns A promise that resolves to the API's health status.
 */
export const getHealth = async (): Promise<HealthStatus> => {
  const { data } = await apiClient.get<HealthStatus>('/health');
  return data;
};