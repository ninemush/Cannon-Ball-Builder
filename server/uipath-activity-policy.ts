import type { AutomationPattern } from "./uipath-activity-registry";

const UI_ACTIVITIES = [
  "ui:Click",
  "ui:TypeInto",
  "ui:GetText",
  "ui:ElementExists",
  "ui:OpenBrowser",
  "ui:NavigateTo",
  "ui:AttachBrowser",
  "ui:AttachWindow",
  "ui:UseBrowser",
  "ui:UseApplicationBrowser",
  "ui:TakeScreenshot",
  "ui:HighlightElement",
  "ui:FindElement",
  "ui:WaitElementVanish",
  "ui:Check",
  "ui:SelectItem",
  "ui:GetAttribute",
  "ui:SetText",
  "ui:SendHotkey",
  "ui:MouseClick",
  "ui:HoverElement",
];

const MAIL_ACTIVITIES = [
  "ui:SendSmtpMailMessage",
  "ui:SendOutlookMailMessage",
  "ui:GetImapMailMessage",
  "ui:GetOutlookMailMessages",
  "ui:SendMail",
  "ui:GetMail",
  "ui:SendExchangeMailMessage",
  "ui:GetExchangeMailMessages",
];

const ALWAYS_BLOCKED = [
  "ui:AddLogFields",
];

const SILENTLY_BLOCKED = new Set([
  "ui:AddLogFields",
]);

const PATTERN_BLOCKED: Record<AutomationPattern, Set<string>> = {
  "simple-linear": new Set([
    ...UI_ACTIVITIES,
    ...MAIL_ACTIVITIES,
    ...ALWAYS_BLOCKED,
  ]),
  "api-data-driven": new Set([
    ...UI_ACTIVITIES,
    ...MAIL_ACTIVITIES,
    ...ALWAYS_BLOCKED,
  ]),
  "ui-automation": new Set(ALWAYS_BLOCKED),
  "transactional-queue": new Set(ALWAYS_BLOCKED),
  "hybrid": new Set(ALWAYS_BLOCKED),
};

export function getBlockedActivities(pattern: AutomationPattern): Set<string> {
  return PATTERN_BLOCKED[pattern] || new Set(ALWAYS_BLOCKED);
}

export function isActivityAllowed(activity: string, pattern: AutomationPattern, explicitlyRequired?: Set<string>): boolean {
  if (explicitlyRequired && explicitlyRequired.has(activity)) return true;
  const blocked = getBlockedActivities(pattern);
  return !blocked.has(activity);
}

export function filterBlockedActivitiesFromXaml(xaml: string, pattern: AutomationPattern): { filtered: string; removed: string[] } {
  const blocked = getBlockedActivities(pattern);
  const removed: string[] = [];

  let result = xaml;
  blocked.forEach((activity) => {
    const tag = activity.replace("ui:", "");
    const escapedActivity = activity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const selfClosingRe = new RegExp(`<${escapedActivity}\\s[^>]*?\\/>`, "g");
    const openCloseRe = new RegExp(`<${escapedActivity}[^>]*>[\\s\\S]*?<\\/${escapedActivity}>`, "g");
    const silent = SILENTLY_BLOCKED.has(activity);
    const replacement = silent ? "" : `<ui:Comment Text="Removed blocked activity: ${tag}" />`;

    if (selfClosingRe.test(result)) {
      removed.push(activity);
      result = result.replace(new RegExp(`<${escapedActivity}\\s[^>]*?\\/>`, "g"), replacement);
    }

    if (openCloseRe.test(result)) {
      if (!removed.includes(activity)) removed.push(activity);
      result = result.replace(new RegExp(`<${escapedActivity}[^>]*>[\\s\\S]*?<\\/${escapedActivity}>`, "g"), replacement);
    }
  });

  return { filtered: result, removed };
}
