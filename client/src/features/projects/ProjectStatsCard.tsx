import {Alert, Badge, Card, Group, Loader, Stack, Text, Title} from '@mantine/core';
import {IconAlertCircle, IconCheck, IconClock, IconGitCommit} from '@tabler/icons-react';
import {useProjectBuilds} from './useProjects';
import {formatDistanceToNow} from 'date-fns';

interface ProjectStatsCardProps {
  projectId: number;
}

export function ProjectStatsCard({ projectId }: ProjectStatsCardProps) {
  const { data: builds, isLoading, isError } = useProjectBuilds(projectId);

  const totalBuilds = builds?.length || 0;
  const successfulBuilds = builds?.filter(build => build.status === 'SUCCESS').length || 0;
  const failedBuilds = builds?.filter(build => build.status === 'FAILURE').length || 0;
  const runningBuilds = builds?.filter(build => build.status === 'RUNNING').length || 0;

  const successRate = totalBuilds > 0 ? Math.round((successfulBuilds / totalBuilds) * 100) : 0;

  const lastBuild = builds?.[0]; // Assuming builds are sorted by date descending
  const lastBuildTime = lastBuild ? formatDistanceToNow(new Date(lastBuild.startedAt), { addSuffix: true }) : 'Never';

  return (
    <Card withBorder padding="lg" h="100%">
      <Stack justify="space-between" h="100%">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={5}>Project Statistics</Title>
            {isLoading && <Loader size="sm" />}
          </Group>

          {isError ? (
            <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" variant="light">
              Failed to load project statistics.
            </Alert>
          ) : (
            <Stack gap="sm">
              <Group justify="space-between">
                <Group gap="xs">
                  <IconGitCommit size={16} />
                  <Text size="sm">Total Builds</Text>
                </Group>
                <Badge variant="light" color="blue">{totalBuilds}</Badge>
              </Group>

              <Group justify="space-between">
                <Group gap="xs">
                  <IconCheck size={16} color="var(--mantine-color-green-6)" />
                  <Text size="sm">Success Rate</Text>
                </Group>
                <Badge variant="light" color="green">{successRate}%</Badge>
              </Group>

              {failedBuilds > 0 && (
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconAlertCircle size={16} color="var(--mantine-color-red-6)" />
                    <Text size="sm">Failed Builds</Text>
                  </Group>
                  <Badge variant="light" color="red">{failedBuilds}</Badge>
                </Group>
              )}

              {runningBuilds > 0 && (
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconClock size={16} color="var(--mantine-color-blue-6)" />
                    <Text size="sm">Running</Text>
                  </Group>
                  <Badge variant="light" color="blue">{runningBuilds}</Badge>
                </Group>
              )}

              <Group justify="space-between">
                <Group gap="xs">
                  <IconClock size={16} />
                  <Text size="sm">Last Build</Text>
                </Group>
                <Text size="sm" fw={500}>{lastBuildTime}</Text>
              </Group>
            </Stack>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}