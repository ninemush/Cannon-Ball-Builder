import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronUp,
  ChevronDown,
  Wifi,
  WifiOff,
  Bot,
  ClipboardList,
  TrendingUp,
} from "lucide-react";

type HealthData = {
  ok: boolean;
  message: string;
  latencyMs: number;
  tenantName?: string;
  folderName?: string;
  robotCount: number;
  pendingTasks: number;
};

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

  if (!health && !healthError) return null;

  const isOk = health?.ok ?? false;

  const latencyColor =
    (health?.latencyMs ?? 999) < 200
      ? "text-green-400"
      : (health?.latencyMs ?? 999) < 500
        ? "text-amber-400"
        : "text-red-400";

  const lastDecision = liveOps?.lastProvisioningDecision;

  return (
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
  );
}
