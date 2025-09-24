import {Alert, Badge, Card, Group, Loader, Stack, Text, Title} from '@mantine/core';
import {IconAlertCircle, IconFolder, IconGitBranch, IconWebhook} from '@tabler/icons-react';
import {useProjects} from '../projects/useProjects';
import {useMyLinkedRepos} from '../repos/useRepos';

export function ProjectOverviewCard() {
  const { data: projects, isLoading: projectsLoading, isError: projectsError } = useProjects();
  const { data: linkedRepos, isLoading: reposLoading, isError: reposError } = useMyLinkedRepos();

  const isLoading = projectsLoading || reposLoading;
  const isError = projectsError || reposError;

  const totalProjects = projects?.length || 0;
  const totalLinkedRepos = linkedRepos?.length || 0;
  const reposWithWebhooks = linkedRepos?.filter(repo => repo.webhookId !== null).length || 0;

  return (
    <Card withBorder padding="lg" h="100%">
      <Stack justify="space-between" h="100%">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={5}>Project Overview</Title>
            {isLoading && <Loader size="sm" />}
          </Group>

          {isError ? (
            <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" variant="light">
              Failed to load data.
            </Alert>
          ) : (
            <Stack gap="sm">
              <Group justify="space-between">
                <Group gap="xs">
                  <IconFolder size={16} />
                  <Text size="sm">Total Projects</Text>
                </Group>
                <Badge variant="light" color="blue">{totalProjects}</Badge>
              </Group>

              <Group justify="space-between">
                <Group gap="xs">
                  <IconGitBranch size={16} />
                  <Text size="sm">Linked Repositories</Text>
                </Group>
                <Badge variant="light" color="green">{totalLinkedRepos}</Badge>
              </Group>

              <Group justify="space-between">
                <Group gap="xs">
                  <IconWebhook size={16} />
                  <Text size="sm">Active Webhooks</Text>
                </Group>
                <Badge
                  variant="light"
                  color={reposWithWebhooks === totalLinkedRepos && totalLinkedRepos > 0 ? 'green' : 'orange'}
                >
                  {reposWithWebhooks}/{totalLinkedRepos}
                </Badge>
              </Group>
            </Stack>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}