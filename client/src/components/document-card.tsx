import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  ChevronDown,
  ChevronRight,
  Check,
  Loader2,
  Download,
  Package,
  X,
  Upload,
  Cloud,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  History,
  BookOpen,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DocumentSection {
  title: string;
  content: string;
}

function parseDocumentSections(content: string): DocumentSection[] {
  const cleaned = content
    .replace(/\[AUTOMATION_TYPE:\s*[^\]]+\]/gi, "")
    .replace(/\[STEP:\s*[\d.]+\s+[^\]]*\]/g, "")
    .replace(/\[DOC:(PDD|SDD):\d+\]/g, "")
    .replace(/\[DEPLOY_UIPATH\]/g, "")
    .replace(/\[STAGE_BACK:\s*[^\]]+\]/g, "");
  const lines = cleaned.split("\n");
  const sections: DocumentSection[] = [];
  let currentTitle = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+\d*\.?\s*(.*)/);
    if (headingMatch) {
      if (currentTitle) {
        sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
      }
      currentTitle = headingMatch[1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentTitle) {
    sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
  }

  if (sections.length === 0 && cleaned.trim()) {
    sections.push({ title: "Document Content", content: cleaned.trim() });
  }

  return sections;
}

interface DocumentCardProps {
  docType: "PDD" | "SDD";
  docId: number;
  content: string;
  ideaId: string;
  isApproved?: boolean;
  version?: number;
  onApproved?: () => void;
  streaming?: boolean;
  streamingElapsed?: number;
  onCancelStreaming?: () => void;
}

export function DocumentCard({ docType, docId, content, ideaId, isApproved, version, onApproved, streaming, streamingElapsed, onCancelStreaming }: DocumentCardProps) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showReviseInput, setShowReviseInput] = useState(false);
  const [revisionText, setRevisionText] = useState("");
  const [viewingVersion, setViewingVersion] = useState<{ id: number; version: number; content: string; status: string } | null>(null);

  const { data: versionHistory } = useQuery<{ id: number; version: number; status: string; createdAt: string }[]>({
    queryKey: ["/api/ideas", ideaId, "documents", "versions", docType],
    enabled: !streaming,
  });

  const activeContent = viewingVersion ? viewingVersion.content : content;
  const activeVersion = viewingVersion ? viewingVersion.version : (version || 1);
  const sections = parseDocumentSections(activeContent);

  const isDocApprovedFromHistory = !streaming && (versionHistory?.some(v => v.id === docId && v.status === "approved") ?? false);
  const effectivelyApproved = !streaming && (isApproved || isDocApprovedFromHistory);

  useEffect(() => {
    if (streaming && sections.length > 0) {
      setExpandedSections(new Set([sections.length - 1]));
    }
  }, [streaming, sections.length]);

  const { toast } = useToast();

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ideas/${ideaId}/documents/${docId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Approval failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setShowApproveConfirm(false);
      toast({ title: `${docType} Approved`, description: `${docType} has been approved successfully.` });
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "documents"] });
      onApproved?.();
    },
    onError: (error: Error) => {
      setShowApproveConfirm(false);
      if (error.message === "Already approved") {
        toast({ title: `${docType} Already Approved`, description: "This document has already been approved." });
        queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "messages"] });
        queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "documents", "versions", docType] });
      } else {
        toast({ title: "Approval failed", description: error.message, variant: "destructive" });
      }
    },
  });

  const reviseMutation = useMutation({
    mutationFn: async (revision: string) => {
      const res = await fetch(`/api/ideas/${ideaId}/documents/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: docType, revision }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Revision failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setShowReviseInput(false);
      setRevisionText("");
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "documents"] });
    },
  });

  function toggleSection(index: number) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const docTitle = docType === "PDD" ? "Process Design Document" : "Solution Design Document";

  return (
    <div
      className="rounded-lg border-l-4 border-l-cb-teal bg-card shadow-lg overflow-hidden"
      data-testid={`card-document-${docType.toLowerCase()}`}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
        <FileText className="h-4 w-4 text-cb-teal shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold text-foreground">{docTitle}</h4>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">
              {streaming ? (
                <span className="text-cb-teal font-medium">
                  <Loader2 className="inline h-3 w-3 mr-1 animate-spin" />
                  Generating...
                  {typeof streamingElapsed === "number" && (
                    <span className="text-muted-foreground/50 ml-1">({streamingElapsed}s)</span>
                  )}
                </span>
              ) : (
                <>
                  Version {activeVersion}
                  {effectivelyApproved && !viewingVersion && (
                    <span className="ml-2 text-cb-teal">
                      <Check className="inline h-3 w-3 mr-0.5" />Approved
                    </span>
                  )}
                  {viewingVersion && (
                    <span className="ml-2 text-amber-400">
                      (viewing older version)
                    </span>
                  )}
                </>
              )}
            </span>
            {streaming && onCancelStreaming && (
              <button
                onClick={onCancelStreaming}
                className="text-[10px] text-muted-foreground hover:text-foreground underline ml-1"
                data-testid="button-cancel-streaming-doc"
              >
                Cancel
              </button>
            )}
            {!streaming && versionHistory && versionHistory.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    data-testid={`button-version-history-${docType.toLowerCase()}`}
                  >
                    <History className="h-3 w-3" />
                    <ChevronDown className="h-2.5 w-2.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuLabel className="text-[10px] text-muted-foreground">
                    Version History
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {versionHistory.map((v) => (
                    <DropdownMenuItem
                      key={v.id}
                      onClick={() => {
                        if (v.id === docId) {
                          setViewingVersion(null);
                        } else {
                          fetch(`/api/ideas/${ideaId}/documents/versions/${docType}`, { credentials: "include" })
                            .then((r) => r.json())
                            .then((versions: any[]) => {
                              const doc = versions.find((d: any) => d.id === v.id);
                              if (doc) {
                                setViewingVersion({ id: doc.id, version: doc.version, content: doc.content, status: doc.status });
                              }
                            });
                        }
                      }}
                      data-testid={`menu-version-${v.version}`}
                    >
                      <span className="flex items-center gap-2 w-full text-xs">
                        <span className={v.id === docId && !viewingVersion ? "font-medium text-foreground" : ""}>
                          v{v.version}
                        </span>
                        <span className={`text-[10px] px-1 py-0.5 rounded ${
                          v.status === "approved" ? "bg-cb-teal/20 text-cb-teal" :
                          v.status === "superseded" ? "bg-muted text-muted-foreground" :
                          "bg-primary/20 text-primary"
                        }`}>
                          {v.status}
                        </span>
                        {v.id === docId && !viewingVersion && (
                          <span className="text-[10px] text-primary ml-auto">current</span>
                        )}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  {viewingVersion && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setViewingVersion(null)}
                        className="text-xs text-primary"
                      >
                        Back to current version
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        {!streaming && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-muted-foreground"
            onClick={() => {
              if (expandedSections.size === sections.length) {
                setExpandedSections(new Set());
              } else {
                setExpandedSections(new Set(sections.map((_, i) => i)));
              }
            }}
            data-testid={`button-toggle-all-sections-${docType.toLowerCase()}`}
          >
            {expandedSections.size === sections.length ? "Collapse All" : "Expand All"}
          </Button>
        )}
      </div>

      <div className="divide-y divide-border/20">
        {sections.map((section, idx) => (
          <div key={idx}>
            <button
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
              onClick={() => toggleSection(idx)}
              data-testid={`button-section-toggle-${idx}`}
            >
              {expandedSections.has(idx) ? (
                <ChevronDown className="h-3 w-3 text-cb-teal shrink-0" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              <span className="text-xs font-medium text-foreground">{section.title}</span>
            </button>
            {expandedSections.has(idx) && (
              <div className="px-4 pb-3 pl-9">
                <div className="text-[11px] text-muted-foreground/90 leading-relaxed prose-doc">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      img: ({ node, ...props }) => (
                        <img
                          {...props}
                          data-testid={`img-process-map-${idx}`}
                          style={{
                            maxWidth: "100%",
                            borderRadius: "8px",
                            margin: "8px 0",
                            border: "1px solid hsl(var(--border))",
                          }}
                        />
                      ),
                    }}
                  >
                    {section.content}
                  </ReactMarkdown>
                  {streaming && idx === sections.length - 1 && (
                    <span className="inline-block w-1.5 h-3.5 bg-cb-teal ml-0.5 animate-pulse rounded-sm" />
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {!effectivelyApproved && !streaming && (
        <div className="px-4 py-3 border-t border-border/30 space-y-2">
          {showApproveConfirm ? (
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-muted-foreground flex-1">
                Confirm approval of this {docType}?
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setShowApproveConfirm(false)}
                disabled={approveMutation.isPending}
                data-testid={`button-cancel-doc-approve-${docType.toLowerCase()}`}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-cb-teal hover:bg-cb-teal/80 text-white"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                data-testid={`button-confirm-doc-approve-${docType.toLowerCase()}`}
              >
                {approveMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Check className="h-3 w-3 mr-1" />
                )}
                Confirm
              </Button>
            </div>
          ) : showReviseInput ? (
            <div className="space-y-2">
              <Textarea
                value={revisionText}
                onChange={(e) => setRevisionText(e.target.value)}
                placeholder={`e.g. "Update section 3 to include..." or "Add an exception for..."`}
                className="min-h-[60px] text-xs bg-muted border-border/30"
                data-testid={`input-revision-${docType.toLowerCase()}`}
              />
              <div className="flex items-center gap-2 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => { setShowReviseInput(false); setRevisionText(""); }}
                  disabled={reviseMutation.isPending}
                  data-testid={`button-cancel-revision-${docType.toLowerCase()}`}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => reviseMutation.mutate(revisionText)}
                  disabled={!revisionText.trim() || reviseMutation.isPending}
                  data-testid={`button-submit-revision-${docType.toLowerCase()}`}
                >
                  {reviseMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  Submit Revision
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-7 text-xs bg-cb-teal hover:bg-cb-teal/80 text-white flex-1"
                onClick={() => setShowApproveConfirm(true)}
                data-testid={`button-approve-${docType.toLowerCase()}`}
              >
                <Check className="h-3 w-3 mr-1" />
                Approve {docType}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs flex-1"
                onClick={() => setShowReviseInput(true)}
                data-testid={`button-request-revision-${docType.toLowerCase()}`}
              >
                Request Revision
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface UiPathPackageCardProps {
  packageData: any;
  ideaId: string;
  onDeployProgress?: (step: string) => void;
  onDeployComplete?: () => void;
  status?: "BUILDING" | "READY" | "READY_WITH_WARNINGS" | "FAILED";
  warnings?: Array<{ code: string; message: string; stage: string; recoverable: boolean }>;
  onRetry?: () => void;
  templateComplianceScore?: number;
}

export function UiPathPackageCard({ packageData, ideaId, onDeployProgress, onDeployComplete, status, warnings, onRetry, templateComplianceScore }: UiPathPackageCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [pushResult, setPushResult] = useState<{ success: boolean; details?: any } | null>(null);
  const [jobState, setJobState] = useState<{ id?: number; state?: string; polling?: boolean } | null>(null);
  const [dhgOpen, setDhgOpen] = useState(false);
  const [dhgContent, setDhgContent] = useState<string | null>(null);
  const [dhgLoading, setDhgLoading] = useState(false);
  const [warningsExpanded, setWarningsExpanded] = useState(false);
  const { toast } = useToast();
  const isFailed = status === "FAILED";
  const hasWarnings = status === "READY_WITH_WARNINGS" && warnings && warnings.length > 0;

  const { data: orchestratorStatus } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/settings/uipath/status"],
  });

  const pushMutation = useMutation({
    mutationFn: async () => {
      onDeployProgress?.("Deploying to Orchestrator...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000);
      try {
        const res = await fetch(`/api/ideas/${ideaId}/push-uipath`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok && res.headers.get("content-type")?.includes("application/json")) {
          const err = await res.json();
          throw new Error(err.message || "Deploy failed");
        }
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");
        const decoder = new TextDecoder();
        let buffer = "";
        let finalResult: any = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.deployStatus) {
                onDeployProgress?.(event.deployStatus);
              }
              if (event.deployComplete) {
                finalResult = event;
              }
            } catch {}
          }
        }

        if (!finalResult) throw new Error("Deploy stream ended without completion");
        return finalResult;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    onSuccess: (data: any) => {
      onDeployProgress?.("");
      onDeployComplete?.();
      if (data.success) {
        setPushResult(data.result || data);
        const d = data.result?.details;
        const processInfo = d?.processName ? ` Process "${d.processName}" created.` : "";
        toast({ title: "Deployed to UiPath", description: `"${d?.packageId}" v${d?.version} deployed.${processInfo}` });
      } else {
        const msg = data.error || data.result?.message || "Deploy failed";
        toast({ title: "Push failed", description: msg, variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "messages"] });
    },
    onError: (error: Error) => {
      onDeployProgress?.("");
      onDeployComplete?.();
      const msg = error.name === "AbortError" ? "Deployment timed out after 10 minutes. Please try again." : error.message;
      toast({ title: "Push failed", description: msg, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "messages"] });
    },
  });

  const startJobMutation = useMutation({
    mutationFn: async (releaseKey: string) => {
      const res = await apiRequest("POST", `/api/ideas/${ideaId}/start-job`, { releaseKey });
      return res.json();
    },
    onSuccess: (data: { success: boolean; message: string; job?: any }) => {
      if (data.success && data.job) {
        setJobState({ id: data.job.id, state: data.job.state, polling: true });
        toast({ title: "Job started", description: `Job ${data.job.id} is running.` });
        pollJobStatus(data.job.id);
      } else {
        toast({ title: "Failed to start job", description: data.message, variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "messages"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to start job", description: error.message, variant: "destructive" });
    },
  });

  const pollJobStatus = async (jobId: number) => {
    let attempts = 0;
    const maxAttempts = 60;
    const interval = 3000;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setJobState((prev) => prev ? { ...prev, polling: false } : null);
        return;
      }
      attempts++;
      try {
        const res = await fetch(`/api/ideas/${ideaId}/job-status/${jobId}`, { credentials: "include" });
        const data = await res.json();
        if (data.success && data.job) {
          const state = data.job.state;
          setJobState({ id: jobId, state, polling: !["Successful", "Faulted", "Stopped", "Suspended"].includes(state) });
          if (["Successful", "Faulted", "Stopped", "Suspended"].includes(state)) {
            if (state === "Successful") {
              toast({ title: "Job completed", description: `Job ${jobId} finished successfully.` });
            } else {
              toast({ title: `Job ${state.toLowerCase()}`, description: data.job.info || `Job ${jobId} ended with state: ${state}`, variant: "destructive" });
            }
            return;
          }
        }
      } catch {}
      setTimeout(poll, interval);
    };
    setTimeout(poll, interval);
  };

  const jobStateColor = (state?: string) => {
    if (!state) return "text-muted-foreground";
    if (state === "Successful") return "text-green-500";
    if (state === "Pending" || state === "Running") return "text-amber-400";
    return "text-red-500";
  };

  const jobStateIcon = (state?: string) => {
    if (!state || state === "Pending" || state === "Running") return <Loader2 className="h-3 w-3 animate-spin" />;
    if (state === "Successful") return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    return <XCircle className="h-3 w-3 text-red-500" />;
  };

  return (
    <div
      className="rounded-lg border-l-4 border-l-primary bg-card shadow-lg overflow-hidden"
      data-testid="card-uipath-package"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
        <Package className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold text-foreground">UiPath Automation Package</h4>
          <span className="text-[10px] text-muted-foreground">{packageData.projectName}</span>
        </div>
        {isFailed && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 text-[10px] font-medium" data-testid="badge-status-failed">
            <XCircle className="h-3 w-3" /> Failed
          </span>
        )}
        {hasWarnings && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 text-[10px] font-medium" data-testid="badge-status-warnings">
            <AlertTriangle className="h-3 w-3" /> {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
          </span>
        )}
        {templateComplianceScore !== undefined && !isNaN(templateComplianceScore) && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
              templateComplianceScore >= 0.9
                ? "bg-emerald-500/15 text-emerald-500"
                : templateComplianceScore >= 0.7
                  ? "bg-amber-500/15 text-amber-500"
                  : "bg-red-500/15 text-red-500"
            }`}
            data-testid="badge-template-compliance"
          >
            {Math.round(templateComplianceScore * 100)}% compliant
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        <p className="text-[11px] text-muted-foreground/90">{packageData.description}</p>

        {packageData.dependencies?.length > 0 && (
          <div>
            <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Dependencies</h5>
            <div className="flex flex-wrap gap-1">
              {packageData.dependencies.map((dep: string, i: number) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  {dep}
                </span>
              ))}
            </div>
          </div>
        )}

        {packageData.workflows?.length > 0 && (
          <div>
            <button
              className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Workflows ({packageData.workflows.length})
            </button>
            {expanded && (
              <div className="space-y-2 mt-1">
                {packageData.workflows.map((wf: any, i: number) => (
                  <div key={i} className="p-2 rounded bg-muted border border-border/20">
                    <p className="text-[11px] font-medium text-foreground">{wf.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{wf.description}</p>
                    {wf.steps?.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {wf.steps.map((step: any, j: number) => (
                          <p key={j} className="text-[10px] text-muted-foreground/70 pl-2 border-l border-border/30">
                            {step.activity}{step.notes ? ` — ${step.notes}` : ""}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {hasWarnings && (
        <div className="px-4 py-2 border-t border-amber-500/20 bg-amber-500/5">
          <button
            onClick={() => setWarningsExpanded(!warningsExpanded)}
            className="flex items-center gap-1 text-[10px] font-semibold text-amber-500 uppercase tracking-wider w-full"
            data-testid="button-toggle-warnings"
          >
            {warningsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {warnings.length} Pipeline Warning{warnings.length !== 1 ? "s" : ""}
          </button>
          {warningsExpanded && (
            <div className="mt-2 space-y-1" data-testid="warnings-detail-panel">
              {warnings.map((w, i) => (
                <div key={i} className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400">
                  <span className="font-medium">[{w.code}]</span> {w.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-3 border-t border-border/30 space-y-2">
        {isFailed && onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors w-full justify-center"
            data-testid="button-retry-build"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retry Build
          </button>
        )}
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                const res = await fetch(`/api/ideas/${ideaId}/download-uipath`, { credentials: "include" });
                if (!res.ok) {
                  const errBody = await res.json().catch(() => null);
                  throw new Error(errBody?.message || "Failed to download UiPath package");
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${(packageData.projectName || "UiPathPackage").replace(/[^a-zA-Z0-9_-]/g, "_")}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch (err: any) {
                toast({ title: "Download failed", description: err.message, variant: "destructive" });
              }
            }}
            disabled={isFailed}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-download-uipath"
          >
            <Download className="h-3.5 w-3.5" />
            Package
          </button>
          <button
            onClick={async () => {
              setDhgContent(null);
              setDhgLoading(true);
              setDhgOpen(true);
              try {
                const res = await fetch(`/api/ideas/${ideaId}/dhg`, { credentials: "include" });
                if (!res.ok) {
                  const err = await res.json();
                  throw new Error(err.message || "Failed to load");
                }
                const data = await res.json();
                setDhgContent(data.content);
              } catch (err: any) {
                toast({ title: "Could not load Handoff Guide", description: err.message, variant: "destructive" });
                setDhgOpen(false);
              } finally {
                setDhgLoading(false);
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-cb-teal/20 hover:bg-cb-teal/30 text-cb-teal text-xs font-medium transition-colors flex-1 justify-center border border-cb-teal/30"
            data-testid="button-view-dhg"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Handoff Guide
          </button>
        </div>
        {orchestratorStatus?.configured && (
          <button
            onClick={() => pushMutation.mutate()}
            disabled={pushMutation.isPending || isFailed}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-push-uipath"
          >
            {pushMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deploying to Orchestrator...
              </>
            ) : (
              <>
                <Cloud className="h-3.5 w-3.5" />
                Deploy to UiPath Orchestrator
              </>
            )}
          </button>
        )}

        {pushResult?.success && (
          <div className="space-y-2 pt-1" data-testid="deploy-result-section">
            <div className={`p-2 rounded text-xs space-y-1 ${pushResult.details?.releaseKey ? 'bg-green-500/10 border border-green-600/30' : 'bg-blue-500/10 border border-blue-600/30'}`}>
              <div className={`flex items-center gap-1.5 font-medium ${pushResult.details?.releaseKey ? 'text-green-400' : 'text-blue-400'}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {pushResult.details?.releaseKey ? 'Deployed & Process Created' : 'Package Uploaded'}
              </div>
              <p className={`text-[10px] ${pushResult.details?.releaseKey ? 'text-green-400/80' : 'text-blue-400/80'}`}>
                {pushResult.details?.packageId} v{pushResult.details?.version}
                {pushResult.details?.folderName && ` → ${pushResult.details.folderName}`}
              </p>
              {!pushResult.details?.releaseKey && (
                <p className="text-[10px] text-muted-foreground">
                  Create a Process from this package in Orchestrator to run it.
                </p>
              )}
            </div>

            {pushResult.details?.releaseKey && (
              <button
                onClick={() => startJobMutation.mutate(pushResult.details.releaseKey)}
                disabled={startJobMutation.isPending || (jobState?.polling ?? false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors w-full justify-center disabled:opacity-50"
                data-testid="button-run-job"
              >
                {startJobMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Starting Job...
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Run in UiPath
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {jobState && (
          <div className="p-2 rounded bg-card border border-border text-xs space-y-1" data-testid="job-status-section">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {jobStateIcon(jobState.state)}
                <span className={`font-medium ${jobStateColor(jobState.state)}`}>
                  Job #{jobState.id}: {jobState.state || "Starting..."}
                </span>
              </div>
              {jobState.polling && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                  Monitoring
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {dhgOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" data-testid="dhg-overlay" onClick={() => setDhgOpen(false)}>
          <div className="relative w-[90vw] max-w-4xl max-h-[85vh] bg-card rounded-xl border border-border shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-cb-teal" />
                <h3 className="text-sm font-semibold text-foreground">Developer Handoff Guide</h3>
              </div>
              <div className="flex items-center gap-2">
                {dhgContent && (
                  <button
                    onClick={() => {
                      const blob = new Blob([dhgContent], { type: "text/markdown" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "DeveloperHandoffGuide.md";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    data-testid="button-download-dhg"
                  >
                    <Download className="h-3 w-3" />
                    Download .md
                  </button>
                )}
                <button onClick={() => setDhgOpen(false)} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" data-testid="button-close-dhg">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {dhgLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-cb-teal" />
                  <span className="ml-2 text-sm text-muted-foreground">Generating Handoff Guide...</span>
                </div>
              ) : dhgContent ? (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-code:text-cb-teal prose-code:bg-muted/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-li:text-muted-foreground prose-table:text-xs" data-testid="dhg-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{dhgContent}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No content available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
