import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {createProject, deleteProject, fetchProject, fetchProjects} from '../../api/projects';
import {getProjectBuilds} from '../../api/builds';
import {Project} from '../../api/types';

// --- Queries ---

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });
}

export function useProject(projectId?: number) {
  return useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => fetchProject(projectId!),
    enabled: !!projectId,
  });
}

export function useProjectBuilds(projectId?: number) {
  return useQuery({
    queryKey: ['project', projectId, 'builds'],
    queryFn: () => getProjectBuilds(projectId!),
    enabled: !!projectId,
    refetchInterval: 30 * 1000, // Refetch every 30s
  });
}

// --- Mutations ---

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, githubRepoUrl }: { name: string; githubRepoUrl: string }) => createProject(name, githubRepoUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteProject(options?: { onSuccess?: (deletedProject: { id: number }) => void }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteProject(id).then(() => ({ id })), // Pass id to onSuccess
    onSuccess: (deletedProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.removeQueries({ queryKey: ['project', deletedProject.id] });
      options?.onSuccess?.(deletedProject);
    },
  });
}