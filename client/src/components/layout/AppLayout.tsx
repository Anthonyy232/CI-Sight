import {ActionIcon, AppShell, Avatar, Burger, Group, Menu, NavLink, Text, Title, UnstyledButton} from '@mantine/core';
import {NavLink as RouterNavLink, useLocation, useNavigate} from 'react-router-dom';
import {useDisclosure} from '@mantine/hooks';
import {useLogout, useMe} from '../../features/auth/useAuth';
import {Logo} from './Logo';
import {IconKey, IconLogout, IconPlus, IconTrash} from '@tabler/icons-react';
import {useDeleteProject, useProjects} from '../../features/projects/useProjects';
import {useState} from 'react';
import {CreateProjectModal} from '../../features/projects/CreateProjectModal';
import {PatModal} from '../../features/auth/PatModal';
import {DeleteProjectModal} from '../../features/projects/DeleteProjectModal';
import {Project} from '../../api/types';

/**
 * Application shell containing header, navbar, and modals.
 *
 * Responsible for global UI elements (project list, user menu) used across pages.
 */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpened, { toggle: toggleMobileNav }] = useDisclosure();
  const { data: me } = useMe();
  const logoutMutation = useLogout();
  const { data: projects = [] } = useProjects();
  const location = useLocation();
  const navigate = useNavigate();

  // State for modals
  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [patModalOpened, { open: openPatModal, close: closePatModal }] = useDisclosure(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const deleteProjectMutation = useDeleteProject({
    onSuccess: (deletedProject) => {
      // If we are on the page of the project that was just deleted, navigate home.
      if (location.pathname === `/projects/${deletedProject.id}`) {
        navigate('/');
      }
      setProjectToDelete(null);
    },
  });

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !mobileNavOpened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={mobileNavOpened} onClick={toggleMobileNav} hiddenFrom="sm" size="sm" />
            <RouterNavLink to="/" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
              <Group gap="xs">
                <Logo />
                <Title order={4} c="dark.9">CI-Sight</Title>
              </Group>
            </RouterNavLink>
          </Group>
          {me?.user && (
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <UnstyledButton>
                  <Group gap="xs">
                    <Avatar src={me.user.avatarUrl} size="sm" radius="xl" />
                    <Text size="sm" fw={500} visibleFrom="xs">
                      {me.user.name || me.user.login}
                    </Text>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Settings</Menu.Label>
                <Menu.Item leftSection={<IconKey size={14} />} onClick={openPatModal}>
                  Set GitHub Token
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconLogout size={14} />} onClick={() => logoutMutation.mutate()}>
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Group justify="space-between" mb="xs">
          <Text size="sm" fw={500}>Projects</Text>
          <ActionIcon variant="subtle" size="sm" onClick={openCreateModal} aria-label="Create new project">
            <IconPlus size={16} />
          </ActionIcon>
        </Group>
        {projects.map((project) => (
          <NavLink
            key={project.id}
            label={project.name}
            component={RouterNavLink}
            to={`/projects/${project.id}`}
            active={location.pathname.startsWith(`/projects/${project.id}`)}
            rightSection={
              <ActionIcon
                size="sm"
                variant="subtle"
                color="red"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setProjectToDelete(project);
                }}
                aria-label={`Delete project ${project.name}`}
              >
                <IconTrash size={14} />
              </ActionIcon>
            }
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>

      <CreateProjectModal opened={createModalOpened} onClose={closeCreateModal} />
      <PatModal opened={patModalOpened} onClose={closePatModal} />
      <DeleteProjectModal
        project={projectToDelete}
        opened={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={() => projectToDelete && deleteProjectMutation.mutate(projectToDelete.id)}
        isPending={deleteProjectMutation.isPending}
      />
    </AppShell>
  );
}