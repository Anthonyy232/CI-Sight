import {useQuery} from '@tanstack/react-query';
import {getBuildDetails, getRecentBuilds} from '../../api/builds';

export function useBuilds() {
  return useQuery({
    queryKey: ['builds', 'recent'],
    queryFn: getRecentBuilds,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
}

export function useBuildDetails(buildId?: number) {
  return useQuery({
    queryKey: ['build', buildId],
    queryFn: () => getBuildDetails(buildId!),
    enabled: !!buildId, // Only run query if buildId is provided
  });
}