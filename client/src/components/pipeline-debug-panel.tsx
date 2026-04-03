import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bug, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Clock, AlertTriangle, Wrench, Shield, FileText, Code,
  Timer, Radio, Activity, Search,
} from "lucide-react";

interface RunSummary {
  runId: string;
  ideaId: string;
  ideaTitle: string;
  status: string;
  generationMode: string;
  currentPhase: string | null;
  triggeredBy: string;
  warningCount: number;
  remediationCount: number;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface RunListResponse {
  runs: RunSummary[];
  total: number;
  offset: number;
  limit: number;
}

interface RunDetail {
  run: {
    runId: string;
    ideaId: string;
    ideaTitle: string;
    status: string;
    generationMode: string;
    currentPhase: string | null;
    triggeredBy: string;
    errorMessage: string | null;
    phaseProgress: any[] | null;
    outcomeReport: any | null;
    stageLog: any | null;
    dhgContent: string | null;
    durationMs: number | null;
    isActive: boolean;
    createdAt: string;
    completedAt: string | null;
  };
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString();
}

const TERMINAL_STATUSES = ["completed", "completed_with_warnings", "failed", "blocked"];

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "default";
  if (status === "completed_with_warnings") return "secondary";
  if (status === "failed" || status === "blocked") return "destructive";
  if (!TERMINAL_STATUSES.includes(status)) return "outline";
  return "secondary";
}

function isActiveStatus(status: string): boolean {
  return !TERMINAL_STATUSES.includes(status);
}

function RunHistoryTable({ onSelectRun }: { onSelectRun: (runId: string, ideaId: string) => void }) {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const pageSize = 15;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const queryParams = new URLSearchParams();
  queryParams.set("offset", String(page * pageSize));
  queryParams.set("limit", String(pageSize));
  if (statusFilter && statusFilter !== "all") queryParams.set("status", statusFilter);
  if (debouncedSearch) queryParams.set("search", debouncedSearch);

  const { data, isLoading, error } = useQuery<RunListResponse>({
    queryKey: ["/api/admin/debug/runs", page, statusFilter, debouncedSearch],
    queryFn: async () => {
      const res = await fetch(`/api/admin/debug/runs?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch runs");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  if (error) {
    return (
      <div className="text-center py-8 text-destructive text-sm" data-testid="text-run-error">
        Failed to load runs: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="debug-run-history">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by idea or run ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-[250px]"
            data-testid="input-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="completed_with_warnings">With Warnings</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto" data-testid="text-run-count">
          {data ? `${data.total} run(s)` : "Loading..."}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !data || data.runs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-no-runs">
          No generation runs found.
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead>Idea</TableHead>
                  <TableHead className="w-[130px]">Mode</TableHead>
                  <TableHead className="w-[90px] text-center">Warnings</TableHead>
                  <TableHead className="w-[110px] text-center">Remediations</TableHead>
                  <TableHead className="w-[100px]">Duration</TableHead>
                  <TableHead className="w-[170px]">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.runs.map((run) => (
                  <TableRow
                    key={run.runId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onSelectRun(run.runId, run.ideaId)}
                    data-testid={`row-run-${run.runId}`}
                  >
                    <TableCell>
                      <Badge variant={statusVariant(run.status)} className="text-[10px]" data-testid={`badge-status-${run.runId}`}>
                        {isActiveStatus(run.status) && <Radio className="h-3 w-3 mr-1 animate-pulse" />}
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs" title={run.ideaTitle} data-testid={`text-idea-${run.runId}`}>
                      {run.ideaTitle}
                    </TableCell>
                    <TableCell className="text-xs" data-testid={`text-mode-${run.runId}`}>
                      {run.generationMode || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {run.warningCount > 0 ? (
                        <Badge variant="secondary" className="text-[10px]" data-testid={`badge-warnings-${run.runId}`}>
                          <AlertTriangle className="h-3 w-3 mr-1" />{run.warningCount}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {run.remediationCount > 0 ? (
                        <Badge variant="secondary" className="text-[10px]" data-testid={`badge-remediations-${run.runId}`}>
                          <Wrench className="h-3 w-3 mr-1" />{run.remediationCount}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs" data-testid={`text-duration-${run.runId}`}>
                      <Clock className="h-3 w-3 inline mr-1 text-muted-foreground" />
                      {formatDuration(run.durationMs)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground" data-testid={`text-created-${run.runId}`}>
                      {formatTimestamp(run.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <span className="text-xs text-muted-foreground" data-testid="text-page-info">
              Page {page + 1} of {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              data-testid="button-next-page"
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function CollapsibleSection({ title, icon, children, defaultOpen = false, badge, testId }: {
  title: string;
  icon: JSX.Element;
  children: JSX.Element | JSX.Element[] | string | null;
  defaultOpen?: boolean;
  badge?: JSX.Element | false | null;
  testId: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid={testId}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-md hover:bg-muted/50 text-left" data-testid={`trigger-${testId}`}>
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronUp className="h-4 w-4 shrink-0 rotate-180" />}
        {icon}
        <span className="text-sm font-medium flex-1">{title}</span>
        {badge}
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-9 pr-3 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function StageTimeline({ stageLog }: { stageLog: any }) {
  if (!stageLog) return <p className="text-xs text-muted-foreground">No stage log data available.</p>;

  const stages = Array.isArray(stageLog) ? stageLog : stageLog.stages || [];
  if (stages.length === 0) return <p className="text-xs text-muted-foreground">No stages recorded.</p>;

  return (
    <div className="space-y-1">
      {stages.map((stage: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-border/50 last:border-0" data-testid={`stage-entry-${i}`}>
          <Badge
            variant={stage.outcome === "succeeded" ? "default" : stage.outcome === "failed" ? "destructive" : "secondary"}
            className="text-[9px] w-[70px] justify-center"
          >
            {stage.outcome || stage.type || "unknown"}
          </Badge>
          <span className="font-mono text-[11px] flex-1 truncate">{stage.stage || stage.name || `Stage ${i + 1}`}</span>
          {stage.durationMs != null && (
            <span className="text-muted-foreground shrink-0">
              <Timer className="h-3 w-3 inline mr-0.5" />{formatDuration(stage.durationMs)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function QualityWarnings({ warnings }: { warnings: any[] }) {
  if (!warnings || warnings.length === 0) return <p className="text-xs text-muted-foreground">No quality warnings.</p>;

  const grouped: Record<string, any[]> = {};
  for (const w of warnings) {
    const cat = w.category || w.check || "uncategorized";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(w);
  }

  return (
    <div className="space-y-2">
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} data-testid={`warning-group-${cat}`}>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-[10px]">{cat}</Badge>
            <span className="text-[10px] text-muted-foreground">{items.length} warning(s)</span>
          </div>
          <div className="pl-3 space-y-0.5">
            {items.map((w, i) => (
              <div key={i} className="text-[11px] text-muted-foreground">
                {w.message || w.detail || w.check || JSON.stringify(w)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RemediationsList({ remediations }: { remediations: any[] }) {
  if (!remediations || remediations.length === 0) return <p className="text-xs text-muted-foreground">No remediations.</p>;

  return (
    <div className="space-y-1.5">
      {remediations.map((r, i) => (
        <div key={i} className="text-xs border-b border-border/50 pb-1.5 last:border-0" data-testid={`remediation-${i}`}>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px]">{r.level || "unknown"}</Badge>
            {r.remediationCode && <code className="text-[10px] text-muted-foreground">{r.remediationCode}</code>}
          </div>
          {r.file && <div className="text-[11px] mt-0.5 font-mono">{r.file}</div>}
          {r.reason && <div className="text-[11px] mt-0.5 text-muted-foreground">{r.reason}</div>}
        </div>
      ))}
    </div>
  );
}

function AutoRepairsList({ repairs }: { repairs: any[] }) {
  if (!repairs || repairs.length === 0) return <p className="text-xs text-muted-foreground">No auto-repairs.</p>;

  return (
    <div className="space-y-1">
      {repairs.map((r, i) => (
        <div key={i} className="text-xs border-b border-border/50 pb-1 last:border-0" data-testid={`repair-${i}`}>
          <span className="font-mono">{r.file || r.name || `Repair ${i + 1}`}</span>
          {r.reason && <span className="text-muted-foreground ml-2">— {r.reason}</span>}
        </div>
      ))}
    </div>
  );
}

function LiveProgressView({ ideaId, runId }: { ideaId: string; runId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = `/api/ideas/${ideaId}/uipath-runs/${runId}/stream?replay=true`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => setConnected(true);

    eventSource.onmessage = (e) => {
      try {
        const raw = JSON.parse(e.data);
        if (raw.heartbeat) return;
        if (raw.done) {
          setEvents(prev => [...prev, { type: "done", message: `Done: ${raw.status || "completed"}`, stage: "done" }]);
          eventSource.close();
          setConnected(false);
          return;
        }
        const event = raw.pipelineEvent || raw;
        const normalized = {
          type: event.type || "info",
          message: event.message || event.stage || "—",
          stage: event.stage || null,
          elapsed: event.elapsed ?? null,
        };
        setEvents(prev => [...prev, normalized]);
      } catch {}
    };

    eventSource.onerror = () => {
      setConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setConnected(false);
    };
  }, [ideaId, runId]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  return (
    <div data-testid="live-progress">
      <div className="flex items-center gap-2 mb-2">
        <Activity className={`h-4 w-4 ${connected ? "text-green-500 animate-pulse" : "text-muted-foreground"}`} />
        <span className="text-sm font-medium">Live Progress</span>
        <Badge variant={connected ? "outline" : "secondary"} className="text-[10px]">
          {connected ? "Connected" : "Disconnected"} · {events.length} event(s)
        </Badge>
      </div>
      <ScrollArea className="h-[200px] border rounded-md p-2">
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">Waiting for events...</p>
        ) : (
          <div className="space-y-1">
            {events.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]" data-testid={`live-event-${i}`}>
                <Badge
                  variant={e.type === "completed" ? "default" : e.type === "failed" ? "destructive" : e.type === "warning" ? "secondary" : "outline"}
                  className="text-[9px] w-[65px] justify-center shrink-0"
                >
                  {e.type}
                </Badge>
                <span className="truncate flex-1">{e.message || e.stage || "—"}</span>
                {e.elapsed != null && <span className="text-muted-foreground shrink-0">{e.elapsed}s</span>}
              </div>
            ))}
            <div ref={scrollEndRef} />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function RunDetailView({ runId, onBack }: { runId: string; onBack: () => void }) {
  const { data, isLoading, error } = useQuery<RunDetail>({
    queryKey: ["/api/admin/debug/runs", runId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/debug/runs/${runId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch run detail");
      return res.json();
    },
    refetchInterval: (query) => query.state.data?.run?.isActive ? 5000 : false,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-error">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="text-center py-8 text-destructive text-sm" data-testid="text-detail-error">
          Failed to load run details: {(error as Error).message}
        </div>
      </div>
    );
  }

  if (!data) return <p className="text-sm text-muted-foreground">Run not found.</p>;

  const { run } = data;
  const outcome = run.outcomeReport;
  const pipelineOutcome = outcome?.pipelineOutcome || outcome;
  const qualityWarnings = pipelineOutcome?.qualityWarnings || [];
  const remediations = pipelineOutcome?.remediations || [];
  const autoRepairs = pipelineOutcome?.autoRepairs || [];
  const degradations = outcome?.degradations || [];
  const emissionGateViolations = pipelineOutcome?.emissionGateViolations || outcome?.emissionGateViolations || [];

  return (
    <div className="space-y-4" data-testid="debug-run-detail">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate" data-testid="text-detail-title">{run.ideaTitle}</h3>
          <p className="text-[10px] text-muted-foreground font-mono" data-testid="text-detail-run-id">{run.runId}</p>
        </div>
        <Badge variant={statusVariant(run.status)} data-testid="badge-detail-status">
          {isActiveStatus(run.status) && <Radio className="h-3 w-3 mr-1 animate-pulse" />}
          {run.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-muted/30">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground">Mode</div>
            <div className="text-sm font-medium" data-testid="text-detail-mode">{run.generationMode || "—"}</div>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground">Duration</div>
            <div className="text-sm font-medium" data-testid="text-detail-duration">{formatDuration(run.durationMs)}</div>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground">Triggered By</div>
            <div className="text-sm font-medium" data-testid="text-detail-trigger">{run.triggeredBy}</div>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground">Created</div>
            <div className="text-sm font-medium" data-testid="text-detail-created">{formatTimestamp(run.createdAt)}</div>
          </CardContent>
        </Card>
      </div>

      {run.errorMessage && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3" data-testid="text-error-message">
          <div className="text-xs font-medium text-destructive">Error</div>
          <div className="text-xs mt-1">{run.errorMessage}</div>
        </div>
      )}

      {run.isActive && (
        <LiveProgressView ideaId={run.ideaId} runId={run.runId} />
      )}

      <div className="space-y-1 border rounded-md">
        <CollapsibleSection
          title="Stage Timeline"
          icon={<Timer className="h-4 w-4 text-blue-500" />}
          defaultOpen={true}
          badge={run.stageLog && <Badge variant="secondary" className="text-[10px]">{Array.isArray(run.stageLog) ? run.stageLog.length : (run.stageLog?.stages?.length || 0)} stages</Badge>}
          testId="section-stages"
        >
          <StageTimeline stageLog={run.stageLog} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Quality Warnings"
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
          badge={qualityWarnings.length > 0 && <Badge variant="secondary" className="text-[10px]">{qualityWarnings.length}</Badge>}
          testId="section-warnings"
        >
          <QualityWarnings warnings={qualityWarnings} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Remediations"
          icon={<Wrench className="h-4 w-4 text-orange-500" />}
          badge={remediations.length > 0 && <Badge variant="secondary" className="text-[10px]">{remediations.length}</Badge>}
          testId="section-remediations"
        >
          <RemediationsList remediations={remediations} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Auto-Repairs"
          icon={<Wrench className="h-4 w-4 text-green-500" />}
          badge={autoRepairs.length > 0 && <Badge variant="secondary" className="text-[10px]">{autoRepairs.length}</Badge>}
          testId="section-repairs"
        >
          <AutoRepairsList repairs={autoRepairs} />
        </CollapsibleSection>

        {degradations.length > 0 && (
          <CollapsibleSection
            title="Degradations"
            icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
            badge={<Badge variant="destructive" className="text-[10px]">{degradations.length}</Badge>}
            testId="section-degradations"
          >
            <div className="space-y-1">
              {degradations.map((d: any, i: number) => (
                <div key={i} className="text-xs border-b border-border/50 pb-1 last:border-0" data-testid={`degradation-${i}`}>
                  {d.fromMode && d.toMode && (
                    <span className="font-medium">{d.fromMode} → {d.toMode}</span>
                  )}
                  {d.reason && <span className="text-muted-foreground ml-2">— {d.reason}</span>}
                  {!d.fromMode && !d.reason && <span>{JSON.stringify(d)}</span>}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {emissionGateViolations.length > 0 && (
          <CollapsibleSection
            title="Emission Gate Violations"
            icon={<Shield className="h-4 w-4 text-red-500" />}
            badge={<Badge variant="destructive" className="text-[10px]">{emissionGateViolations.length}</Badge>}
            testId="section-emission-violations"
          >
            <div className="space-y-1">
              {emissionGateViolations.map((v: any, i: number) => (
                <div key={i} className="text-xs" data-testid={`emission-violation-${i}`}>
                  {typeof v === "string" ? v : JSON.stringify(v)}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        <CollapsibleSection
          title="DHG Content"
          icon={<FileText className="h-4 w-4 text-purple-500" />}
          testId="section-dhg"
        >
          {run.dhgContent ? (
            <ScrollArea className="h-[300px] border rounded-md p-3 bg-muted/20">
              <div className="prose prose-sm dark:prose-invert max-w-none text-xs" data-testid="text-dhg-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.dhgContent}</ReactMarkdown>
              </div>
            </ScrollArea>
          ) : (
            <p className="text-xs text-muted-foreground">No DHG content available.</p>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Raw Outcome Report (JSON)"
          icon={<Code className="h-4 w-4 text-gray-500" />}
          testId="section-raw-json"
        >
          {run.outcomeReport ? (
            <ScrollArea className="h-[400px] border rounded-md p-3 bg-muted/20">
              <pre className="text-[11px] whitespace-pre-wrap font-mono" data-testid="text-raw-outcome">{JSON.stringify(run.outcomeReport, null, 2)}</pre>
            </ScrollArea>
          ) : (
            <p className="text-xs text-muted-foreground">No outcome report available.</p>
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
}

export function PipelineDebugPanel() {
  const [selectedRun, setSelectedRun] = useState<{ runId: string; ideaId: string } | null>(null);

  return (
    <div className="p-4" data-testid="pipeline-debug-panel">
      <div className="flex items-center gap-2 mb-4">
        <Bug className="h-4 w-4 text-orange-500" />
        <h3 className="text-sm font-semibold">Pipeline Debug Inspector</h3>
      </div>

      {selectedRun ? (
        <RunDetailView
          runId={selectedRun.runId}
          onBack={() => setSelectedRun(null)}
        />
      ) : (
        <RunHistoryTable
          onSelectRun={(runId, ideaId) => setSelectedRun({ runId, ideaId })}
        />
      )}
    </div>
  );
}
