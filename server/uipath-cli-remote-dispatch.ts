import { createHash, randomUUID } from "crypto";
import type {
  CliAnalyzeResult,
  CliPackResult,
  CliPackageFlavor,
  UiPathProjectType,
} from "./uipath-cli-validator";

export type RunnerHealthState =
  | "healthy"
  | "degraded"
  | "busy"
  | "unreachable"
  | "misconfigured";

export type CliRunnerType = "local_linux" | "remote_windows" | "none";

export type CliPackArtifactSource = "uipcli" | "fallback_adm_zip" | "none";

export type RemoteDispatchFallbackReason =
  | "remote_runner_not_configured"
  | "cli_remote_unreachable"
  | "cli_remote_misconfigured"
  | "cli_remote_busy_fallback"
  | "cli_remote_degraded_fallback"
  | "cli_remote_dispatch_timeout"
  | "cli_remote_retry_exhausted"
  | "cli_remote_byte_fidelity_failure"
  | "cli_remote_invocation_error";

export interface RemoteRunnerConfig {
  url: string;
  authToken?: string;
  cliVersion: string;
  cliWindowsLegacyVersion: string;
  dotnetVersion: string;
  policy: DispatchPolicy;
  healthTtlMs: number;
  healthProbeTimeoutMs: number;
}

export interface DispatchPolicy {
  maxDispatchWaitMs: number;
  maxExecutionTimeMs: number;
  retryCount: number;
  busyBehavior: "queue" | "fallback";
  dispatchOnDegraded: boolean;
}

export const DEFAULT_DISPATCH_POLICY: DispatchPolicy = {
  maxDispatchWaitMs: 60_000,
  maxExecutionTimeMs: 180_000,
  retryCount: 1,
  busyBehavior: "queue",
  dispatchOnDegraded: true,
};

export const DEFAULT_HEALTH_TTL_MS = 30_000;
export const DEFAULT_HEALTH_PROBE_TIMEOUT_MS = 5_000;

export interface RemoteDispatchRequest {
  dispatchId: string;
  command: "package_analyze_pack";
  projectType: UiPathProjectType;
  cliFlavor: CliPackageFlavor;
  cliVersion: string;
  dotnetVersion: string;
  bundle: {
    hash: string;
    projectJson: string;
    xamlEntries: { name: string; content: string }[];
  };
}

export interface RunnerMetadata {
  runnerId: string;
  runnerVersion: string;
  cliVersionUsed: string;
  dotnetVersionUsed: string;
  hostOsBuild: string;
  wallClockMs: number;
  exitCode: number;
}

export interface RemoteDispatchResponse {
  analyzeResult: CliAnalyzeResult;
  packResult: CliPackResult;
  /** base64-encoded .nupkg bytes when pack succeeded. */
  nupkgBase64?: string;
  stdout: string;
  stderr: string;
  runner: RunnerMetadata;
}

export interface HashChain {
  bundleHash: string;
  returnedArtifactHash?: string;
  persistedArtifactHash?: string;
}

export interface ByteFidelityFailure {
  bundleHash: string;
  returnedArtifactHash: string;
  persistedArtifactHash: string;
  runner: RunnerMetadata;
  detectedAt: string;
}

export interface DispatchOutcome {
  ok: boolean;
  runnerHealthState: RunnerHealthState;
  dispatchPolicy: DispatchPolicy;
  retryAttempts: number;
  fallbackReason?: RemoteDispatchFallbackReason;
  response?: RemoteDispatchResponse;
  hashChain?: HashChain;
  byteFidelityFailure?: ByteFidelityFailure;
  errorMessage?: string;
}

const HEALTHY_STATES: ReadonlySet<RunnerHealthState> = new Set<RunnerHealthState>([
  "healthy",
  "degraded",
  "busy",
]);

export function isRemoteRunnerConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.UIPATH_REMOTE_RUNNER_URL);
}

export function loadRemoteRunnerConfig(env: NodeJS.ProcessEnv = process.env): RemoteRunnerConfig | null {
  const url = env.UIPATH_REMOTE_RUNNER_URL;
  if (!url) return null;

  const policy: DispatchPolicy = {
    maxDispatchWaitMs: parsePositiveInt(env.UIPATH_REMOTE_MAX_DISPATCH_WAIT_MS, DEFAULT_DISPATCH_POLICY.maxDispatchWaitMs),
    maxExecutionTimeMs: parsePositiveInt(env.UIPATH_REMOTE_MAX_EXECUTION_MS, DEFAULT_DISPATCH_POLICY.maxExecutionTimeMs),
    retryCount: parseNonNegativeInt(env.UIPATH_REMOTE_RETRY_COUNT, DEFAULT_DISPATCH_POLICY.retryCount),
    busyBehavior: env.UIPATH_REMOTE_BUSY_BEHAVIOR === "fallback" ? "fallback" : DEFAULT_DISPATCH_POLICY.busyBehavior,
    dispatchOnDegraded: env.UIPATH_REMOTE_DISPATCH_ON_DEGRADED === "false" ? false : DEFAULT_DISPATCH_POLICY.dispatchOnDegraded,
  };

  return {
    url,
    authToken: env.UIPATH_REMOTE_RUNNER_TOKEN,
    cliVersion: env.UIPATH_REMOTE_CLI_VERSION || "25.10.0",
    cliWindowsLegacyVersion: env.UIPATH_REMOTE_CLI_LEGACY_VERSION || "22.10.0",
    dotnetVersion: env.UIPATH_REMOTE_DOTNET_VERSION || "8.0",
    policy,
    healthTtlMs: parsePositiveInt(env.UIPATH_REMOTE_HEALTH_TTL_MS, DEFAULT_HEALTH_TTL_MS),
    healthProbeTimeoutMs: parsePositiveInt(env.UIPATH_REMOTE_HEALTH_PROBE_TIMEOUT_MS, DEFAULT_HEALTH_PROBE_TIMEOUT_MS),
  };
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseNonNegativeInt(raw: string | undefined, fallback: number): number {
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function computeBundleHash(
  projectJson: string,
  xamlEntries: { name: string; content: string }[],
): string {
  const h = createHash("sha256");
  h.update("project.json\0");
  h.update(projectJson);
  const sorted = [...xamlEntries].sort((a, b) => a.name.localeCompare(b.name));
  for (const e of sorted) {
    h.update("\0");
    h.update(e.name);
    h.update("\0");
    h.update(e.content);
  }
  return `sha256:${h.digest("hex")}`;
}

export function hashBytes(buf: Buffer): string {
  return `sha256:${createHash("sha256").update(buf).digest("hex")}`;
}

export interface ByteFidelityCheckInput {
  bundleHash: string;
  returnedBytes: Buffer;
  persistedBytes: Buffer;
  runner: RunnerMetadata;
}

export function verifyByteFidelity(input: ByteFidelityCheckInput):
  | { ok: true; hashChain: HashChain }
  | { ok: false; failure: ByteFidelityFailure } {
  const returnedHash = hashBytes(input.returnedBytes);
  const persistedHash = hashBytes(input.persistedBytes);
  if (returnedHash === persistedHash) {
    return {
      ok: true,
      hashChain: {
        bundleHash: input.bundleHash,
        returnedArtifactHash: returnedHash,
        persistedArtifactHash: persistedHash,
      },
    };
  }
  return {
    ok: false,
    failure: {
      bundleHash: input.bundleHash,
      returnedArtifactHash: returnedHash,
      persistedArtifactHash: persistedHash,
      runner: input.runner,
      detectedAt: new Date().toISOString(),
    },
  };
}

interface CachedHealth {
  state: RunnerHealthState;
  fetchedAt: number;
  detail?: string;
}

export interface HealthProbeFn {
  (config: RemoteRunnerConfig): Promise<{ state: RunnerHealthState; detail?: string }>;
}

export class RunnerHealthChecker {
  private cache: CachedHealth | null = null;
  private inflight: Promise<CachedHealth> | null = null;

  constructor(
    private readonly config: RemoteRunnerConfig,
    private readonly probe: HealthProbeFn,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async getState(): Promise<{ state: RunnerHealthState; detail?: string; cached: boolean }> {
    if (this.cache && this.now() - this.cache.fetchedAt < this.config.healthTtlMs) {
      return { state: this.cache.state, detail: this.cache.detail, cached: true };
    }
    if (!this.inflight) {
      this.inflight = (async () => {
        try {
          const probed = await this.probe(this.config);
          const entry: CachedHealth = { state: probed.state, fetchedAt: this.now(), detail: probed.detail };
          this.cache = entry;
          return entry;
        } catch (err: unknown) {
          const detail = err instanceof Error ? err.message : String(err);
          const entry: CachedHealth = { state: "unreachable", fetchedAt: this.now(), detail };
          this.cache = entry;
          return entry;
        } finally {
          this.inflight = null;
        }
      })();
    }
    const entry = await this.inflight;
    return { state: entry.state, detail: entry.detail, cached: false };
  }

  invalidate(): void {
    this.cache = null;
  }
}

export function shouldDispatch(state: RunnerHealthState, policy: DispatchPolicy): {
  dispatch: boolean;
  fallbackReason?: RemoteDispatchFallbackReason;
} {
  switch (state) {
    case "healthy":
      return { dispatch: true };
    case "degraded":
      return policy.dispatchOnDegraded
        ? { dispatch: true }
        : { dispatch: false, fallbackReason: "cli_remote_degraded_fallback" };
    case "busy":
      return policy.busyBehavior === "queue"
        ? { dispatch: true }
        : { dispatch: false, fallbackReason: "cli_remote_busy_fallback" };
    case "unreachable":
      return { dispatch: false, fallbackReason: "cli_remote_unreachable" };
    case "misconfigured":
      return { dispatch: false, fallbackReason: "cli_remote_misconfigured" };
  }
}

export function isRetryableTransport(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: string; message?: string };
  if (e.name === "AbortError") return true;
  if (e.code === "ECONNRESET" || e.code === "ECONNREFUSED" || e.code === "ETIMEDOUT") return true;
  if (typeof e.message === "string" && /timeout|reset|refused/i.test(e.message)) return true;
  return false;
}

export interface DispatchTransport {
  postDispatch(
    config: RemoteRunnerConfig,
    request: RemoteDispatchRequest,
    signal: AbortSignal,
  ): Promise<RemoteDispatchResponse>;
}

export const httpDispatchTransport: DispatchTransport = {
  async postDispatch(config, request, signal) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (config.authToken) headers["authorization"] = `Bearer ${config.authToken}`;
    const res = await fetch(`${config.url.replace(/\/$/, "")}/dispatch`, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
      signal,
    });
    if (!res.ok) {
      throw new Error(`Remote runner returned HTTP ${res.status}: ${await res.text().catch(() => "")}`);
    }
    return (await res.json()) as RemoteDispatchResponse;
  },
};

export const defaultHealthProbe: HealthProbeFn = async (config) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.healthProbeTimeoutMs);
  try {
    const headers: Record<string, string> = {};
    if (config.authToken) headers["authorization"] = `Bearer ${config.authToken}`;
    const res = await fetch(`${config.url.replace(/\/$/, "")}/health`, { headers, signal: controller.signal });
    if (!res.ok) {
      return { state: "misconfigured", detail: `health endpoint returned HTTP ${res.status}` };
    }
    const body = (await res.json().catch(() => ({}))) as { state?: RunnerHealthState; detail?: string };
    if (body && body.state && HEALTHY_STATES.has(body.state)) {
      return { state: body.state, detail: body.detail };
    }
    if (body && body.state === "misconfigured") {
      return { state: "misconfigured", detail: body.detail };
    }
    return { state: "healthy" };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return { state: "unreachable", detail: "health probe timeout" };
    }
    return { state: "unreachable", detail: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Persists the runner-returned `.nupkg` bytes at the real artifact storage
 * boundary and returns the bytes that were actually written/read back, so the
 * dispatcher can hash both ends of the persistence step. The caller controls
 * the filesystem/object-storage write — the dispatcher never trusts an
 * in-memory copy as the persisted artifact.
 */
export interface PersistArtifactFn {
  (returnedBytes: Buffer, request: RemoteDispatchRequest): Promise<Buffer>;
}

export interface DispatchToWindowsRunnerInput {
  config: RemoteRunnerConfig;
  projectJson: string;
  xamlEntries: { name: string; content: string }[];
  projectType: UiPathProjectType;
  cliFlavor: CliPackageFlavor;
  /** Optional override; when omitted the module-shared singleton is used (keyed by URL). */
  health?: RunnerHealthChecker;
  transport?: DispatchTransport;
  /** Required when the runner is expected to return artifact bytes — enables true byte-fidelity verification. */
  persistArtifact?: PersistArtifactFn;
  onProgress?: (msg: string) => void;
  /** Sleep used for busy-queue polling; injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const BUSY_QUEUE_POLL_MS = 2_000;

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function dispatchToWindowsRunner(
  input: DispatchToWindowsRunnerInput,
): Promise<DispatchOutcome> {
  const { config, projectJson, xamlEntries, projectType, cliFlavor } = input;
  const transport = input.transport ?? httpDispatchTransport;
  const sleep = input.sleep ?? defaultSleep;
  const now = input.now ?? (() => Date.now());
  const health = input.health ?? getSharedHealthChecker(config);

  // 1) Resolve health, with a real busy-queue wait honoring maxDispatchWaitMs.
  const queueOutcome = await waitForDispatchSlot(health, config.policy, sleep, now, input.onProgress);
  if (!queueOutcome.dispatch) {
    return {
      ok: false,
      runnerHealthState: queueOutcome.lastState,
      dispatchPolicy: config.policy,
      retryAttempts: 0,
      fallbackReason: queueOutcome.fallbackReason,
      errorMessage: queueOutcome.detail,
    };
  }
  const healthStateForDispatch = queueOutcome.lastState;

  const cliVersion =
    cliFlavor === "UiPath.CLI.Windows.Legacy" ? config.cliWindowsLegacyVersion : config.cliVersion;

  const bundleHash = computeBundleHash(projectJson, xamlEntries);
  const request: RemoteDispatchRequest = {
    dispatchId: randomUUID(),
    command: "package_analyze_pack",
    projectType,
    cliFlavor,
    cliVersion,
    dotnetVersion: config.dotnetVersion,
    bundle: {
      hash: bundleHash,
      projectJson,
      xamlEntries,
    },
  };

  const totalAttempts = config.policy.retryCount + 1;
  let lastError: unknown;
  let attempts = 0;

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    attempts = attempt + 1;
    if (input.onProgress) {
      input.onProgress(
        `Dispatching CLI to remote Windows runner (attempt ${attempts}/${totalAttempts}, health=${healthStateForDispatch})`,
      );
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.policy.maxExecutionTimeMs);
    try {
      const response = await transport.postDispatch(config, request, controller.signal);
      clearTimeout(timer);

      const hashChain: HashChain = { bundleHash };

      // Artifact-presence invariant: a successful pack MUST carry artifact
      // bytes. A response that claims pack success without `nupkgBase64`
      // cannot be byte-fidelity-verified or shipped as the run artifact, so
      // we reject it as an invocation error and force fallback packaging.
      if (response.packResult.success && !response.nupkgBase64) {
        return {
          ok: false,
          runnerHealthState: healthStateForDispatch,
          dispatchPolicy: config.policy,
          retryAttempts: attempt + 1,
          response,
          hashChain,
          fallbackReason: "cli_remote_invocation_error",
          errorMessage:
            "Remote runner reported pack success but did not return nupkgBase64; cannot verify or ship artifact",
        };
      }

      // 2) Real byte-fidelity step at the persistence boundary.
      if (response.nupkgBase64) {
        const returnedBytes = Buffer.from(response.nupkgBase64, "base64");
        const returnedHash = hashBytes(returnedBytes);
        hashChain.returnedArtifactHash = returnedHash;

        if (input.persistArtifact) {
          let persistedBytes: Buffer;
          try {
            persistedBytes = await input.persistArtifact(returnedBytes, request);
          } catch (err: unknown) {
            health.invalidate();
            return {
              ok: false,
              runnerHealthState: healthStateForDispatch,
              dispatchPolicy: config.policy,
              retryAttempts: attempt + 1,
              response,
              hashChain,
              fallbackReason: "cli_remote_invocation_error",
              errorMessage: `Failed to persist remote artifact: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
          const verification = verifyByteFidelity({
            bundleHash,
            returnedBytes,
            persistedBytes,
            runner: response.runner,
          });
          if (!verification.ok) {
            // Hard failure: do NOT ship the runner artifact. Caller forces fallback packaging.
            return {
              ok: false,
              runnerHealthState: healthStateForDispatch,
              dispatchPolicy: config.policy,
              retryAttempts: attempt + 1,
              response,
              hashChain: {
                bundleHash,
                returnedArtifactHash: verification.failure.returnedArtifactHash,
                persistedArtifactHash: verification.failure.persistedArtifactHash,
              },
              byteFidelityFailure: verification.failure,
              fallbackReason: "cli_remote_byte_fidelity_failure",
              errorMessage: "Persisted artifact bytes did not match runner-returned bytes",
            };
          }
          hashChain.persistedArtifactHash = verification.hashChain.persistedArtifactHash;
        }
      }

      return {
        ok: true,
        runnerHealthState: healthStateForDispatch,
        dispatchPolicy: config.policy,
        retryAttempts: attempt,
        response,
        hashChain,
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      lastError = err;
      const aborted = err instanceof Error && err.name === "AbortError";
      if (aborted) {
        return {
          ok: false,
          runnerHealthState: healthStateForDispatch,
          dispatchPolicy: config.policy,
          retryAttempts: attempt,
          fallbackReason: "cli_remote_dispatch_timeout",
          errorMessage: "Remote CLI execution exceeded maxExecutionTimeMs",
        };
      }
      if (!isRetryableTransport(err) || attempt === totalAttempts - 1) {
        const reason: RemoteDispatchFallbackReason =
          attempt === totalAttempts - 1 && isRetryableTransport(err)
            ? "cli_remote_retry_exhausted"
            : "cli_remote_invocation_error";
        health.invalidate();
        return {
          ok: false,
          runnerHealthState: healthStateForDispatch,
          dispatchPolicy: config.policy,
          retryAttempts: attempt + 1,
          fallbackReason: reason,
          errorMessage: err instanceof Error ? err.message : String(err),
        };
      }
      // retryable: loop
    }
  }

  health.invalidate();
  return {
    ok: false,
    runnerHealthState: healthStateForDispatch,
    dispatchPolicy: config.policy,
    retryAttempts: attempts,
    fallbackReason: "cli_remote_retry_exhausted",
    errorMessage: lastError instanceof Error ? lastError.message : String(lastError),
  };
}

interface QueueDecision {
  dispatch: boolean;
  lastState: RunnerHealthState;
  fallbackReason?: RemoteDispatchFallbackReason;
  detail?: string;
}

/**
 * Implements the real busy-queue contract: when health is `busy` and the
 * policy is `queue`, poll health (with the configured TTL invalidation) until
 * the runner reports a non-busy dispatchable state, or until
 * `maxDispatchWaitMs` elapses (→ `cli_remote_dispatch_timeout`).
 */
export async function waitForDispatchSlot(
  health: RunnerHealthChecker,
  policy: DispatchPolicy,
  sleep: (ms: number) => Promise<void>,
  now: () => number,
  onProgress?: (msg: string) => void,
): Promise<QueueDecision> {
  const startedAt = now();
  let probe = await health.getState();

  // Non-busy states resolve immediately by the standard policy matrix.
  if (probe.state !== "busy") {
    const decision = shouldDispatch(probe.state, policy);
    return decision.dispatch
      ? { dispatch: true, lastState: probe.state }
      : { dispatch: false, lastState: probe.state, fallbackReason: decision.fallbackReason, detail: probe.detail };
  }

  // Busy + fallback policy: short-circuit immediately.
  if (policy.busyBehavior === "fallback") {
    return { dispatch: false, lastState: "busy", fallbackReason: "cli_remote_busy_fallback", detail: probe.detail };
  }

  // Busy + queue policy: wait for capacity, honoring maxDispatchWaitMs.
  while (probe.state === "busy" && now() - startedAt < policy.maxDispatchWaitMs) {
    if (onProgress) {
      onProgress(
        `Remote runner busy; queued (${Math.round((now() - startedAt) / 1000)}s of ${Math.round(policy.maxDispatchWaitMs / 1000)}s)`,
      );
    }
    const remaining = policy.maxDispatchWaitMs - (now() - startedAt);
    if (remaining <= 0) break;
    await sleep(Math.min(BUSY_QUEUE_POLL_MS, Math.max(50, remaining)));
    health.invalidate();
    probe = await health.getState();
  }
  if (probe.state === "busy") {
    return {
      dispatch: false,
      lastState: "busy",
      fallbackReason: "cli_remote_dispatch_timeout",
      detail: `Runner remained busy for ${policy.maxDispatchWaitMs}ms (maxDispatchWaitMs)`,
    };
  }
  // Slot freed up — apply the standard policy decision to the new state.
  const decision = shouldDispatch(probe.state, policy);
  return decision.dispatch
    ? { dispatch: true, lastState: probe.state }
    : { dispatch: false, lastState: probe.state, fallbackReason: decision.fallbackReason, detail: probe.detail };
}

/**
 * Module-shared health checker singleton, keyed by runner URL so the TTL cache
 * is effective across dispatched runs (operational requirement: avoid
 * per-job re-probing).
 */
const sharedHealthCheckers = new Map<string, RunnerHealthChecker>();

export function getSharedHealthChecker(
  config: RemoteRunnerConfig,
  probe: HealthProbeFn = defaultHealthProbe,
): RunnerHealthChecker {
  const key = `${config.url}|${config.healthTtlMs}`;
  let existing = sharedHealthCheckers.get(key);
  if (!existing) {
    existing = new RunnerHealthChecker(config, probe);
    sharedHealthCheckers.set(key, existing);
  }
  return existing;
}

/** Test/operational helper to drop the cached singletons (e.g. between tests, on config reload). */
export function resetSharedHealthCheckers(): void {
  sharedHealthCheckers.clear();
}
