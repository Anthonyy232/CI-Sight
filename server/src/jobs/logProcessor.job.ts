import {Job} from 'bullmq';
import {prisma} from '../db';
import {classifyError, findSimilarity} from '../services/ml.service';
import {generateSolution} from '../services/llm.service';
import {extractErrorContext, sanitizeForLlm} from '../utils/log-parser';
import {logger} from '../utils/logger';
import axios from 'axios';
import {Build, BuildStatus, Project} from '@prisma/client';
import {CryptoService} from '../services/crypto.service';
import AdmZip from 'adm-zip';

/**
 * Background job processor for handling GitHub webhook payloads.
 *
 * Responsibilities:
 * - Map GitHub workflow status to internal BuildStatus
 * - Download and persist logs
 * - Run ML classification + similarity lookup
 * - Fallback to LLM for novel errors
 */
const cryptoService = new CryptoService();
const SIMILARITY_THRESHOLD = 0.7;

/**
 * Maps GitHub's workflow conclusion/status to the internal BuildStatus enum.
 */
export function mapGithubStatus(status: string | null | undefined): BuildStatus {
  switch (status) {
    case 'success':
      return BuildStatus.SUCCESS;
    case 'failure':
    case 'timed_out':
    case 'action_required':
      return BuildStatus.FAILURE;
    case 'cancelled':
      return BuildStatus.CANCELLED;
    default:
      return BuildStatus.RUNNING;
  }
}

/**
 * Fetches zipped logs from GitHub, extracts them, and persists them to the database.
 */
async function fetchAndProcessLogs(build: Build, project: Project, payload: any): Promise<string> {
  const logsUrl = payload.workflow_run.logs_url;
  if (!logsUrl) {
    logger.warn(`No logs_url present for build ${build.id}.`);
    return '';
  }

  const repoLink = await prisma.repoLink.findFirst({
    where: { projectId: project.id, deletedAt: null },
    include: { user: true },
  });

  if (!repoLink) {
    logger.warn(`No active user link found for project ${project.id} to download logs.`);
    return '';
  }

  // Prioritize user's Personal Access Token if available, otherwise use OAuth token.
  const tokenToUse = repoLink.user.githubPat ?? repoLink.user.accessToken;
  const token = cryptoService.decrypt(tokenToUse);

  if (!token) {
    logger.error(`Failed to decrypt token for user ${repoLink.userId} on project ${project.id}.`);
    return '';
  }

  let logText = '';
  try {
    logger.info(`Downloading logs from ${logsUrl} for build ${build.id}`);
    const response = await axios.get(logsUrl, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const zip = new AdmZip(Buffer.from(response.data));
    for (const entry of zip.getEntries()) {
      if (!entry.isDirectory && entry.entryName.endsWith('.txt')) {
        logText += entry.getData().toString('utf8') + '\n';
      }
    }
    logText = logText.trim();
    logger.info(`Extracted ${logText.split('\n').length} log lines for build ${build.id}`);
  } catch (err) {
    const error = err as Error;
    logger.error(`Failed to download or extract logs for build ${build.id}`, { error: error.message });
    return '';
  }

  if (logText) {
    const lines = logText.split(/\r?\n/);
    const entries = lines
      .map((line, idx) => ({ buildId: build.id, lineNumber: idx + 1, content: line }))
      .filter(entry => entry.content.trim().length > 0);

    if (entries.length > 0) {
      await prisma.logEntry.createMany({ data: entries, skipDuplicates: true });
    }
  }

  return logText;
}

/**
 * Extracts a high-quality error signature from log text using common patterns.
 * Searches from the bottom of the log up, as errors typically appear near the end.
 */
function extractErrorSignature(logText: string): string | null {
  const patterns = [
    /error: (.*)/i,
    /fatal: (.*)/i,
    /npm err! (.*)/i,
    /FAIL (.*)/i,
    /(\w*Error: .*)/,
  ];

  const lines = logText.split('\n').reverse();
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }
  return null;
}

/**
 * Orchestrates the analysis of a build failure using a layered strategy.
 */
async function analyzeBuildFailure(build: Build, logText: string) {
  if (build.status !== BuildStatus.FAILURE || !logText) {
    return;
  }

  logger.info(`Analyzing failure for build ${build.id}`);
  const errorSignature = extractErrorSignature(logText) || logText.slice(-512);

  // Fast classification and similarity search.
  const classification = await classifyError(errorSignature);
  const similarityResult = await findSimilarity(errorSignature);

  let solution = 'No specific solution found.';

  // Knowledge Base Check - Use known solution if confidence is high.
  if (similarityResult && similarityResult.similarity > SIMILARITY_THRESHOLD) {
    logger.info(`Found high-confidence match (${similarityResult.similarity.toFixed(2)}) in knowledge base for build ${build.id}.`);
    solution = similarityResult.solution;
  } else {
    // LLM Fallback - Trigger for novel or low-confidence errors.
    logger.info(`No high-confidence match found. Falling back to LLM for build ${build.id}.`);

    // Context Extraction and Sanitization.
    const errorContext = extractErrorContext(logText, errorSignature);
    const sanitizedContext = sanitizeForLlm(errorContext);

    // LLM Query to response
    const llmSolution = await generateSolution(sanitizedContext);
    if (llmSolution) {
      solution = llmSolution;
    } else {
      logger.warn(`LLM failed to generate a solution for build ${build.id}.`);
      if (similarityResult?.solution) {
        solution = `Could not generate a new solution. The most similar known issue suggests: ${similarityResult.solution}`;
      }
    }
  }

  await prisma.build.update({
    where: { id: build.id },
    data: {
      errorCategory: classification.category,
      failureReason: solution,
    },
  });
  logger.info(`Updated build ${build.id} with analysis results.`);
}

/**
 * Main job processor for handling webhook payloads from the queue.
 */
export async function processLogJob(job: Job) {
  const { payload } = job.data;
  const repoFullName = payload?.repository?.full_name;
  const runId = String(payload?.workflow_run?.id);

  logger.info(`Processing job ${job.id} for repo ${repoFullName}, run ${runId}`);

  if (!runId || !repoFullName) {
    throw new Error(`Job ${job.id} missing critical data: runId or repoFullName`);
  }

  const existingBuild = await prisma.build.findUnique({ where: { githubRunId: runId } });
  const newStatus = mapGithubStatus(payload.workflow_run.conclusion || payload.workflow_run.status);

  // Handle build reruns by resetting the build state.
  if (existingBuild && newStatus === BuildStatus.RUNNING && existingBuild.status !== BuildStatus.RUNNING) {
    logger.info(`Rerun detected for build ${existingBuild.id}. Resetting state.`);
    await prisma.logEntry.deleteMany({ where: { buildId: existingBuild.id } });
    await prisma.build.update({
      where: { id: existingBuild.id },
      data: {
        status: BuildStatus.RUNNING,
        completedAt: null,
        failureReason: null,
        errorCategory: null,
        startedAt: new Date(payload.workflow_run.run_started_at),
      },
    });
  }

  const project = await prisma.project.upsert({
    where: { githubRepoUrl: repoFullName },
    update: {},
    create: { name: repoFullName.split('/')[1] || repoFullName, githubRepoUrl: repoFullName },
  });

  const isCompleted = newStatus !== BuildStatus.RUNNING;
  const completedAt = isCompleted ? new Date(payload.workflow_run.updated_at) : undefined;

  const build = await prisma.build.upsert({
    where: { githubRunId: runId },
    update: {
      status: newStatus,
      completedAt,
      triggeringCommit: payload.workflow_run.head_sha?.slice(0, 7),
    },
    create: {
      projectId: project.id,
      githubRunId: runId,
      status: newStatus,
      startedAt: new Date(payload.workflow_run.run_started_at),
      completedAt,
      triggeringCommit: payload.workflow_run.head_sha?.slice(0, 7),
    },
  });

  const existingLogCount = await prisma.logEntry.count({ where: { buildId: build.id } });
  let logText = '';

  // Only fetch logs for completed builds that don't already have logs.
  if (existingLogCount === 0 && build.status !== BuildStatus.RUNNING) {
    logger.info(`Build ${build.id} has no logs. Attempting to fetch.`);
    logText = await fetchAndProcessLogs(build, project, payload);
  }

  // If logs were just fetched, trigger the failure analysis.
  if (logText) {
    await analyzeBuildFailure(build, logText);
  }

  logger.info(`Successfully processed job ${job.id}, build ID: ${build.id}`);
  return { ok: true, buildId: build.id };
}