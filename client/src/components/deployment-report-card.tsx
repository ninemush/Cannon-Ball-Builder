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
  failed: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", label: "Failed" },
};

export function DeploymentReportCard({ report, onDismiss }: { report: DeployReport; onDismiss: () => void }) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const grouped: Record<string, DeploymentResult[]> = {};
  for (const r of report.results) {
    const key = r.artifact;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  const counts = {
    created: report.results.filter((r) => r.status === "created").length,
    exists: report.results.filter((r) => r.status === "exists").length,
    failed: report.results.filter((r) => r.status === "failed").length,
  };

  const allSuccess = counts.failed === 0;

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="mx-2 my-3 rounded-lg border border-border overflow-hidden bg-card/80 backdrop-blur-sm" data-testid="deployment-report-card">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary/10 to-transparent border-b border-border/50">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm text-foreground">Deployment Report</span>
          {report.packageId && (
            <span className="text-xs text-muted-foreground">
              {report.packageId} v{report.version}
            </span>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-dismiss-deploy-report"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {(report.orgName || report.processName) && (
        <div className="px-4 py-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground border-b border-border/30">
          {report.orgName && (
            <span>
              <Server className="h-3 w-3 inline mr-1" />
              {report.orgName}/{report.tenantName}
            </span>
          )}
          {report.folderName && (
            <span>
              <FolderOpen className="h-3 w-3 inline mr-1" />
              {report.folderName}
            </span>
          )}
          {report.processName && (
            <span>
              <Zap className="h-3 w-3 inline mr-1" />
              {report.processName}
            </span>
          )}
        </div>
      )}

      <div className="px-4 py-2 flex gap-3 border-b border-border/30">
        {counts.created > 0 && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            {counts.created} created
          </span>
        )}
        {counts.exists > 0 && (
          <span className="flex items-center gap-1 text-xs text-blue-400">
            <Info className="h-3 w-3" />
            {counts.exists} existing
          </span>
        )}
        {counts.failed > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <XCircle className="h-3 w-3" />
            {counts.failed} failed
          </span>
        )}
      </div>

      <div className="divide-y divide-border/30">
        {Object.entries(grouped).map(([artifactType, items]) => {
          const isExpanded = expandedGroups[artifactType] !== false;
          const groupCreated = items.filter((i) => i.status === "created").length;
          const groupIssues = items.filter((i) => i.status === "failed").length;

          return (
            <div key={artifactType}>
              <button
                onClick={() => toggleGroup(artifactType)}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-accent/30 transition-colors text-left"
                data-testid={`deploy-group-${artifactType.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="text-muted-foreground shrink-0">{artifactIcon(artifactType)}</span>
                <span className="text-xs font-medium text-foreground">
                  {artifactType}s
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {items.length} item{items.length > 1 ? "s" : ""}
                  {groupCreated > 0 && <span className="text-green-400 ml-1.5">{groupCreated} new</span>}
                  {groupIssues > 0 && <span className="text-amber-400 ml-1.5">{groupIssues} need attention</span>}
                </span>
              </button>
              {isExpanded && (
                <div className="px-4 pb-2 space-y-1">
                  {items.map((item, idx) => {
                    const cfg = statusConfig[item.status] || statusConfig.failed;
                    const StatusIcon = cfg.icon;
                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 px-3 py-1.5 rounded-md ${cfg.bg}`}
                        data-testid={`deploy-item-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <StatusIcon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${cfg.color}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground truncate">{item.name}</span>
                            <span className={`text-[10px] ${cfg.color}`}>{cfg.label}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{item.message}</p>
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

      <div className={`px-4 py-2 text-xs border-t border-border/50 ${allSuccess ? "text-green-400" : "text-muted-foreground"}`}>
        {allSuccess ? (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            All artifacts provisioned successfully
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            {counts.failed} item{counts.failed > 1 ? "s" : ""} failed — check details above
          </span>
        )}
      </div>
    </div>
  );
}
