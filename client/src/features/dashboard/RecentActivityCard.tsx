import {Alert, Badge, Card, Center, Group, Loader, Stack, Text, Timeline, Title} from '@mantine/core';
import {IconAlertCircle, IconCheck, IconFolderPlus, IconGitCommit, IconX} from '@tabler/icons-react';
import {useBuilds} from '../builds/useBuilds';
import {useProjects} from '../projects/useProjects';
import {formatDistanceToNow} from 'date-fns';

export function RecentActivityCard() {
  const { data: builds, isLoading: buildsLoading, isError: buildsError } = useBuilds();
  const { data: projects, isLoading: projectsLoading, isError: projectsError } = useProjects();

  const isLoading = buildsLoading || projectsLoading;
  const isError = buildsError || projectsError;

  const activities: Array<{
    id: string;
    type: 'build' | 'project';
    title: string;
    description: string;
    timestamp: Date;
    status?: string;
    icon: any;
  }> = [];

  builds?.slice(0, 5).forEach(build => {
    activities.push({
      id: `build-${build.id}`,
      type: 'build',
      title: `Build ${build.status.toLowerCase()}`,
      description: `${build.projectName} - ${build.commit}`,
      timestamp: new Date(build.startedAt),
      status: build.status,
      icon: build.status === 'SUCCESS' ? IconCheck : build.status === 'FAILURE' ? IconX : IconGitCommit,
    });
  });

  projects?.slice(0, 3).forEach(project => {
    activities.push({
      id: `project-${project.id}`,
      type: 'project',
      title: 'Project created',
      description: project.name,
      timestamp: new Date(project.createdAt),
      icon: IconFolderPlus,
    });
  });

  activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'SUCCESS': return 'green';
      case 'FAILURE': return 'red';
      case 'RUNNING': return 'blue';
      default: return 'gray';
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
          activities.length === 0 ? (
            <Center h={200}>
              <Text c="dimmed" size="sm">No recent activity to display.</Text>
            </Center>
          ) : (
            <Timeline bulletSize={24} lineWidth={2}>
              {activities.slice(0, 5).map((activity) => (
                <Timeline.Item
                  key={activity.id}
                  bullet={<activity.icon size={12} />}
                  title={
                    <Group gap="xs" align="center">
                      <Text size="sm" fw={500}>{activity.title}</Text>
                      {activity.status && (
                        <Badge size="xs" variant="light" color={getStatusColor(activity.status)}>
                          {activity.status}
                        </Badge>
                      )}
                    </Group>
                  }
                >
                  <Stack gap={2}>
                    <Text size="sm" c="dimmed">{activity.description}</Text>
                    <Text size="xs" c="dimmed">
                      {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                    </Text>
                  </Stack>
                </Timeline.Item>
              ))}
            </Timeline>
          )
        )}
      </Stack>
    </Card>
  );
}