import {Button, Center, Paper, Stack, Text, Title} from '@mantine/core';
import {IconBrandGithub} from '@tabler/icons-react';
import {Logo} from '../../components/layout/Logo';

export function LoginPage() {
  const handleLogin = () => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const loginPath = '/api/auth/github';

    window.location.href = `${apiUrl}${loginPath}`;
  };

  return (
    <Center h="100vh" bg="var(--mantine-color-gray-0)">
      <Paper shadow="md" p="xl" withBorder radius="md" w={600}>
        <Stack align="center" gap="xl">
          <Stack align="center" gap="xs">
            <Logo size={84} />
            <Title order={2}>CI-Sight</Title>
          </Stack>
          <Text c="dimmed">Please log in to view your dashboard</Text>
          <Button
            onClick={handleLogin}
            leftSection={<IconBrandGithub size={18} />}
            size="md"
            fullWidth
          >
            Login with GitHub
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}