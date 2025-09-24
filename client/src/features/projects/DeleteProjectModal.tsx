import {Button, Group, Modal, Text} from '@mantine/core';
import {Project} from '../../api/types';

interface DeleteProjectModalProps {
  project: Project | null;
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeleteProjectModal({ project, opened, onClose, onConfirm, isPending }: DeleteProjectModalProps) {
  if (!project) return null;

  return (
    <Modal opened={opened} onClose={onClose} title={`Delete Project: ${project.name}`} centered>
      <Text>
        Are you sure you want to delete the project "<strong>{project.name}</strong>"? This action is irreversible and will delete all associated builds and logs.
      </Text>
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button color="red" onClick={onConfirm} loading={isPending}>
          Delete Project
        </Button>
      </Group>
    </Modal>
  );
}