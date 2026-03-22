import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Wifi,
  WifiOff,
  Bot,
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Lock,
  ServerOff,
  ShieldAlert,
  Eye,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type HealthData = {
  ok: boolean;
  message: string;
  latencyMs: number;
  tenantName?: string;
  folderName?: string;
  robotCount: number;
  pendingTasks: number;
};

type RemediationGuidance = {
  reason: string;
  actionOwner: string;
  recommendedStep: string;
  technicalEvidence?: string;
};

type ServiceStatusDetail = {
  status: "available" | "limited" | "unavailable" | "unknown";
  confidence: "official" | "inferred" | "deprecated" | "unknown";
  evidence: string;
  reachable: "reachable" | "limited" | "unreachable" | "unknown";
  truthfulStatus?: string;
  displayLabel?: string;
  category?: string;
  parentService?: string;
  displayName?: string;
  remediation?: RemediationGuidance;
};

type DiagnosticsData = {
  configured: boolean;
  connected?: boolean;
  serviceDetails?: Record<string, ServiceStatusDetail>;
};

const truthfulStatusIcon = (detail: ServiceStatusDetail) => {
  const ts = detail.truthfulStatus || detail.status;
  switch (ts) {
    case "available":
      return (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
      );
    case "auth_scope":
      return <Lock className="h-3 w-3 text-amber-400 shrink-0" />;
    case "not_provisioned":
      return <ServerOff className="h-3 w-3 text-gray-400 shrink-0" />;
    case "endpoint_failure":
      return <XCircle className="h-3 w-3 text-red-400 shrink-0" />;
    case "unsupported_external_api":
      return <ShieldAlert className="h-3 w-3 text-gray-500 shrink-0" />;
    case "internal_probe_error":
      return <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />;
    case "limited":
      return <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />;
    case "unavailable":
      return <XCircle className="h-3 w-3 text-red-400 shrink-0" />;
    default:
      return <HelpCircle className="h-3 w-3 text-gray-400 shrink-0" />;
  }
};

const truthfulStatusColor = (detail: ServiceStatusDetail) => {
  const ts = detail.truthfulStatus || detail.status;
  switch (ts) {
    case "available": return "text-green-400";
    case "auth_scope": return "text-amber-400";
    case "not_provisioned": return "text-gray-400";
    case "endpoint_failure": return "text-red-400";
    case "unsupported_external_api": return "text-gray-500";
    case "internal_probe_error": return "text-red-400";
    case "limited": return "text-amber-400";
    case "unavailable": return "text-red-400";
    default: return "text-gray-400";
  }
};

const ACTION_OWNER_LABELS: Record<string, string> = {
  "uipath-admin": "UiPath Admin",
  "cannonball": "CannonBall",
  "user-config": "Your Configuration",
  "not-actionable": "Not Actionable",
};

function RemediationDetail({ remediation }: { remediation: RemediationGuidance }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        data-testid="button-remediation-toggle"
      >
        <ChevronRight className={`h-2.5 w-2.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
        <span>How to enable</span>
      </button>
      {expanded && (
        <div className="mt-1 ml-3 text-[10px] space-y-0.5 text-muted-foreground border-l border-border/50 pl-2">
          <p>{remediation.reason}</p>
          <p className="text-foreground/80">{remediation.recommendedStep}</p>
          <p className="text-[9px]">
            Action: <span className="font-medium">{ACTION_OWNER_LABELS[remediation.actionOwner] || remediation.actionOwner}</span>
          </p>
          {remediation.technicalEvidence && (
            <p className="text-[9px] font-mono opacity-60">{remediation.technicalEvidence}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ServiceEntry({ flagKey, detail, indented, parentDetail }: { flagKey: string; detail: ServiceStatusDetail; indented?: boolean; parentDetail?: ServiceStatusDetail }) {
  const name = detail.displayName || flagKey;
  const label = detail.displayLabel || detail.status;
  const showRemediation = detail.truthfulStatus && detail.truthfulStatus !== "available" && detail.remediation;
  const parentAvailableChildNot = indented && parentDetail
    && (parentDetail.truthfulStatus === "available" || parentDetail.status === "available")
    && detail.truthfulStatus !== "available" && detail.status !== "available";

  return (
    <div className={`${indented ? "ml-4" : ""}`} data-testid={`service-status-${flagKey}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 text-[11px] cursor-default py-0.5">
            {truthfulStatusIcon(detail)}
            <span className={truthfulStatusColor(detail)}>
              {name}
            </span>
            {detail.truthfulStatus && detail.truthfulStatus !== "available" && detail.truthfulStatus !== detail.status && (
              <span className="text-[9px] text-muted-foreground ml-1">({label})</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <p>
            <span className="font-medium">{label}</span>
            {detail.evidence && <span> — {detail.evidence}</span>}
          </p>
          {parentAvailableChildNot && (
            <p className="mt-1 text-amber-400/80">
              Parent service ({parentDetail?.displayName}) is available but this capability requires additional configuration or scopes.
            </p>
          )}
          {detail.remediation && (
            <p className="mt-1 text-muted-foreground">{detail.remediation.reason}</p>
          )}
        </TooltipContent>
      </Tooltip>
      {showRemediation && detail.remediation && (
        <RemediationDetail remediation={detail.remediation} />
      )}
    </div>
  );
}

export function IntegrationStatusBar() {
  const [collapsed, setCollapsed] = useState(false);

  const { data: health, error: healthError } = useQuery<HealthData>({
    queryKey: ["/api/uipath/health"],
    refetchInterval: 60000,
    staleTime: 50000,
    retry: 1,
  });

  const { data: liveOps } = useQuery<{
    connected: boolean;
    lastProvisioningDecision?: {
      decision: string;
      robotsDelta: number;
      reasoning: string;
      executedAt: string;
    } | null;
  }>({
    queryKey: ["/api/uipath/live-ops"],
    refetchInterval: 60000,
    staleTime: 50000,
    retry: 1,
    enabled: !!health?.ok,
  });

  const { data: diagnostics } = useQuery<DiagnosticsData>({
    queryKey: ["/api/uipath/diagnostics"],
    refetchInterval: 120000,
    staleTime: 100000,
    retry: 1,
    enabled: !!health?.ok,
  });

  if (!health && !healthError) return null;

  const isOk = health?.ok ?? false;

  const latencyColor =
    (health?.latencyMs ?? 999) < 200
      ? "text-green-400"
      : (health?.latencyMs ?? 999) < 500
        ? "text-amber-400"
        : "text-red-400";

  const lastDecision = liveOps?.lastProvisioningDecision;

  const serviceDetails = diagnostics?.serviceDetails;

  const entries = serviceDetails ? Object.entries(serviceDetails) : [];
  const services = entries.filter(([, d]) => d.category === "service");
  const capabilities = entries.filter(([, d]) => d.category === "capability");
  const observations = entries.filter(([, d]) => d.category === "observation");
  const infrastructure = entries.filter(([, d]) => d.category === "infrastructure");
  const uncategorized = entries.filter(([, d]) => !d.category);

  const allCategorized = [...services, ...capabilities, ...observations, ...infrastructure, ...uncategorized];

  const availableCount = allCategorized.filter(([, d]) =>
    d.truthfulStatus === "available" || (!d.truthfulStatus && d.status === "available")
  ).length;
  const unavailableCount = allCategorized.filter(([, d]) => {
    const ts = d.truthfulStatus || d.status;
    return ts !== "available" && ts !== "unknown" && ts !== "limited";
  }).length;
  const unknownCount = allCategorized.filter(([, d]) =>
    (d.truthfulStatus || d.status) === "unknown"
  ).length;
  const totalServices = entries.length;

  const getChildCapabilities = (parentKey: string) =>
    capabilities.filter(([, d]) => d.parentService === parentKey);

  const parentedCapabilityKeys = new Set(
    services.flatMap(([key]) => getChildCapabilities(key).map(([k]) => k))
  );
  const orphanCapabilities = capabilities.filter(([k]) => !parentedCapabilityKeys.has(k));

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="border-t border-border bg-card/80 backdrop-blur-sm shrink-0"
        data-testid="integration-status-bar"
      >
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          aria-controls="status-bar-details"
          className="flex items-center justify-between w-full px-4 py-1.5 hover:bg-accent/30 transition-colors"
          data-testid="button-toggle-status-bar"
        >
          <div className="flex items-center gap-3 text-xs">
            {healthError ? (
              <span className="flex items-center gap-1.5 text-muted-foreground" data-testid="status-unavailable">
                <WifiOff className="h-3 w-3" />
                UiPath status unavailable
              </span>
            ) : isOk ? (
              <span className="flex items-center gap-1.5 text-green-400" data-testid="status-connected">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                Connected to {health?.tenantName || "Orchestrator"}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-red-400" data-testid="status-disconnected">
                <WifiOff className="h-3 w-3" />
                Disconnected
              </span>
            )}

            {isOk && health && (
              <>
                <span className="text-border">|</span>
                <span className="flex items-center gap-1 text-muted-foreground" data-testid="status-robots">
                  <Bot className="h-3 w-3" />
                  {health.robotCount} robot{health.robotCount !== 1 ? "s" : ""}
                </span>

                {health.pendingTasks > 0 && (
                  <>
                    <span className="text-border">|</span>
                    <span className="flex items-center gap-1 text-amber-400" data-testid="status-pending-tasks">
                      <ClipboardList className="h-3 w-3" />
                      {health.pendingTasks} task{health.pendingTasks !== 1 ? "s" : ""} pending
                    </span>
                  </>
                )}

                <span className="text-border">|</span>
                <span className={`flex items-center gap-1 ${latencyColor}`} data-testid="status-latency">
                  <Wifi className="h-3 w-3" />
                  {health.latencyMs}ms
                </span>

                {totalServices > 0 && (
                  <>
                    <span className="text-border">|</span>
                    <span className="flex items-center gap-1.5" data-testid="status-services-summary">
                      <span className="text-green-400">{availableCount} available</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-red-400">{unavailableCount} unavailable</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-gray-400">{unknownCount} unknown</span>
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            {collapsed ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </div>
        </button>

        <div id="status-bar-details">
          {!collapsed && isOk && serviceDetails && (
            <div className="px-4 pb-2 pt-1 border-t border-border/50">
              {services.length > 0 && (
                <div className="mb-2" data-testid="service-section-services">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Services</div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-0">
                    {services.map(([key, detail]) => {
                      const children = getChildCapabilities(key);
                      return (
                        <div key={key}>
                          <ServiceEntry flagKey={key} detail={detail} />
                          {children.map(([childKey, childDetail]) => (
                            <ServiceEntry key={childKey} flagKey={childKey} detail={childDetail} indented parentDetail={detail} />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {orphanCapabilities.length > 0 && (
                <div className="mb-2" data-testid="service-section-capabilities">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Capabilities</div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-0">
                    {orphanCapabilities.map(([key, detail]) => (
                      <ServiceEntry key={key} flagKey={key} detail={detail} />
                    ))}
                  </div>
                </div>
              )}

              {infrastructure.length > 0 && (
                <div className="mb-2" data-testid="service-section-infrastructure">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Infrastructure</div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-0">
                    {infrastructure.map(([key, detail]) => (
                      <ServiceEntry key={key} flagKey={key} detail={detail} />
                    ))}
                  </div>
                </div>
              )}

              {observations.length > 0 && (
                <div className="mb-1" data-testid="service-section-observations">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Eye className="h-2.5 w-2.5" />
                    Environment
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0">
                    {observations.map(([key, detail]) => (
                      <div key={key} className="flex items-center gap-1.5 text-[11px] py-0.5" data-testid={`service-status-${key}`}>
                        {truthfulStatusIcon(detail)}
                        <span className={truthfulStatusColor(detail)}>
                          {detail.displayName || key}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {uncategorized.length > 0 && (
                <div className="grid grid-cols-3 gap-x-4 gap-y-0" data-testid="service-details-grid">
                  {uncategorized.map(([key, detail]) => (
                    <ServiceEntry key={key} flagKey={key} detail={detail} />
                  ))}
                </div>
              )}
            </div>
          )}

          {!collapsed && isOk && lastDecision && (
            <div className="px-4 pb-2 pt-0.5 border-t border-border/50">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground" data-testid="status-last-decision">
                <TrendingUp className="h-3 w-3 text-[#008b9b]" />
                <span>
                  Last provisioning: <span className="text-foreground font-medium">{lastDecision.decision}</span>
                  {lastDecision.robotsDelta !== 0 && (
                    <span className={lastDecision.robotsDelta > 0 ? "text-green-400" : "text-amber-400"}>
                      {" "}({lastDecision.robotsDelta > 0 ? "+" : ""}{lastDecision.robotsDelta} robot{Math.abs(lastDecision.robotsDelta) !== 1 ? "s" : ""})
                    </span>
                  )}
                  {" "}&mdash; {lastDecision.reasoning.slice(0, 80)}
                  {lastDecision.reasoning.length > 80 ? "..." : ""}
                </span>
              </div>
            </div>
          )}

          {!collapsed && !isOk && health && (
            <div className="px-4 pb-2 pt-0.5 border-t border-border/50">
              <p className="text-[11px] text-red-400" data-testid="status-error-detail">
                {health.message}
              </p>
            </div>
          )}

          {!collapsed && healthError && (
            <div className="px-4 pb-2 pt-0.5 border-t border-border/50">
              <p className="text-[11px] text-muted-foreground" data-testid="status-error-detail">
                Could not reach UiPath health endpoint. Check server logs for details.
              </p>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
