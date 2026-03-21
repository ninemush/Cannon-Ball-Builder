import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Shield, ShieldOff, ShieldCheck, ShieldAlert, Info, AlertTriangle, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef, useState } from "react";
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

interface PackageCharacteristics {
  hasReFramework?: boolean;
  hasDocumentUnderstanding?: boolean;
  workflowCount?: number;
  activityCount?: number;
  isFirstProductionDeploy?: boolean;
}

interface MetaValidationBarProps {
  isGenerating?: boolean;
  metaValidationStatus?: StatusChipState;
  fixCount?: number;
  packageCharacteristics?: PackageCharacteristics;
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

function getAccentColor(status: StatusChipState, isOff: boolean): string {
  if (isOff) return "transparent";
  switch (status) {
    case "assessing":
    case "will-validate":
      return "rgb(245 158 11)";
    case "active":
    case "validating":
      return "rgb(249 115 22)";
    case "fixed":
    case "clean":
      return "rgb(34 197 94)";
    case "warning":
      return "rgb(245 158 11)";
    default:
      return "transparent";
  }
}

function getShieldIcon(status: StatusChipState, isOff: boolean) {
  if (isOff) return ShieldOff;
  switch (status) {
    case "fixed":
    case "clean":
      return ShieldCheck;
    case "warning":
      return ShieldAlert;
    default:
      return Shield;
  }
}

function getShieldColorClass(status: StatusChipState, isOff: boolean): string {
  if (isOff) return "text-muted-foreground/40";
  switch (status) {
    case "assessing":
    case "will-validate":
      return "text-amber-500 dark:text-amber-400";
    case "active":
    case "validating":
      return "text-orange-500 dark:text-orange-400";
    case "fixed":
    case "clean":
      return "text-green-500 dark:text-green-400";
    case "warning":
      return "text-amber-500 dark:text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

function isActiveState(status: StatusChipState): boolean {
  return status === "assessing" || status === "validating" || status === "active" || status === "will-validate";
}

function isResultState(status: StatusChipState): boolean {
  return status === "fixed" || status === "clean";
}

function getShimmerGradient(status: StatusChipState): string {
  let r = 249, g = 115, b = 22;
  if (status === "assessing" || status === "will-validate") {
    r = 245; g = 158; b = 11;
  }
  return `linear-gradient(90deg, transparent 0%, rgba(${r},${g},${b},0.03) 30%, rgba(${r},${g},${b},0.06) 50%, rgba(${r},${g},${b},0.03) 70%, transparent 100%)`;
}

function shouldRecommendAlways(chars?: PackageCharacteristics): boolean {
  if (!chars) return false;
  if (chars.hasReFramework) return true;
  if (chars.hasDocumentUnderstanding) return true;
  if ((chars.workflowCount ?? 0) > 8) return true;
  if ((chars.activityCount ?? 0) > 100) return true;
  if (chars.isFirstProductionDeploy) return true;
  return false;
}

export function MetaValidationBar({ isGenerating, metaValidationStatus = "ready", fixCount, packageCharacteristics }: MetaValidationBarProps) {
  const { toast } = useToast();
  const [flash, setFlash] = useState(false);
  const prevStatusRef = useRef<StatusChipState>(metaValidationStatus);

  const { data: settings } = useQuery<{ mode: MetaValidationMode }>({
    queryKey: ["/api/settings/meta-validation"],
  });

  const currentMode = settings?.mode || "Auto";
  const isOff = currentMode === "Off";
  const showAlwaysHint = currentMode !== "Always" && shouldRecommendAlways(packageCharacteristics);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = metaValidationStatus;
    if (prev !== metaValidationStatus && isResultState(metaValidationStatus)) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [metaValidationStatus]);

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
  const accentColor = getAccentColor(metaValidationStatus, isOff);
  const ShieldIcon = getShieldIcon(metaValidationStatus, isOff);
  const shieldColorClass = getShieldColorClass(metaValidationStatus, isOff);
  const active = isActiveState(metaValidationStatus) && !isOff;
  const isChipActive = (isActiveState(metaValidationStatus) || metaValidationStatus === "warning") && !isOff;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={`relative flex items-center justify-between px-3 py-1.5 border-b border-border bg-background/80 backdrop-blur-sm overflow-hidden transition-all duration-300 ${isOff ? "opacity-60" : ""}`}
        style={{ maxHeight: "40px" }}
        data-testid="meta-validation-bar"
      >
        <div
          className="absolute left-0 top-0 bottom-0 transition-all duration-500"
          style={{
            width: accentColor === "transparent" ? "0px" : "3px",
            backgroundColor: accentColor,
            opacity: active ? 1 : 0.8,
            animation: active ? "accent-pulse 1.5s ease-in-out infinite" : "none",
          }}
          data-testid="meta-validation-accent"
        />

        {active && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: getShimmerGradient(metaValidationStatus),
              animation: "shimmer-sweep 2s ease-in-out infinite",
            }}
            data-testid="meta-validation-shimmer"
          />
        )}

        {flash && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundColor: metaValidationStatus === "fixed" || metaValidationStatus === "clean"
                ? "rgb(34 197 94 / 0.12)"
                : "rgb(245 158 11 / 0.12)",
              animation: "result-flash 1.2s ease-out forwards",
            }}
            data-testid="meta-validation-flash"
          />
        )}

        <div className="flex items-center gap-2 relative z-10">
          <ShieldIcon
            className={`h-3.5 w-3.5 transition-colors duration-300 ${shieldColorClass} ${active && !isOff ? "animate-[shield-spin_2s_ease-in-out_infinite]" : ""}`}
            data-testid="meta-validation-shield-icon"
          />
          <span className={`text-[10px] font-medium transition-colors duration-300 ${isOff ? "text-muted-foreground/50" : "text-muted-foreground"}`} data-testid="quality-check-label">Quality Check</span>
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

          {isOff && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30" data-testid="meta-validation-off-warning">
                  <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  <span className="text-[9px] text-amber-700 dark:text-amber-400 font-medium">Unverified</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" collisionPadding={8} className="max-w-[280px] text-xs leading-relaxed">
                <p>Quality Check is off. Generated packages may contain structural errors, missing properties, or invalid expressions that will only be caught when opened in UiPath Studio.</p>
                <p className="mt-1.5 text-[10px] text-muted-foreground">Switch to Auto or Always to have issues detected and fixed before download.</p>
              </TooltipContent>
            </Tooltip>
          )}

          {showAlwaysHint && !isOff && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20" data-testid="meta-validation-always-hint">
                  <Lightbulb className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                  <span className="text-[9px] text-blue-600 dark:text-blue-400 font-medium">Always recommended</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" collisionPadding={8} className="max-w-[280px] text-xs leading-relaxed">
                <p>This package has characteristics that benefit from a full quality review on every generation: {
                  [
                    packageCharacteristics?.hasReFramework && "ReFramework",
                    packageCharacteristics?.hasDocumentUnderstanding && "Document Understanding",
                    (packageCharacteristics?.workflowCount ?? 0) > 8 && `${packageCharacteristics?.workflowCount} workflows`,
                    (packageCharacteristics?.activityCount ?? 0) > 100 && `${packageCharacteristics?.activityCount} activities`,
                    packageCharacteristics?.isFirstProductionDeploy && "first production deploy",
                  ].filter(Boolean).join(", ")
                }.</p>
                <p className="mt-1.5 text-[10px] text-muted-foreground">Consider switching to Always mode for this package.</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div
          className={`relative z-10 flex items-center px-2 py-0.5 rounded-full transition-all duration-300 ${chipConfig.className} ${chipConfig.pulse ? "animate-pulse" : ""} ${isChipActive ? "text-[11px] font-semibold" : "text-[10px] font-medium"}`}
          data-testid="meta-validation-status-chip"
        >
          {chipConfig.label}
        </div>
      </div>

      <style>{`
        @keyframes shimmer-sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes result-flash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes accent-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes shield-spin {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.15) rotate(-5deg); }
          75% { transform: scale(1.15) rotate(5deg); }
        }
      `}</style>
    </TooltipProvider>
  );
}
