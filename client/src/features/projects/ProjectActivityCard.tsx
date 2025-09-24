import {Alert, Badge, Card, Center, Group, Loader, Stack, Text, Timeline, Title} from '@mantine/core';
import {IconAlertCircle, IconCheck, IconClock, IconGitCommit, IconX} from '@tabler/icons-react';
import {useProjectBuilds} from './useProjects';
import {formatDistanceToNow} from 'date-fns';

interface ProjectActivityCardProps {
  projectId: number;
}

export function ProjectActivityCard({ projectId }: ProjectActivityCardProps) {
  const { data: builds, isLoading, isError } = useProjectBuilds(projectId);

  const recentBuilds = builds?.slice(0, 8) || []; // Show last 8 builds

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS': return 'green';
      case 'FAILURE': return 'red';
      case 'RUNNING': return 'blue';
      case 'CANCELLED': return 'orange';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS': return IconCheck;
      case 'FAILURE': return IconX;
      case 'RUNNING': return IconClock;
      default: return IconGitCommit;
    }
  };

  return (
    <Card withBorder padding="lg" h="100%">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={5}>Recent Activity</Title>
          {isLoading && <Loader size="sm" />}
        </Group>

        {isError && <Alert color="red" title="Error" icon={<IconAlertCircle />}>Failed to load activity.</Alert>}

        {!isLoading && !isError && (
          recentBuilds.length === 0 ? (
            <Center h={200}>
              <Text c="dimmed" size="sm">No recent activity to display.</Text>
            </Center>
          ) : (
            <Timeline bulletSize={24} lineWidth={2}>
              {recentBuilds.map((build) => {
                const StatusIcon = getStatusIcon(build.status);
                return (
                  <Timeline.Item
                    key={build.id}
                    bullet={<StatusIcon size={12} />}
                    title={
                      <Group gap="xs" align="center">
                        <Text size="sm" fw={500}>
                          Build {build.status.toLowerCase()}
                        </Text>
                        <Badge size="xs" variant="light" color={getStatusColor(build.status)}>
                          {build.status}
                        </Badge>
                      </Group>
                    }
                  >
                    <Stack gap={2}>
                      <Text size="sm" c="dimmed" ff="monospace">
                        {build.commit}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {formatDistanceToNow(new Date(build.startedAt), { addSuffix: true })}
                      </Text>
                    </Stack>
                  </Timeline.Item>
                );
              })}
            </Timeline>
          )
        )}
      </Stack>
    </Card>
  );
}