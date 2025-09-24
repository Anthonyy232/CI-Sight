import {ActionIcon, Anchor, Badge, Button, Card, Group, Stack, Table, Text, Title} from '@mantine/core';
import {useDeleteProject, useProjects} from './useProjects';
import {Link} from 'react-router-dom';
import {useState} from 'react';
import {IconCalendar, IconGitBranch, IconPlus, IconTrash} from '@tabler/icons-react';
import {CreateProjectModal} from './CreateProjectModal';
import {DeleteProjectModal} from './DeleteProjectModal';
import {Project} from '../../api/types';
import {useDisclosure} from '@mantine/hooks';
import {formatDistanceToNow} from 'date-fns';

export function ProjectsListPage() {
  const { data: projects = [], isLoading } = useProjects();
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const deleteProjectMutation = useDeleteProject({
    onSuccess: () => setProjectToDelete(null),
  });

  const rows = projects.map((p) => (
    <Table.Tr key={p.id}>
      <Table.Td>
        <Stack gap={4}>
          <Anchor component={Link} to={`/projects/${p.id}`} fw={500} size="sm">
            {p.name}
          </Anchor>
          <Group gap="xs">
            <IconGitBranch size={12} />
            <Text size="xs" c="dimmed">{p.githubRepoUrl}</Text>
          </Group>
        </Stack>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <IconCalendar size={14} />
          <Text size="xs" c="dimmed">
            {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
          </Text>
        </Group>
      </Table.Td>
      <Table.Td>
        <Group justify="flex-end">
          <ActionIcon color="red" variant="subtle" onClick={() => setProjectToDelete(p)}>
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <>
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>Projects</Title>
          <Text c="dimmed">All projects configured in CI-Sight.</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={openModal}>
          Create Project
        </Button>
      </Group>

      <Card mb="md">
        <Group justify="space-between">
          <Group gap="xs">
            <IconGitBranch size={20} />
            <div>
              <Text fw={500}>Total Projects</Text>
              <Text size="sm" c="dimmed">Projects configured in your CI pipeline</Text>
            </div>
          </Group>
          <Badge variant="light" color="blue" size="lg">
            {projects.length}
          </Badge>
        </Group>
      </Card>

      <Card>
        <Table verticalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Project</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
        {isLoading && <Text p="md">Loading...</Text>}
      </Card>

      <CreateProjectModal opened={modalOpened} onClose={closeModal} />
      <DeleteProjectModal
        project={projectToDelete}
        opened={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={() => projectToDelete && deleteProjectMutation.mutate(projectToDelete.id)}
        isPending={deleteProjectMutation.isPending}
      />
    </>
  );
}