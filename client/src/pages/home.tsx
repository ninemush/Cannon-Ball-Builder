import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PIPELINE_STAGES, type Idea, type PipelineStage } from "@shared/schema";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, AlertTriangle } from "lucide-react";

function getStatusChip(stage: string): { label: string; className: string } {
  const approvalStages = ["CoE Approval", "Governance / Security Scan"];
  const actionStages = ["Idea", "Feasibility Assessment"];

  if (approvalStages.includes(stage)) {
    return { label: "Pending Approval", className: "bg-cb-gold/15 text-cb-gold border border-cb-gold/25" };
  }
  if (actionStages.includes(stage)) {
    return { label: "Action Required", className: "bg-primary/15 text-primary border border-primary/25" };
  }
  return { label: "Active", className: "bg-cb-teal/15 text-cb-teal border border-cb-teal/25" };
}

function formatTimestamp(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isStalled(idea: Idea): boolean {
  const now = new Date();
  const updated = new Date(idea.updatedAt);
  const hoursDiff = (now.getTime() - updated.getTime()) / (1000 * 60 * 60);
  const terminalStages = ["Deploy", "Maintenance"];
  return hoursDiff >= 48 && !terminalStages.includes(idea.stage);
}

function IdeaCard({ idea }: { idea: Idea }) {
  const status = getStatusChip(idea.stage);
  const stalled = isStalled(idea);

  return (
    <Link
      href={`/workspace/${idea.id}`}
      className={`block p-3 rounded-lg bg-card border transition-colors cursor-pointer group ${
        stalled ? "border-amber-500/40 hover:border-amber-500/60" : "border-card-border hover:border-primary/30"
      }`}
      data-testid={`card-idea-${idea.id}`}
    >
      <div className="space-y-2.5">
        <h4 className="text-sm font-medium text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {idea.title}
        </h4>
        <p className="text-xs text-muted-foreground truncate">
          {idea.owner}
        </p>
        {stalled && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/25"
            data-testid={`chip-stalled-${idea.id}`}
          >
            <AlertTriangle className="h-2.5 w-2.5" />
            Needs attention
          </span>
        )}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full ${status.className}`}
          >
            {status.label}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            {formatTimestamp(idea.updatedAt)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function StageColumn({ stage, ideas }: { stage: PipelineStage; ideas: Idea[] }) {
  const stageIdeas = ideas.filter((idea) => idea.stage === stage);

  return (
    <div
      className="flex flex-col min-w-[220px] max-w-[220px] h-full"
      data-testid={`column-${stage.toLowerCase().replace(/[\s\/]/g, "-")}`}
    >
      <div className="flex items-center gap-2 px-2 pb-3 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
          {stage}
        </h3>
        {stageIdeas.length > 0 && (
          <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground px-1">
            {stageIdeas.length}
          </span>
        )}
      </div>
      <div className="flex-1 pt-3 space-y-2 overflow-y-auto">
        {stageIdeas.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { data: ideas, isLoading } = useQuery<Idea[]>({
    queryKey: ["/api/ideas"],
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full" data-testid="page-pipeline-loading">
        <div className="px-6 py-4 border-b border-border">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-40 mt-1.5" />
        </div>
        <div className="flex gap-4 p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="min-w-[220px] space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const allIdeas = ideas ?? [];

  return (
    <div className="flex flex-col h-full" data-testid="page-pipeline">
      <div className="px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Pipeline</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {allIdeas.length} idea{allIdeas.length !== 1 ? "s" : ""} across {PIPELINE_STAGES.length} stages
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex gap-4 p-6 h-[calc(100vh-8.5rem)]">
          {PIPELINE_STAGES.map((stage) => (
            <StageColumn key={stage} stage={stage} ideas={allIdeas} />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
