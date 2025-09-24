import {Grid, Stack} from '@mantine/core';
import {HealthCard} from './HealthCard';
import {BuildsTable} from '../builds/BuildsTable';
import {ProjectOverviewCard} from './ProjectOverviewCard';
import {BuildAnalyticsCard} from './BuildAnalyticsCard';
import {ErrorInsightsCard} from './ErrorInsightsCard';
import {RecentActivityCard} from './RecentActivityCard';
import {UserStatusCard} from './UserStatusCard';
import {RepositoryHealthCard} from './RepositoryHealthCard';

export function DashboardPage() {
  return (
    <Stack gap="lg">
      <Grid gutter="md" align="stretch">
        <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
          <ProjectOverviewCard />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
          <BuildAnalyticsCard />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
          <ErrorInsightsCard />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
          <UserStatusCard />
        </Grid.Col>
      </Grid>

      <Grid gutter="md" align="stretch">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <RecentActivityCard />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            <HealthCard />
            <RepositoryHealthCard />
          </Stack>
        </Grid.Col>
      </Grid>

      <BuildsTable />
    </Stack>
  );
}