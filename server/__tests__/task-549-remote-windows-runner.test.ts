import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_DISPATCH_POLICY,
  RunnerHealthChecker,
  computeBundleHash,
  dispatchToWindowsRunner,
  getSharedHealthChecker,
  hashBytes,
  isRetryableTransport,
  loadRemoteRunnerConfig,
  resetSharedHealthCheckers,
  shouldDispatch,
  verifyByteFidelity,
  waitForDispatchSlot,
  type DispatchTransport,
  type DispatchToWindowsRunnerInput,
  type DispatchOutcome,
  type PersistArtifactFn,
  type RemoteDispatchRequest,
  type RemoteDispatchResponse,
  type RunnerHealthState,
  type RemoteRunnerConfig,
} from "../uipath-cli-remote-dispatch";
import {
  runCliValidation,
  type CliValidationResult,
} from "../uipath-cli-validator";

type RemoteDispatchModule = typeof import("../uipath-cli-remote-dispatch");

const SAMPLE_PROJECT_WINDOWS = JSON.stringify({
  name: "Test",
  targetFramework: "Windows",
});

const SAMPLE_PROJECT_PORTABLE = JSON.stringify({
  name: "Test",
  targetFramework: "Portable",
});

const SAMPLE_XAML = [{ name: "Main.xaml", content: "<Activity/>" }];

function makeConfig(overrides: Partial<RemoteRunnerConfig> = {}): RemoteRunnerConfig {
  return {
    url: "https://runner.example.com",
    cliVersion: "25.10.0",
    cliWindowsLegacyVersion: "22.10.0",
    dotnetVersion: "8.0",
    policy: { ...DEFAULT_DISPATCH_POLICY },
    healthTtlMs: 30_000,
    healthProbeTimeoutMs: 5_000,
    ...overrides,
  };
}

function makeRunnerMetadata() {
  return {
    runnerId: "win-runner-1",
    runnerVersion: "1.0.0",
    cliVersionUsed: "25.10.0",
    dotnetVersionUsed: "8.0",
    hostOsBuild: "Windows Server 2022",
    wallClockMs: 1234,
    exitCode: 0,
  };
}

function makeResponse(nupkg?: Buffer): RemoteDispatchResponse {
  return {
    analyzeResult: {
      success: true,
      defects: [],
      exitCode: 0,
      stdout: "",
      stderr: "",
      durationMs: 100,
    },
    packResult: {
      success: !!nupkg,
      outputPath: nupkg ? "Test.1.0.0.nupkg" : undefined,
      exitCode: nupkg ? 0 : 1,
      stdout: "",
      stderr: "",
      durationMs: 100,
      errors: [],
    },
    nupkgBase64: nupkg?.toString("base64"),
    stdout: "",
    stderr: "",
    runner: makeRunnerMetadata(),
  };
}

describe("Task #549 — uipath-cli-remote-dispatch", () => {
  describe("loadRemoteRunnerConfig", () => {
    it("returns null when not configured", () => {
      expect(loadRemoteRunnerConfig({})).toBeNull();
    });

    it("loads defaults from URL only", () => {
      const cfg = loadRemoteRunnerConfig({ UIPATH_REMOTE_RUNNER_URL: "https://runner.example.com" });
      expect(cfg).not.toBeNull();
      expect(cfg!.policy.busyBehavior).toBe("queue");
      expect(cfg!.policy.dispatchOnDegraded).toBe(true);
      expect(cfg!.policy.retryCount).toBe(DEFAULT_DISPATCH_POLICY.retryCount);
    });

    it("respects busyBehavior=fallback override", () => {
      const cfg = loadRemoteRunnerConfig({
        UIPATH_REMOTE_RUNNER_URL: "https://r/",
        UIPATH_REMOTE_BUSY_BEHAVIOR: "fallback",
        UIPATH_REMOTE_DISPATCH_ON_DEGRADED: "false",
        UIPATH_REMOTE_RETRY_COUNT: "3",
      });
      expect(cfg!.policy.busyBehavior).toBe("fallback");
      expect(cfg!.policy.dispatchOnDegraded).toBe(false);
      expect(cfg!.policy.retryCount).toBe(3);
    });
  });

  describe("computeBundleHash", () => {
    it("is deterministic and order-independent across xaml entries", () => {
      const a = computeBundleHash(SAMPLE_PROJECT_WINDOWS, [
        { name: "A.xaml", content: "<a/>" },
        { name: "B.xaml", content: "<b/>" },
      ]);
      const b = computeBundleHash(SAMPLE_PROJECT_WINDOWS, [
        { name: "B.xaml", content: "<b/>" },
        { name: "A.xaml", content: "<a/>" },
      ]);
      expect(a).toBe(b);
      expect(a).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it("changes when content changes", () => {
      const a = computeBundleHash(SAMPLE_PROJECT_WINDOWS, [{ name: "A.xaml", content: "<a/>" }]);
      const b = computeBundleHash(SAMPLE_PROJECT_WINDOWS, [{ name: "A.xaml", content: "<a></a>" }]);
      expect(a).not.toBe(b);
    });
  });

  describe("verifyByteFidelity", () => {
    it("returns ok when bytes match", () => {
      const buf = Buffer.from("hello");
      const r = verifyByteFidelity({
        bundleHash: "sha256:abc",
        returnedBytes: buf,
        persistedBytes: buf,
        runner: makeRunnerMetadata(),
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.hashChain.returnedArtifactHash).toBe(r.hashChain.persistedArtifactHash);
        expect(r.hashChain.bundleHash).toBe("sha256:abc");
      }
    });

    it("returns failure with full hash chain when bytes mismatch", () => {
      const r = verifyByteFidelity({
        bundleHash: "sha256:abc",
        returnedBytes: Buffer.from("aaaa"),
        persistedBytes: Buffer.from("bbbb"),
        runner: makeRunnerMetadata(),
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.failure.bundleHash).toBe("sha256:abc");
        expect(r.failure.returnedArtifactHash).not.toBe(r.failure.persistedArtifactHash);
        expect(r.failure.detectedAt).toBeTruthy();
      }
    });
  });

  describe("shouldDispatch", () => {
    const policy = { ...DEFAULT_DISPATCH_POLICY };
    it("dispatches on healthy", () => {
      expect(shouldDispatch("healthy", policy).dispatch).toBe(true);
    });
    it("dispatches on degraded by default", () => {
      expect(shouldDispatch("degraded", policy).dispatch).toBe(true);
    });
    it("queues (dispatches) on busy by default", () => {
      expect(shouldDispatch("busy", policy).dispatch).toBe(true);
    });
    it("fallbacks on busy when busyBehavior=fallback", () => {
      const r = shouldDispatch("busy", { ...policy, busyBehavior: "fallback" });
      expect(r.dispatch).toBe(false);
      expect(r.fallbackReason).toBe("cli_remote_busy_fallback");
    });
    it("fallbacks on degraded when dispatchOnDegraded=false", () => {
      const r = shouldDispatch("degraded", { ...policy, dispatchOnDegraded: false });
      expect(r.dispatch).toBe(false);
      expect(r.fallbackReason).toBe("cli_remote_degraded_fallback");
    });
    it("fallbacks on unreachable / misconfigured", () => {
      expect(shouldDispatch("unreachable", policy).fallbackReason).toBe("cli_remote_unreachable");
      expect(shouldDispatch("misconfigured", policy).fallbackReason).toBe("cli_remote_misconfigured");
    });
  });

  describe("RunnerHealthChecker", () => {
    let nowVal = 0;
    let probeCalls = 0;
    let nextState: RunnerHealthState = "healthy";

    beforeEach(() => {
      nowVal = 1000;
      probeCalls = 0;
      nextState = "healthy";
    });

    function build(ttl = 10_000) {
      return new RunnerHealthChecker(
        makeConfig({ healthTtlMs: ttl }),
        async () => {
          probeCalls++;
          return { state: nextState };
        },
        () => nowVal,
      );
    }

    it("caches health within TTL and refreshes when stale", async () => {
      const checker = build(5_000);
      const a = await checker.getState();
      expect(a.state).toBe("healthy");
      expect(a.cached).toBe(false);
      expect(probeCalls).toBe(1);

      nowVal += 1_000;
      const b = await checker.getState();
      expect(b.cached).toBe(true);
      expect(probeCalls).toBe(1);

      nowVal += 10_000;
      nextState = "degraded";
      const c = await checker.getState();
      expect(c.state).toBe("degraded");
      expect(c.cached).toBe(false);
      expect(probeCalls).toBe(2);
    });

    it("invalidate forces a fresh probe", async () => {
      const checker = build(60_000);
      await checker.getState();
      expect(probeCalls).toBe(1);
      checker.invalidate();
      await checker.getState();
      expect(probeCalls).toBe(2);
    });

    it("classifies probe throw as unreachable", async () => {
      const checker = new RunnerHealthChecker(
        makeConfig(),
        async () => { throw new Error("boom"); },
        () => nowVal,
      );
      const r = await checker.getState();
      expect(r.state).toBe("unreachable");
      expect(r.detail).toContain("boom");
    });
  });

  describe("isRetryableTransport", () => {
    it("identifies AbortError, ECONNRESET, timeout messages as retryable", () => {
      expect(isRetryableTransport({ name: "AbortError" })).toBe(true);
      expect(isRetryableTransport({ code: "ECONNRESET" })).toBe(true);
      expect(isRetryableTransport(new Error("connection refused"))).toBe(true);
      expect(isRetryableTransport(new Error("HTTP 500"))).toBe(false);
    });
  });

  describe("dispatchToWindowsRunner", () => {
    function buildHealth(state: RunnerHealthState = "healthy") {
      return new RunnerHealthChecker(
        makeConfig(),
        async () => ({ state }),
      );
    }

    it("returns ok with returned-artifact hash when no persistArtifact is provided", async () => {
      const config = makeConfig();
      const transport: DispatchTransport = {
        async postDispatch() {
          return makeResponse(Buffer.from("PK\x03\x04nupkgbytes"));
        },
      };
      const outcome = await dispatchToWindowsRunner({
        config,
        projectJson: SAMPLE_PROJECT_WINDOWS,
        xamlEntries: SAMPLE_XAML,
        projectType: "Windows",
        cliFlavor: "UiPath.CLI.Windows",
        health: buildHealth("healthy"),
        transport,
      });
      expect(outcome.ok).toBe(true);
      expect(outcome.runnerHealthState).toBe("healthy");
      expect(outcome.hashChain?.bundleHash).toMatch(/^sha256:/);
      expect(outcome.hashChain?.returnedArtifactHash).toMatch(/^sha256:/);
      // No persistArtifact callback -> no persisted hash recorded.
      expect(outcome.hashChain?.persistedArtifactHash).toBeUndefined();
      expect(outcome.response?.runner.runnerId).toBe("win-runner-1");
    });

    it("verifies byte-fidelity end-to-end via persistArtifact (matching bytes -> ok)", async () => {
      const bytes = Buffer.from("PK\x03\x04goodnupkg");
      const transport: DispatchTransport = { async postDispatch() { return makeResponse(bytes); } };
      const persistArtifact: PersistArtifactFn = async returned => returned; // simulate lossless write+read
      const outcome = await dispatchToWindowsRunner({
        config: makeConfig(),
        projectJson: SAMPLE_PROJECT_WINDOWS,
        xamlEntries: SAMPLE_XAML,
        projectType: "Windows",
        cliFlavor: "UiPath.CLI.Windows",
        health: buildHealth("healthy"),
        transport,
        persistArtifact,
      });
      expect(outcome.ok).toBe(true);
      expect(outcome.hashChain?.returnedArtifactHash).toBe(outcome.hashChain?.persistedArtifactHash);
      expect(outcome.byteFidelityFailure).toBeUndefined();
    });

    it("forces fallback when persisted bytes differ from runner-returned bytes", async () => {
      const bytes = Buffer.from("PK\x03\x04goodnupkg");
      const transport: DispatchTransport = { async postDispatch() { return makeResponse(bytes); } };
      // Simulate corruption / wrong file at the persistence boundary.
      const persistArtifact: PersistArtifactFn = async () => Buffer.from("CORRUPTEDONDISK");
      const outcome = await dispatchToWindowsRunner({
        config: makeConfig(),
        projectJson: SAMPLE_PROJECT_WINDOWS,
        xamlEntries: SAMPLE_XAML,
        projectType: "Windows",
        cliFlavor: "UiPath.CLI.Windows",
        health: buildHealth("healthy"),
        transport,
        persistArtifact,
      });
      expect(outcome.ok).toBe(false);
      expect(outcome.fallbackReason).toBe("cli_remote_byte_fidelity_failure");
      expect(outcome.byteFidelityFailure).toBeDefined();
      expect(outcome.byteFidelityFailure!.returnedArtifactHash).not.toBe(
        outcome.byteFidelityFailure!.persistedArtifactHash,
      );
      expect(outcome.byteFidelityFailure!.runner.runnerId).toBe("win-runner-1");
      expect(outcome.byteFidelityFailure!.detectedAt).toMatch(/T/);
      expect(outcome.hashChain?.returnedArtifactHash).toBe(outcome.byteFidelityFailure!.returnedArtifactHash);
      expect(outcome.hashChain?.persistedArtifactHash).toBe(outcome.byteFidelityFailure!.persistedArtifactHash);
    });

    it("treats persistArtifact failure as cli_remote_invocation_error", async () => {
      const transport: DispatchTransport = {
        async postDispatch() { return makeResponse(Buffer.from("xx")); },
      };
      const persistArtifact: PersistArtifactFn = async () => { throw new Error("disk full"); };
      const outcome = await dispatchToWindowsRunner({
        config: makeConfig(),
        projectJson: SAMPLE_PROJECT_WINDOWS,
        xamlEntries: SAMPLE_XAML,
        projectType: "Windows",
        cliFlavor: "UiPath.CLI.Windows",
        health: buildHealth("healthy"),
        transport,
        persistArtifact,
      });
      expect(outcome.ok).toBe(false);
      expect(outcome.fallbackReason).toBe("cli_remote_invocation_error");
      expect(outcome.errorMessage).toMatch(/disk full/);
    });

    it("returns busy fallback immediately when busyBehavior=fallback", async () => {
      const config = makeConfig({ policy: { ...DEFAULT_DISPATCH_POLICY, busyBehavior: "fallback" } });
      let called = 0;
      const transport: DispatchTransport = {
        async postDispatch() { called++; return makeResponse(Buffer.from("x")); },
      };
      const outcome = await dispatchToWindowsRunner({
        config,
        projectJson: SAMPLE_PROJECT_WINDOWS,
        xamlEntries: SAMPLE_XAML,
        projectType: "Windows",
        cliFlavor: "UiPath.CLI.Windows",
        health: buildHealth("busy"),
        transport,
      });
      expect(outcome.ok).toBe(false);
      expect(outcome.fallbackReason).toBe("cli_remote_busy_fallback");
      expect(called).toBe(0);
    });

    it("retries transient transport errors and exhausts after retryCount", async () => {
      const config = makeConfig({ policy: { ...DEFAULT_DISPATCH_POLICY, retryCount: 2 } });
      let attempts = 0;
      const transport: DispatchTransport = {
        async postDispatch() {
          attempts++;
          throw Object.assign(new Error("connection reset by peer"), { code: "ECONNRESET" });
        },
      };
      const outcome = await dispatchToWindowsRunner({
        config,
        projectJson: SAMPLE_PROJECT_WINDOWS,
        xamlEntries: SAMPLE_XAML,
        projectType: "Windows",
        cliFlavor: "UiPath.CLI.Windows",
        health: buildHealth("healthy"),
        transport,
      });
      expect(attempts).toBe(3);
      expect(outcome.ok).toBe(false);
      expect(outcome.fallbackReason).toBe("cli_remote_retry_exhausted");
      expect(outcome.retryAttempts).toBe(3);
    });

    it("does not retry non-retryable invocation errors", async () => {
      let attempts = 0;
      const transport: DispatchTransport = {
        async postDispatch() {
          attempts++;
          throw new Error("Remote runner returned HTTP 500: boom");
        },
      };
      const outcome = await dispatchToWindowsRunner({
        config: makeConfig(),
        projectJson: SAMPLE_PROJECT_WINDOWS,
        xamlEntries: SAMPLE_XAML,
        projectType: "Windows",
        cliFlavor: "UiPath.CLI.Windows",
        health: buildHealth("healthy"),
        transport,
      });
      expect(attempts).toBe(1);
      expect(outcome.ok).toBe(false);
      expect(outcome.fallbackReason).toBe("cli_remote_invocation_error");
    });

    it("uses Windows.Legacy CLI version for WindowsLegacy projects", async () => {
      let captured: RemoteDispatchRequest | null = null;
      const transport: DispatchTransport = {
        async postDispatch(_cfg, req) {
          captured = req;
          return makeResponse(Buffer.from("x"));
        },
      };
      await dispatchToWindowsRunner({
        config: makeConfig({ cliWindowsLegacyVersion: "22.10.5" }),
        projectJson: SAMPLE_PROJECT_WINDOWS,
        xamlEntries: SAMPLE_XAML,
        projectType: "WindowsLegacy",
        cliFlavor: "UiPath.CLI.Windows.Legacy",
        health: buildHealth("healthy"),
        transport,
      });
      expect(captured).not.toBeNull();
      expect(captured!.cliVersion).toBe("22.10.5");
      expect(captured!.cliFlavor).toBe("UiPath.CLI.Windows.Legacy");
      expect(captured!.bundle.hash).toMatch(/^sha256:/);
    });

    it("queues on busy and dispatches once health flips to healthy within maxDispatchWaitMs", async () => {
      const config = makeConfig({
        policy: { ...DEFAULT_DISPATCH_POLICY, busyBehavior: "queue", maxDispatchWaitMs: 10_000 },
      });
      let probeCalls = 0;
      // Start busy, then go healthy on the 3rd probe.
      const probe = async () => {
        probeCalls++;
        return { state: (probeCalls < 3 ? "busy" : "healthy") as RunnerHealthState };
      };
      let virtualNow = 0;
      const sleeps: number[] = [];
      const sleep = async (ms: number) => { sleeps.push(ms); virtualNow += ms; };
      const now = () => virtualNow;
      const health = new RunnerHealthChecker(config, probe, now);

      const transport: DispatchTransport = { async postDispatch() { return makeResponse(Buffer.from("x")); } };
      const outcome = await dispatchToWindowsRunner({
        config,
        projectJson: SAMPLE_PROJECT_WINDOWS,
        xamlEntries: SAMPLE_XAML,
        projectType: "Windows",
        cliFlavor: "UiPath.CLI.Windows",
        health,
        transport,
        sleep,
        now,
      });
      expect(outcome.ok).toBe(true);
      expect(outcome.runnerHealthState).toBe("healthy");
      expect(probeCalls).toBeGreaterThanOrEqual(3);
      expect(sleeps.length).toBeGreaterThanOrEqual(2);
    });

    it("returns cli_remote_dispatch_timeout when busy persists past maxDispatchWaitMs", async () => {
      const config = makeConfig({
        policy: { ...DEFAULT_DISPATCH_POLICY, busyBehavior: "queue", maxDispatchWaitMs: 5_000 },
      });
      let virtualNow = 0;
      const sleep = async (ms: number) => { virtualNow += ms; };
      const now = () => virtualNow;
      const health = new RunnerHealthChecker(config, async () => ({ state: "busy" }), now);

      let dispatched = 0;
      const transport: DispatchTransport = { async postDispatch() { dispatched++; return makeResponse(Buffer.from("x")); } };
      const outcome = await dispatchToWindowsRunner({
        config,
        projectJson: SAMPLE_PROJECT_WINDOWS,
        xamlEntries: SAMPLE_XAML,
        projectType: "Windows",
        cliFlavor: "UiPath.CLI.Windows",
        health,
        transport,
        sleep,
        now,
      });
      expect(dispatched).toBe(0);
      expect(outcome.ok).toBe(false);
      expect(outcome.fallbackReason).toBe("cli_remote_dispatch_timeout");
      expect(outcome.runnerHealthState).toBe("busy");
    });

    it("falls back when health is unreachable without dispatching", async () => {
      let called = 0;
      const transport: DispatchTransport = {
        async postDispatch() { called++; return makeResponse(Buffer.from("x")); },
      };
      const outcome = await dispatchToWindowsRunner({
        config: makeConfig(),
        projectJson: SAMPLE_PROJECT_WINDOWS,
        xamlEntries: SAMPLE_XAML,
        projectType: "Windows",
        cliFlavor: "UiPath.CLI.Windows",
        health: buildHealth("unreachable"),
        transport,
      });
      expect(called).toBe(0);
      expect(outcome.ok).toBe(false);
      expect(outcome.fallbackReason).toBe("cli_remote_unreachable");
    });
  });
});

describe("Task #549 — getSharedHealthChecker (cross-dispatch caching)", () => {
  beforeEach(() => resetSharedHealthCheckers());

  it("returns the same instance for the same URL+TTL config", () => {
    const a = getSharedHealthChecker(makeConfig());
    const b = getSharedHealthChecker(makeConfig());
    expect(a).toBe(b);
  });

  it("preserves cached health state across dispatch calls (no per-job re-probe)", async () => {
    const config = makeConfig();
    let probes = 0;
    const probe = async () => { probes++; return { state: "healthy" as RunnerHealthState }; };
    const health = getSharedHealthChecker(config, probe);
    const transport: DispatchTransport = { async postDispatch() { return makeResponse(Buffer.from("x")); } };

    for (let i = 0; i < 3; i++) {
      await dispatchToWindowsRunner({
        config,
        projectJson: SAMPLE_PROJECT_WINDOWS,
        xamlEntries: SAMPLE_XAML,
        projectType: "Windows",
        cliFlavor: "UiPath.CLI.Windows",
        health,
        transport,
      });
    }
    // 3 dispatches should have triggered exactly one probe thanks to the TTL cache.
    expect(probes).toBe(1);
  });
});

describe("Task #549 — runCliValidation integration", () => {
  beforeEach(() => resetSharedHealthCheckers());

  it("returns cli_skipped_incompatible_agent for Windows project on Linux when no remote configured", async () => {
    if (process.platform === "win32") return;
    const result = await runCliValidation(SAMPLE_PROJECT_WINDOWS, SAMPLE_XAML, undefined, { env: {} });
    expect(result.mode).toBe("cli_skipped_incompatible_agent");
    expect(result.cliRunnerType).toBe("none");
    expect(result.packArtifactSource).toBe("none");
    expect(result.remote).toBeUndefined();
  });

  it("dispatches to remote Windows runner when configured and healthy", async () => {
    if (process.platform === "win32") return;
    const stubModule = await makeStubModule({ healthState: "healthy", nupkg: Buffer.from("PKzipbytes") });
    const result = await runCliValidation(SAMPLE_PROJECT_WINDOWS, SAMPLE_XAML, undefined, {
      env: { UIPATH_REMOTE_RUNNER_URL: "https://runner.example.com" },
      remoteDispatchOverride: stubModule,
    });
    expect(result.mode).toBe("cli_remote_windows");
    expect(result.cliRunnerType).toBe("remote_windows");
    expect(result.packArtifactSource).toBe("uipcli");
    expect(result.remote?.runnerHealthState).toBe("healthy");
    expect(result.remote?.hashChain?.bundleHash).toMatch(/^sha256:/);
    expect(result.remote?.runner?.runnerId).toBe("win-runner-1");
  });

  it("surfaces unreachable as cli_remote_unreachable mode", async () => {
    if (process.platform === "win32") return;
    const stubModule = await makeStubModule({ healthState: "unreachable" });
    const result = await runCliValidation(SAMPLE_PROJECT_WINDOWS, SAMPLE_XAML, undefined, {
      env: { UIPATH_REMOTE_RUNNER_URL: "https://runner.example.com" },
      remoteDispatchOverride: stubModule,
    });
    expect(result.mode).toBe("cli_remote_unreachable");
    expect(result.cliRunnerType).toBe("none");
    expect(result.remote?.fallbackReason).toBe("cli_remote_unreachable");
  });

  it("proves shipped-artifact identity: persistedArtifactHash equals hash of the pipeline-stored buffer", async () => {
    if (process.platform === "win32") return;
    const runnerBytes = Buffer.from("PK\x03\x04runner-bytes-v1");
    const stubModule = await makeStubModule({ healthState: "healthy", nupkg: runnerBytes });
    // Simulate the exact pipeline contract: persist callback stores the
    // returned bytes as the run artifact and returns those exact bytes,
    // so persistedArtifactHash IS the hash of what gets shipped.
    let pipelineStoredBuffer: Buffer | null = null;
    const result = await runCliValidation(SAMPLE_PROJECT_WINDOWS, SAMPLE_XAML, undefined, {
      env: { UIPATH_REMOTE_RUNNER_URL: "https://runner.example.com" },
      remoteDispatchOverride: stubModule,
      persistArtifactOverride: async returned => {
        pipelineStoredBuffer = Buffer.from(returned);
        return pipelineStoredBuffer;
      },
    });
    expect(result.mode).toBe("cli_remote_windows");
    expect(result.cliRunnerType).toBe("remote_windows");
    expect(result.packArtifactSource).toBe("uipcli");
    expect(pipelineStoredBuffer).not.toBeNull();
    // The artifact the pipeline would ship matches the runner-returned bytes.
    expect(Buffer.compare(pipelineStoredBuffer!, runnerBytes)).toBe(0);
    // And the persisted-hash on the run record is the hash of those exact shipped bytes.
    expect(result.remote?.hashChain?.persistedArtifactHash).toBe(hashBytes(pipelineStoredBuffer!));
    expect(result.remote?.hashChain?.returnedArtifactHash).toBe(result.remote?.hashChain?.persistedArtifactHash);
  });

  it("forces fallback packaging on byte-fidelity mismatch end-to-end via runCliValidation", async () => {
    if (process.platform === "win32") return;
    const stubModule = await makeStubModule({ healthState: "healthy", nupkg: Buffer.from("good-nupkg-bytes") });
    const result = await runCliValidation(SAMPLE_PROJECT_WINDOWS, SAMPLE_XAML, undefined, {
      env: { UIPATH_REMOTE_RUNNER_URL: "https://runner.example.com" },
      remoteDispatchOverride: stubModule,
      // Persistence corrupts the bytes -> byte-fidelity guard must fire.
      persistArtifactOverride: async () => Buffer.from("CORRUPTED-ON-DISK"),
    });
    expect(result.mode).toBe("cli_remote_byte_fidelity_failure");
    expect(result.cliRunnerType).toBe("none");
    expect(result.packArtifactSource).toBe("fallback_adm_zip");
    expect(result.remote?.byteFidelityFailure).toBeDefined();
    expect(result.remote?.byteFidelityFailure!.returnedArtifactHash).not.toBe(
      result.remote!.byteFidelityFailure!.persistedArtifactHash,
    );
    expect(result.remote?.hashChain?.bundleHash).toMatch(/^sha256:/);
  });

  it("rejects malformed success payload (packResult.success=true but no nupkgBase64) and forces fallback", async () => {
    if (process.platform === "win32") return;
    const real = await import("../uipath-cli-remote-dispatch");
    const malformedTransport: DispatchTransport = {
      async postDispatch() {
        const r = makeResponse(Buffer.from("ignored"));
        return { ...r, nupkgBase64: undefined };
      },
    };
    const stubModule: RemoteDispatchModule = {
      ...real,
      defaultHealthProbe: async () => ({ state: "healthy" }),
      dispatchToWindowsRunner: (input: DispatchToWindowsRunnerInput): Promise<DispatchOutcome> =>
        real.dispatchToWindowsRunner({ ...input, transport: malformedTransport }),
    };
    const result = await runCliValidation(SAMPLE_PROJECT_WINDOWS, SAMPLE_XAML, undefined, {
      env: { UIPATH_REMOTE_RUNNER_URL: "https://runner.example.com" },
      remoteDispatchOverride: stubModule,
    });
    expect(result.mode).not.toBe("cli_remote_windows");
    expect(result.cliRunnerType).toBe("none");
    expect(result.packArtifactSource).not.toBe("uipcli");
    expect(result.remote?.fallbackReason).toBe("cli_remote_invocation_error");
    expect(result.remote?.hashChain?.persistedArtifactHash).toBeUndefined();
    expect(result.remote?.hashChain?.returnedArtifactHash).toBeUndefined();
  });

  it("does NOT attempt remote dispatch for compatible (CrossPlatform) projects", async () => {
    if (process.platform === "win32") return;
    const stubModule = await makeStubModule({ healthState: "healthy" });
    let dispatched = false;
    const wrapped: RemoteDispatchModule = {
      ...stubModule,
      dispatchToWindowsRunner: async (input: DispatchToWindowsRunnerInput): Promise<DispatchOutcome> => {
        dispatched = true;
        return stubModule.dispatchToWindowsRunner(input);
      },
    };
    const result: CliValidationResult = await runCliValidation(SAMPLE_PROJECT_PORTABLE, SAMPLE_XAML, undefined, {
      env: { UIPATH_REMOTE_RUNNER_URL: "https://runner.example.com" },
      remoteDispatchOverride: wrapped,
    });
    expect(dispatched).toBe(false);
    expect(result.mode).not.toBe("cli_remote_windows");
  });
});

async function makeStubModule(opts: {
  healthState: RunnerHealthState;
  nupkg?: Buffer;
}): Promise<RemoteDispatchModule> {
  const real = await import("../uipath-cli-remote-dispatch");
  const transport: DispatchTransport = {
    async postDispatch() {
      return makeResponse(opts.nupkg);
    },
  };
  return {
    ...real,
    defaultHealthProbe: async () => ({ state: opts.healthState }),
    dispatchToWindowsRunner: (input: DispatchToWindowsRunnerInput): Promise<DispatchOutcome> =>
      real.dispatchToWindowsRunner({ ...input, transport }),
  };
}
