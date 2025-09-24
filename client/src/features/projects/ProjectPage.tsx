import {useParams} from 'react-router-dom';
import {Anchor, Card, Grid, Loader, Stack, Table, Text, Title} from '@mantine/core';
import {useProject, useProjectBuilds} from './useProjects';
import {BuildDetailsDrawer} from '../builds/BuildDetailsDrawer';
import {useState} from 'react';
import {StatusBadge} from '../../components/common/StatusBadge';
import {formatDistanceToNow} from 'date-fns';
import {IconExternalLink} from '@tabler/icons-react';
import {ProjectStatsCard} from './ProjectStatsCard';
import {ProjectBuildAnalyticsCard} from './ProjectBuildAnalyticsCard';
import {ProjectActivityCard} from './ProjectActivityCard';

export function ProjectPage() {
  const { id } = useParams();
  const projectId = id ? Number(id) : undefined;

  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: builds, isLoading: buildsLoading } = useProjectBuilds(projectId);

  const [selectedBuildId, setSelectedBuildId] = useState<number | undefined>();

  if (projectLoading) {
    return <Loader />;
  }

  if (!project) {
    return <Text>Project not found.</Text>;
  }

  const rows = builds?.map((build) => (
    <Table.Tr key={build.id} onClick={() => setSelectedBuildId(build.id)} style={{ cursor: 'pointer' }}>
      <Table.Td>
        <Text fw={500} ff="monospace">{build.commit}</Text>
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
      <Title order={2}>{project.name}</Title>
      <Anchor href={`https://github.com/${project.githubRepoUrl}`} target="_blank" size="sm" c="dimmed" mb="md">
        {project.githubRepoUrl} <IconExternalLink size={14} style={{ verticalAlign: 'middle' }} />
      </Anchor>

      <Stack gap="lg">
        <Grid gutter="md" align="stretch">
          <Grid.Col span={{ base: 12, md: 6, lg: 4 }}>
            <ProjectStatsCard projectId={projectId!} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6, lg: 4 }}>
            <ProjectBuildAnalyticsCard projectId={projectId!} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <ProjectActivityCard projectId={projectId!} />
          </Grid.Col>
        </Grid>

        <Card padding="lg">
          <Title order={4} mb="md">Recent Builds</Title>
          {buildsLoading && <Loader />}
          {builds && (
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Commit</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Time</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          )}
        </Card>
      </Stack>

      <BuildDetailsDrawer
        opened={!!selectedBuildId}
        onClose={() => setSelectedBuildId(undefined)}
        buildId={selectedBuildId}
      />
    </>
  );
}