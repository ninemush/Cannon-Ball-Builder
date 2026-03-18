import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Shield, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type MetaValidationMode = "Auto" | "Always" | "Off";

type StatusChipState =
  | "ready"
  | "assessing"
  | "will-validate"
  | "not-needed"
  | "active"
  | "validating"
  | "fixed"
  | "clean"
  | "warning";

interface MetaValidationBarProps {
  isGenerating?: boolean;
  metaValidationStatus?: StatusChipState;
  fixCount?: number;
}

const MODE_OPTIONS: MetaValidationMode[] = ["Auto", "Always", "Off"];

const MODE_ALIGN: Record<MetaValidationMode, "start" | "center" | "end"> = {
  Auto: "start",
  Always: "center",
  Off: "end",
};

const MODE_TOOLTIPS: Record<MetaValidationMode, { description: string; time: string; cost: string }> = {
  Auto: {
    description: "Runs a quality review only when risk factors are detected — such as multiple workflows, complex API integrations, or a low template compliance score. You'll see a notice in the progress log when it activates.",
    time: "⏱ +10–30s when triggered",
    cost: "💰 Small token cost when triggered",
  },
  Always: {
    description: "Runs a quality review on every generation regardless of complexity. Best for critical processes where getting it right first time matters more than speed. Uses a lightweight AI model to keep costs low.",
    time: "⏱ +10–30s on every generation",
    cost: "💰 Small token cost on every generation",
  },
  Off: {
    description: "Skips the quality review entirely. Fastest builds with no additional cost. Generated package ships without a second-pass check — recommended only for simple processes or when iterating quickly.",
    time: "⏱ No additional time",
    cost: "💰 No additional cost",
  },
};

function getChipConfig(status: StatusChipState, fixCount?: number): { label: string; className: string; pulse?: boolean } {
  switch (status) {
    case "ready":
      return { label: "Ready", className: "bg-muted text-muted-foreground" };
    case "assessing":
      return { label: "Assessing...", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
    case "will-validate":
      return { label: "Will validate", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
    case "not-needed":
      return { label: "Not needed", className: "bg-muted text-muted-foreground" };
    case "active":
      return { label: "Active", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" };
    case "validating":
      return { label: "Validating...", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", pulse: true };
    case "fixed":
      return { label: `✓ ${fixCount || 0} fix${(fixCount || 0) !== 1 ? "es" : ""}`, className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
    case "clean":
      return { label: "✓ Clean", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
    case "warning":
      return { label: `⚠ Review needed${fixCount ? ` (${fixCount} fix${fixCount !== 1 ? "es" : ""})` : ""}`, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
    default:
      return { label: "Ready", className: "bg-muted text-muted-foreground" };
  }
}

export function MetaValidationBar({ isGenerating, metaValidationStatus = "ready", fixCount }: MetaValidationBarProps) {
  const { toast } = useToast();

  const { data: settings } = useQuery<{ mode: MetaValidationMode }>({
    queryKey: ["/api/settings/meta-validation"],
  });

  const currentMode = settings?.mode || "Auto";

  const updateMode = useMutation({
    mutationFn: async (mode: MetaValidationMode) => {
      return apiRequest("PUT", "/api/settings/meta-validation", { mode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/meta-validation"] });
    },
  });

  const handleModeChange = (mode: MetaValidationMode) => {
    if (isGenerating) {
      toast({
        title: "Mode change queued",
        description: "Will apply to next generation.",
      });
    }
    updateMode.mutate(mode);
  };

  const chipConfig = getChipConfig(metaValidationStatus, fixCount);

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-background/80 backdrop-blur-sm"
        style={{ maxHeight: "40px" }}
        data-testid="meta-validation-bar"
      >
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-medium text-muted-foreground" data-testid="quality-check-label">Quality Check</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex items-center" data-testid="quality-check-info-icon">
                <Info className="h-3 w-3 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" collisionPadding={8} className="max-w-[280px] text-xs leading-relaxed">
              <p>Quality Check runs an AI-powered review of your generated package before it is built. It checks for structural errors, missing properties, and common XAML mistakes that would prevent the package from opening correctly in UiPath Studio.</p>
              <p className="mt-2">The review uses a lightweight AI model (Haiku) to keep costs low.</p>
            </TooltipContent>
          </Tooltip>
          <div className="flex items-center rounded-full border border-border overflow-hidden" data-testid="meta-validation-mode-selector">
            {MODE_OPTIONS.map((mode) => (
              <Tooltip key={mode}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleModeChange(mode)}
                    className={`px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                      currentMode === mode
                        ? "bg-orange-500 text-white dark:bg-orange-600"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                    data-testid={`meta-validation-mode-${mode.toLowerCase()}`}
                  >
                    {mode}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align={MODE_ALIGN[mode]} collisionPadding={8} className="max-w-[260px] text-xs leading-relaxed">
                  <p>{MODE_TOOLTIPS[mode].description}</p>
                  <div className="mt-1.5 pt-1.5 border-t border-border/50 space-y-0.5 text-[10px] text-muted-foreground">
                    <p>{MODE_TOOLTIPS[mode].time}</p>
                    <p>{MODE_TOOLTIPS[mode].cost}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        <div
          className={`flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-300 ${chipConfig.className} ${chipConfig.pulse ? "animate-pulse" : ""}`}
          data-testid="meta-validation-status-chip"
        >
          {chipConfig.label}
        </div>
      </div>
    </TooltipProvider>
  );
}
