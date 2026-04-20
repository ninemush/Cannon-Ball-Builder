# uipcli Promotion Simulation Report (#545)

_Generated: 2026-04-20T12:48:22.663Z_

## Top-line summary

- **Verdict:** `DEFERRED`
- **Sample size:** 10 runs
- **Simulatable runs (CLI produced a usable verdict):** 0
- **Regression-risk runs:** 0
- **Expected-churn runs:** 0
- **Safe-delta runs:** 0

**Rationale:** DEFERRED: 0 of 10 runs in the sample carried real CLI execution data, so #541 has no CLI-grounded behavior to differ on. The simulator cannot produce evidence-based verdict/artifact/routing/DHG deltas from this sample. Re-run after a Windows runner (#549) lands or after #541 Phase 1 step 1 (capability-driven framework selection) starts producing CLI shadow data on Linux.

## Deferral notice

The recommendation in `.local/tasks/uipcli-promotion-dry-run-simulation.md` ('When to run') applies: when no recent runs include real CLI execution data, the simulation has nothing CLI-grounded to differ on. Re-run this simulator after either:

- **#549 lands** (Windows runner) — Windows-required runs start producing real CLI shadow data on the dominant project shape; or
- **#541 Phase 1 step 1 lands** (capability-driven post-emission framework selection) — CrossPlatform-eligible runs start executing CLI in-process on Linux.

Until then, the simulator's verdict-, artifact-, and routing-delta sections fall through to 'CLI did not run; #541 falls back to legacy heuristic — verdict identical by definition.'

## Per-run findings

### Run `f7d4f7ac-01fe-4f60-99d3-14a46f39e91c`

- Spec id: `d3274c92-1bb8-46a9-8a14-4ddd0c7d3da6`
- Declared targetFramework: `n/a`
- CLI mode: `absent`
- Actual status: `structurally_invalid`
- Simulated status: `structurally_invalid`
- Verdict reason: CLI did not produce usable signals (mode=absent); #541 falls back to legacy heuristic — simulated verdict is identical to actual by definition. Run is not counted toward simulatable totals.
- Truth sources (simulated): openability=`fallback_heuristic`, fidelity=`final_quality_report`

**1. Verdict delta**

Agree — actual=`structurally_invalid` simulated=`structurally_invalid`

**2. Shipped artifact delta**

- packArtifactSource (legacy): `fallback_adm_zip`
- packArtifactSource (simulated): `fallback_adm_zip`
- packFallbackReason: `cli_unavailable`
- Simulated #541 would also use the hand-rolled packer; both runs ship the same artifact.

**3. Analyzer Error routing delta**

_No analyzer Error-severity defects in this run (or CLI did not produce defects)._

**4. DHG Studio Compatibility delta**

_No per-workflow studio compatibility classifications recorded for this run._

**5. Regression-risk classification**

_No risk items — all simulated deltas are no-ops._

**Notes:**

- Outcome report contains no cliValidation block; CLI either did not run or the result is not persisted today.

### Run `ffeeb0f4-5ee0-422c-b347-ac1a60e9b74d`

- Spec id: `348a09fd-b435-45fb-9dbc-ee0c30ea6135`
- Declared targetFramework: `n/a`
- CLI mode: `absent`
- Actual status: `structurally_invalid`
- Simulated status: `structurally_invalid`
- Verdict reason: CLI did not produce usable signals (mode=absent); #541 falls back to legacy heuristic — simulated verdict is identical to actual by definition. Run is not counted toward simulatable totals.
- Truth sources (simulated): openability=`fallback_heuristic`, fidelity=`final_quality_report`

**1. Verdict delta**

Agree — actual=`structurally_invalid` simulated=`structurally_invalid`

**2. Shipped artifact delta**

- packArtifactSource (legacy): `fallback_adm_zip`
- packArtifactSource (simulated): `fallback_adm_zip`
- packFallbackReason: `cli_unavailable`
- Simulated #541 would also use the hand-rolled packer; both runs ship the same artifact.

**3. Analyzer Error routing delta**

_No analyzer Error-severity defects in this run (or CLI did not produce defects)._

**4. DHG Studio Compatibility delta**

_No per-workflow studio compatibility classifications recorded for this run._

**5. Regression-risk classification**

_No risk items — all simulated deltas are no-ops._

**Notes:**

- Outcome report contains no cliValidation block; CLI either did not run or the result is not persisted today.

### Run `66561075-d7c8-4ffe-b2c6-cc64d07fa982`

- Spec id: `d3274c92-1bb8-46a9-8a14-4ddd0c7d3da6`
- Declared targetFramework: `n/a`
- CLI mode: `absent`
- Actual status: `structurally_invalid`
- Simulated status: `structurally_invalid`
- Verdict reason: CLI did not produce usable signals (mode=absent); #541 falls back to legacy heuristic — simulated verdict is identical to actual by definition. Run is not counted toward simulatable totals.
- Truth sources (simulated): openability=`fallback_heuristic`, fidelity=`final_quality_report`

**1. Verdict delta**

Agree — actual=`structurally_invalid` simulated=`structurally_invalid`

**2. Shipped artifact delta**

- packArtifactSource (legacy): `fallback_adm_zip`
- packArtifactSource (simulated): `fallback_adm_zip`
- packFallbackReason: `cli_unavailable`
- Simulated #541 would also use the hand-rolled packer; both runs ship the same artifact.

**3. Analyzer Error routing delta**

_No analyzer Error-severity defects in this run (or CLI did not produce defects)._

**4. DHG Studio Compatibility delta**

_No per-workflow studio compatibility classifications recorded for this run._

**5. Regression-risk classification**

_No risk items — all simulated deltas are no-ops._

**Notes:**

- Outcome report contains no cliValidation block; CLI either did not run or the result is not persisted today.

### Run `b2bda0c2-b70e-41da-8649-479ba3f9e209`

- Spec id: `348a09fd-b435-45fb-9dbc-ee0c30ea6135`
- Declared targetFramework: `n/a`
- CLI mode: `absent`
- Actual status: `structurally_invalid`
- Simulated status: `structurally_invalid`
- Verdict reason: CLI did not produce usable signals (mode=absent); #541 falls back to legacy heuristic — simulated verdict is identical to actual by definition. Run is not counted toward simulatable totals.
- Truth sources (simulated): openability=`fallback_heuristic`, fidelity=`final_quality_report`

**1. Verdict delta**

Agree — actual=`structurally_invalid` simulated=`structurally_invalid`

**2. Shipped artifact delta**

- packArtifactSource (legacy): `fallback_adm_zip`
- packArtifactSource (simulated): `fallback_adm_zip`
- packFallbackReason: `cli_unavailable`
- Simulated #541 would also use the hand-rolled packer; both runs ship the same artifact.

**3. Analyzer Error routing delta**

_No analyzer Error-severity defects in this run (or CLI did not produce defects)._

**4. DHG Studio Compatibility delta**

_No per-workflow studio compatibility classifications recorded for this run._

**5. Regression-risk classification**

_No risk items — all simulated deltas are no-ops._

**Notes:**

- Outcome report contains no cliValidation block; CLI either did not run or the result is not persisted today.

### Run `53b42526-961d-45eb-a1ff-7e44279d53d6`

- Spec id: `d3274c92-1bb8-46a9-8a14-4ddd0c7d3da6`
- Declared targetFramework: `n/a`
- CLI mode: `absent`
- Actual status: `structurally_invalid`
- Simulated status: `structurally_invalid`
- Verdict reason: CLI did not produce usable signals (mode=absent); #541 falls back to legacy heuristic — simulated verdict is identical to actual by definition. Run is not counted toward simulatable totals.
- Truth sources (simulated): openability=`fallback_heuristic`, fidelity=`final_quality_report`

**1. Verdict delta**

Agree — actual=`structurally_invalid` simulated=`structurally_invalid`

**2. Shipped artifact delta**

- packArtifactSource (legacy): `fallback_adm_zip`
- packArtifactSource (simulated): `fallback_adm_zip`
- packFallbackReason: `cli_unavailable`
- Simulated #541 would also use the hand-rolled packer; both runs ship the same artifact.

**3. Analyzer Error routing delta**

_No analyzer Error-severity defects in this run (or CLI did not produce defects)._

**4. DHG Studio Compatibility delta**

_No per-workflow studio compatibility classifications recorded for this run._

**5. Regression-risk classification**

_No risk items — all simulated deltas are no-ops._

**Notes:**

- Outcome report contains no cliValidation block; CLI either did not run or the result is not persisted today.

### Run `e8a4c523-49cf-4c22-b408-1fa3eabe4278`

- Spec id: `348a09fd-b435-45fb-9dbc-ee0c30ea6135`
- Declared targetFramework: `n/a`
- CLI mode: `absent`
- Actual status: `failed`
- Simulated status: `failed`
- Verdict reason: CLI did not produce usable signals (mode=absent); #541 falls back to legacy heuristic — simulated verdict is identical to actual by definition. Run is not counted toward simulatable totals.
- Truth sources (simulated): openability=`fallback_heuristic`, fidelity=`fallback_heuristic`

**1. Verdict delta**

Agree — actual=`failed` simulated=`failed`

**2. Shipped artifact delta**

- packArtifactSource (legacy): `fallback_adm_zip`
- packArtifactSource (simulated): `fallback_adm_zip`
- packFallbackReason: `cli_unavailable`
- Simulated #541 would also use the hand-rolled packer; both runs ship the same artifact.

**3. Analyzer Error routing delta**

_No analyzer Error-severity defects in this run (or CLI did not produce defects)._

**4. DHG Studio Compatibility delta**

_No per-workflow studio compatibility classifications recorded for this run._

**5. Regression-risk classification**

_No risk items — all simulated deltas are no-ops._

**Notes:**

- Outcome report contains no cliValidation block; CLI either did not run or the result is not persisted today.

### Run `0a2318f3-1b3b-4cd6-8219-dba1a798dc5a`

- Spec id: `d3274c92-1bb8-46a9-8a14-4ddd0c7d3da6`
- Declared targetFramework: `n/a`
- CLI mode: `absent`
- Actual status: `structurally_invalid`
- Simulated status: `structurally_invalid`
- Verdict reason: CLI did not produce usable signals (mode=absent); #541 falls back to legacy heuristic — simulated verdict is identical to actual by definition. Run is not counted toward simulatable totals.
- Truth sources (simulated): openability=`fallback_heuristic`, fidelity=`final_quality_report`

**1. Verdict delta**

Agree — actual=`structurally_invalid` simulated=`structurally_invalid`

**2. Shipped artifact delta**

- packArtifactSource (legacy): `fallback_adm_zip`
- packArtifactSource (simulated): `fallback_adm_zip`
- packFallbackReason: `cli_unavailable`
- Simulated #541 would also use the hand-rolled packer; both runs ship the same artifact.

**3. Analyzer Error routing delta**

_No analyzer Error-severity defects in this run (or CLI did not produce defects)._

**4. DHG Studio Compatibility delta**

_No per-workflow studio compatibility classifications recorded for this run._

**5. Regression-risk classification**

_No risk items — all simulated deltas are no-ops._

**Notes:**

- Outcome report contains no cliValidation block; CLI either did not run or the result is not persisted today.

### Run `0b60dfcd-a70e-4aa0-9c5c-223585f1ad2e`

- Spec id: `348a09fd-b435-45fb-9dbc-ee0c30ea6135`
- Declared targetFramework: `n/a`
- CLI mode: `absent`
- Actual status: `failed`
- Simulated status: `failed`
- Verdict reason: CLI did not produce usable signals (mode=absent); #541 falls back to legacy heuristic — simulated verdict is identical to actual by definition. Run is not counted toward simulatable totals.
- Truth sources (simulated): openability=`fallback_heuristic`, fidelity=`fallback_heuristic`

**1. Verdict delta**

Agree — actual=`failed` simulated=`failed`

**2. Shipped artifact delta**

- packArtifactSource (legacy): `fallback_adm_zip`
- packArtifactSource (simulated): `fallback_adm_zip`
- packFallbackReason: `cli_unavailable`
- Simulated #541 would also use the hand-rolled packer; both runs ship the same artifact.

**3. Analyzer Error routing delta**

_No analyzer Error-severity defects in this run (or CLI did not produce defects)._

**4. DHG Studio Compatibility delta**

_No per-workflow studio compatibility classifications recorded for this run._

**5. Regression-risk classification**

_No risk items — all simulated deltas are no-ops._

**Notes:**

- Outcome report contains no cliValidation block; CLI either did not run or the result is not persisted today.

### Run `d5f102a2-2a62-4f8f-84d8-5544b4a656fb`

- Spec id: `348a09fd-b435-45fb-9dbc-ee0c30ea6135`
- Declared targetFramework: `n/a`
- CLI mode: `absent`
- Actual status: `structurally_invalid`
- Simulated status: `structurally_invalid`
- Verdict reason: CLI did not produce usable signals (mode=absent); #541 falls back to legacy heuristic — simulated verdict is identical to actual by definition. Run is not counted toward simulatable totals.
- Truth sources (simulated): openability=`fallback_heuristic`, fidelity=`final_quality_report`

**1. Verdict delta**

Agree — actual=`structurally_invalid` simulated=`structurally_invalid`

**2. Shipped artifact delta**

- packArtifactSource (legacy): `fallback_adm_zip`
- packArtifactSource (simulated): `fallback_adm_zip`
- packFallbackReason: `cli_unavailable`
- Simulated #541 would also use the hand-rolled packer; both runs ship the same artifact.

**3. Analyzer Error routing delta**

_No analyzer Error-severity defects in this run (or CLI did not produce defects)._

**4. DHG Studio Compatibility delta**

_No per-workflow studio compatibility classifications recorded for this run._

**5. Regression-risk classification**

_No risk items — all simulated deltas are no-ops._

**Notes:**

- Outcome report contains no cliValidation block; CLI either did not run or the result is not persisted today.

### Run `03cda18b-26bf-463c-baf7-d2e50385472d`

- Spec id: `d3274c92-1bb8-46a9-8a14-4ddd0c7d3da6`
- Declared targetFramework: `n/a`
- CLI mode: `absent`
- Actual status: `structurally_invalid`
- Simulated status: `structurally_invalid`
- Verdict reason: CLI did not produce usable signals (mode=absent); #541 falls back to legacy heuristic — simulated verdict is identical to actual by definition. Run is not counted toward simulatable totals.
- Truth sources (simulated): openability=`fallback_heuristic`, fidelity=`final_quality_report`

**1. Verdict delta**

Agree — actual=`structurally_invalid` simulated=`structurally_invalid`

**2. Shipped artifact delta**

- packArtifactSource (legacy): `fallback_adm_zip`
- packArtifactSource (simulated): `fallback_adm_zip`
- packFallbackReason: `cli_unavailable`
- Simulated #541 would also use the hand-rolled packer; both runs ship the same artifact.

**3. Analyzer Error routing delta**

_No analyzer Error-severity defects in this run (or CLI did not produce defects)._

**4. DHG Studio Compatibility delta**

_No per-workflow studio compatibility classifications recorded for this run._

**5. Regression-risk classification**

_No risk items — all simulated deltas are no-ops._

**Notes:**

- Outcome report contains no cliValidation block; CLI either did not run or the result is not persisted today.

## Reproducibility

Re-run this report with:

```
# from the database (most recent N runs)
tsx tools/uipcli-promotion-sim/run-report.ts --limit 10

# from on-disk verification bundles (default: attached_assets/)
tsx tools/uipcli-promotion-sim/run-report.ts --from-bundles

# or pin to a specific bundle directory
tsx tools/uipcli-promotion-sim/run-report.ts --bundle-dir /path/to/bundles
```

The simulator imports `CLI_RULE_TO_CHECK` and `CLI_FIXABLE_RULE_IDS` from `server/meta-validation/iterative-llm-corrector.ts` so simulated routing follows the production whitelist. The `BLOCKING_CLI_ERROR_RULE_IDS` set in `tools/uipcli-promotion-sim/simulate.ts` is the closed list of openability-blocking analyzer Errors anticipated by #541; it is empty today (per the plan, unknown Errors default to localized DHG TODOs).

Archive-level diff: when both the shipped `.nupkg` (via `shippedArtifact.filePath`/`buffer`) and the CLI-produced `.nupkg` (via `cliValidation.packResult.outputPath`) are available on disk, the artifact-delta section emits a per-entry table (only-in-shipped / only-in-cli / content-differs / identical, with truncated sha256 per side). When neither is on disk, the section honestly reports the missing inputs and the path to enable the diff.
