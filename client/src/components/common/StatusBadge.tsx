import {Badge} from '@mantine/core';
import {BuildStatus} from '../../api/types';

const statusMap: Record<BuildStatus, { label: string; color: string }> = {
  SUCCESS: { label: 'Success', color: 'green' },
  FAILURE: { label: 'Failure', color: 'red' },
  RUNNING: { label: 'Running', color: 'blue' },
  CANCELLED: { label: 'Cancelled', color: 'gray' },
};

export function StatusBadge({ status }: { status: BuildStatus }) {
  const { label, color } = statusMap[status] || { label: 'Unknown', color: 'dark' };
  return (
    <Badge color={color} variant="light">
      {label}
    </Badge>
  );
}