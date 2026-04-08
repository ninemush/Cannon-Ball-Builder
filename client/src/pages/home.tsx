import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { PIPELINE_STAGES, type Idea, type PipelineStage } from "@shared/schema";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/utils";

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

function isStalled(idea: Idea): boolean {
  const now = new Date();
  const updated = new Date(idea.updatedAt);
  const hoursDiff = (now.getTime() - updated.getTime()) / (1000 * 60 * 60);
  const terminalStages = ["Deploy", "Maintenance"];
  return hoursDiff >= 48 && !terminalStages.includes(idea.stage);
}

function IdeaCard({ idea, canDelete }: { idea: Idea; canDelete: boolean }) {
  const status = getStatusChip(idea.stage);
  const stalled = isStalled(idea);
  const { toast } = useToast();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/ideas/${idea.id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      toast({ title: "Idea deleted", description: `"${idea.title}" has been removed.` });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      setConfirmingDelete(false);
    },
  });

  return (
    <div
      className={`relative p-2 rounded-lg bg-card border transition-colors group ${
        stalled ? "border-amber-500/40 hover:border-amber-500/60" : "border-card-border hover:border-primary/30"
      }`}
      data-testid={`card-idea-${idea.id}`}
    >
      {canDelete && !confirmingDelete && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirmingDelete(true);
          }}
          className="absolute top-1.5 right-1.5 p-0.5 rounded text-muted-foreground/40 hover:text-destructive transition-colors invisible group-hover:visible z-10"
          data-testid={`button-delete-idea-${idea.id}`}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
      {confirmingDelete && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center gap-1.5 rounded-lg bg-card/95 backdrop-blur-sm border border-destructive/30"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] text-muted-foreground mr-1">Delete?</span>
          <Button
            size="sm"
            variant="destructive"
            className="text-[10px] px-2"
            disabled={deleteMutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              deleteMutation.mutate();
            }}
            data-testid={`button-confirm-delete-${idea.id}`}
          >
            {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-[10px] px-2"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setConfirmingDelete(false);
            }}
            data-testid={`button-cancel-delete-${idea.id}`}
          >
            No
          </Button>
        </div>
      )}
      <Link
        href={`/workspace/${idea.id}`}
        className="block cursor-pointer"
      >
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
            {idea.title}
          </h4>
          <p className="text-[10px] text-muted-foreground truncate">
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
    </div>
  );
}

function StageColumn({ stage, ideas, isMobile, canDelete }: { stage: PipelineStage; ideas: Idea[]; isMobile: boolean; canDelete: boolean }) {
  const stageIdeas = ideas.filter((idea) => idea.stage === stage);

  return (
    <div
      className={`flex flex-col h-full ${isMobile ? "min-w-[160px] max-w-[160px] snap-start" : "flex-1 min-w-0"}`}
      data-testid={`column-${stage.toLowerCase().replace(/[\s\/]/g, "-")}`}
    >
      <div className="flex items-center gap-1 px-1.5 pb-2 border-b border-border">
        <h3 className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate leading-tight">
          {stage}
        </h3>
        {stageIdeas.length > 0 && (
          <span className="flex items-center justify-center min-w-[16px] h-[16px] rounded-full bg-secondary text-[9px] font-medium text-secondary-foreground px-0.5 shrink-0">
            {stageIdeas.length}
          </span>
        )}
      </div>
      <div className="flex-1 pt-2 space-y-1.5 overflow-y-auto">
        {stageIdeas.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} canDelete={canDelete} />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { data: ideas, isLoading } = useQuery<Idea[]>({
    queryKey: ["/api/ideas"],
  });
  const isMobile = useIsMobile();
  const { activeRole } = useAuth();
  const canDelete = activeRole === "Admin" || activeRole === "CoE";

  if (isLoading) {
    return (
      <div className="flex flex-col h-full" data-testid="page-pipeline-loading">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-40 mt-1.5" />
        </div>
        <div className="flex gap-2 p-3 sm:p-4">
          {Array.from({ length: isMobile ? 2 : 10 }).map((_, i) => (
            <div key={i} className={isMobile ? "min-w-[160px] space-y-3" : "flex-1 min-w-0 space-y-3"}>
              <Skeleton className="h-4 w-full max-w-[80px]" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const allIdeas = ideas ?? [];

  return (
    <div className="flex flex-col h-full" data-testid="page-pipeline">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
        <h1 className="text-base sm:text-lg font-semibold text-foreground">Pipeline</h1>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
          {allIdeas.length} idea{allIdeas.length !== 1 ? "s" : ""} across {PIPELINE_STAGES.length} stages
        </p>
      </div>
      {isMobile ? (
        <ScrollArea className="flex-1">
          <div className="flex gap-2 p-3 h-[calc(100vh-7.5rem)] snap-x snap-mandatory overflow-x-auto">
            {PIPELINE_STAGES.map((stage) => (
              <StageColumn key={stage} stage={stage} ideas={allIdeas} isMobile={true} canDelete={canDelete} />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      ) : (
        <div className="flex gap-2 p-3 sm:p-4 h-[calc(100vh-8.5rem)] overflow-hidden">
          {PIPELINE_STAGES.map((stage) => (
            <StageColumn key={stage} stage={stage} ideas={allIdeas} isMobile={false} canDelete={canDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
