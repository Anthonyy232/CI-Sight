import {Button, Group, Loader, Modal, Select, TextInput} from '@mantine/core';
import {useState} from 'react';
import {useCreateProject} from './useProjects';
import {useGithubRepos} from '../repos/useRepos';
import {notifications} from '@mantine/notifications';

interface CreateProjectModalProps {
  opened: boolean;
  onClose: () => void;
}

export function CreateProjectModal({ opened, onClose }: CreateProjectModalProps) {
  const { data: repos, isLoading: isLoadingRepos } = useGithubRepos();
  const createProjectMutation = useCreateProject();
  const [name, setName] = useState('');
  const [repoUrl, setRepoUrl] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name || !repoUrl) return;
    await createProjectMutation.mutateAsync(
      { name, githubRepoUrl: repoUrl },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Project Created',
            message: `Project "${name}" has been successfully created.`,
            color: 'green',
          });
          setName('');
          setRepoUrl(null);
          onClose();
        },
      }
    );
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Create New Project">
      <TextInput label="Project Name" placeholder="My Awesome App" value={name} onChange={(e) => setName(e.target.value)} mb="sm" />
      <Select
        label="GitHub Repository"
        placeholder="Select a repository"
        value={repoUrl}
        onChange={setRepoUrl}
        data={(repos || []).map((r) => ({ value: r.full_name, label: r.full_name }))}
        searchable
        rightSection={isLoadingRepos ? <Loader size="xs" /> : null}
        mb="md"
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleCreate} loading={createProjectMutation.isPending} disabled={!name || !repoUrl}>
          Create Project
        </Button>
      </Group>
    </Modal>
  );
}