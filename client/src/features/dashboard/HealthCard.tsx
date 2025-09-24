import {Alert, Badge, Button, Card, Group, Loader, Stack, Text, Title} from '@mantine/core';
import {IconAlertCircle, IconCheck, IconRefresh} from '@tabler/icons-react';
import {useHealth} from './useHealth';
import {format} from 'date-fns';

export function HealthCard() {
  const { data, isLoading, isError, refetch } = useHealth();
  const isOk = data?.status === 'ok';

  return (
    <Card withBorder padding="lg">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={5}>System Status</Title>
          {isLoading ? (
            <Loader size="sm" />
          ) : (
            <Badge
              size="sm"
              color={isOk ? 'green' : 'red'}
              leftSection={isOk ? <IconCheck size={12} /> : <IconAlertCircle size={12} />}
            >
              {isOk ? 'Healthy' : 'Error'}
            </Badge>
          )}
        </Group>

        {isError && (
          <Alert icon={<IconAlertCircle size={16} />} title="Connection Error" color="red">
            Failed to connect to the backend.
          </Alert>
        )}

        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            Last check: {data ? format(new Date(data.time), 'p') : 'N/A'}
          </Text>
          <Button
            variant="light"
            size="xs"
            onClick={() => refetch()}
            leftSection={<IconRefresh size={14} />}
            loading={isLoading}
          >
            Refresh
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}