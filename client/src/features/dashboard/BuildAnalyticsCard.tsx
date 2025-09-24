import {Alert, Badge, Card, Group, Loader, Progress, Stack, Text, Title} from '@mantine/core';
import {IconAlertCircle, IconCheck, IconClock, IconPlayerPlay} from '@tabler/icons-react';
import {useBuilds} from '../builds/useBuilds';

export function BuildAnalyticsCard() {
  const { data: builds, isLoading, isError } = useBuilds();

  const totalBuilds = builds?.length || 0;
  const successfulBuilds = builds?.filter(build => build.status === 'SUCCESS').length || 0;
  const runningBuilds = builds?.filter(build => build.status === 'RUNNING').length || 0;

  const successRate = totalBuilds > 0 ? Math.round((successfulBuilds / (totalBuilds - runningBuilds)) * 100) : 0;

  const completedBuilds = builds?.filter(build => build.completedAt) || [];
  const avgDuration = completedBuilds.length > 0
    ? completedBuilds.reduce((acc, build) => {
        const start = new Date(build.startedAt);
        const end = new Date(build.completedAt!);
        return acc + (end.getTime() - start.getTime());
      }, 0) / completedBuilds.length
    : 0;

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <Card withBorder padding="lg" h="100%">
      <Stack justify="space-between" h="100%">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={5}>Build Analytics</Title>
            <Badge variant="light" color="blue">{totalBuilds} total</Badge>
          </Group>

          {isLoading && <Loader />}
          {isError && <Alert color="red" title="Error" icon={<IconAlertCircle />}>Failed to load build data.</Alert>}
          
          {builds && (
            <Stack gap="md">
              <div>
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconCheck size={16} color="var(--mantine-color-green-6)" />
                    <Text size="sm">Success Rate</Text>
                  </Group>
                  <Text fw={500}>{successRate}%</Text>
                </Group>
                <Progress value={successRate} color="green" size="sm" mt={4} />
              </div>

              <Group justify="space-between">
                <Group gap="xs">
                  <IconClock size={16} />
                  <Text size="sm">Avg Duration</Text>
                </Group>
                <Text fw={500}>{completedBuilds.length > 0 ? formatDuration(avgDuration) : 'N/A'}</Text>
              </Group>

              {runningBuilds > 0 && (
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconPlayerPlay size={16} color="var(--mantine-color-blue-6)" />
                    <Text size="sm">Running Now</Text>
                  </Group>
                  <Badge variant="light" color="blue">{runningBuilds}</Badge>
                </Group>
              )}
            </Stack>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}