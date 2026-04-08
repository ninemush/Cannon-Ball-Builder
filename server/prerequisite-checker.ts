import * as orch from "./orchestrator-client";
import { getConfig, getHeaders, getBaseUrl, UiPathAuthError } from "./uipath-auth";

export type CheckStatus = "pass" | "warning" | "blocking";

export interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
  remediation?: string;
}

export interface PrerequisiteReport {
  results: CheckResult[];
  hasBlocking: boolean;
  hasWarnings: boolean;
  blockingCount: number;
  warningCount: number;
  passCount: number;
}

export async function checkMachineAvailability(): Promise<CheckResult> {
  try {
    const machines = await orch.getMachines();
    if (machines.length === 0) {
      return {
        name: "Machine Availability",
        status: "blocking",
        detail: "No machines registered in the target folder",
        remediation: "Register at least one machine in Orchestrator > Machines before deploying.",
      };
    }

    const disconnected = machines.filter(
      (m) => m.Status === "Disconnected" || m.Status === "Offline"
    );

    if (disconnected.length === machines.length) {
      return {
        name: "Machine Availability",
        status: "warning",
        detail: `${machines.length} machine(s) registered, but all are disconnected`,
        remediation: "Ensure at least one machine is online and connected to Orchestrator.",
      };
    }

    const available = machines.length - disconnected.length;
    const unattended = machines.filter(
      (m) => m.UnattendedSlots && m.UnattendedSlots > 0
    );

    return {
      name: "Machine Availability",
      status: "pass",
      detail: `${machines.length} machine(s) registered, ${available} available${unattended.length > 0 ? ` (${unattended.length} with Unattended slots)` : ""}`,
    };
  } catch (err: any) {
    return {
      name: "Machine Availability",
      status: "warning",
      detail: `Could not check machines: ${err.message}`,
      remediation: "Verify Orchestrator connectivity and folder permissions.",
    };
  }
}

export async function checkRobotLicense(): Promise<CheckResult> {
  try {
    const robots = await orch.getRobots();
    if (robots.length === 0) {
      return {
        name: "Robot License",
        status: "blocking",
        detail: "No robots found in the target folder",
        remediation: "Ensure at least one Unattended robot is available in the folder. Check Orchestrator > Robots.",
      };
    }

    const unattended = robots.filter(
      (r) => r.Type === "Unattended" || r.Type === "NonProduction"
    );

    if (unattended.length === 0) {
      return {
        name: "Robot License",
        status: "warning",
        detail: `${robots.length} robot(s) found, but none are Unattended type`,
        remediation: "For background automation, at least one Unattended robot is recommended.",
      };
    }

    return {
      name: "Robot License",
      status: "pass",
      detail: `${unattended.length} Unattended robot(s) available out of ${robots.length} total`,
    };
  } catch (err: any) {
    return {
      name: "Robot License",
      status: "warning",
      detail: `Could not check robot licenses: ${err.message}`,
      remediation: "Verify Orchestrator connectivity.",
    };
  }
}

export async function checkFolderPermissions(): Promise<CheckResult> {
  try {
    const config = await getConfig();
    if (!config) {
      return {
        name: "Folder Permissions",
        status: "blocking",
        detail: "UiPath is not configured",
        remediation: "Configure UiPath credentials in Admin > Integrations.",
      };
    }

    const queues = await orch.getQueues();

    return {
      name: "Folder Permissions",
      status: "pass",
      detail: `Read access confirmed (${queues.length} queue(s) visible)`,
    };
  } catch (err: any) {
    if (err.statusCode === 403) {
      return {
        name: "Folder Permissions",
        status: "blocking",
        detail: "Access denied to target folder",
        remediation: "Ensure the External App has access to the target folder in Orchestrator > Folder Settings.",
      };
    }
    return {
      name: "Folder Permissions",
      status: "warning",
      detail: `Could not verify folder permissions: ${err.message}`,
    };
  }
}

export async function checkPackageFeedWritable(): Promise<CheckResult> {
  try {
    const processes = await orch.getProcesses();

    return {
      name: "Package Feed",
      status: "pass",
      detail: `Package feed accessible (${processes.length} process(es) visible)`,
    };
  } catch (err: any) {
    if (err.statusCode === 403) {
      return {
        name: "Package Feed",
        status: "blocking",
        detail: "Cannot access package feed — missing OR.Execution scope",
        remediation: "Add OR.Execution scope to your External App in UiPath Cloud Portal.",
      };
    }
    return {
      name: "Package Feed",
      status: "warning",
      detail: `Could not verify package feed: ${err.message}`,
    };
  }
}

export async function checkActionCenterLicense(): Promise<CheckResult> {
  try {
    const catalogs = await orch.getActionCatalog();
    return {
      name: "Action Center",
      status: "pass",
      detail: `Action Center reachable (${catalogs.length} catalog(s))`,
    };
  } catch (err: any) {
    return {
      name: "Action Center",
      status: "warning",
      detail: "Action Center not available on this tenant",
      remediation: "Action Center requires a specific license. Exception routing will be disabled for this process.",
    };
  }
}

export async function checkTestManagerLicense(): Promise<CheckResult> {
  try {
    const testSets = await orch.getTestSets();
    return {
      name: "Test Manager",
      status: "pass",
      detail: `Test Manager reachable (${testSets.length} test set(s))`,
    };
  } catch {
    try {
      const config = await getConfig();
      if (config) {
        const headers = await getHeaders();
        const base = getBaseUrl(config as any);
        const res = await fetch(`${base}/odata/TestSets?$top=1`, { headers });
        if (res.ok) {
          return {
            name: "Test Manager",
            status: "pass",
            detail: "Test Manager reachable (via Orchestrator OData)",
          };
        }
      }
    } catch { }
    return {
      name: "Test Manager",
      status: "warning",
      detail: "Test Manager not available on this tenant",
      remediation: "Test Manager requires a specific license. Test gate (Stage 9) will be skipped.",
    };
  }
}

export async function checkAll(): Promise<PrerequisiteReport> {
  const results = await Promise.all([
    checkMachineAvailability(),
    checkRobotLicense(),
    checkFolderPermissions(),
    checkPackageFeedWritable(),
    checkActionCenterLicense(),
    checkTestManagerLicense(),
  ]);

  const blockingCount = results.filter((r) => r.status === "blocking").length;
  const warningCount = results.filter((r) => r.status === "warning").length;
  const passCount = results.filter((r) => r.status === "pass").length;

  return {
    results,
    hasBlocking: blockingCount > 0,
    hasWarnings: warningCount > 0,
    blockingCount,
    warningCount,
    passCount,
  };
}

export function generatePrerequisiteReport(report: PrerequisiteReport): string {
  const lines = ["## Pre-deployment Check", ""];

  for (const r of report.results) {
    const icon = r.status === "pass" ? "✓" : r.status === "warning" ? "⚠" : "✗";
    lines.push(`${icon}  ${r.name.padEnd(24)} ${r.detail}`);
    if (r.remediation && r.status !== "pass") {
      lines.push(`   → ${r.remediation}`);
    }
  }

  lines.push("");

  if (report.hasBlocking) {
    lines.push(
      `${report.blockingCount} blocking issue(s). Deployment cannot proceed until resolved.`
    );
  } else if (report.hasWarnings) {
    lines.push(
      `${report.warningCount} warning(s). No blocking issues. Ready to deploy.`
    );
  } else {
    lines.push("All checks passed. Ready to deploy.");
  }

  return lines.join("\n");
}
