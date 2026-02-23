import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, UserRole, AuditLog, Idea, PipelineStage } from "@shared/schema";
import { ROLES, PIPELINE_STAGES } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  ShieldAlert,
  Users,
  ScrollText,
  Monitor,
  Search,
  Download,
  ArrowRight,
  CircleDot,
  Brain,
  UserCheck,
  Lightbulb,
  Plug,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  Clock,
  FolderOpen,
  RefreshCw,
  Stethoscope,
  AlertTriangle,
  Bot,
  Server,
  Play,
  Activity,
  ChevronDown,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function roleBadgeVariant(role: string): "default" | "secondary" | "outline" | "destructive" {
  switch (role) {
    case "Admin":
      return "destructive";
    case "CoE":
      return "default";
    default:
      return "secondary";
  }
}

function UsersTab() {
  const { toast } = useToast();
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      await apiRequest("PATCH", `/api/users/${id}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Role updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update role", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border overflow-x-auto">
      <Table data-testid="table-users">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users?.map((user) => (
            <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
              <TableCell className="font-medium" data-testid={`text-username-${user.id}`}>
                {user.displayName}
              </TableCell>
              <TableCell className="text-muted-foreground" data-testid={`text-email-${user.id}`}>
                {user.email}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={roleBadgeVariant(user.role)} className="text-xs" data-testid={`badge-role-${user.id}`}>
                    {user.role}
                  </Badge>
                  <Select
                    value={user.role}
                    onValueChange={(value) =>
                      updateRoleMutation.mutate({ id: user.id, role: value as UserRole })
                    }
                    disabled={updateRoleMutation.isPending}
                  >
                    <SelectTrigger
                      className="w-[140px]"
                      data-testid={`select-role-${user.id}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role} value={role} data-testid={`option-role-${role}`}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {users?.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                No users found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function AuditLogTab() {
  const [filter, setFilter] = useState("");
  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs"],
  });

  const filteredLogs = logs?.filter((log) => {
    if (!filter) return true;
    const term = filter.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      (log.userName?.toLowerCase().includes(term)) ||
      (log.details?.toLowerCase().includes(term)) ||
      (log.fromStage?.toLowerCase().includes(term)) ||
      (log.toStage?.toLowerCase().includes(term)) ||
      (log.ideaId?.toLowerCase().includes(term))
    );
  });

  const exportCSV = () => {
    if (!filteredLogs?.length) return;
    const headers = ["Timestamp", "User", "Action", "Idea ID", "From Stage", "To Stage", "Details"];
    const rows = filteredLogs.map((log) => [
      new Date(log.createdAt).toISOString(),
      log.userName ?? "",
      log.action,
      log.ideaId ?? "",
      log.fromStage ?? "",
      log.toStage ?? "",
      (log.details ?? "").replace(/"/g, '""'),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search audit logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9"
            data-testid="input-audit-search"
          />
        </div>
        <Button variant="outline" onClick={exportCSV} data-testid="button-export-csv">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>
      <div className="rounded-md border border-border overflow-x-auto">
        <Table data-testid="table-audit-logs">
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Idea</TableHead>
              <TableHead>Stage Transition</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs?.map((log) => (
              <TableRow key={log.id} data-testid={`row-audit-${log.id}`}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  <span className="text-sm">{log.userName ?? "System"}</span>
                  {log.userRole && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {log.userRole}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono max-w-[100px] truncate">
                  {log.ideaId ? log.ideaId.slice(0, 8) : "-"}
                </TableCell>
                <TableCell>
                  {log.fromStage || log.toStage ? (
                    <div className="flex items-center gap-1 text-xs flex-wrap">
                      <span className="text-muted-foreground">{log.fromStage ?? "-"}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span>{log.toStage ?? "-"}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                  {log.details ?? "-"}
                </TableCell>
              </TableRow>
            ))}
            {filteredLogs?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No audit log entries found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SystemTab() {
  const { toast } = useToast();
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: ideas } = useQuery<Idea[]>({ queryKey: ["/api/ideas"] });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (ideaId: string) => {
      const res = await apiRequest("DELETE", `/api/ideas/${ideaId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      toast({ title: "Idea deleted", description: "The idea and all related data have been removed." });
      setConfirmDeleteId(null);
      setDeletingId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      setDeletingId(null);
    },
  });

  const stageCounts: Record<string, number> = {};
  PIPELINE_STAGES.forEach((stage) => {
    stageCounts[stage] = 0;
  });
  ideas?.forEach((idea) => {
    if (stageCounts[idea.stage] !== undefined) {
      stageCounts[idea.stage]++;
    }
  });
  const maxCount = Math.max(1, ...Object.values(stageCounts));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 space-y-2" data-testid="card-model">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Brain className="h-4 w-4" />
            Model
          </div>
          <p className="text-sm font-semibold">Claude claude-sonnet-4-6</p>
        </Card>
        <Card className="p-4 space-y-2" data-testid="card-api-status">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <CircleDot className="h-4 w-4" />
            API Status
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-sm font-semibold text-green-500">Connected</span>
          </div>
        </Card>
        <Card className="p-4 space-y-2" data-testid="card-total-users">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <UserCheck className="h-4 w-4" />
            Total Users
          </div>
          <p className="text-2xl font-bold" data-testid="text-user-count">
            {users?.length ?? 0}
          </p>
        </Card>
        <Card className="p-4 space-y-2" data-testid="card-total-ideas">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Lightbulb className="h-4 w-4" />
            Total Ideas
          </div>
          <p className="text-2xl font-bold" data-testid="text-idea-count">
            {ideas?.length ?? 0}
          </p>
        </Card>
      </div>

      <Card className="p-4 space-y-4" data-testid="card-stage-chart">
        <h3 className="text-sm font-semibold text-foreground">Ideas per Stage</h3>
        <div className="space-y-2">
          {PIPELINE_STAGES.map((stage) => {
            const count = stageCounts[stage] ?? 0;
            const pct = (count / maxCount) * 100;
            return (
              <div key={stage} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-[160px] truncate flex-shrink-0" title={stage}>
                  {stage}
                </span>
                <div className="flex-1 h-5 rounded-md bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-md transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: "#e8450a",
                      minWidth: count > 0 ? "8px" : "0px",
                    }}
                    data-testid={`bar-stage-${stage}`}
                  />
                </div>
                <span className="text-xs font-mono text-muted-foreground w-6 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4 space-y-4" data-testid="card-idea-management">
        <h3 className="text-sm font-semibold text-foreground">Idea Management</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ideas?.map((idea) => (
              <TableRow key={idea.id} data-testid={`row-idea-${idea.id}`}>
                <TableCell className="text-sm font-medium">{idea.title}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{idea.owner}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">{idea.stage}</Badge>
                </TableCell>
                <TableCell>
                  {confirmDeleteId === idea.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs px-2"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          setDeletingId(idea.id);
                          deleteMutation.mutate(idea.id);
                        }}
                        data-testid={`button-confirm-delete-${idea.id}`}
                      >
                        {deletingId === idea.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2"
                        onClick={() => setConfirmDeleteId(null)}
                        data-testid={`button-cancel-delete-${idea.id}`}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmDeleteId(idea.id)}
                      data-testid={`button-delete-idea-${idea.id}`}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Delete
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

const UIPATH_SCOPE_CATEGORIES = [
  { category: "Core", scopes: [
    { id: "OR.Default", description: "General Orchestrator access" },
    { id: "OR.Administration", description: "Administration" },
    { id: "OR.Administration.Read", description: "Read administration data" },
    { id: "OR.Administration.Write", description: "Write administration data" },
  ]},
  { category: "Folders & Execution", scopes: [
    { id: "OR.Folders", description: "Full folder access" },
    { id: "OR.Folders.Read", description: "Read folders" },
    { id: "OR.Folders.Write", description: "Write folders" },
    { id: "OR.Execution", description: "Full execution access" },
    { id: "OR.Execution.Read", description: "Read executions" },
    { id: "OR.Execution.Write", description: "Write executions" },
  ]},
  { category: "Assets & Queues", scopes: [
    { id: "OR.Assets", description: "Full asset access" },
    { id: "OR.Assets.Read", description: "Read assets" },
    { id: "OR.Assets.Write", description: "Write assets" },
    { id: "OR.Queues", description: "Full queue access" },
    { id: "OR.Queues.Read", description: "Read queues" },
    { id: "OR.Queues.Write", description: "Write queues" },
  ]},
  { category: "Jobs & Robots", scopes: [
    { id: "OR.Jobs", description: "Full job access" },
    { id: "OR.Jobs.Read", description: "Read jobs" },
    { id: "OR.Jobs.Write", description: "Write jobs" },
    { id: "OR.Robots", description: "Full robot access" },
    { id: "OR.Robots.Read", description: "Read robots" },
    { id: "OR.Robots.Write", description: "Write robots" },
  ]},
  { category: "Machines & Hypervisor", scopes: [
    { id: "OR.Machines", description: "Full machine access" },
    { id: "OR.Machines.Read", description: "Read machines" },
    { id: "OR.Machines.Write", description: "Write machines" },
    { id: "OR.Hypervisor", description: "Full hypervisor access" },
    { id: "OR.Hypervisor.Read", description: "Read hypervisor" },
    { id: "OR.Hypervisor.Write", description: "Write hypervisor" },
  ]},
  { category: "Settings & Users", scopes: [
    { id: "OR.Settings", description: "Full settings access" },
    { id: "OR.Settings.Read", description: "Read settings" },
    { id: "OR.Settings.Write", description: "Write settings" },
    { id: "OR.Users", description: "Full user access" },
    { id: "OR.Users.Read", description: "Read users" },
    { id: "OR.Users.Write", description: "Write users" },
    { id: "OR.License", description: "Full license access" },
    { id: "OR.License.Read", description: "Read licenses" },
    { id: "OR.License.Write", description: "Write licenses" },
  ]},
  { category: "Monitoring & Analytics", scopes: [
    { id: "OR.Monitoring", description: "Full monitoring access" },
    { id: "OR.Monitoring.Read", description: "Read monitoring" },
    { id: "OR.Monitoring.Write", description: "Write monitoring" },
    { id: "OR.Analytics", description: "Full analytics access" },
    { id: "OR.Analytics.Read", description: "Read analytics" },
    { id: "OR.Analytics.Write", description: "Write analytics" },
    { id: "OR.Audit", description: "Full audit access" },
    { id: "OR.Audit.Read", description: "Read audit logs" },
    { id: "OR.Audit.Write", description: "Write audit logs" },
  ]},
  { category: "Storage & Tasks", scopes: [
    { id: "OR.Buckets", description: "Full storage bucket access" },
    { id: "OR.Buckets.Read", description: "Read storage buckets" },
    { id: "OR.Buckets.Write", description: "Write storage buckets" },
    { id: "OR.Tasks", description: "Full task access (Action Center)" },
    { id: "OR.Tasks.Read", description: "Read tasks" },
    { id: "OR.Tasks.Write", description: "Write tasks" },
    { id: "OR.BackgroundTasks", description: "Full background task access" },
    { id: "OR.BackgroundTasks.Read", description: "Read background tasks" },
    { id: "OR.BackgroundTasks.Write", description: "Write background tasks" },
  ]},
  { category: "Testing", scopes: [
    { id: "OR.TestSets", description: "Full test set access" },
    { id: "OR.TestSets.Read", description: "Read test sets" },
    { id: "OR.TestSets.Write", description: "Write test sets" },
    { id: "OR.TestSetExecutions", description: "Full test execution access" },
    { id: "OR.TestSetExecutions.Read", description: "Read test executions" },
    { id: "OR.TestSetExecutions.Write", description: "Write test executions" },
    { id: "OR.TestSetSchedules", description: "Full test schedule access" },
    { id: "OR.TestSetSchedules.Read", description: "Read test schedules" },
    { id: "OR.TestSetSchedules.Write", description: "Write test schedules" },
    { id: "OR.TestDataQueues", description: "Full test data queue access" },
    { id: "OR.TestDataQueues.Read", description: "Read test data queues" },
    { id: "OR.TestDataQueues.Write", description: "Write test data queues" },
  ]},
  { category: "AI & ML", scopes: [
    { id: "OR.ML", description: "Full ML access" },
    { id: "OR.ML.Read", description: "Read ML models" },
    { id: "OR.ML.Write", description: "Write ML models" },
    { id: "OR.AutomationSolutions.Access", description: "Automation Solutions access" },
  ]},
  { category: "Webhooks", scopes: [
    { id: "OR.Webhooks", description: "Full webhook access" },
    { id: "OR.Webhooks.Read", description: "Read webhooks" },
    { id: "OR.Webhooks.Write", description: "Write webhooks" },
  ]},
];

function extractOrgSlug(input: string): string {
  let val = input.trim();
  val = val.replace(/^https?:\/\//, "");
  val = val.replace(/^cloud\.uipath\.com\//, "");
  val = val.replace(/\/+$/, "");
  val = val.split("/")[0];
  return val.trim();
}

function OrchestratorHealthPanel() {
  const [expanded, setExpanded] = useState(false);
  const [machinesOpen, setMachinesOpen] = useState(false);
  const [robotsOpen, setRobotsOpen] = useState(false);
  const [processesOpen, setProcessesOpen] = useState(false);

  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery<{
    checks: Array<{ name: string; status: "pass" | "fail" | "warn"; message: string; details?: any }>;
    summary: string;
  }>({
    queryKey: ["/api/settings/uipath/health-check"],
    enabled: false,
  });

  const { data: machinesData, isLoading: machinesLoading, refetch: refetchMachines } = useQuery<{
    success: boolean;
    machines?: Array<{ id: number; name: string; type: string; status: string; description: string }>;
    message?: string;
  }>({
    queryKey: ["/api/settings/uipath/machines"],
    enabled: false,
  });

  const { data: robotsData, isLoading: robotsLoading, refetch: refetchRobots } = useQuery<{
    success: boolean;
    robots?: Array<{ id: number; robotId: number; robotName: string; machineName: string; status: string; type: string; isUnresponsive: boolean }>;
    message?: string;
  }>({
    queryKey: ["/api/settings/uipath/robots"],
    enabled: false,
  });

  const { data: processesData, isLoading: processesLoading, refetch: refetchProcesses } = useQuery<{
    success: boolean;
    processes?: Array<{ id: number; name: string; processKey: string; processVersion: string; description: string }>;
    message?: string;
  }>({
    queryKey: ["/api/settings/uipath/processes"],
    enabled: false,
  });

  const runDiagnostics = () => {
    setExpanded(true);
    refetchHealth();
    refetchMachines();
    refetchRobots();
    refetchProcesses();
  };

  const statusIcon = (status: string) => {
    if (status === "pass") return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
    if (status === "fail") return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
    return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
  };

  const statusColor = (status: string) => {
    if (status === "pass") return "border-green-600/30 bg-green-500/10";
    if (status === "fail") return "border-red-600/30 bg-red-500/10";
    return "border-amber-500/30 bg-amber-500/10";
  };

  const isLoading = healthLoading || machinesLoading || robotsLoading || processesLoading;

  return (
    <div className="border-t border-border pt-4 mt-4 space-y-3" data-testid="health-check-section">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-[#e8450a]" />
          <h4 className="text-sm font-semibold text-foreground">Orchestrator Diagnostics</h4>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={runDiagnostics}
          disabled={isLoading}
          data-testid="button-run-diagnostics"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <Activity className="mr-1.5 h-3.5 w-3.5" />
              Run Diagnostics
            </>
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Check if everything is set up correctly to run automations: authentication, folder, packages, processes, machines, and robots.
      </p>

      {expanded && (
        <div className="space-y-3 mt-2">
          {healthData && (
            <div className="space-y-2" data-testid="health-check-results">
              <div className={`p-3 rounded-md border text-sm font-medium ${
                healthData.checks.some(c => c.status === "fail")
                  ? "border-red-600/30 bg-red-500/10 text-red-400"
                  : healthData.checks.some(c => c.status === "warn")
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : "border-green-600/30 bg-green-500/10 text-green-400"
              }`} data-testid="health-summary">
                {healthData.summary}
              </div>

              <div className="space-y-1.5">
                {healthData.checks.map((check, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 p-2.5 rounded-md border ${statusColor(check.status)}`}
                    data-testid={`health-check-${check.name.toLowerCase().replace(/\s/g, "-")}`}
                  >
                    {statusIcon(check.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{check.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{check.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <button
              className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
              onClick={() => { setProcessesOpen(!processesOpen); if (!processesData) refetchProcesses(); }}
              data-testid="toggle-processes-list"
            >
              {processesOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <Play className="h-3.5 w-3.5 text-[#e8450a]" />
              Processes ({processesData?.processes?.length ?? "..."})
            </button>
            {processesOpen && (
              <div className="ml-6 space-y-1" data-testid="processes-list">
                {processesLoading && <Skeleton className="h-8 w-full" />}
                {processesData?.processes?.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2 border border-dashed border-border rounded">
                    No processes found in this folder. Push a package and a process will be created automatically.
                  </p>
                )}
                {processesData?.processes?.map((proc) => (
                  <div key={proc.id} className="flex items-center justify-between p-2 rounded bg-card border border-border text-xs">
                    <div>
                      <span className="font-medium text-foreground">{proc.name}</span>
                      <span className="ml-2 text-muted-foreground">v{proc.processVersion}</span>
                    </div>
                    <code className="text-[10px] text-muted-foreground">{proc.processKey}</code>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <button
              className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
              onClick={() => { setRobotsOpen(!robotsOpen); if (!robotsData) refetchRobots(); }}
              data-testid="toggle-robots-list"
            >
              {robotsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <Bot className="h-3.5 w-3.5 text-[#008b9b]" />
              Robots ({robotsData?.robots?.length ?? "..."})
            </button>
            {robotsOpen && (
              <div className="ml-6 space-y-1" data-testid="robots-list">
                {robotsLoading && <Skeleton className="h-8 w-full" />}
                {robotsData?.robots?.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2 border border-dashed border-border rounded">
                    No robot sessions found. Assign robots to this folder in Orchestrator &gt; Folder Settings.
                  </p>
                )}
                {robotsData?.robots?.map((robot) => (
                  <div key={robot.id} className="flex items-center justify-between p-2 rounded bg-card border border-border text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{robot.robotName}</span>
                      <Badge variant={robot.status === "Available" ? "default" : "secondary"} className="text-[10px] py-0">
                        {robot.status}
                      </Badge>
                    </div>
                    <span className="text-muted-foreground">{robot.machineName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <button
              className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
              onClick={() => { setMachinesOpen(!machinesOpen); if (!machinesData) refetchMachines(); }}
              data-testid="toggle-machines-list"
            >
              {machinesOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <Server className="h-3.5 w-3.5 text-[#7b1fa2]" />
              Machines ({machinesData?.machines?.length ?? "..."})
            </button>
            {machinesOpen && (
              <div className="ml-6 space-y-1" data-testid="machines-list">
                {machinesLoading && <Skeleton className="h-8 w-full" />}
                {machinesData?.machines?.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2 border border-dashed border-border rounded">
                    No machine templates found. Create them in Orchestrator &gt; Tenant &gt; Machines.
                  </p>
                )}
                {machinesData?.machines?.map((machine) => (
                  <div key={machine.id} className="flex items-center justify-between p-2 rounded bg-card border border-border text-xs">
                    <span className="font-medium text-foreground">{machine.name}</span>
                    <span className="text-muted-foreground">{machine.type || "Standard"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IntegrationsTab() {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [showSecret, setShowSecret] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [tenantName, setTenantName] = useState("DefaultTenant");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set(["OR.Default"]));
  const [testResultMsg, setTestResultMsg] = useState<{ success: boolean; message: string } | null>(null);
  const [scopeVerification, setScopeVerification] = useState<{
    success: boolean;
    requestedScopes: string[];
    grantedScopes: string[];
    message: string;
    services?: Record<string, { available: boolean; message: string }>;
  } | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState<string | null>(null);
  const [scopeProbe, setScopeProbe] = useState<{
    status: "ok" | "mismatch" | "auth_failed" | "not_configured";
    requestedScopes: string[];
    grantedScopes: string[];
    missingInApp: string[];
    extraInApp: string[];
    message: string;
  } | null>(null);
  const [scopeProbeLoading, setScopeProbeLoading] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: config, isLoading } = useQuery<{
    configured: boolean;
    orgName?: string;
    tenantName?: string;
    clientId?: string;
    scopes?: string;
    hasSecret?: boolean;
    lastTestedAt?: string | null;
    folderId?: string | null;
    folderName?: string | null;
  }>({
    queryKey: ["/api/settings/uipath"],
  });

  const { data: foldersData, isLoading: foldersLoading, refetch: refetchFolders } = useQuery<{
    success: boolean;
    folders?: { id: number; displayName: string; fullyQualifiedName: string }[];
    message?: string;
  }>({
    queryKey: ["/api/settings/uipath/folders"],
    enabled: !!config?.configured,
  });

  const folderMutation = useMutation({
    mutationFn: async (data: { folderId: string | null; folderName: string | null }) => {
      const res = await apiRequest("POST", "/api/settings/uipath/folder", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/uipath"] });
      toast({ title: "Target folder updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save folder", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (config?.configured) {
      setOrgName(config.orgName || "");
      setTenantName(config.tenantName || "DefaultTenant");
      setClientId(config.clientId || "");
      const scopeSet = new Set((config.scopes || "OR.Default").split(" ").filter(Boolean));
      setSelectedScopes(scopeSet);
      setSelectedFolderId(config.folderId || null);
      setSelectedFolderName(config.folderName || null);
      setStep(3);
    }
  }, [config]);

  useEffect(() => {
    if (step === 3 && config?.configured && !scopeProbe && !scopeProbeLoading) {
      setScopeProbeLoading(true);
      fetch("/api/settings/uipath/probe-scopes", { credentials: "include" })
        .then(r => r.json())
        .then(data => setScopeProbe(data))
        .catch(() => {})
        .finally(() => setScopeProbeLoading(false));
    }
  }, [step, config?.configured]);

  const toggleScope = (scopeId: string) => {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scopeId)) {
        if (scopeId === "OR.Default" && next.size === 1) return next;
        next.delete(scopeId);
      } else {
        next.add(scopeId);
      }
      return next;
    });
  };

  const validateStep = (s: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (s === 0) {
      const org = extractOrgSlug(orgName);
      if (!org) newErrors.orgName = "Organization name is required";
      if (!tenantName.trim()) newErrors.tenantName = "Tenant name is required";
    }
    if (s === 1) {
      if (!clientId.trim()) newErrors.clientId = "App ID is required";
      else {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(clientId.trim())) {
          newErrors.clientId = "App ID should be a UUID (e.g. 04c8163f-77fc-4547-86e3-dba0844844fe)";
        }
      }
      if (!clientSecret.trim() && !config?.hasSecret) newErrors.clientSecret = "App Secret is required";
    }
    if (s === 2) {
      if (selectedScopes.size === 0) newErrors.scopes = "Select at least one scope";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goNext = () => {
    if (validateStep(step)) {
      setErrors({});
      setStep((s) => Math.min(s + 1, 3));
    }
  };

  const goBack = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/uipath", {
        orgName: extractOrgSlug(orgName),
        tenantName: tenantName.trim(),
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim() || undefined,
        scopes: Array.from(selectedScopes).join(" "),
      });
      return res.json();
    },
    onSuccess: (data: { success: boolean; message: string; testResult?: { success: boolean; message: string } }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/uipath"] });
      setClientSecret("");
      setScopeProbe(null);
      if (data.testResult) {
        setTestResultMsg(data.testResult);
        if (data.testResult.success) {
          toast({ title: "Saved & connected", description: "Configuration saved and connection verified." });
        } else {
          toast({ title: "Saved but connection failed", description: data.testResult.message, variant: "destructive" });
        }
      } else {
        toast({ title: "UiPath configuration saved" });
      }
      setStep(3);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/uipath/test");
      return res.json();
    },
    onSuccess: (data: { success: boolean; message: string }) => {
      setTestResultMsg(data);
      queryClient.invalidateQueries({ queryKey: ["/api/settings/uipath"] });
      if (data.success) {
        toast({ title: "Connection successful", description: data.message });
      } else {
        toast({ title: "Connection failed", description: data.message, variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Test failed", description: error.message, variant: "destructive" });
    },
  });

  const verifyScopesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/settings/uipath/verify-scopes", { credentials: "include" });
      return res.json();
    },
    onSuccess: (data: any) => {
      setScopeVerification(data);
      if (data.success) {
        toast({ title: "Scope verification complete", description: data.message });
      } else {
        toast({ title: "Scope verification failed", description: data.message, variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Verification failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const stepLabels = ["Organization", "Credentials", "Scopes", "Confirm"];

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="p-4 sm:p-6 space-y-4 sm:space-y-6" data-testid="card-uipath-config">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-[#e8450a]" />
              <h3 className="text-base sm:text-lg font-semibold text-foreground">UiPath Orchestrator</h3>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Connect to UiPath Cloud to push automation packages directly.{" "}
              <a
                href="https://cloud.uipath.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#e8450a] hover:underline"
                data-testid="link-uipath-cloud"
              >
                Open UiPath Cloud
              </a>
            </p>
          </div>
          {config?.configured ? (
            <Badge variant="outline" className="border-green-600 text-green-500 gap-1" data-testid="badge-connected">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="border-muted-foreground text-muted-foreground gap-1" data-testid="badge-not-configured">
              <XCircle className="h-3 w-3" />
              Not configured
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1" data-testid="wizard-steps">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-1 flex-1">
              <button
                onClick={() => {
                  if (i <= step || config?.configured) {
                    setErrors({});
                    setStep(i);
                  }
                }}
                className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded transition-colors ${
                  i === step
                    ? "bg-[#e8450a] text-white"
                    : i < step
                      ? "bg-[#e8450a]/20 text-[#e8450a] hover:bg-[#e8450a]/30 cursor-pointer"
                      : "bg-muted text-muted-foreground"
                }`}
                data-testid={`wizard-step-${i}`}
              >
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border border-current">
                  {i < step ? "✓" : i + 1}
                </span>
                {label}
              </button>
              {i < stepLabels.length - 1 && (
                <div className={`flex-1 h-px ${i < step ? "bg-[#e8450a]/40" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4" data-testid="wizard-panel-org">
            <div className="p-3 rounded-md bg-muted/50 border border-border text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-sm">Step 1: Organization & Tenant</p>
              <p>Find these in your UiPath Cloud URL: <code className="bg-muted px-1 py-0.5 rounded text-[10px]">cloud.uipath.com/<strong>orgName</strong>/<strong>tenantName</strong></code></p>
              <p>You can paste the full URL — the organization name will be extracted automatically.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name <span className="text-destructive">*</span></Label>
              <Input
                id="orgName"
                placeholder="e.g. mycompany or https://cloud.uipath.com/mycompany/"
                value={orgName}
                onChange={(e) => { setOrgName(e.target.value); setErrors((p) => ({ ...p, orgName: "" })); }}
                className={errors.orgName ? "border-destructive" : ""}
                data-testid="input-uipath-org"
              />
              {errors.orgName && <p className="text-xs text-destructive" data-testid="error-org">{errors.orgName}</p>}
              {orgName && orgName.includes("cloud.uipath.com") && (
                <p className="text-xs text-green-500">
                  Will use: <strong>{extractOrgSlug(orgName)}</strong>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenantName">Tenant Name <span className="text-destructive">*</span></Label>
              <Input
                id="tenantName"
                placeholder="e.g. DefaultTenant"
                value={tenantName}
                onChange={(e) => { setTenantName(e.target.value); setErrors((p) => ({ ...p, tenantName: "" })); }}
                className={errors.tenantName ? "border-destructive" : ""}
                data-testid="input-uipath-tenant"
              />
              {errors.tenantName && <p className="text-xs text-destructive" data-testid="error-tenant">{errors.tenantName}</p>}
              <p className="text-xs text-muted-foreground">Usually "DefaultTenant" unless you renamed it.</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4" data-testid="wizard-panel-creds">
            <div className="p-3 rounded-md bg-muted/50 border border-border text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-sm">Step 2: App Credentials</p>
              <p>Create a <strong>Confidential</strong> External Application in UiPath Cloud:</p>
              <p>Admin → External Applications → Add Application → Type: Confidential</p>
              <a
                href="https://cloud.uipath.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#e8450a] hover:underline inline-flex items-center gap-1"
              >
                Open UiPath Cloud Admin
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientId">App ID (Client ID) <span className="text-destructive">*</span></Label>
              <Input
                id="clientId"
                placeholder="e.g. 04c8163f-77fc-4547-86e3-dba0844844fe"
                value={clientId}
                onChange={(e) => { setClientId(e.target.value); setErrors((p) => ({ ...p, clientId: "" })); }}
                className={errors.clientId ? "border-destructive" : ""}
                data-testid="input-uipath-client-id"
              />
              {errors.clientId && <p className="text-xs text-destructive" data-testid="error-client-id">{errors.clientId}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientSecret">App Secret (Client Secret) <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  id="clientSecret"
                  type={showSecret ? "text" : "password"}
                  placeholder={config?.hasSecret ? "••••••• (saved — leave blank to keep)" : "Paste your app secret"}
                  value={clientSecret}
                  onChange={(e) => { setClientSecret(e.target.value); setErrors((p) => ({ ...p, clientSecret: "" })); }}
                  className={`pr-10 ${errors.clientSecret ? "border-destructive" : ""}`}
                  data-testid="input-uipath-client-secret"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-secret"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.clientSecret && <p className="text-xs text-destructive" data-testid="error-client-secret">{errors.clientSecret}</p>}
              <p className="text-xs text-muted-foreground">
                The secret is shown only once when you create the app. Copy it before closing the dialog.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4" data-testid="wizard-panel-scopes">
            <div className="p-3 rounded-md bg-muted/50 border border-border text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-sm">Step 3: Select Scopes</p>
              <p>Choose the permissions your app needs. These must match the scopes you granted when creating the External Application in UiPath Cloud.</p>
              <p className="text-[#e8450a]">Tip: Paste your scope list from UiPath below to auto-select matching scopes.</p>
            </div>
            {errors.scopes && <p className="text-xs text-destructive" data-testid="error-scopes">{errors.scopes}</p>}

            <div className="space-y-2">
              <Label htmlFor="paste-scopes" className="text-xs">Paste scopes from UiPath (space or newline separated)</Label>
              <div className="flex gap-2">
                <Input
                  id="paste-scopes"
                  placeholder="e.g. OR.Default OR.Folders.Read OR.Execution.Write ..."
                  data-testid="input-paste-scopes"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) {
                        const parsed = val.split(/[\s,]+/).filter(s => s.startsWith("OR."));
                        if (parsed.length > 0) {
                          const scopeSet = new Set(parsed);
                          scopeSet.add("OR.Default");
                          setSelectedScopes(scopeSet);
                          (e.target as HTMLInputElement).value = "";
                          toast({ title: `${scopeSet.size} scopes loaded`, description: parsed.slice(0, 5).join(", ") + (parsed.length > 5 ? ` + ${parsed.length - 5} more` : "") });
                        }
                      }
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-apply-pasted-scopes"
                  onClick={() => {
                    const input = document.getElementById("paste-scopes") as HTMLInputElement;
                    const val = input?.value?.trim();
                    if (val) {
                      const parsed = val.split(/[\s,]+/).filter(s => s.startsWith("OR."));
                      if (parsed.length > 0) {
                        const scopeSet = new Set(parsed);
                        scopeSet.add("OR.Default");
                        setSelectedScopes(scopeSet);
                        input.value = "";
                        toast({ title: `${scopeSet.size} scopes loaded`, description: parsed.slice(0, 5).join(", ") + (parsed.length > 5 ? ` + ${parsed.length - 5} more` : "") });
                      }
                    }
                  }}
                >
                  Apply
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                data-testid="button-select-all-scopes"
                onClick={() => {
                  const allIds = UIPATH_SCOPE_CATEGORIES.flatMap(c => c.scopes.map(s => s.id));
                  setSelectedScopes(new Set(allIds));
                }}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-clear-scopes"
                onClick={() => setSelectedScopes(new Set(["OR.Default"]))}
              >
                Clear
              </Button>
              <span className="text-xs text-muted-foreground ml-auto">{selectedScopes.size} selected</span>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1" data-testid="scope-list">
              {UIPATH_SCOPE_CATEGORIES.map((cat) => {
                const catScopeIds = cat.scopes.map(s => s.id);
                const allChecked = catScopeIds.every(id => selectedScopes.has(id));
                const someChecked = catScopeIds.some(id => selectedScopes.has(id));
                return (
                  <div key={cat.category} className="border border-border rounded-md" data-testid={`scope-category-${cat.category.toLowerCase().replace(/\s+/g, "-")}`}>
                    <label className="flex items-center gap-2 px-3 py-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-md">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                        onChange={() => {
                          setSelectedScopes(prev => {
                            const next = new Set(prev);
                            if (allChecked) {
                              catScopeIds.forEach(id => { if (id !== "OR.Default") next.delete(id); });
                            } else {
                              catScopeIds.forEach(id => next.add(id));
                            }
                            return next;
                          });
                        }}
                        className="accent-[#e8450a] h-3.5 w-3.5"
                        data-testid={`scope-category-toggle-${cat.category.toLowerCase().replace(/\s+/g, "-")}`}
                      />
                      <span className="text-xs font-semibold text-foreground">{cat.category}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{catScopeIds.filter(id => selectedScopes.has(id)).length}/{catScopeIds.length}</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5 px-2 py-1.5">
                      {cat.scopes.map(scope => {
                        const checked = selectedScopes.has(scope.id);
                        return (
                          <label
                            key={scope.id}
                            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors text-xs ${
                              checked ? "bg-[#e8450a]/5 text-foreground" : "text-muted-foreground hover:text-foreground"
                            }`}
                            data-testid={`scope-item-${scope.id}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleScope(scope.id)}
                              className="accent-[#e8450a] h-3 w-3"
                              data-testid={`scope-checkbox-${scope.id}`}
                            />
                            <code className="text-[10px] font-mono">{scope.id}</code>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Selected ({selectedScopes.size}): <strong className="break-all">{Array.from(selectedScopes).join(", ")}</strong>
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4" data-testid="wizard-panel-confirm">
            <div className="p-3 rounded-md bg-muted/50 border border-border text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-sm">Step 4: Review & Connect</p>
              <p>Review your settings below, then save and test the connection.</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-muted-foreground shrink-0">Organization</span>
                    <span className="font-medium text-foreground" data-testid="confirm-org">{extractOrgSlug(orgName) || "—"}</span>
                  </div>
                  <button onClick={() => { setErrors({}); setStep(0); }} className="text-[#e8450a] hover:text-[#e8450a]/80 p-1 rounded transition-colors" data-testid="edit-org" title="Edit organization"><Pencil className="h-3 w-3" /></button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-muted-foreground shrink-0">Tenant</span>
                    <span className="font-medium text-foreground" data-testid="confirm-tenant">{tenantName || "—"}</span>
                  </div>
                  <button onClick={() => { setErrors({}); setStep(0); }} className="text-[#e8450a] hover:text-[#e8450a]/80 p-1 rounded transition-colors" data-testid="edit-tenant" title="Edit tenant"><Pencil className="h-3 w-3" /></button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-muted-foreground shrink-0">App ID</span>
                    <span className="font-mono text-xs text-foreground truncate" data-testid="confirm-client-id">{clientId || "—"}</span>
                  </div>
                  <button onClick={() => { setErrors({}); setStep(1); }} className="text-[#e8450a] hover:text-[#e8450a]/80 p-1 rounded transition-colors" data-testid="edit-credentials" title="Edit credentials"><Pencil className="h-3 w-3" /></button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-muted-foreground shrink-0">App Secret</span>
                    <span className="text-foreground" data-testid="confirm-secret">
                      {config?.hasSecret || clientSecret ? "••••••• (set)" : "Not set"}
                    </span>
                  </div>
                  <button onClick={() => { setErrors({}); setStep(1); }} className="text-[#e8450a] hover:text-[#e8450a]/80 p-1 rounded transition-colors" data-testid="edit-secret" title="Edit credentials"><Pencil className="h-3 w-3" /></button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0 flex-1">
                    <span className="text-muted-foreground shrink-0">Scopes</span>
                    <span className="text-foreground text-xs break-all" data-testid="confirm-scopes">
                      {Array.from(selectedScopes).join(", ") || "None"}
                    </span>
                  </div>
                  <button onClick={() => { setErrors({}); setStep(2); }} className="text-[#e8450a] hover:text-[#e8450a]/80 p-1 rounded transition-colors" data-testid="edit-scopes" title="Edit scopes"><Pencil className="h-3 w-3" /></button>
                </div>
              </div>

              {scopeProbeLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded border border-border bg-muted/30" data-testid="scope-probe-loading">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Checking scope sync with UiPath Cloud...
                </div>
              )}

              {scopeProbe && scopeProbe.status === "ok" && (
                <div className="flex items-center gap-2 text-xs text-green-400 p-2 rounded border border-green-600/30 bg-green-500/10" data-testid="scope-probe-ok">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>{scopeProbe.message}</span>
                </div>
              )}

              {scopeProbe && scopeProbe.status === "mismatch" && (
                <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs space-y-2" data-testid="scope-probe-mismatch">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-medium">Scope mismatch detected</p>
                      <p>{scopeProbe.message}</p>
                      {scopeProbe.missingInApp.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">New in UiPath (not in app): </span>
                          {scopeProbe.missingInApp.map(s => (
                            <span key={s} className="inline-block px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono mr-1 mb-1">{s}</span>
                          ))}
                        </div>
                      )}
                      {scopeProbe.extraInApp.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">In app but not in UiPath: </span>
                          {scopeProbe.extraInApp.map(s => (
                            <span key={s} className="inline-block px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] font-mono mr-1 mb-1">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => { setErrors({}); setScopeProbe(null); setStep(2); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#e8450a] text-white text-xs font-medium hover:bg-[#e8450a]/90 transition-colors"
                    data-testid="button-fix-scopes-mismatch"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit Scopes to Fix
                  </button>
                </div>
              )}

              {scopeProbe && scopeProbe.status === "auth_failed" && (
                <div className="p-3 rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-xs space-y-2" data-testid="scope-probe-failed">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Scope validation failed</p>
                      <p>{scopeProbe.message}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setErrors({}); setScopeProbe(null); setStep(2); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#e8450a] text-white text-xs font-medium hover:bg-[#e8450a]/90 transition-colors"
                    data-testid="button-fix-scopes-auth-failed"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit Scopes
                  </button>
                </div>
              )}

              {config?.lastTestedAt && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1" data-testid="last-tested">
                  <Clock className="h-3 w-3" />
                  Last tested: {new Date(config.lastTestedAt).toLocaleString()}
                </div>
              )}

              {testResultMsg && (
                <div
                  className={`p-3 rounded-md border text-sm ${
                    testResultMsg.success
                      ? "border-green-600/30 bg-green-500/10 text-green-400"
                      : "border-destructive/30 bg-destructive/10 text-destructive"
                  }`}
                  data-testid="test-result-msg"
                >
                  <div className="flex items-start gap-2">
                    {testResultMsg.success ? <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                    <span>{testResultMsg.message}</span>
                  </div>
                  {!testResultMsg.success && /invalid_scope/i.test(testResultMsg.message) && (
                    <div className="mt-2 p-2 rounded bg-destructive/5 border border-destructive/20 text-xs space-y-2" data-testid="scope-mismatch-help">
                      <p>Invalid scopes. The scopes you selected must match the scopes granted to your External Application in UiPath Cloud. Go to Admin &gt; External Applications, edit your app, and verify the selected scopes.</p>
                      <button
                        onClick={() => { setErrors({}); setTestResultMsg(null); setStep(2); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#e8450a] text-white text-xs font-medium hover:bg-[#e8450a]/90 transition-colors"
                        data-testid="button-edit-scopes-from-error"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit Scopes
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                data-testid="button-save-uipath"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving & Testing...
                  </>
                ) : (
                  "Save & Test Connection"
                )}
              </Button>
              {config?.configured && (
                <Button
                  variant="outline"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                  data-testid="button-test-uipath"
                >
                  {testMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    "Re-test Connection"
                  )}
                </Button>
              )}
              {config?.configured && (
                <Button
                  variant="outline"
                  onClick={() => verifyScopesMutation.mutate()}
                  disabled={verifyScopesMutation.isPending}
                  data-testid="button-verify-scopes"
                >
                  {verifyScopesMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify Scopes & Services"
                  )}
                </Button>
              )}
            </div>

            {scopeVerification && (
              <div className="border border-border rounded-lg p-4 space-y-3 mt-4" data-testid="scope-verification-results">
                <div className="flex items-center gap-2">
                  {scopeVerification.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <span className="text-sm font-medium text-foreground">{scopeVerification.message}</span>
                </div>

                {scopeVerification.services && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Service Availability</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(scopeVerification.services).map(([name, info]) => (
                        <div
                          key={name}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs ${
                            info.available
                              ? "bg-green-500/10 text-green-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}
                          data-testid={`service-status-${name.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          {info.available ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="font-medium">{name}</span>
                            <span className="ml-1 text-muted-foreground">— {info.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {scopeVerification.grantedScopes.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Granted Scopes ({scopeVerification.grantedScopes.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {scopeVerification.grantedScopes.map((scope) => (
                        <span key={scope} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-mono">
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {config?.configured && (
              <div className="border-t border-border pt-4 mt-4 space-y-3" data-testid="folder-picker-section">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-[#e8450a]" />
                  <h4 className="text-sm font-semibold text-foreground">Target Folder</h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Choose which Orchestrator folder packages are uploaded to. If no folder is selected, packages go to the tenant-level feed.
                </p>

                {foldersData && !foldersData.success && (
                  <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs space-y-1" data-testid="folders-error">
                    <p className="font-medium">Could not load folders</p>
                    <p>{foldersData.message || "Check that your External Application has the OR.Folders scope, then click refresh."}</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Select
                    value={selectedFolderId || "__tenant__"}
                    disabled={foldersLoading || (foldersData !== undefined && !foldersData?.success)}
                    onValueChange={(val) => {
                      if (val === "__tenant__") {
                        setSelectedFolderId(null);
                        setSelectedFolderName(null);
                        folderMutation.mutate({ folderId: null, folderName: null });
                      } else {
                        const folder = foldersData?.folders?.find((f) => String(f.id) === val);
                        if (folder) {
                          setSelectedFolderId(String(folder.id));
                          setSelectedFolderName(folder.displayName);
                          folderMutation.mutate({ folderId: String(folder.id), folderName: folder.displayName });
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[280px]" data-testid="select-uipath-folder">
                      <SelectValue placeholder={foldersLoading ? "Loading folders..." : "Select a folder..."} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__tenant__" data-testid="folder-option-tenant">
                        <span className="text-muted-foreground">Tenant feed (no folder)</span>
                      </SelectItem>
                      {foldersData?.folders?.map((folder) => (
                        <SelectItem
                          key={folder.id}
                          value={String(folder.id)}
                          data-testid={`folder-option-${folder.id}`}
                        >
                          {folder.fullyQualifiedName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => refetchFolders()}
                    disabled={foldersLoading}
                    data-testid="button-refresh-folders"
                    title="Refresh folder list"
                  >
                    <RefreshCw className={`h-4 w-4 ${foldersLoading ? "animate-spin" : ""}`} />
                  </Button>
                  {folderMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>

                {selectedFolderName && (
                  <p className="text-xs text-green-500" data-testid="text-selected-folder">
                    Packages will be uploaded to: <strong>{selectedFolderName}</strong>
                  </p>
                )}
                {!selectedFolderId && (
                  <p className="text-xs text-muted-foreground">
                    Packages will appear under Tenant &gt; Packages (tenant-level feed).
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {config?.configured && <OrchestratorHealthPanel />}

        {step < 3 && (
          <div className="flex items-center gap-3 pt-2">
            {step > 0 && (
              <Button variant="outline" onClick={goBack} data-testid="button-wizard-back">
                Back
              </Button>
            )}
            <Button onClick={goNext} data-testid="button-wizard-next">
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const { activeRole } = useAuth();

  if (activeRole !== "Admin") {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4"
        data-testid="page-access-denied"
      >
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-card border border-border">
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Access Denied</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            You must be an Admin to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 max-w-6xl mx-auto space-y-4 sm:space-y-6" data-testid="page-settings">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Admin Panel</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Manage users, view audit logs, and monitor system status.
        </p>
      </div>

      <Tabs defaultValue="users" data-testid="tabs-admin">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList data-testid="tablist-admin" className="w-max sm:w-auto">
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="mr-1.5 sm:mr-2 h-4 w-4" />
              <span className="text-xs sm:text-sm">Users</span>
            </TabsTrigger>
            <TabsTrigger value="audit" data-testid="tab-audit">
              <ScrollText className="mr-1.5 sm:mr-2 h-4 w-4" />
              <span className="text-xs sm:text-sm">Audit Log</span>
            </TabsTrigger>
            <TabsTrigger value="system" data-testid="tab-system">
              <Monitor className="mr-1.5 sm:mr-2 h-4 w-4" />
              <span className="text-xs sm:text-sm">System</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations">
              <Plug className="mr-1.5 sm:mr-2 h-4 w-4" />
              <span className="text-xs sm:text-sm">Integrations</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditLogTab />
        </TabsContent>
        <TabsContent value="system" className="mt-4">
          <SystemTab />
        </TabsContent>
        <TabsContent value="integrations" className="mt-4">
          <IntegrationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
