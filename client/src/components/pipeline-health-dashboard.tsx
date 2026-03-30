import { useQuery } from "@tanstack/react-query";
import { Activity, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, Target, Timer, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ConvergenceReport {
  totalRuns: number;
  recentRuns: number;
  averageQgRunCount: number;
  postComplianceDefectRate: number;
  complianceIdempotencyRate: number;
  averageCascadeAmplification: number;
  averageStubRatio: number;
  zeroStubRunCount: number;
  averageDhgAccuracy: number;
  convergenceReady: boolean;
  consecutiveCleanRuns: number;
  studioLoadabilityRate: number;
  averageTransitiveDependencyIssues: number;
  trend: {
    stubRatios: number[];
    dhgAccuracyScores: number[];
    qgRunCounts: number[];
    cascadeRatios: number[];
  };
}

function MiniTrendBar({ values, label }: { values: number[]; label: string }) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 0.01);
  return (
    <div className="mt-2" data-testid={`trend-${label}`}>
      <div className="text-[9px] text-muted-foreground mb-1">Trend ({values.length} periods)</div>
      <div className="flex items-end gap-px h-6">
        {values.map((v, i) => (
          <div
            key={i}
            className="bg-primary/60 rounded-sm flex-1 min-w-[3px]"
            style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
            title={`${v.toFixed(3)}`}
          />
        ))}
      </div>
    </div>
  );
}

export function PipelineHealthDashboard() {
  const { data: report, isLoading } = useQuery<ConvergenceReport>({
    queryKey: ["/api/admin/pipeline-health/convergence"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-muted-foreground" data-testid="pipeline-health-loading">
        Loading pipeline health metrics...
      </div>
    );
  }

  if (!report || report.recentRuns === 0) {
    return (
      <div className="p-4" data-testid="pipeline-health-empty">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Pipeline Health</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          No pipeline health data available yet. Metrics will appear after packages are generated.
        </p>
      </div>
    );
  }

  const convergenceProgress = Math.min(report.consecutiveCleanRuns, 20);
  const convergencePercent = (convergenceProgress / 20) * 100;

  return (
    <div className="p-4 space-y-4" data-testid="pipeline-health-dashboard">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-blue-500" />
        <h3 className="text-sm font-semibold">Pipeline Health &amp; Convergence</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Last 30 days · {report.recentRuns} runs ({report.totalRuns} total)
        </span>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-md bg-muted/30 border" data-testid="convergence-status">
        {report.convergenceReady ? (
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
        ) : (
          <Target className="h-5 w-5 text-amber-500 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium">
            {report.convergenceReady
              ? "Pipeline Converged"
              : `Convergence Progress: ${report.consecutiveCleanRuns}/20 consecutive clean runs`}
          </div>
          <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${report.convergenceReady ? "bg-green-500" : "bg-amber-500"}`}
              style={{ width: `${convergencePercent}%` }}
            />
          </div>
        </div>
        <Badge variant={report.convergenceReady ? "default" : "secondary"} className="text-[10px] shrink-0" data-testid="badge-convergence">
          {report.convergenceReady ? "Ready" : "In Progress"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-muted/30" data-testid="metric-stub-ratio">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Package className="h-3 w-3 text-orange-500" />
              <span className="text-[10px] text-muted-foreground font-medium">Avg Stub Ratio</span>
            </div>
            <p className="text-lg font-bold">{(report.averageStubRatio * 100).toFixed(1)}%</p>
            <div className="text-[10px] text-muted-foreground">{report.zeroStubRunCount} zero-stub runs</div>
            <MiniTrendBar values={report.trend.stubRatios} label="stub-ratio" />
          </CardContent>
        </Card>

        <Card className="bg-muted/30" data-testid="metric-dhg-accuracy">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-[10px] text-muted-foreground font-medium">DHG Accuracy</span>
            </div>
            <p className="text-lg font-bold">{(report.averageDhgAccuracy * 100).toFixed(0)}%</p>
            <MiniTrendBar values={report.trend.dhgAccuracyScores} label="dhg-accuracy" />
          </CardContent>
        </Card>

        <Card className="bg-muted/30" data-testid="metric-cascade">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              {report.averageCascadeAmplification > 1.2 ? (
                <TrendingDown className="h-3 w-3 text-red-500" />
              ) : (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              )}
              <span className="text-[10px] text-muted-foreground font-medium">Cascade Amp.</span>
            </div>
            <p className="text-lg font-bold">{report.averageCascadeAmplification.toFixed(2)}x</p>
            <MiniTrendBar values={report.trend.cascadeRatios} label="cascade" />
          </CardContent>
        </Card>

        <Card className="bg-muted/30" data-testid="metric-qg-runs">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Timer className="h-3 w-3 text-blue-500" />
              <span className="text-[10px] text-muted-foreground font-medium">Avg QG Runs</span>
            </div>
            <p className="text-lg font-bold">{report.averageQgRunCount.toFixed(1)}</p>
            <MiniTrendBar values={report.trend.qgRunCounts} label="qg-runs" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-muted/30" data-testid="metric-idempotency">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] text-muted-foreground font-medium">Compliance Idempotency</span>
            </div>
            <p className="text-lg font-bold">{report.complianceIdempotencyRate.toFixed(0)}%</p>
          </CardContent>
        </Card>

        <Card className="bg-muted/30" data-testid="metric-defect-rate">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              <span className="text-[10px] text-muted-foreground font-medium">Post-Compliance Defects</span>
            </div>
            <p className="text-lg font-bold">{report.postComplianceDefectRate.toFixed(2)}</p>
            <div className="text-[10px] text-muted-foreground">avg per run</div>
          </CardContent>
        </Card>

        <Card className="bg-muted/30" data-testid="metric-studio-loadability">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="h-3 w-3 text-purple-500" />
              <span className="text-[10px] text-muted-foreground font-medium">Studio Loadability</span>
            </div>
            <p className="text-lg font-bold">{report.studioLoadabilityRate.toFixed(0)}%</p>
          </CardContent>
        </Card>

        <Card className="bg-muted/30" data-testid="metric-transitive-deps">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] text-muted-foreground font-medium">Transitive Dep Issues</span>
            </div>
            <p className="text-lg font-bold">{report.averageTransitiveDependencyIssues.toFixed(1)}</p>
            <div className="text-[10px] text-muted-foreground">avg per run</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
