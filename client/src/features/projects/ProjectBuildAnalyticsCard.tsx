import {Alert, Badge, Card, Group, Loader, Progress, Stack, Text, Title} from '@mantine/core';
import {IconAlertCircle, IconAlertTriangle, IconClock, IconTrendingUp} from '@tabler/icons-react';
import {useProjectBuilds} from './useProjects';

interface ProjectBuildAnalyticsCardProps {
  projectId: number;
}

export function ProjectBuildAnalyticsCard({ projectId }: ProjectBuildAnalyticsCardProps) {
  const { data: builds, isLoading, isError } = useProjectBuilds(projectId);

  const totalBuilds = builds?.length || 0;
  const successfulBuilds = builds?.filter(build => build.status === 'SUCCESS').length || 0;
  const failedBuilds = builds?.filter(build => build.status === 'FAILURE').length || 0;
  const runningBuilds = builds?.filter(build => build.status === 'RUNNING').length || 0;

  const successRate = totalBuilds > 0 ? Math.round((successfulBuilds / totalBuilds) * 100) : 0;
  const failureRate = totalBuilds > 0 ? Math.round((failedBuilds / totalBuilds) * 100) : 0;

  // Calculate average build duration for successful builds
  const completedBuilds = builds?.filter(build => build.completedAt && build.status === 'SUCCESS') || [];
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

  // Calculate trend (comparing recent builds to older ones)
  const recentBuilds = builds?.slice(0, 5) || [];
  const olderBuilds = builds?.slice(5, 10) || [];
  const recentSuccessRate = recentBuilds.length > 0
    ? Math.round((recentBuilds.filter(b => b.status === 'SUCCESS').length / recentBuilds.length) * 100)
    : 0;
  const olderSuccessRate = olderBuilds.length > 0
    ? Math.round((olderBuilds.filter(b => b.status === 'SUCCESS').length / olderBuilds.length) * 100)
    : 0;
  const trend = recentSuccessRate - olderSuccessRate;

  return (
    <Card withBorder padding="lg" h="100%">
      <Stack justify="space-between" h="100%">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={5}>Build Analytics</Title>
            <Badge variant="light" color="blue">{totalBuilds} builds</Badge>
          </Group>

          {isLoading && <Loader />}
          {isError && <Alert color="red" title="Error" icon={<IconAlertCircle />}>Failed to load analytics.</Alert>}

          {builds && totalBuilds > 0 && (
            <Stack gap="md">
              <div>
                <Group justify="space-between" mb={4}>
                  <Group gap="xs">
                    <IconTrendingUp size={16} color="var(--mantine-color-green-6)" />
                    <Text size="sm">Success Rate</Text>
                  </Group>
                  <Text fw={500}>{successRate}%</Text>
                </Group>
                <Progress value={successRate} color="green" size="sm" />
              </div>

              {failureRate > 0 && (
                <div>
                  <Group justify="space-between" mb={4}>
                    <Group gap="xs">
                      <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" />
                      <Text size="sm">Failure Rate</Text>
                    </Group>
                    <Text fw={500}>{failureRate}%</Text>
                  </Group>
                  <Progress value={failureRate} color="red" size="sm" />
                </div>
              )}

              <Group justify="space-between">
                <Group gap="xs">
                  <IconClock size={16} />
                  <Text size="sm">Avg Duration</Text>
                </Group>
                <Text fw={500}>
                  {completedBuilds.length > 0 ? formatDuration(avgDuration) : 'N/A'}
                </Text>
              </Group>

              {olderBuilds.length > 0 && (
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconTrendingUp
                      size={16}
                      color={trend > 0 ? 'var(--mantine-color-green-6)' : trend < 0 ? 'var(--mantine-color-red-6)' : 'var(--mantine-color-gray-6)'}
                    />
                    <Text size="sm">Trend</Text>
                  </Group>
                  <Text fw={500} c={trend > 0 ? 'green' : trend < 0 ? 'red' : 'gray'}>
                    {trend > 0 ? '+' : ''}{trend}%
                  </Text>
                </Group>
              )}

              {runningBuilds > 0 && (
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconClock size={16} color="var(--mantine-color-blue-6)" />
                    <Text size="sm">Currently Running</Text>
                  </Group>
                  <Badge variant="light" color="blue">{runningBuilds}</Badge>
                </Group>
              )}
            </Stack>
          )}

          {builds && totalBuilds === 0 && (
            <Text size="sm" c="dimmed" ta="center">No builds yet</Text>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}