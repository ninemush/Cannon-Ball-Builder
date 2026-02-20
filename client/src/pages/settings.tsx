import { useState } from "react";
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
    <div className="rounded-md border border-border">
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
      <div className="rounded-md border border-border">
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
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: ideas } = useQuery<Idea[]>({ queryKey: ["/api/ideas"] });

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
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="page-settings">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
        <p className="text-sm text-muted-foreground">
          Manage users, view audit logs, and monitor system status.
        </p>
      </div>

      <Tabs defaultValue="users" data-testid="tabs-admin">
        <TabsList data-testid="tablist-admin">
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="mr-2 h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <ScrollText className="mr-2 h-4 w-4" />
            Audit Log
          </TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">
            <Monitor className="mr-2 h-4 w-4" />
            System
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditLogTab />
        </TabsContent>
        <TabsContent value="system" className="mt-4">
          <SystemTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
