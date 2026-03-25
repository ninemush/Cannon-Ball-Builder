export const UIPATH_PROMPT = `Based on the approved SDD, generate a detailed UiPath automation package specification. Output a JSON object with this exact shape:

{
  "projectName": "string (PascalCase, no spaces)",
  "description": "string",
  "dependencies": [
    "UiPath.System.Activities",
    "UiPath.UIAutomation.Activities",
    "... other specific UiPath package names needed"
  ],
  "workflows": [
    {
      "name": "string (PascalCase filename without .xaml)",
      "description": "string",
      "variables": [
        {
          "name": "string (camelCase variable name)",
          "type": "String|Int32|Boolean|DataTable|Object|DateTime|Array<String>|Dictionary<String,Object>",
          "defaultValue": "optional default value or empty string",
          "scope": "workflow|sequence (where this variable is declared)"
        }
      ],
      "steps": [
        {
          "activity": "string (human-readable step description)",
          "activityType": "string (exact UiPath activity name, e.g. ui:TypeInto, ui:Click, ui:GetText, ui:OpenBrowser, ui:ExcelApplicationScope, ui:ReadRange, ui:WriteRange, ui:SendSmtpMailMessage, ui:GetImapMailMessage, ui:HttpClient, ui:ExecuteQuery, ui:ReadTextFile, ui:WriteTextFile, ui:AddQueueItem, ui:GetTransactionItem, ui:SetTransactionStatus, ui:LogMessage, ui:Assign, ui:Delay, ui:MessageBox, If, ForEach, While, Switch, TryCatch, RetryScope, InvokeWorkflowFile)",
          "activityPackage": "string (UiPath package name from the correct domain — CORE: UiPath.System.Activities (flow/data/file), UiPath.UIAutomation.Activities (UI clicks/typing/scraping), UiPath.Testing.Activities (test automation), UiPath.Form.Activities (user forms/dialogs), UiPath.ComplexScenarios.Activities (advanced orchestration) — PRODUCTIVITY: UiPath.Excel.Activities, UiPath.Mail.Activities, UiPath.PDF.Activities, UiPath.Word.Activities, UiPath.Presentations.Activities — CLOUD/ENTERPRISE: UiPath.MicrosoftOffice365.Activities (O365/SharePoint/Outlook), UiPath.GSuite.Activities (Google Workspace), UiPath.Salesforce.Activities, UiPath.SAP.BAPI.Activities, UiPath.ServiceNow.Activities, UiPath.Jira.Activities, UiPath.Slack.Activities, UiPath.MicrosoftDynamics.Activities, UiPath.OracleNetSuite.Activities, UiPath.Workday.Activities, UiPath.AmazonWebServices.Activities, UiPath.Azure.Activities — DATA/API: UiPath.WebAPI.Activities (HTTP/REST/SOAP), UiPath.Database.Activities (SQL), UiPath.DataService.Activities, UiPath.IntegrationService.Activities, UiPath.FTP.Activities — AI/ML: UiPath.IntelligentOCR.Activities (document understanding), UiPath.MLActivities, UiPath.GenAI.Activities, UiPath.DocumentUnderstanding.ML.Activities, UiPath.Cognitive.Activities, UiPath.GoogleVision.Activities — SECURITY: UiPath.Cryptography.Activities, UiPath.Credentials.Activities — INFRASTRUCTURE: UiPath.Persistence.Activities (queues/storage), UiPath.Citrix.Activities, UiPath.Terminal.Activities, UiPath.VMware.Activities, UiPath.Python.Activities, UiPath.Java.Activities)",
          "properties": {
            "key": "value (activity-specific properties like Selector, Input, Output, FileName, SheetName, URL, Method, Headers, Body, Query, Timeout, etc.)"
          },
          "selectorHint": "string or null (placeholder UI selector pattern for UI activities, e.g. '<html app=\\"chrome\\" /><webctrl tag=\\"input\\" id=\\"username\\" />' with TODO comments for elements needing real selectors)",
          "errorHandling": "retry|catch|escalate|none (retry = wrap in RetryScope, catch = wrap in TryCatch, escalate = catch + Action Center escalation, none = no special handling)",
          "notes": "string (implementation notes, business rules, or TODO items for the developer)"
        }
      ]
    }
  ]
}

IMPORTANT RULES:
- Use SPECIFIC UiPath activity names in activityType (e.g. "ui:TypeInto" not just "Type Into")
- For UI automation steps, always include a selectorHint with a realistic placeholder selector pattern and TODO comment
- For system interaction steps (UI, API, DB, email), set errorHandling to "retry" or "catch"
- For human-in-the-loop steps, set errorHandling to "escalate"
- Include ALL variables needed by the workflow in the variables array
- Include specific properties for each activity (e.g. Selector, Input, Output, FileName, URL, Method, etc.)
- Map decision points to If/Switch activities with Condition properties
- Map loops to ForEach/While activities
- Include initialization steps (config read, variable setup) at the start of Main workflow
- Include cleanup/logging steps at the end
- List ALL required UiPath package dependencies
- Be as specific and production-ready as possible

Return ONLY the JSON object, no other text.`;


export function repairTruncatedPackageJson(rawText: string): any | null {
  try {
    let text = rawText.trim();
    const fenceStart = text.match(/```(?:json)?\s*\n/);
    if (fenceStart) {
      text = text.slice(fenceStart.index! + fenceStart[0].length);
      const fenceEnd = text.lastIndexOf("```");
      if (fenceEnd > 0) text = text.slice(0, fenceEnd);
    }

    const firstBrace = text.indexOf("{");
    if (firstBrace === -1) return null;
    text = text.slice(firstBrace);

    let inString = false;
    let escaped = false;
    let lastSafePos = 0;
    const stack: string[] = [];

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{" || ch === "[") {
        stack.push(ch === "{" ? "}" : "]");
      } else if (ch === "}" || ch === "]") {
        if (stack.length > 0) stack.pop();
      }
      if (ch === "," || ch === "}" || ch === "]") {
        lastSafePos = i;
      }
    }

    if (inString) {
      text = text.slice(0, text.lastIndexOf('"'));
    }

    for (let attempts = 0; attempts < 30; attempts++) {
      text = text.replace(/,\s*$/, "");

      let s = false, esc = false;
      const st: string[] = [];
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (esc) { esc = false; continue; }
        if (c === "\\") { esc = true; continue; }
        if (c === '"') { s = !s; continue; }
        if (s) continue;
        if (c === "{") st.push("}");
        else if (c === "[") st.push("]");
        else if (c === "}" || c === "]") { if (st.length > 0) st.pop(); }
      }

      if (s) {
        text = text.slice(0, text.lastIndexOf('"'));
        continue;
      }

      const closing = st.reverse().join("");
      try {
        return JSON.parse(text + closing);
      } catch {
        const cutPoints = [text.lastIndexOf(","), text.lastIndexOf("}")].filter(p => p > 0);
        const cutAt = Math.max(...cutPoints, -1);
        if (cutAt <= 0) return null;
        text = text.slice(0, cutAt);
      }
    }
    return null;
  } catch {
    return null;
  }
}
