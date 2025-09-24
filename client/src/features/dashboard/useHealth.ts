import {useQuery} from '@tanstack/react-query';
import {getHealth} from '../../api/health';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 60 * 1000, // Refresh every 60 seconds
  });
}