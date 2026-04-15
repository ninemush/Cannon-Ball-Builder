export type ManifestStepStatus = "preserved" | "stubbed" | "degraded" | "dropped";

export interface ManifestEntry {
  stepId: string;
  sourceDescription: string;
  assignedWorkflow: string;
  assignedActivity: string;
  activityType: string;
  status: ManifestStepStatus;
  reason: string;
  corrections: string[];
  developerAction: string;
  placeholderInserted: string;
  editLocation: string;
  expandedActivities?: string[];
  collapsedFrom?: string[];
}

export interface TraceabilityManifest {
  entries: ManifestEntry[];
  createdAt: string;
  finalizedAt?: string;
}

export function createManifest(): TraceabilityManifest {
  return {
    entries: [],
    createdAt: new Date().toISOString(),
  };
}

export function initializeManifestFromSpec(
  manifest: TraceabilityManifest,
  workflows: Array<{
    name: string;
    steps: Array<{
      activity: string;
      activityType?: string;
      properties?: Record<string, unknown>;
    }>;
  }>,
): void {
  for (const wf of workflows) {
    const wfName = wf.name || "Main";
    if (!wf.steps || wf.steps.length === 0) continue;
    for (let i = 0; i < wf.steps.length; i++) {
      const step = wf.steps[i];
      const actKey = (step.activity || "").replace(/\s+/g, "_").substring(0, 40);
      const stepId = `${wfName}:S${i}:${step.activityType || "unknown"}:${actKey}`;
      manifest.entries.push({
        stepId,
        sourceDescription: step.activity || "",
        assignedWorkflow: wfName,
        assignedActivity: step.activity || "",
        activityType: step.activityType || "unknown",
        status: "preserved",
        reason: "Initial decomposition",
        corrections: [],
        developerAction: "",
        placeholderInserted: "",
        editLocation: `${wfName}.xaml`,
      });
    }
  }
}

export function updateManifestEntry(
  manifest: TraceabilityManifest,
  stepId: string,
  update: Partial<Pick<ManifestEntry, "status" | "reason" | "developerAction" | "placeholderInserted" | "editLocation">>,
): void {
  const entry = manifest.entries.find(e => e.stepId === stepId);
  if (!entry) return;
  if (update.status !== undefined) entry.status = update.status;
  if (update.reason !== undefined) entry.reason = update.reason;
  if (update.developerAction !== undefined) entry.developerAction = update.developerAction;
  if (update.placeholderInserted !== undefined) entry.placeholderInserted = update.placeholderInserted;
  if (update.editLocation !== undefined) entry.editLocation = update.editLocation;
}

export function addManifestCorrection(
  manifest: TraceabilityManifest,
  stepId: string,
  correction: string,
): void {
  const entry = manifest.entries.find(e => e.stepId === stepId);
  if (!entry) return;
  entry.corrections.push(correction);
}

export function updateManifestEntriesByWorkflow(
  manifest: TraceabilityManifest,
  workflowName: string,
  update: Partial<Pick<ManifestEntry, "status" | "reason" | "developerAction" | "placeholderInserted">>,
): void {
  for (const entry of manifest.entries) {
    if (entry.assignedWorkflow === workflowName) {
      if (update.status !== undefined) entry.status = update.status;
      if (update.reason !== undefined) entry.reason = update.reason;
      if (update.developerAction !== undefined) entry.developerAction = update.developerAction;
      if (update.placeholderInserted !== undefined) entry.placeholderInserted = update.placeholderInserted;
    }
  }
}

export function updateManifestEntriesByActivityType(
  manifest: TraceabilityManifest,
  workflowName: string,
  activityType: string,
  update: Partial<Pick<ManifestEntry, "status" | "reason" | "developerAction" | "placeholderInserted" | "editLocation">>,
): void {
  for (const entry of manifest.entries) {
    if (entry.assignedWorkflow === workflowName && entry.activityType === activityType) {
      if (update.status !== undefined) entry.status = update.status;
      if (update.reason !== undefined) entry.reason = update.reason;
      if (update.developerAction !== undefined) entry.developerAction = update.developerAction;
      if (update.placeholderInserted !== undefined) entry.placeholderInserted = update.placeholderInserted;
      if (update.editLocation !== undefined) entry.editLocation = update.editLocation;
    }
  }
}

export function markWorkflowDropped(
  manifest: TraceabilityManifest,
  workflowName: string,
  reason: string,
): void {
  updateManifestEntriesByWorkflow(manifest, workflowName, {
    status: "dropped",
    reason,
    developerAction: `Workflow "${workflowName}.xaml" was removed — re-implement if needed`,
  });
}

export function markWorkflowStubbed(
  manifest: TraceabilityManifest,
  workflowName: string,
  reason: string,
): void {
  const entries = manifest.entries.filter(e => e.assignedWorkflow === workflowName);
  for (const entry of entries) {
    entry.status = "stubbed";
    entry.reason = reason;
    entry.developerAction = `Workflow "${workflowName}.xaml" contains stubs — implement real business logic`;
    entry.placeholderInserted = "Stub workflow with TODO placeholder";
    entry.corrections.push(`Stubbed: ${reason}`);
  }
  if (entries.length === 0) {
    manifest.entries.push({
      stepId: `${workflowName}:stub:0`,
      sourceDescription: `Workflow "${workflowName}" (stubbed)`,
      assignedWorkflow: workflowName,
      assignedActivity: "",
      activityType: "workflow",
      status: "stubbed",
      reason,
      corrections: [`Stubbed: ${reason}`],
      developerAction: `Workflow "${workflowName}.xaml" contains stubs — implement real business logic`,
      placeholderInserted: "Stub workflow with TODO placeholder",
      editLocation: `${workflowName}.xaml`,
    });
  }
}

export function markStepDegraded(
  manifest: TraceabilityManifest,
  workflowName: string,
  stepIndex: number,
  reason: string,
  developerAction: string,
  placeholder?: string,
): void {
  const entriesForWf = manifest.entries.filter(e => e.assignedWorkflow === workflowName);
  if (stepIndex >= 0 && stepIndex < entriesForWf.length) {
    const entry = entriesForWf[stepIndex];
    entry.status = "degraded";
    entry.reason = reason;
    entry.developerAction = developerAction;
    if (placeholder) entry.placeholderInserted = placeholder;
  }
}

export function recordPruningDecision(
  manifest: TraceabilityManifest,
  workflowName: string,
  wasSpecDefined: boolean,
  preserved: boolean,
  reason: string,
): void {
  if (preserved) {
    updateManifestEntriesByWorkflow(manifest, workflowName, {
      status: "degraded",
      reason: `Invoke-path mismatch: ${reason}`,
      developerAction: `Wire up InvokeWorkflowFile reference to "${workflowName}.xaml" in the calling workflow`,
      placeholderInserted: "TODO Comment noting unresolved invoke link",
    });
  } else {
    markWorkflowDropped(manifest, workflowName, 
      wasSpecDefined 
        ? `Spec-defined workflow pruned: ${reason}` 
        : `Orphaned workflow removed: ${reason}`
    );
  }
}

export function reconcileManifestWithArtifact(
  manifest: TraceabilityManifest,
  xamlEntries: Array<{ name: string; content: string }>,
): void {
  const artifactWorkflows = new Map<string, string>();
  for (const entry of xamlEntries) {
    const baseName = (entry.name.split("/").pop() || entry.name).replace(/\.xaml$/i, "");
    artifactWorkflows.set(baseName, entry.content);
  }

  for (const me of manifest.entries) {
    if (me.status === "dropped") continue;

    const xamlContent = artifactWorkflows.get(me.assignedWorkflow);
    if (!xamlContent) {
      me.status = "dropped";
      me.reason = me.reason
        ? `${me.reason}; workflow absent from final artifact`
        : "Workflow absent from final artifact";
      me.developerAction = me.developerAction || `Re-implement "${me.assignedWorkflow}.xaml"`;
      me.corrections.push("Reconciliation: workflow not in final artifact");
      continue;
    }

    if (me.status !== "preserved") continue;

    const activityPresent = me.assignedActivity &&
      me.assignedActivity.length > 0 &&
      xamlContent.includes(me.assignedActivity);

    const activityTypePresent = me.activityType !== "unknown" &&
      me.activityType.length > 0 &&
      (xamlContent.includes(me.activityType) || xamlContent.includes(`<${me.activityType}`) || xamlContent.includes(`<ui:${me.activityType}`));

    const displayNamePresent = me.assignedActivity &&
      me.assignedActivity.length > 0 &&
      xamlContent.includes(`DisplayName="${me.assignedActivity}"`);

    if (displayNamePresent || activityPresent) {
      continue;
    }

    if (activityTypePresent) {
      continue;
    }

    me.status = "degraded";
    me.reason = me.reason
      ? `${me.reason}; step not verified in final XAML`
      : "Step not verified in final XAML — no activity or type match found";
    me.developerAction = me.developerAction ||
      `Verify "${me.assignedActivity}" (${me.activityType}) is correctly implemented in ${me.assignedWorkflow}.xaml`;
    me.corrections.push("Reconciliation: step presence not confirmed in final artifact");
  }
}

export function finalizeManifest(manifest: TraceabilityManifest): void {
  manifest.finalizedAt = new Date().toISOString();
}

export function getManifestSummary(manifest: TraceabilityManifest): {
  total: number;
  preserved: number;
  stubbed: number;
  degraded: number;
  dropped: number;
} {
  const entries = manifest.entries;
  return {
    total: entries.length,
    preserved: entries.filter(e => e.status === "preserved").length,
    stubbed: entries.filter(e => e.status === "stubbed").length,
    degraded: entries.filter(e => e.status === "degraded").length,
    dropped: entries.filter(e => e.status === "dropped").length,
  };
}
