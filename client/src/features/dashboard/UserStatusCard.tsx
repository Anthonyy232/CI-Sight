import {Alert, Avatar, Badge, Card, Group, Loader, Stack, Text, Title} from '@mantine/core';
import {IconAlertCircle, IconCheck, IconKey, IconUser} from '@tabler/icons-react';
import {useQuery} from '@tanstack/react-query';
import {getMe} from '../../api/user';

export function UserStatusCard() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['user'], queryFn: getMe });
  const user = data?.user;

  return (
    <Card withBorder padding="lg" h="100%">
      <Stack justify="space-between" h="100%">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={5}>User Status</Title>
            {isLoading && <Loader size="sm" />}
          </Group>
          
          {isError && <Alert color="red" title="Error" icon={<IconAlertCircle />}>Failed to load user data.</Alert>}
          {!user && !isLoading && !isError && (
            <Alert color="orange" title="Not Authenticated" icon={<IconAlertCircle />}>Please log in to view status.</Alert>
          )}

          {user && (
            <>
              <Group>
                <Avatar src={user.avatarUrl} alt={user.name || user.login} radius="xl" />
                <div>
                  <Text fw={500} size="sm">{user.name || user.login}</Text>
                  <Text size="xs" c="dimmed">@{user.login}</Text>
                </div>
              </Group>

              <Stack gap="sm" mt="xs">
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconUser size={16} />
                    <Text size="sm">GitHub Account</Text>
                  </Group>
                  <Badge variant="light" color="green">Connected</Badge>
                </Group>

                <Group justify="space-between">
                  <Group gap="xs">
                    <IconKey size={16} />
                    <Text size="sm">Access Token</Text>
                  </Group>
                  <Badge
                    variant="light"
                    color={user.hasPat ? 'green' : 'red'}
                    leftSection={user.hasPat ? <IconCheck size={10} /> : <IconAlertCircle size={10} />}
                  >
                    {user.hasPat ? 'Configured' : 'Missing'}
                  </Badge>
                </Group>
              </Stack>
            </>
          )}
        </Stack>

        {user && !user.hasPat && (
          <Text size="xs" c="dimmed">
            A Personal Access Token is needed for repository access.
          </Text>
        )}
      </Stack>
    </Card>
  );
}