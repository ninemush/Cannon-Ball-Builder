import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { type Idea, PIPELINE_STAGES } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  ExternalLink,
  Clock,
  ChevronRight,
  FileText,
  Map,
  MessageSquare,
} from "lucide-react";

interface ReviewIdea extends Idea {
  nodeCount?: number;
  messageCount?: number;
  hasMapApproval?: boolean;
  hasPdd?: boolean;
  hasSdd?: boolean;
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReviewCard({
  idea,
  onSelect,
  isSelected,
}: {
  idea: ReviewIdea;
  onSelect: (id: string) => void;
  isSelected: boolean;
}) {
  const stageIndex = PIPELINE_STAGES.indexOf(idea.stage as any);

  return (
    <button
      onClick={() => onSelect(idea.id)}
      className={`w-full text-left p-4 rounded-lg border transition-colors ${
        isSelected
          ? "border-primary/50 bg-primary/5"
          : "border-border hover:border-primary/20 bg-card"
      }`}
      data-testid={`review-card-${idea.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground truncate">
            {idea.title}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">{idea.owner}</p>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">
          Stage {stageIndex + 1}
        </Badge>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {formatDate(idea.updatedAt)}
        </span>
        <Badge
          variant="secondary"
          className="text-[10px]"
        >
          {idea.stage}
        </Badge>
      </div>
    </button>
  );
}

function ReviewDetail({ idea }: { idea: ReviewIdea }) {
  const { toast } = useToast();
  const { user, activeRole } = useAuth();
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const { data: mapData } = useQuery<any>({
    queryKey: ["/api/ideas", idea.id, "process-map", "as-is"],
    queryFn: async () => {
      const res = await fetch(
        `/api/ideas/${idea.id}/process-map?view=as-is`,
        { credentials: "include" }
      );
      return res.json();
    },
  });

  const { data: messages } = useQuery<any[]>({
    queryKey: ["/api/ideas", idea.id, "messages"],
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/ideas/${idea.id}/advance-stage`, {
        stage: "Deploy",
        reason: `CoE approval granted by ${user?.displayName}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      toast({ title: "Approved", description: "Idea approved and advanced to Deploy stage" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/ideas/${idea.id}/advance-stage`, {
        stage: "Design",
        reason: `CoE rejected: ${rejectReason}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      setShowRejectForm(false);
      setRejectReason("");
      toast({ title: "Rejected", description: "Idea sent back to Design stage" });
    },
  });

  const nodeCount = mapData?.nodes?.length || 0;
  const msgCount = messages?.length || 0;
  const hasApproval = !!mapData?.approval;

  return (
    <div className="flex flex-col h-full" data-testid="review-detail">
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {idea.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {idea.owner} · {idea.stage}
            </p>
          </div>
          <Link
            href={`/workspace/${idea.id}`}
            className="text-xs text-primary hover:underline flex items-center gap-1"
            data-testid="link-open-workspace"
          >
            Open Workspace
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/20 border border-border/40">
              <div className="flex items-center gap-2 mb-1">
                <Map className="h-3.5 w-3.5 text-cb-teal" />
                <span className="text-[10px] text-muted-foreground font-medium">
                  Process Steps
                </span>
              </div>
              <p className="text-lg font-semibold text-foreground">{nodeCount}</p>
              {hasApproval && (
                <Badge className="text-[9px] mt-1 bg-green-500/15 text-green-400 border-green-500/25">
                  Map Approved
                </Badge>
              )}
            </div>
            <div className="p-3 rounded-lg bg-muted/20 border border-border/40">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-3.5 w-3.5 text-cb-gold" />
                <span className="text-[10px] text-muted-foreground font-medium">
                  Chat Messages
                </span>
              </div>
              <p className="text-lg font-semibold text-foreground">{msgCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/20 border border-border/40">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-3.5 w-3.5 text-cb-magenta" />
                <span className="text-[10px] text-muted-foreground font-medium">
                  Documents
                </span>
              </div>
              <p className="text-lg font-semibold text-foreground">-</p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-foreground mb-2">
              Description
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {idea.description}
            </p>
          </div>

          {mapData?.nodes && mapData.nodes.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-2">
                Process Steps Summary
              </h4>
              <div className="space-y-1.5">
                {mapData.nodes
                  .filter((n: any) => n.nodeType !== "start" && n.nodeType !== "end")
                  .map((node: any, i: number) => (
                    <div
                      key={node.id}
                      className="flex items-center gap-2 p-2 rounded bg-muted/10 border border-border/20"
                    >
                      <span className="text-[10px] text-muted-foreground w-5 text-right">
                        {i + 1}.
                      </span>
                      <span className="text-xs text-foreground flex-1">
                        {node.name}
                      </span>
                      {node.role && (
                        <span className="text-[10px] text-muted-foreground">
                          {node.role}
                        </span>
                      )}
                      {node.isPainPoint && (
                        <Badge variant="destructive" className="text-[9px]">
                          Pain Point
                        </Badge>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {idea.stage === "CoE Approval" && (
            <div className="border-t border-border pt-4 space-y-3">
              <h4 className="text-xs font-semibold text-foreground">
                Review Decision
              </h4>

              {!showRejectForm ? (
                <div className="flex gap-2">
                  <Button
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    data-testid="button-approve-idea"
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    {approveMutation.isPending ? "Approving..." : "Approve"}
                  </Button>
                  <Button
                    onClick={() => setShowRejectForm(true)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    variant="destructive"
                    className="flex-1"
                    data-testid="button-reject-idea"
                  >
                    <ShieldX className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Reason for rejection..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="text-xs min-h-[80px]"
                    data-testid="input-reject-reason"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => rejectMutation.mutate()}
                      disabled={!rejectReason.trim() || rejectMutation.isPending}
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      data-testid="button-confirm-reject"
                    >
                      {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowRejectForm(false);
                        setRejectReason("");
                      }}
                      variant="ghost"
                      size="sm"
                      data-testid="button-cancel-reject"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function Reviews() {
  const { activeRole } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: ideas, isLoading } = useQuery<Idea[]>({
    queryKey: ["/api/ideas"],
  });

  if (activeRole !== "CoE" && activeRole !== "Admin") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Access restricted to CoE and Admin roles.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const reviewableIdeas = (ideas ?? []).filter(
    (i) =>
      i.stage === "CoE Approval" ||
      i.stage === "Governance / Security Scan" ||
      i.stage === "Design" ||
      i.stage === "Build" ||
      i.stage === "Test"
  );

  const selectedIdea = reviewableIdeas.find((i) => i.id === selectedId);

  return (
    <div className="flex flex-col h-full" data-testid="page-reviews">
      <div className="px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">CoE Reviews</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {reviewableIdeas.length} idea{reviewableIdeas.length !== 1 ? "s" : ""}{" "}
          pending review
        </p>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-[320px] border-r border-border">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {reviewableIdeas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ShieldCheck className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    No ideas awaiting review.
                  </p>
                </div>
              ) : (
                reviewableIdeas.map((idea) => (
                  <ReviewCard
                    key={idea.id}
                    idea={idea}
                    onSelect={setSelectedId}
                    isSelected={selectedId === idea.id}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>
        <div className="flex-1">
          {selectedIdea ? (
            <ReviewDetail idea={selectedIdea} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <ChevronRight className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  Select an idea to review
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
