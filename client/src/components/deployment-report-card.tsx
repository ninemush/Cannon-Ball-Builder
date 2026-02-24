import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  ChevronDown,
  ChevronRight,
  X,
  Package,
  Server,
  Database,
  Shield,
  FolderOpen,
  Cpu,
  Zap,
  FileText,
  TestTube,
} from "lucide-react";

interface DeploymentResult {
  artifact: string;
  name: string;
  status: string;
  message: string;
  id?: number;
}

interface DeployReport {
  packageId?: string;
  version?: string;
  processName?: string;
  orgName?: string;
  tenantName?: string;
  folderName?: string;
  results: DeploymentResult[];
  summary?: string;
}

const artifactIcon = (artifact: string) => {
  const lower = artifact.toLowerCase();
  if (lower.includes("queue")) return <Database className="h-3.5 w-3.5" />;
  if (lower.includes("asset")) return <Shield className="h-3.5 w-3.5" />;
  if (lower.includes("machine")) return <Cpu className="h-3.5 w-3.5" />;
  if (lower.includes("trigger")) return <Zap className="h-3.5 w-3.5" />;
  if (lower.includes("storage") || lower.includes("bucket")) return <FolderOpen className="h-3.5 w-3.5" />;
  if (lower.includes("environment")) return <Server className="h-3.5 w-3.5" />;
  if (lower.includes("action")) return <FileText className="h-3.5 w-3.5" />;
  if (lower.includes("test")) return <TestTube className="h-3.5 w-3.5" />;
  return <Package className="h-3.5 w-3.5" />;
};

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  created: { icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10", label: "Created" },
  exists: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10", label: "Exists" },
  skipped: { icon: Info, color: "text-slate-400", bg: "bg-slate-500/10", label: "Not Available" },
  failed: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", label: "Failed" },
};

export function DeploymentReportCard({ report, onDismiss }: { report: DeployReport; onDismiss?: (() => void) | undefined }) {
  const infraGroups = ["Infrastructure", "Runtime Check"];

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    const allSkippedGroups = new Set<string>();
    for (const r of report.results) {
      const art = r.artifact || "Other";
      if (r.status === "skipped") allSkippedGroups.add(art);
    }
    for (const r of report.results) {
      const art = r.artifact || "Other";
      if (initial[art] === undefined) {
        initial[art] = infraGroups.includes(art) || allSkippedGroups.has(art) ? false : true;
      }
    }
    return initial;
  });
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});

  const grouped: Record<string, DeploymentResult[]> = {};
  for (const r of report.results) {
    const key = r.artifact || "Other";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({ ...r, name: r.name || "Unknown", artifact: r.artifact || "Other" });
  }

  const counts = {
    created: report.results.filter((r) => r.status === "created").length,
    exists: report.results.filter((r) => r.status === "exists").length,
    skipped: report.results.filter((r) => r.status === "skipped").length,
    failed: report.results.filter((r) => r.status === "failed").length,
  };

  const allSuccess = counts.failed === 0 && counts.skipped === 0;
  const partialSuccess = counts.failed === 0 && counts.skipped > 0;

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleMessage = (key: string) => {
    setExpandedMessages((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const groupLabel = (artifactType: string) => {
    if (artifactType === "Infrastructure" || artifactType === "Runtime Check") return artifactType;
    return artifactType + "s";
  };

  return (
    <div className="mx-2 my-3 rounded-lg border border-border overflow-hidden bg-card/80 backdrop-blur-sm max-w-md" data-testid="deployment-report-card">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-primary/10 to-transparent border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <Package className="h-4 w-4 text-primary shrink-0" />
          <span className="font-semibold text-sm text-foreground">Deployment Report</span>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-2"
            data-testid="button-dismiss-deploy-report"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {report.packageId && (
        <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border/30 flex flex-wrap gap-x-3 gap-y-0.5">
          <span className="font-medium text-foreground">{report.packageId}</span>
          <span>v{report.version}</span>
          {report.processName && (
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {report.processName}
            </span>
          )}
        </div>
      )}

      <div className="px-4 py-2 flex gap-3 border-b border-border/30">
        {counts.created > 0 && (
          <span className="flex items-center gap-1 text-xs text-green-400" data-testid="text-deploy-created-count">
            <CheckCircle2 className="h-3 w-3" />
            {counts.created} created
          </span>
        )}
        {counts.exists > 0 && (
          <span className="flex items-center gap-1 text-xs text-blue-400" data-testid="text-deploy-exists-count">
            <Info className="h-3 w-3" />
            {counts.exists} existing
          </span>
        )}
        {counts.skipped > 0 && (
          <span className="flex items-center gap-1 text-xs text-slate-400" data-testid="text-deploy-skipped-count">
            <Info className="h-3 w-3" />
            {counts.skipped} not available
          </span>
        )}
        {counts.failed > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-400" data-testid="text-deploy-failed-count">
            <XCircle className="h-3 w-3" />
            {counts.failed} failed
          </span>
        )}
      </div>

      <div className="divide-y divide-border/30 max-h-[300px] overflow-y-auto">
        {Object.entries(grouped).map(([artifactType, items]) => {
          const isExpanded = expandedGroups[artifactType] === true;
          const groupCreated = items.filter((i) => i.status === "created").length;
          const groupFailed = items.filter((i) => i.status === "failed").length;
          const groupSkipped = items.filter((i) => i.status === "skipped").length;
          const allOk = groupFailed === 0 && groupSkipped === 0;

          return (
            <div key={artifactType}>
              <button
                onClick={() => toggleGroup(artifactType)}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-accent/30 transition-colors text-left"
                data-testid={`deploy-group-${artifactType.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                <span className="text-muted-foreground shrink-0">{artifactIcon(artifactType)}</span>
                <span className="text-xs font-medium text-foreground">
                  {groupLabel(artifactType)}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1.5">
                  {allOk ? (
                    <CheckCircle2 className="h-3 w-3 text-green-400" />
                  ) : (
                    <>
                      {groupFailed > 0 && (
                        <span className="text-red-400">{groupFailed} failed</span>
                      )}
                      {groupSkipped > 0 && (
                        <span className="text-slate-400">{groupSkipped} n/a</span>
                      )}
                    </>
                  )}
                  <span>{items.length}</span>
                </span>
              </button>
              {isExpanded && (
                <div className="px-4 pb-2 space-y-0.5">
                  {items.map((item, idx) => {
                    const cfg = statusConfig[item.status] || statusConfig.failed;
                    const StatusIcon = cfg.icon;
                    const itemKey = `${artifactType}-${idx}`;
                    const msgExpanded = expandedMessages[itemKey];
                    const hasDetailMessage = item.message && item.message.length > 60;
                    const showExpandable = hasDetailMessage && item.status !== "created";
                    const showMessage = item.status === "failed" || item.status === "skipped" || (item.status === "exists" && item.message && item.message.includes("polling"));

                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 px-3 py-1.5 rounded-md ${cfg.bg} cursor-pointer`}
                        onClick={() => showExpandable && toggleMessage(itemKey)}
                        data-testid={`deploy-item-${(item.name || "unknown").toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <StatusIcon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${cfg.color}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground truncate">{item.name || "Unknown"}</span>
                            <span className={`text-[10px] shrink-0 ${cfg.color}`}>{cfg.label}</span>
                          </div>
                          {showMessage ? (
                            <p className={`text-[10px] text-muted-foreground leading-tight mt-0.5 ${!msgExpanded && showExpandable ? "line-clamp-1" : ""}`}>
                              {item.message}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={`px-4 py-2 text-xs border-t border-border/50 ${allSuccess ? "text-green-400" : partialSuccess ? "text-green-400" : "text-muted-foreground"}`}>
        {allSuccess ? (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            All artifacts provisioned successfully
          </span>
        ) : partialSuccess ? (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Core artifacts provisioned successfully. {counts.skipped} service{counts.skipped > 1 ? "s" : ""} not available on tenant.
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            {counts.failed} failed{counts.skipped > 0 ? `, ${counts.skipped} not available` : ""} — expand groups for details
          </span>
        )}
      </div>
    </div>
  );
}
