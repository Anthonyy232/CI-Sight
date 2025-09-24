import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {deleteRepoLink, fetchGithubRepos, fetchMyLinkedRepos, registerRepo, restoreRepoLink} from '../../api/repos';

export function useGithubRepos() {
  return useQuery({ queryKey: ['repos', 'github'], queryFn: fetchGithubRepos });
}

export function useMyLinkedRepos() {
  return useQuery({ queryKey: ['repos', 'linked'], queryFn: fetchMyLinkedRepos });
}

export function useRegisterRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, repoFullName }: { projectId: number; repoFullName: string }) => registerRepo(projectId, repoFullName),
    onSuccess: () => {
      // Invalidate both linked repos and projects (in case a new one was created)
      queryClient.invalidateQueries({ queryKey: ['repos', 'linked'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteRepoLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repos', 'linked'] });
    },
  });
}

export function useRestoreRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => restoreRepoLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repos', 'linked'] });
    },
  });
}