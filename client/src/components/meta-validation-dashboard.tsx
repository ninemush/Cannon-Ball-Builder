import { useQuery } from "@tanstack/react-query";
import { Shield, TrendingUp, Zap, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MetricsSummary {
  averageCostUsd: number;
  metaValidationEngagementRate: number;
  averageCorrectionsPerValidation: number;
  correctionRate: number;
  correctionsAppliedTotal: number;
  metaValidationsEngagedTotal: number;
  templateComplianceTrend: number[];
  totalGenerations: number;
}

export function MetaValidationDashboard() {
  const { data: metrics, isLoading } = useQuery<MetricsSummary>({
    queryKey: ["/api/admin/meta-validation/metrics"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-muted-foreground" data-testid="meta-validation-dashboard-loading">
        Loading metrics...
      </div>
    );
  }

  if (!metrics || metrics.totalGenerations === 0) {
    return (
      <div className="p-4" data-testid="meta-validation-dashboard-empty">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">High Confidence Mode Metrics</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          No generation data available yet. Metrics will appear after packages are generated.
        </p>
      </div>
    );
  }

  const engagementPct = (metrics.metaValidationEngagementRate * 100).toFixed(0);
  const avgCost = metrics.averageCostUsd < 0.01
    ? `< $0.01`
    : `$${metrics.averageCostUsd.toFixed(3)}`;
  const avgCorrections = metrics.averageCorrectionsPerValidation.toFixed(1);
  const correctionRateDisplay = metrics.correctionRate.toFixed(1);
  const latestCompliance = metrics.templateComplianceTrend.length > 0
    ? (metrics.templateComplianceTrend[metrics.templateComplianceTrend.length - 1] * 100).toFixed(0)
    : "N/A";

  return (
    <div className="p-4 space-y-4" data-testid="meta-validation-dashboard">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-orange-500" />
        <h3 className="text-sm font-semibold">High Confidence Mode Metrics</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Last 30 days · {metrics.totalGenerations} generations
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="bg-muted/30" data-testid="metric-avg-cost">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] text-muted-foreground font-medium">Avg Cost/Gen</span>
            </div>
            <p className="text-lg font-bold">{avgCost}</p>
          </CardContent>
        </Card>

        <Card className="bg-muted/30" data-testid="metric-engagement-rate">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className="h-3 w-3 text-orange-500" />
              <span className="text-[10px] text-muted-foreground font-medium">Engagement Rate</span>
            </div>
            <p className="text-lg font-bold">{engagementPct}%</p>
          </CardContent>
        </Card>

        <Card className="bg-muted/30" data-testid="metric-avg-corrections">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              <span className="text-[10px] text-muted-foreground font-medium">Avg Corrections</span>
            </div>
            <p className="text-lg font-bold">{avgCorrections}</p>
          </CardContent>
        </Card>

        <Card className="bg-muted/30" data-testid="metric-correction-rate">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3 w-3 text-purple-500" />
              <span className="text-[10px] text-muted-foreground font-medium">Corrections/Run</span>
            </div>
            <p className="text-lg font-bold">{correctionRateDisplay}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              {metrics.correctionsAppliedTotal} applied / {metrics.metaValidationsEngagedTotal} engaged
            </p>
          </CardContent>
        </Card>

        <Card className="bg-muted/30" data-testid="metric-compliance-trend">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3 w-3 text-blue-500" />
              <span className="text-[10px] text-muted-foreground font-medium">Compliance</span>
            </div>
            <p className="text-lg font-bold">{latestCompliance}%</p>
          </CardContent>
        </Card>
      </div>

      {metrics.templateComplianceTrend.length > 1 && (
        <div className="mt-2">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[10px] text-muted-foreground">Template Compliance Trend</span>
          </div>
          <div className="flex items-end gap-0.5 h-8">
            {metrics.templateComplianceTrend.map((val, idx) => (
              <div
                key={idx}
                className="flex-1 bg-blue-500/70 dark:bg-blue-400/60 rounded-t"
                style={{ height: `${Math.max(2, val * 100)}%` }}
                title={`${(val * 100).toFixed(0)}%`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
