import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {getMe, logout, updateGithubPat} from '../../api/user';

/**
 * React Query hook returning the current authenticated user.
 */
export const useMe = () => {
  return useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: Infinity, // User data is stable within a session
    retry: false, // Don't retry on 401, let the interceptor handle it
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      window.location.href = '/login';
    },
  });
};

export const useUpdatePat = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pat: string) => updateGithubPat(pat),
    onSuccess: () => {
      // Refetch user data to update the 'hasPat' status
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
};