import {Alert, Card, Loader, Table, Text, Title} from '@mantine/core';
import {IconAlertCircle} from '@tabler/icons-react';
import {useBuilds} from './useBuilds';
import {formatDistanceToNow} from 'date-fns';
import {StatusBadge} from '../../components/common/StatusBadge';
import {useState} from 'react';
import {BuildDetailsDrawer} from './BuildDetailsDrawer';

/**
 * Renders a table of recent builds and opens a details drawer when a row is selected.
 */
export function BuildsTable() {
  const { data: builds, isLoading, isError } = useBuilds();
  const [selectedBuildId, setSelectedBuildId] = useState<number | undefined>();

  const handleRowClick = (buildId: number) => {
    setSelectedBuildId(buildId);
  };

  const rows = builds?.map((build) => (
    <Table.Tr key={build.id} onClick={() => handleRowClick(build.id)} style={{ cursor: 'pointer' }}>
      <Table.Td>
        <Text fw={500}>{build.projectName}</Text>
        <Text size="xs" c="dimmed" ff="monospace">
          {build.commit}
        </Text>
      </Table.Td>
      <Table.Td>
        <StatusBadge status={build.status} />
      </Table.Td>
      <Table.Td>
        <Text size="sm">{formatDistanceToNow(new Date(build.startedAt), { addSuffix: true })}</Text>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <>
      <Card padding="lg">
        <Title order={3} mb="md">Recent Builds</Title>
        {isLoading && <Loader />}
        {isError && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
            Could not load recent builds.
          </Alert>
        )}
        {builds && (
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Project / Commit</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Time</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        )}
      </Card>

      <BuildDetailsDrawer
        opened={!!selectedBuildId}
        onClose={() => setSelectedBuildId(undefined)}
        buildId={selectedBuildId}
      />
    </>
  );
}