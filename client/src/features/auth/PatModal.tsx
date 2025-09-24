import {Anchor, Button, Group, Modal, PasswordInput, Text} from '@mantine/core';
import {useState} from 'react';
import {useUpdatePat} from './useAuth';
import {notifications} from '@mantine/notifications';

interface PatModalProps {
  opened: boolean;
  onClose: () => void;
}

export function PatModal({ opened, onClose }: PatModalProps) {
  const [patValue, setPatValue] = useState('');
  const updatePatMutation = useUpdatePat();

  const handleSave = async () => {
    if (!patValue.trim()) return;
    await updatePatMutation.mutateAsync(patValue.trim(), {
      onSuccess: () => {
        notifications.show({
          title: 'Success',
          message: 'GitHub token has been updated.',
          color: 'green',
        });
        setPatValue('');
        onClose();
      },
    });
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Set GitHub Personal Access Token" size="md">
      <Text size="sm" mb="md">
        To download workflow logs from private repositories, you need a GitHub Personal Access Token with 'repo' scope.
        Create one at{' '}
        <Anchor href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">
          GitHub Settings
        </Anchor>
        .
      </Text>
      <PasswordInput
        label="GitHub Personal Access Token"
        placeholder="ghp_..."
        value={patValue}
        onChange={(e) => setPatValue(e.target.value)}
        mb="md"
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} loading={updatePatMutation.isPending}>
          Save Token
        </Button>
      </Group>
    </Modal>
  );
}