---
name: post-implementation-verification
description: Automatically collects, validates, and bundles all verification artifacts after every pipeline-related task into a single downloadable zip file. Use after completing any pipeline-related implementation task.
---

# Post-Implementation Verification

Collect and bundle all verification artifacts after every pipeline-related task into a single downloadable zip file for reviewer inspection.

## Activation Criteria

Use this skill **after completing any pipeline-related task**, including:

- Defect fixes in the XAML generation pipeline
- Quality gate improvements or new validation rules
- Meta-validation changes
- DHG generator updates
- Package assembler modifications
- Emission gate or remediation logic changes
- Any change to files under `server/` that affects pipeline output

Do NOT use this skill for:

- Frontend-only UI changes unrelated to pipeline output
- Documentation-only updates
- Orchestrator configuration changes

## Verification Workflow

After completing the implementation task:

### Step 1: Trigger a generation run

Ensure a generation run has been executed for at least one test idea so that pipeline artifacts are available. If a run was already triggered as part of testing, skip this step.

### Step 2: Download the verification bundle

Call the verification bundle endpoint:

```
POST /api/verification-bundle/:ideaId
```

This returns a zip file containing all artifacts from the latest generation run for the given idea.

### Step 3: Review the bundle contents

The bundle contains a structured folder with:

| File | Description | Availability |
|------|-------------|-------------|
| `manifest.json` | Idea metadata, generation run ID, timestamps, project name, artifact source tracking | Always |
| `<ProjectName>.nupkg` | The generated UiPath NuGet package | When build succeeded and cache available (or reconstructed from cached xamlEntries) |
| `package-metadata.json` | Package metadata (project name, version, dependencies) when .nupkg binary is unavailable | When cache expired but package metadata exists in chat messages |
| `dhg.md` | The Developer Handoff Guide | When DHG was generated |
| `pdd.md` | Process Definition Document for the idea | When PDD exists in database |
| `sdd.md` | Solution Design Document for the idea | When SDD exists in database |
| `document-approvals.json` | Approval timestamps, roles, user info, and versions for PDD and SDD | When at least one document has been approved |
| `activity-catalog.json` | Full activity catalog snapshot with all packages, activities, and properties | When catalog file exists on filesystem |
| `generation-metadata.json` | Studio target, package version ranges, and generation configuration | When metadata file exists on filesystem |
| `quality-gate-results.json` | Full quality gate output (violations, readiness, completeness) | When quality gate ran (cache or outcome-report fallback) |
| `meta-validation-results.json` | Meta-validation output (engaged, corrections, confidence score, mode, duration) | When meta-validation ran (cache or outcome-report fallback) |
| `pipeline-diagnostics.json` | Stage log, progress events, error details from the generation run | Always |
| `outcome-report.json` | The full PipelineOutcomeReport with remediations, auto-repairs, warnings | When run completed |
| `final-quality-report.json` | Final artifact validation results with per-file Studio compatibility | When cache available |
| `spec-snapshot.json` | The package specification snapshot used for generation | When spec was captured |

### Step 4: Verify against task requirements

Cross-reference the bundle contents against the task's acceptance criteria:

1. **Quality gate results** — confirm the fix reduced or eliminated the targeted violations
2. **DHG content** — verify the Developer Handoff Guide accurately reflects the current state
3. **Meta-validation results** — check that corrections are applied correctly
4. **Pipeline diagnostics** — confirm no new failures or regressions in stage progression
5. **Outcome report** — review remediations, auto-repairs, and quality warnings for changes

## Manifest Schema

```json
{
  "ideaId": "string",
  "ideaTitle": "string",
  "ideaDescription": "string",
  "generationRunId": "string (UUID)",
  "generationMode": "full_implementation | baseline_openable",
  "generationStatus": "completed | completed_with_warnings | failed | blocked",
  "triggeredBy": "manual | chat | api",
  "createdAt": "ISO 8601 timestamp",
  "completedAt": "ISO 8601 timestamp | null",
  "bundleGeneratedAt": "ISO 8601 timestamp",
  "projectName": "string",
  "cacheAvailable": "boolean",
  "artifactSources": {
    "<artifact-name>": "cache | database | outcome-report-fallback | generated"
  }
}
```

## UI Access

Users can also download the verification bundle from the **Artifacts** panel in the workspace UI. When a UiPath package exists for an idea, a "Verification Bundle" download button appears alongside the standard artifact downloads.

## Known Limitations

- **Screenshot capture**: Playwright-based UI screenshot capture (package card, DHG view, diagnostics panels) is not yet integrated into the bundle. Screenshots require a browser runtime that is complex to provision server-side. This is a future enhancement.
- **Cache dependency**: The nupkg binary and final quality report are only available from the in-memory pipeline cache. After a server restart, these artifacts will be absent from the bundle. Meta-validation results now fall back to extracting summary data from the persisted outcome report when cache is expired. Quality gate results also fall back to the outcome report.

## Integration with Pipeline Evidence Gate

This skill complements the `pipeline-evidence-gate` skill. While the evidence gate requires runtime evidence *before* proposing tasks, the verification bundle provides the runtime evidence *after* completing tasks. Together they form a closed loop:

1. **Evidence Gate** (pre-task): Requires runtime evidence to justify the task
2. **Implementation**: The actual code changes
3. **Verification Bundle** (post-task): Collects all artifacts to prove the task succeeded

When filing evidence for the evidence gate on future tasks, the verification bundle from a previous task serves as a valid evidence source.
