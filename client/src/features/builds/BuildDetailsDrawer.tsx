import {Alert, Anchor, Box, Divider, Drawer, Group, Loader, Stack, Text, Title} from '@mantine/core';
import {useBuildDetails} from './useBuilds';
import {useMe} from '../auth/useAuth';
import {format} from 'date-fns';
import {StatusBadge} from '../../components/common/StatusBadge';
import {IconAlertCircle, IconExternalLink, IconInfoCircle} from '@tabler/icons-react';
import {useVirtualizer} from '@tanstack/react-virtual';
import {useMemo, useRef} from 'react';
import classes from './BuildDetailsDrawer.module.css';

interface BuildDetailsDrawerProps {
  buildId?: number;
  opened: boolean;
  onClose: () => void;
}

const isErrorLine = (line: string): boolean => {
  const lowerCaseLine = line.toLowerCase();
  const errorKeywords = ['error', 'failed', 'failure', 'exception', 'npm err!', 'fatal:'];
  return errorKeywords.some(keyword => lowerCaseLine.includes(keyword));
};

/**
 * Drawer that shows full build details and virtualized logs.
 *
 * Logs are virtualized for performance on large outputs. Viewing raw logs
 * requires the user to have provided a GitHub PAT; otherwise an informational
 * prompt is shown.
 */
export function BuildDetailsDrawer({ buildId, opened, onClose }: BuildDetailsDrawerProps) {
  const { data: build, isLoading, isError } = useBuildDetails(buildId);
  const { data: me } = useMe();
  const parentRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(
    () => (build?.logs ? build.logs.split('\n') : me?.user?.hasPat ? ['No logs available for this build.'] : []),
    [build?.logs, me?.user?.hasPat]
  );

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 18,
    overscan: 10,
  });

  const githubRunUrl = build ? `https://github.com/${build.githubRepoUrl}/actions/runs/${build.githubRunId}` : '#';
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <Drawer opened={opened} onClose={onClose} title="Build Details" padding="md" size="xl" position="right">
      {isLoading && <Loader />}
      {isError && <Alert color="red" title="Error">Could not load build details.</Alert>}
      {!isLoading && build && (
        <Stack>
          <Group justify="space-between">
            <Stack gap={0}>
              <Title order={4}>{build.projectName}</Title>
              <Text size="xs" c="dimmed">Build #{build.id}</Text>
            </Stack>
            <StatusBadge status={build.status} />
          </Group>

          {build.status === 'FAILURE' && build.failureReason && (
            <Alert color="red" title={build.errorCategory || 'Failure Reason'} icon={<IconAlertCircle />}>
              {build.failureReason}
            </Alert>
          )}

          <Divider />
          <Text size="sm"><strong>Started:</strong> {format(new Date(build.startedAt), 'PPpp')}</Text>
          <Text size="sm"><strong>Completed:</strong> {build.completedAt ? format(new Date(build.completedAt), 'PPpp') : 'N/A'}</Text>
          <Anchor href={githubRunUrl} target="_blank" size="sm">
            <Group gap="xs">
              View on GitHub <IconExternalLink size={14} />
            </Group>
          </Anchor>
          <Divider />

          <Title order={5}>Logs</Title>
          
          {!build?.logs && !me?.user?.hasPat && (
            <Alert color="blue" title="GitHub Token Required" icon={<IconInfoCircle />}>
              To view build logs, you need to add a GitHub Personal Access Token with 'repo' scope. 
              Click on your avatar in the top-right corner and select "Set GitHub Token".
            </Alert>
          )}
          
          <Box ref={parentRef} className={classes.logViewport}>
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
                }}
              >
                {virtualItems.map((virtualItem) => (
                  <div
                    key={virtualItem.key}
                    data-error={isErrorLine(lines[virtualItem.index])}
                    className={classes.logLine}
                  >
                    <span className={classes.lineNumber}>{virtualItem.index + 1}</span>
                    <span className={classes.logContent}>
                      {lines[virtualItem.index] || '\u00A0'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Box>
        </Stack>
      )}
    </Drawer>
  );
}