import {Navigate, Route, Routes} from 'react-router-dom';
import {useMe} from './features/auth/useAuth';
import {Center, Loader} from '@mantine/core';
import {AppLayout} from './components/layout/AppLayout';
import {DashboardPage} from './features/dashboard/DashboardPage';
import {ProjectPage} from './features/projects/ProjectPage';
import {ProjectsListPage} from './features/projects/ProjectsListPage';
import {LoginPage} from './features/auth/LoginPage';

/**
 * A component that wraps all routes that require authentication.
 * It renders them within the main AppLayout.
 */
function ProtectedRoutes() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsListPage />} />
        <Route path="/projects/:id" element={<ProjectPage />} />
        {/* Fallback route for any other authenticated paths */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

function App() {
  const { data, isLoading } = useMe();
  const isAuthenticated = !!data?.user;

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />} />
      <Route path="/*" element={isAuthenticated ? <ProtectedRoutes /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;