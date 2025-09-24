/**
 * Build lifecycle status values returned by the API.
 */
export type BuildStatus = 'RUNNING' | 'SUCCESS' | 'FAILURE' | 'CANCELLED';

/**
 * Compact build information shown in lists and summaries.
 */
export interface BuildSummary {
  id: number;
  projectName: string;
  status: BuildStatus;
  commit: string;
  startedAt: string; // ISO Date String
  completedAt: string | null; // ISO Date String
}

/**
 * Detailed build information including logs and failure metadata.
 */
export interface BuildDetails {
  id: number;
  projectName: string;
  githubRepoUrl: string;
  githubRunId: string;
  status: BuildStatus;
  startedAt: string;
  completedAt: string | null;
  failureReason: string | null;
  errorCategory: string | null;
  logs: string;
}

/**
 * Represents a project entity linked to a GitHub repo.
 */
export interface Project {
  id: number;
  name: string;
  githubRepoUrl: string;
  createdAt: string;
}

/**
 * Shape returned by GitHub's repo list endpoint (trimmed to fields we use).
 */
export interface GithubRepo {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
}

/**
 * A repo linked in the app with optional remote webhook id.
 */
export interface LinkedRepo {
  id: number;
  repoFullName: string;
  webhookId: number | null;
  project: {
    id: number;
    name: string;
  };
}

/**
 * Minimal user profile returned from /api/me.
 */
export interface User {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  hasPat: boolean;
}

export interface MeResponse {
  user: User | null;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  time: string; // ISO Date String
}