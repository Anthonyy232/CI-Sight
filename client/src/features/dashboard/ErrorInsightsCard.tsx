import {Alert, Badge, Card, Center, Group, Loader, Progress, Stack, Text, Title} from '@mantine/core';
import {IconAlertCircle, IconAlertTriangle} from '@tabler/icons-react';
import {useQuery} from '@tanstack/react-query';
import {getErrorAnalytics} from '../../api/builds';

export function ErrorInsightsCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['error-analytics'],
    queryFn: getErrorAnalytics,
  });

  const { totalFailed, categories } = data || { totalFailed: 0, categories: [] };

  return (
    <Card withBorder padding="lg" h="100%">
      <Stack justify="space-between" h="100%">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={5}>Error Insights</Title>
            {!isLoading && <Badge variant="light" color="red">{totalFailed} failed</Badge>}
            {isLoading && <Loader size="sm" />}
          </Group>

          {isError && <Alert color="red" title="Error" icon={<IconAlertCircle />}>Failed to load analytics.</Alert>}

          {!isLoading && !isError && (
            totalFailed === 0 ? (
              <Center h={100}>
                <Text size="sm" c="dimmed">No failed builds to analyze</Text>
              </Center>
            ) : (
              <Stack gap="md">
                {categories.map((item) => (
                  <div key={item.category}>
                    <Group justify="space-between" mb={4}>
                      <Group gap="xs">
                        <IconAlertTriangle size={14} color="var(--mantine-color-orange-6)" />
                        <Text size="sm" fw={500}>{item.category}</Text>
                      </Group>
                      <Text size="sm">{item.percentage}%</Text>
                    </Group>
                    <Progress value={item.percentage} color="orange" size="sm" />
                  </div>
                ))}
              </Stack>
            )
          )}
        </Stack>
      </Stack>
    </Card>
  );
}