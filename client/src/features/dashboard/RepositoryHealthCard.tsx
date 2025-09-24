import {Alert, Badge, Card, Center, Group, Loader, Progress, Stack, Text, Title} from '@mantine/core';
import {IconAlertCircle, IconCheck, IconWebhook, IconX} from '@tabler/icons-react';
import {useMyLinkedRepos} from '../repos/useRepos';

export function RepositoryHealthCard() {
  const { data: linkedRepos, isLoading, isError } = useMyLinkedRepos();

  const totalRepos = linkedRepos?.length || 0;
  const reposWithWebhooks = linkedRepos?.filter(repo => repo.webhookId !== null).length || 0;
  const webhookCoverage = totalRepos > 0 ? Math.round((reposWithWebhooks / totalRepos) * 100) : 0;

  return (
    <Card withBorder padding="lg">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={5}>Repository Health</Title>
          {isLoading ? <Loader size="sm" /> : <Badge variant="light" color="blue">{totalRepos} repos</Badge>}
        </Group>

        {isError && <Alert color="red" title="Error" icon={<IconAlertCircle />}>Failed to load repository data.</Alert>}

        {!isLoading && !isError && (
          totalRepos === 0 ? (
            <Center h={100}>
              <Text size="sm" c="dimmed">No linked repositories</Text>
            </Center>
          ) : (
            <Stack gap="md">
              <div>
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconWebhook size={16} />
                    <Text size="sm">Webhook Coverage</Text>
                  </Group>
                  <Text fw={500}>{webhookCoverage}%</Text>
                </Group>
                <Progress
                  value={webhookCoverage}
                  color={webhookCoverage === 100 ? 'green' : webhookCoverage > 50 ? 'yellow' : 'red'}
                  size="sm"
                  mt={4}
                />
              </div>

              <Stack gap="xs">
                <Text size="sm" fw={500}>Repository Status</Text>
                {linkedRepos?.slice(0, 3).map((repo) => (
                  <Group key={repo.id} justify="space-between">
                    <Text size="xs" truncate>{repo.repoFullName}</Text>
                    <Badge
                      size="xs"
                      color={repo.webhookId ? 'green' : 'red'}
                      variant="light"
                      leftSection={repo.webhookId ? <IconCheck size={10} /> : <IconX size={10} />}
                    >
                      {repo.webhookId ? 'Active' : 'Missing'}
                    </Badge>
                  </Group>
                ))}
                {totalRepos > 3 && (
                  <Text size="xs" c="dimmed" ta="right">+ {totalRepos - 3} more</Text>
                )}
              </Stack>
            </Stack>
          )
        )}
      </Stack>
    </Card>
  );
}