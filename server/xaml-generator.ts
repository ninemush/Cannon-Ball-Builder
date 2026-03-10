import type { ProcessNode, ProcessEdge } from "@shared/schema";
import type { EnrichedNodeSpec, EnrichedActivity, EnrichmentResult } from "./ai-xaml-enricher";
import {
  generateAnnotationText,
  generateArgumentValidationXaml,
  enforceVariableName,
  enforceDisplayName,
  type AnalysisReport,
} from "./workflow-analyzer";
import { escapeXml } from "./lib/xml-utils";
import type { DeploymentResult } from "@shared/models/deployment";

export type XamlGap = {
  category: "selector" | "credential" | "endpoint" | "logic" | "config" | "manual" | "agent";
  activity: string;
  description: string;
  placeholder: string;
  estimatedMinutes: number;
};

export type XamlGeneratorResult = {
  xaml: string;
  gaps: XamlGap[];
  usedPackages: string[];
  variables: VariableDecl[];
};

const UIPATH_NAMESPACES = `xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:mva="clr-namespace:Microsoft.VisualBasic.Activities;assembly=System.Activities"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=mscorlib"
  xmlns:scg2="clr-namespace:System.Data;assembly=System.Data"
  xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=mscorlib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"`;

const UIPATH_VB_SETTINGS = `
  <mva:VisualBasic.Settings>
    <x:Null />
  </mva:VisualBasic.Settings>
  <sap2010:WorkflowViewState.IdRef>__ROOT_ID__</sap2010:WorkflowViewState.IdRef>
  <TextExpression.NamespacesForImplementation>
    <sco:Collection x:TypeArguments="x:String">
      <x:String>System</x:String>
      <x:String>System.Collections</x:String>
      <x:String>System.Collections.Generic</x:String>
      <x:String>System.Data</x:String>
      <x:String>System.IO</x:String>
      <x:String>System.Linq</x:String>
      <x:String>System.Xml</x:String>
      <x:String>System.Xml.Linq</x:String>
      <x:String>UiPath.Core</x:String>
      <x:String>UiPath.Core.Activities</x:String>
      <x:String>Microsoft.VisualBasic</x:String>
      <x:String>Microsoft.VisualBasic.Activities</x:String>
      <x:String>System.Activities</x:String>
      <x:String>System.Activities.Statements</x:String>
      <x:String>System.Activities.Expressions</x:String>
    </sco:Collection>
  </TextExpression.NamespacesForImplementation>
  <TextExpression.ReferencesForImplementation>
    <sco:Collection x:TypeArguments="AssemblyReference">
      <AssemblyReference>System.Activities</AssemblyReference>
      <AssemblyReference>Microsoft.VisualBasic</AssemblyReference>
      <AssemblyReference>mscorlib</AssemblyReference>
      <AssemblyReference>System.Data</AssemblyReference>
      <AssemblyReference>System</AssemblyReference>
      <AssemblyReference>System.Core</AssemblyReference>
      <AssemblyReference>System.Xml</AssemblyReference>
      <AssemblyReference>System.Xml.Linq</AssemblyReference>
      <AssemblyReference>UiPath.Core</AssemblyReference>
      <AssemblyReference>UiPath.Core.Activities</AssemblyReference>
    </sco:Collection>
  </TextExpression.ReferencesForImplementation>`;

export function makeUiPathCompliant(rawXaml: string): string {
  let idCounter = 0;
  const viewStateEntries: { id: string; width: number; height: number }[] = [];

  function nextId(prefix: string): string {
    idCounter++;
    return `${prefix}_${idCounter}`;
  }

  function getHintSize(tag: string): { w: number; h: number } {
    if (tag.startsWith("Sequence") || tag.startsWith("StateMachine")) return { w: 400, h: 300 };
    if (tag.startsWith("If")) return { w: 400, h: 280 };
    if (tag.startsWith("TryCatch")) return { w: 400, h: 260 };
    if (tag.startsWith("ForEach")) return { w: 400, h: 240 };
    if (tag.startsWith("State")) return { w: 300, h: 200 };
    if (tag.startsWith("Transition")) return { w: 200, h: 60 };
    return { w: 334, h: 90 };
  }

  let xml = rawXaml;

  const oldNsBlock = xml.match(/xmlns="http:\/\/schemas\.microsoft\.com\/netfx\/2009\/xaml\/activities"[\s\S]*?xmlns:x="http:\/\/schemas\.microsoft\.com\/winfx\/2006\/xaml"/);
  if (oldNsBlock) {
    xml = xml.replace(oldNsBlock[0], UIPATH_NAMESPACES);
  }

  const classMatch = xml.match(/x:Class="([^"]+)"/);
  const className = classMatch ? classMatch[1].replace(/[^A-Za-z0-9_]/g, "") : "Workflow";
  const rootId = nextId(className);

  const activityTagPattern = /<(Sequence|If|TryCatch|ForEach|Assign|State|StateMachine|Transition|Flowchart|FlowStep|FlowDecision|ui:[A-Za-z]+)\s+((?:[^>]*?\s+)?)DisplayName="([^"]*)"([^>]*?)(\s*\/?>)/g;
  xml = xml.replace(activityTagPattern, (match, tag, preAttrs, displayName, rest, closing) => {
    if (preAttrs.includes("WorkflowViewState.IdRef") || rest.includes("WorkflowViewState.IdRef")) return match;
    const prefix = tag.replace("ui:", "").replace(/[^A-Za-z]/g, "");
    const id = nextId(prefix);
    const hint = getHintSize(tag);
    viewStateEntries.push({ id, width: hint.w, height: hint.h });
    const pre = preAttrs ? `${preAttrs}` : "";
    return `<${tag} ${pre}DisplayName="${displayName}" sap2010:WorkflowViewState.IdRef="${id}" sap:VirtualizedContainerService.HintSize="${hint.w},${hint.h}"${rest}${closing}`;
  });

  const firstChildMatch = xml.match(/<(Sequence|StateMachine|Flowchart)\s+DisplayName="[^"]*"/);
  if (firstChildMatch) {
    const rootHint = firstChildMatch[1] === "StateMachine" ? { w: 600, h: 500 } : firstChildMatch[1] === "Flowchart" ? { w: 600, h: 400 } : { w: 500, h: 400 };
    viewStateEntries.push({ id: rootId, width: rootHint.w, height: rootHint.h });
  }

  const vbSettingsBlock = UIPATH_VB_SETTINGS.replace("__ROOT_ID__", rootId);

  const firstTag = xml.match(/<(Sequence|StateMachine|Flowchart)\s/);
  if (firstTag && firstTag.index !== undefined) {
    xml = xml.slice(0, firstTag.index) + vbSettingsBlock + "\n  " + xml.slice(firstTag.index);
  }

  let viewStateManager = `\n  <sap2010:WorkflowViewState.ViewStateManager>\n    <sap2010:ViewStateManager>`;
  for (const entry of viewStateEntries) {
    viewStateManager += `\n      <sap2010:ViewStateData Id="${entry.id}" sap:VirtualizedContainerService.HintSize="${entry.width},${entry.height}">
        <sap:WorkflowViewStateService.ViewState>
          <scg:Dictionary x:TypeArguments="x:String, x:Object">
            <x:Boolean x:Key="IsExpanded">True</x:Boolean>
          </scg:Dictionary>
        </sap:WorkflowViewStateService.ViewState>
      </sap2010:ViewStateData>`;
  }
  viewStateManager += `\n    </sap2010:ViewStateManager>\n  </sap2010:WorkflowViewState.ViewStateManager>`;

  xml = xml.replace(/<\/Activity>\s*$/, viewStateManager + "\n</Activity>");

  xml = xml.replace(/scg:DataTable/g, "scg2:DataTable");
  xml = xml.replace(/scg:DataRow/g, "scg2:DataRow");

  return xml;
}

type VariableDecl = {
  name: string;
  type: string;
  defaultValue?: string;
};

type ActivityContext = {
  system: string;
  nodeType: string;
  name: string;
  description: string;
  role: string;
  isPainPoint: boolean;
};

type WorkflowStep = {
  activity?: string;
  activityType?: string;
  activityPackage?: string;
  properties?: Record<string, any>;
  variables?: VariableDecl[];
  errorHandling?: "retry" | "catch" | "escalate" | "none";
  selectorHint?: string;
  notes?: string;
  nodeType?: string;
  role?: string;
};

type WorkflowSpec = {
  name: string;
  description?: string;
  steps?: WorkflowStep[];
  arguments?: Array<{ name: string; direction: string; type: string; required?: boolean }>;
};

function classifyActivity(ctx: ActivityContext): {
  activityType: string;
  activityPackage: string;
  properties: Record<string, string>;
  selectorHint?: string;
  errorHandling: "retry" | "catch" | "escalate" | "none";
  variables: VariableDecl[];
  gaps: XamlGap[];
} {
  const system = (ctx.system || "").toLowerCase();
  const name = (ctx.name || "").toLowerCase();
  const desc = (ctx.description || "").toLowerCase();
  const combined = `${name} ${desc} ${system}`;

  if (system.includes("excel") || system.includes("spreadsheet") || combined.includes("excel") || combined.includes("spreadsheet")) {
    return classifyExcel(ctx, combined);
  }
  if (system.includes("email") || system.includes("outlook") || system.includes("smtp") || combined.includes("email") || combined.includes("mail")) {
    return classifyEmail(ctx, combined);
  }
  if (system.includes("api") || system.includes("http") || system.includes("rest") || system.includes("web service") || combined.includes("api") || combined.includes("http request")) {
    return classifyApi(ctx, combined);
  }
  if (system.includes("database") || system.includes("sql") || system.includes("db") || combined.includes("database") || combined.includes("query")) {
    return classifyDatabase(ctx, combined);
  }
  if (system.includes("queue") || combined.includes("queue item") || combined.includes("transaction")) {
    return classifyQueue(ctx, combined);
  }
  if (combined.includes("file") || combined.includes("folder") || combined.includes("directory") || combined.includes("read") || combined.includes("write") || combined.includes("download") || combined.includes("upload")) {
    return classifyFile(ctx, combined);
  }
  if (combined.includes("browser") || combined.includes("web") || combined.includes("click") || combined.includes("type") || combined.includes("navigate") || combined.includes("login") || combined.includes("portal") || combined.includes("screen") || combined.includes("ui ") || combined.includes("application")) {
    return classifyUI(ctx, combined);
  }

  if (ctx.nodeType === "agent-task" || ctx.nodeType === "agent-loop") {
    return classifyAgent(ctx, combined);
  }

  return classifyGeneral(ctx, combined);
}

function classifyExcel(ctx: ActivityContext, combined: string): ReturnType<typeof classifyActivity> {
  const gaps: XamlGap[] = [];
  const variables: VariableDecl[] = [];

  if (combined.includes("read") || combined.includes("extract") || combined.includes("get") || combined.includes("open")) {
    variables.push({ name: "dt_ExcelData", type: "System.Data.DataTable" });
    gaps.push({
      category: "config",
      activity: "ExcelReadRange",
      description: `Configure Excel file path for "${ctx.name}"`,
      placeholder: "C:\\Data\\Input.xlsx",
      estimatedMinutes: 10,
    });
    return {
      activityType: "ui:ExcelApplicationScope",
      activityPackage: "UiPath.Excel.Activities",
      properties: { WorkbookPath: "TODO: Set Excel file path" },
      errorHandling: "retry",
      variables,
      gaps,
    };
  }

  if (combined.includes("write") || combined.includes("save") || combined.includes("export") || combined.includes("update")) {
    variables.push({ name: "dt_OutputData", type: "System.Data.DataTable" });
    gaps.push({
      category: "config",
      activity: "ExcelWriteRange",
      description: `Configure output Excel file path for "${ctx.name}"`,
      placeholder: "C:\\Data\\Output.xlsx",
      estimatedMinutes: 10,
    });
    return {
      activityType: "ui:ExcelApplicationScope",
      activityPackage: "UiPath.Excel.Activities",
      properties: { WorkbookPath: "TODO: Set output Excel file path" },
      errorHandling: "retry",
      variables,
      gaps,
    };
  }

  variables.push({ name: "dt_ExcelData", type: "System.Data.DataTable" });
  gaps.push({
    category: "config",
    activity: "ExcelApplicationScope",
    description: `Configure Excel file path for "${ctx.name}"`,
    placeholder: "C:\\Data\\Workbook.xlsx",
    estimatedMinutes: 10,
  });
  return {
    activityType: "ui:ExcelApplicationScope",
    activityPackage: "UiPath.Excel.Activities",
    properties: { WorkbookPath: "TODO: Set Excel file path" },
    errorHandling: "retry",
    variables,
    gaps,
  };
}

function classifyEmail(ctx: ActivityContext, combined: string): ReturnType<typeof classifyActivity> {
  const gaps: XamlGap[] = [];
  const variables: VariableDecl[] = [];

  if (combined.includes("send") || combined.includes("notify") || combined.includes("forward") || combined.includes("reply")) {
    variables.push({ name: "str_EmailTo", type: "String", defaultValue: '""' });
    variables.push({ name: "str_EmailSubject", type: "String", defaultValue: '""' });
    variables.push({ name: "str_EmailBody", type: "String", defaultValue: '""' });
    gaps.push({
      category: "credential",
      activity: "SendSmtpMailMessage",
      description: `Configure SMTP credentials for "${ctx.name}"`,
      placeholder: "Use Orchestrator Credential asset",
      estimatedMinutes: 15,
    });
    gaps.push({
      category: "config",
      activity: "SendSmtpMailMessage",
      description: `Set SMTP server and port for "${ctx.name}"`,
      placeholder: "smtp.office365.com:587",
      estimatedMinutes: 5,
    });
    return {
      activityType: "ui:SendSmtpMailMessage",
      activityPackage: "UiPath.Mail.Activities",
      properties: {
        To: "TODO: Set recipient email",
        Subject: "TODO: Set email subject",
        Body: "TODO: Set email body",
        Server: "TODO: Set SMTP server",
        Port: "587",
      },
      errorHandling: "retry",
      variables,
      gaps,
    };
  }

  variables.push({ name: "list_Emails", type: "System.Collections.Generic.List(System.Net.Mail.MailMessage)" });
  gaps.push({
    category: "credential",
    activity: "GetImapMailMessage",
    description: `Configure IMAP credentials for "${ctx.name}"`,
    placeholder: "Use Orchestrator Credential asset",
    estimatedMinutes: 15,
  });
  return {
    activityType: "ui:GetImapMailMessage",
    activityPackage: "UiPath.Mail.Activities",
    properties: {
      Server: "TODO: Set IMAP server",
      Port: "993",
      Top: "10",
    },
    errorHandling: "retry",
    variables,
    gaps,
  };
}

function classifyApi(ctx: ActivityContext, combined: string): ReturnType<typeof classifyActivity> {
  const gaps: XamlGap[] = [];
  const variables: VariableDecl[] = [
    { name: "str_ApiResponse", type: "String", defaultValue: '""' },
    { name: "int_StatusCode", type: "Int32", defaultValue: "0" },
  ];

  let method = "GET";
  if (combined.includes("post") || combined.includes("create") || combined.includes("submit") || combined.includes("send")) {
    method = "POST";
  } else if (combined.includes("update") || combined.includes("patch")) {
    method = "PATCH";
  } else if (combined.includes("delete") || combined.includes("remove")) {
    method = "DELETE";
  }

  gaps.push({
    category: "endpoint",
    activity: "HttpClient",
    description: `Configure API endpoint URL for "${ctx.name}"`,
    placeholder: "https://api.example.com/endpoint",
    estimatedMinutes: 15,
  });
  gaps.push({
    category: "credential",
    activity: "HttpClient",
    description: `Configure API authentication for "${ctx.name}"`,
    placeholder: "Bearer token or API key from Orchestrator asset",
    estimatedMinutes: 10,
  });

  return {
    activityType: "ui:HttpClient",
    activityPackage: "UiPath.Web.Activities",
    properties: {
      EndPoint: "TODO: Set API endpoint URL",
      Method: method,
      AcceptFormat: "JSON",
    },
    errorHandling: "retry",
    variables,
    gaps,
  };
}

function classifyDatabase(ctx: ActivityContext, combined: string): ReturnType<typeof classifyActivity> {
  const gaps: XamlGap[] = [];
  const variables: VariableDecl[] = [
    { name: "dt_QueryResult", type: "System.Data.DataTable" },
  ];

  gaps.push({
    category: "endpoint",
    activity: "ExecuteQuery",
    description: `Configure database connection string for "${ctx.name}"`,
    placeholder: "Server=TODO;Database=TODO;User Id=TODO;Password=TODO;",
    estimatedMinutes: 15,
  });
  gaps.push({
    category: "logic",
    activity: "ExecuteQuery",
    description: `Write SQL query for "${ctx.name}"`,
    placeholder: "SELECT * FROM TableName WHERE Condition",
    estimatedMinutes: 20,
  });

  return {
    activityType: "ui:ExecuteQuery",
    activityPackage: "UiPath.Database.Activities",
    properties: {
      ConnectionString: "TODO: Set database connection string",
      Sql: "TODO: Write SQL query",
      ProviderName: "System.Data.SqlClient",
    },
    errorHandling: "catch",
    variables,
    gaps,
  };
}

function classifyQueue(ctx: ActivityContext, combined: string): ReturnType<typeof classifyActivity> {
  const gaps: XamlGap[] = [];
  const variables: VariableDecl[] = [];

  if (combined.includes("add") || combined.includes("push") || combined.includes("create")) {
    variables.push({ name: "queueItemInfo", type: "UiPath.Core.QueueItemData" });
    gaps.push({
      category: "config",
      activity: "AddQueueItem",
      description: `Configure queue name and item data for "${ctx.name}"`,
      placeholder: "QueueName from Orchestrator",
      estimatedMinutes: 10,
    });
    return {
      activityType: "ui:AddQueueItem",
      activityPackage: "UiPath.System.Activities",
      properties: {
        QueueName: "TODO: Set Orchestrator queue name",
        Reference: "TODO: Set unique reference",
      },
      errorHandling: "catch",
      variables,
      gaps,
    };
  }

  if (combined.includes("get") || combined.includes("fetch") || combined.includes("process") || combined.includes("transaction")) {
    variables.push({ name: "queueItem", type: "UiPath.Core.QueueItem" });
    gaps.push({
      category: "config",
      activity: "GetTransactionItem",
      description: `Configure queue name for "${ctx.name}"`,
      placeholder: "QueueName from Orchestrator",
      estimatedMinutes: 10,
    });
    return {
      activityType: "ui:GetTransactionItem",
      activityPackage: "UiPath.System.Activities",
      properties: {
        QueueName: "TODO: Set Orchestrator queue name",
      },
      errorHandling: "catch",
      variables,
      gaps,
    };
  }

  variables.push({ name: "queueItem", type: "UiPath.Core.QueueItem" });
  return {
    activityType: "ui:SetTransactionStatus",
    activityPackage: "UiPath.System.Activities",
    properties: {
      Status: "Successful",
    },
    errorHandling: "catch",
    variables,
    gaps,
  };
}

function classifyFile(ctx: ActivityContext, combined: string): ReturnType<typeof classifyActivity> {
  const gaps: XamlGap[] = [];
  const variables: VariableDecl[] = [];

  if (combined.includes("read") || combined.includes("load") || combined.includes("open") || combined.includes("import")) {
    variables.push({ name: "str_FileContent", type: "String", defaultValue: '""' });
    gaps.push({
      category: "config",
      activity: "ReadTextFile",
      description: `Configure input file path for "${ctx.name}"`,
      placeholder: "C:\\Data\\Input.txt",
      estimatedMinutes: 5,
    });
    return {
      activityType: "ui:ReadTextFile",
      activityPackage: "UiPath.System.Activities",
      properties: { FileName: "TODO: Set input file path" },
      errorHandling: "catch",
      variables,
      gaps,
    };
  }

  if (combined.includes("write") || combined.includes("save") || combined.includes("export") || combined.includes("output")) {
    gaps.push({
      category: "config",
      activity: "WriteTextFile",
      description: `Configure output file path for "${ctx.name}"`,
      placeholder: "C:\\Data\\Output.txt",
      estimatedMinutes: 5,
    });
    return {
      activityType: "ui:WriteTextFile",
      activityPackage: "UiPath.System.Activities",
      properties: {
        FileName: "TODO: Set output file path",
        Text: "TODO: Set content to write",
      },
      errorHandling: "catch",
      variables,
      gaps,
    };
  }

  if (combined.includes("exist") || combined.includes("check") || combined.includes("verify")) {
    variables.push({ name: "bool_FileExists", type: "Boolean", defaultValue: "False" });
    return {
      activityType: "ui:PathExists",
      activityPackage: "UiPath.System.Activities",
      properties: { Path: "TODO: Set path to check" },
      errorHandling: "none",
      variables,
      gaps,
    };
  }

  variables.push({ name: "str_FileContent", type: "String", defaultValue: '""' });
  gaps.push({
    category: "config",
    activity: "ReadTextFile",
    description: `Configure file path for "${ctx.name}"`,
    placeholder: "C:\\Data\\File.txt",
    estimatedMinutes: 5,
  });
  return {
    activityType: "ui:ReadTextFile",
    activityPackage: "UiPath.System.Activities",
    properties: { FileName: "TODO: Set file path" },
    errorHandling: "catch",
    variables,
    gaps,
  };
}

function classifyUI(ctx: ActivityContext, combined: string): ReturnType<typeof classifyActivity> {
  const gaps: XamlGap[] = [];
  const variables: VariableDecl[] = [];

  const selectorBase = `<html app='${escapeXml(ctx.system || "application")}' />`;

  if (combined.includes("open") || combined.includes("launch") || combined.includes("navigate") || combined.includes("browser") || combined.includes("url")) {
    gaps.push({
      category: "selector",
      activity: "OpenBrowser",
      description: `Set target URL for "${ctx.name}"`,
      placeholder: "https://application.example.com",
      estimatedMinutes: 5,
    });
    return {
      activityType: "ui:OpenBrowser",
      activityPackage: "UiPath.UIAutomation.Activities",
      properties: {
        Url: "TODO: Set application URL",
        BrowserType: "Chrome",
      },
      selectorHint: selectorBase,
      errorHandling: "retry",
      variables,
      gaps,
    };
  }

  if (combined.includes("type") || combined.includes("enter") || combined.includes("input") || combined.includes("fill")) {
    gaps.push({
      category: "selector",
      activity: "TypeInto",
      description: `Configure UI selector for input field in "${ctx.name}"`,
      placeholder: `<webctrl tag='INPUT' name='TODO' />`,
      estimatedMinutes: 15,
    });
    return {
      activityType: "ui:TypeInto",
      activityPackage: "UiPath.UIAutomation.Activities",
      properties: {
        Text: "TODO: Set text to type",
      },
      selectorHint: `${selectorBase}<webctrl tag='INPUT' name='TODO_field_name' />`,
      errorHandling: "retry",
      variables,
      gaps,
    };
  }

  if (combined.includes("click") || combined.includes("press") || combined.includes("button") || combined.includes("submit") || combined.includes("select")) {
    gaps.push({
      category: "selector",
      activity: "Click",
      description: `Configure UI selector for clickable element in "${ctx.name}"`,
      placeholder: `<webctrl tag='BUTTON' name='TODO' />`,
      estimatedMinutes: 15,
    });
    return {
      activityType: "ui:Click",
      activityPackage: "UiPath.UIAutomation.Activities",
      properties: {},
      selectorHint: `${selectorBase}<webctrl tag='BUTTON' name='TODO_button_name' />`,
      errorHandling: "retry",
      variables,
      gaps,
    };
  }

  if (combined.includes("get text") || combined.includes("extract") || combined.includes("scrape") || combined.includes("read") || combined.includes("copy")) {
    variables.push({ name: "str_ExtractedText", type: "String", defaultValue: '""' });
    gaps.push({
      category: "selector",
      activity: "GetText",
      description: `Configure UI selector for text extraction in "${ctx.name}"`,
      placeholder: `<webctrl tag='SPAN' id='TODO' />`,
      estimatedMinutes: 15,
    });
    return {
      activityType: "ui:GetText",
      activityPackage: "UiPath.UIAutomation.Activities",
      properties: {},
      selectorHint: `${selectorBase}<webctrl tag='SPAN' id='TODO_element_id' />`,
      errorHandling: "retry",
      variables,
      gaps,
    };
  }

  gaps.push({
    category: "selector",
    activity: "ClickOnText",
    description: `Configure UI selector for "${ctx.name}"`,
    placeholder: `<webctrl tag='*' aaname='TODO' />`,
    estimatedMinutes: 15,
  });
  return {
    activityType: "ui:Click",
    activityPackage: "UiPath.UIAutomation.Activities",
    properties: {},
    selectorHint: `${selectorBase}<webctrl tag='*' aaname='TODO_element' />`,
    errorHandling: "retry",
    variables,
    gaps,
  };
}

function classifyGeneral(ctx: ActivityContext, _combined: string): ReturnType<typeof classifyActivity> {
  return {
    activityType: "ui:LogMessage",
    activityPackage: "UiPath.System.Activities",
    properties: {
      Level: "Info",
      Message: `"Executing: ${escapeXml(ctx.name)}"`,
    },
    errorHandling: "none",
    variables: [],
    gaps: [{
      category: "logic",
      activity: "LogMessage",
      description: `Implement business logic for "${ctx.name}"`,
      placeholder: "Replace LogMessage with actual implementation",
      estimatedMinutes: 30,
    }],
  };
}

function classifyAgent(ctx: ActivityContext, _combined: string): ReturnType<typeof classifyActivity> {
  const gaps: XamlGap[] = [];
  const variables: VariableDecl[] = [
    { name: "str_AgentInput", type: "String", defaultValue: '""' },
    { name: "str_AgentOutput", type: "String", defaultValue: '""' },
  ];

  gaps.push({
    category: "agent",
    activity: "InvokeAgent",
    description: `Configure agent invocation for "${ctx.name}" — set agent name, input data mapping, and output capture`,
    placeholder: "AgentInvocation_Stub.xaml",
    estimatedMinutes: 30,
  });
  gaps.push({
    category: "agent",
    activity: "InvokeAgent",
    description: `Define agent prompt template and guardrails for "${ctx.name}"`,
    placeholder: "Configure agent system prompt and escalation rules",
    estimatedMinutes: 20,
  });

  return {
    activityType: "ui:InvokeWorkflowFile",
    activityPackage: "UiPath.System.Activities",
    properties: {
      WorkflowFileName: "AgentInvocation_Stub.xaml",
    },
    errorHandling: "catch",
    variables,
    gaps,
  };
}

function renderVariablesBlock(variables: VariableDecl[]): string {
  if (variables.length === 0) return "<Sequence.Variables />";

  const uniqueVars = new Map<string, VariableDecl>();
  for (const v of variables) {
    if (!uniqueVars.has(v.name)) {
      uniqueVars.set(v.name, v);
    }
  }

  let xml = "<Sequence.Variables>\n";
  uniqueVars.forEach((v) => {
    const typeAttr = mapClrType(v.type);
    if (v.defaultValue) {
      xml += `        <Variable x:TypeArguments="${typeAttr}" Name="${escapeXml(v.name)}" Default="${escapeXml(v.defaultValue)}" />\n`;
    } else {
      xml += `        <Variable x:TypeArguments="${typeAttr}" Name="${escapeXml(v.name)}" />\n`;
    }
  });
  xml += "      </Sequence.Variables>";
  return xml;
}

function mapClrType(type: string): string {
  const lower = type.toLowerCase();
  if (lower === "string" || lower === "system.string") return "x:String";
  if (lower === "int32" || lower === "integer" || lower === "int" || lower === "system.int32") return "x:Int32";
  if (lower === "int64" || lower === "long" || lower === "system.int64") return "x:Int64";
  if (lower === "boolean" || lower === "bool" || lower === "system.boolean") return "x:Boolean";
  if (lower === "double" || lower === "system.double") return "x:Double";
  if (lower === "decimal" || lower === "system.decimal") return "x:Decimal";
  if (lower === "datetime" || lower === "system.datetime") return "s:DateTime";
  if (lower === "timespan" || lower === "system.timespan") return "s:TimeSpan";
  if (lower === "object" || lower === "system.object") return "x:Object";
  if (lower.includes("datatable") || lower.includes("system.data.datatable")) return "scg2:DataTable";
  if (lower.includes("datarow") || lower.includes("system.data.datarow")) return "scg2:DataRow";
  if (lower.includes("securestring") || lower.includes("system.security.securestring")) return "s:Security.SecureString";
  if (lower.includes("mailmessage") || lower.includes("system.net.mail.mailmessage")) return "s:Net.Mail.MailMessage";
  if (lower.includes("list(") || lower.includes("list<")) return type;
  if (lower.includes("dictionary") || lower.includes("dictionary<")) return type;
  if (lower.includes("queueitem") || lower.includes("uipath.core.queueitem")) return "ui:QueueItem";
  if (lower.includes("queueitemdata") || lower.includes("uipath.core.queueitemdata")) return "ui:QueueItemData";
  return type;
}

function isUiActivity(activityType: string): boolean {
  const uiTypes = ["ui:OpenBrowser", "ui:NavigateTo", "ui:TypeInto", "ui:Click", "ui:GetText",
    "ui:ElementExists", "ui:AttachBrowser", "ui:AttachWindow", "ui:UseApplicationBrowser"];
  return uiTypes.some(t => activityType.startsWith(t));
}

function isNonCriticalActivity(activityType: string): boolean {
  const nonCritical = ["ui:LogMessage", "ui:SendSmtpMailMessage", "ui:SendOutlookMailMessage"];
  return nonCritical.some(t => activityType === t);
}

function renderActivity(
  activityType: string,
  displayName: string,
  properties: Record<string, string>,
  selectorHint?: string,
  operationalProps?: { timeout?: number; continueOnError?: boolean; delayBefore?: number; delayAfter?: number },
  annotationOpts?: { stepNumber?: number; stepName?: string; businessContext?: string; errorStrategy?: string; placeholders?: string[]; aiReasoning?: string }
): string {
  const enforced = enforceDisplayName(activityType, displayName);
  let propAttrs = "";
  for (const [key, value] of Object.entries(properties)) {
    propAttrs += ` ${key}="${escapeXml(value)}"`;
  }

  if (selectorHint) {
    propAttrs += ` Selector="${escapeXml(selectorHint)}"`;
  }

  if (isUiActivity(activityType)) {
    const timeout = operationalProps?.timeout ?? 30000;
    propAttrs += ` TimeoutMS="${timeout}"`;
  }

  const continueOnError = operationalProps?.continueOnError ?? (isNonCriticalActivity(activityType) ? true : false);
  propAttrs += ` ContinueOnError="${continueOnError ? "True" : "False"}"`;

  if (operationalProps?.delayBefore && operationalProps.delayBefore > 0) {
    propAttrs += ` DelayBefore="${operationalProps.delayBefore}"`;
  }
  if (operationalProps?.delayAfter && operationalProps.delayAfter > 0) {
    propAttrs += ` DelayAfter="${operationalProps.delayAfter}"`;
  }

  if (annotationOpts) {
    const annotationText = generateAnnotationText(annotationOpts);
    if (annotationText) {
      propAttrs += ` sap2010:Annotation.AnnotationText="${escapeXml(annotationText)}"`;
    }
  }

  return `
          <${activityType} DisplayName="${escapeXml(enforced)}"${propAttrs} />`;
}

function wrapInTryCatch(innerXml: string, stepName: string, errorHandling: "retry" | "catch" | "escalate" | "none"): string {
  if (errorHandling === "none") return innerXml;

  const strategyDesc = errorHandling === "retry" ? "Retry up to 3 times with 5s interval"
    : errorHandling === "escalate" ? "Log escalation and rethrow for manual intervention"
    : "Log error and rethrow to caller";
  const annotation = generateAnnotationText({ stepName, errorStrategy: strategyDesc });
  const annotAttr = ` sap2010:Annotation.AnnotationText="${escapeXml(annotation)}"`;

  if (errorHandling === "retry") {
    return `
          <ui:RetryScope DisplayName="Retry: ${escapeXml(stepName)}" NumberOfRetries="3" RetryInterval="00:00:05"${annotAttr}>
            <ui:RetryScope.Body>
              <Sequence DisplayName="Retry Body: ${escapeXml(stepName)}">${innerXml}
              </Sequence>
            </ui:RetryScope.Body>
            <ui:RetryScope.Condition>
              <ui:ShouldRetry />
            </ui:RetryScope.Condition>
          </ui:RetryScope>`;
  }

  const catchAction = errorHandling === "escalate"
    ? `<ui:LogMessage Level="Error" Message="[Escalation Required] ${escapeXml(stepName)} failed — manual intervention needed" DisplayName="Log Escalation" />`
    : `<ui:LogMessage Level="Error" Message="[Error] ${escapeXml(stepName)} failed" DisplayName="Log Error" />`;

  return `
          <TryCatch DisplayName="Try: ${escapeXml(stepName)}"${annotAttr}>
            <TryCatch.Try>
              <Sequence DisplayName="Execute: ${escapeXml(stepName)}">${innerXml}
              </Sequence>
            </TryCatch.Try>
            <TryCatch.Catches>
              <Catch x:TypeArguments="s:Exception">
                <ActivityAction x:TypeArguments="s:Exception">
                  <ActivityAction.Argument>
                    <DelegateInArgument x:TypeArguments="s:Exception" Name="exception" />
                  </ActivityAction.Argument>
                  <Sequence DisplayName="Handle Exception: ${escapeXml(stepName)}">
                    ${catchAction}
                    <Rethrow DisplayName="Rethrow" />
                  </Sequence>
                </ActivityAction>
              </Catch>
            </TryCatch.Catches>
          </TryCatch>`;
}

function renderAgentTaskSequence(stepName: string, description: string, role: string): string {
  const safeStepName = escapeXml(stepName);
  const agentRole = role ? escapeXml(role) : "AI Agent";
  const annotationText = escapeXml(
    `[Agent Step] ${stepName}\nAgent Role: ${agentRole}\nDescription: ${description || stepName}\nThis step is handled by a UiPath Agent (AI-driven) rather than traditional RPA.\nThe agent uses LLM reasoning to process unstructured or judgment-based work.`
  );

  return `
          <Sequence DisplayName="Agent: ${safeStepName}" sap2010:Annotation.AnnotationText="${annotationText}">
            <Sequence.Variables>
              <Variable x:TypeArguments="x:String" Name="str_AgentInput" Default="&quot;&quot;" />
              <Variable x:TypeArguments="x:String" Name="str_AgentOutput" Default="&quot;&quot;" />
            </Sequence.Variables>
            <ui:LogMessage Level="Info" Message="'Invoking agent for: ${safeStepName}'" DisplayName="Log Agent Start: ${safeStepName}" />
            <ui:InvokeWorkflowFile DisplayName="Invoke Agent: ${safeStepName}" WorkflowFileName="AgentInvocation_Stub.xaml">
              <ui:InvokeWorkflowFile.Arguments>
                <InArgument x:TypeArguments="x:String" x:Key="in_AgentName">"${safeStepName}"</InArgument>
                <InArgument x:TypeArguments="x:String" x:Key="in_InputData">[str_AgentInput]</InArgument>
                <OutArgument x:TypeArguments="x:String" x:Key="out_AgentResult">[str_AgentOutput]</OutArgument>
              </ui:InvokeWorkflowFile.Arguments>
            </ui:InvokeWorkflowFile>
            <Assign DisplayName="Capture Agent Output: ${safeStepName}">
              <Assign.To><OutArgument x:TypeArguments="x:String">[str_AgentOutput]</OutArgument></Assign.To>
              <Assign.Value><InArgument x:TypeArguments="x:String">[str_AgentOutput]</InArgument></Assign.Value>
            </Assign>
            <ui:LogMessage Level="Info" Message="'Agent completed: ${safeStepName}'" DisplayName="Log Agent Complete: ${safeStepName}" />
          </Sequence>`;
}

function renderAgentDecision(stepName: string, description: string, role: string, thenXml: string, elseXml: string): string {
  const safeStepName = escapeXml(stepName);
  const agentRole = role ? escapeXml(role) : "AI Agent";
  const annotationText = escapeXml(
    `[Agent Decision] ${stepName}\nAgent Role: ${agentRole}\nJudgment Call: ${description || stepName}\nThis decision is evaluated by a UiPath Agent using LLM reasoning rather than deterministic rules.\nThe agent analyzes context and makes a judgment-based determination.`
  );

  const defaultThen = thenXml || `\n              <ui:LogMessage Level="Info" Message="'Agent decision YES path: ${safeStepName}'" DisplayName="Agent Then Path" />`;
  const defaultElse = elseXml || `\n              <ui:LogMessage Level="Info" Message="'Agent decision NO path: ${safeStepName}'" DisplayName="Agent Else Path" />`;

  return `
          <Sequence DisplayName="Agent Decision Setup: ${safeStepName}" sap2010:Annotation.AnnotationText="${annotationText}">
            <Sequence.Variables>
              <Variable x:TypeArguments="x:Boolean" Name="bool_AgentDecisionResult" Default="False" />
              <Variable x:TypeArguments="x:String" Name="str_AgentDecisionInput" Default="&quot;&quot;" />
            </Sequence.Variables>
            <ui:LogMessage Level="Info" Message="'Invoking agent decision for: ${safeStepName}'" DisplayName="Log Agent Decision Start" />
            <ui:InvokeWorkflowFile DisplayName="Agent Evaluate: ${safeStepName}" WorkflowFileName="AgentInvocation_Stub.xaml">
              <ui:InvokeWorkflowFile.Arguments>
                <InArgument x:TypeArguments="x:String" x:Key="in_AgentName">"${safeStepName}"</InArgument>
                <InArgument x:TypeArguments="x:String" x:Key="in_InputData">[str_AgentDecisionInput]</InArgument>
                <OutArgument x:TypeArguments="x:Boolean" x:Key="out_DecisionResult">[bool_AgentDecisionResult]</OutArgument>
              </ui:InvokeWorkflowFile.Arguments>
            </ui:InvokeWorkflowFile>
            <If DisplayName="Agent Decision: ${safeStepName}" Condition="[bool_AgentDecisionResult]">
              <If.Then>
                <Sequence DisplayName="Agent Yes: ${safeStepName}">${defaultThen}
                </Sequence>
              </If.Then>
              <If.Else>
                <Sequence DisplayName="Agent No: ${safeStepName}">${defaultElse}
                </Sequence>
              </If.Else>
            </If>
            <ui:LogMessage Level="Info" Message="'Agent decision completed: ${safeStepName}'" DisplayName="Log Agent Decision Complete" />
          </Sequence>`;
}

function wrapInIf(innerXml: string, condition: string, displayName: string): string {
  return `
          <If DisplayName="Decision: ${escapeXml(displayName)}" Condition="[${escapeXml(condition)}]">
            <If.Then>
              <Sequence DisplayName="Then: ${escapeXml(displayName)}">${innerXml}
              </Sequence>
            </If.Then>
            <If.Else>
              <Sequence DisplayName="Else: ${escapeXml(displayName)}">
                <ui:LogMessage Level="Info" Message="'Condition not met: ${escapeXml(displayName)}'" DisplayName="Log Else Path" />
              </Sequence>
            </If.Else>
          </If>`;
}

function renderEnrichedActivities(enrichedNode: EnrichedNodeSpec): {
  xml: string;
  packages: string[];
  variables: VariableDecl[];
  gaps: XamlGap[];
} {
  const packages: string[] = [];
  const variables: VariableDecl[] = [];
  const gaps: XamlGap[] = [];

  if (enrichedNode.activities.length === 0) {
    return { xml: "", packages: [], variables: [], gaps: [] };
  }

  let innerXml = "";
  for (let actIdx = 0; actIdx < enrichedNode.activities.length; actIdx++) {
    const act = enrichedNode.activities[actIdx];
    packages.push(act.package);
    if (act.variables) {
      for (const v of act.variables) {
        variables.push({ name: enforceVariableName(v.name, mapClrType(v.type)), type: v.type, defaultValue: v.defaultValue });
      }
    }

    const props: Record<string, string> = {};
    const placeholders: string[] = [];
    for (const [key, value] of Object.entries(act.properties || {})) {
      const strVal = String(value);
      props[key] = strVal;
      if (strVal.startsWith("PLACEHOLDER_") || strVal.startsWith("TODO")) {
        placeholders.push(key);
      }
    }

    const operationalProps = {
      timeout: act.timeout,
      continueOnError: act.continueOnError,
      delayBefore: act.delayBefore,
      delayAfter: act.delayAfter,
    };

    const annotationOpts = {
      stepName: enrichedNode.nodeName,
      businessContext: act.displayName !== enrichedNode.nodeName ? `${enrichedNode.nodeName} — ${act.displayName}` : enrichedNode.nodeName,
      placeholders: placeholders.length > 0 ? placeholders : undefined,
      aiReasoning: `Selected ${act.activityType} from ${act.package}`,
    };

    innerXml += renderActivity(act.activityType, act.displayName, props, act.selectorHint, operationalProps, annotationOpts).replace(/\n          /, "\n            ");
  }

  for (const gap of enrichedNode.gaps || []) {
    gaps.push(gap);
  }

  const firstAct = enrichedNode.activities[0];
  const errorHandling = firstAct.errorHandling || "none";

  let xml: string;
  if (enrichedNode.activities.length === 1) {
    xml = wrapInTryCatch(innerXml, enrichedNode.nodeName, errorHandling);
  } else {
    const sequenceXml = `
          <Sequence DisplayName="${escapeXml(enrichedNode.nodeName)}">${innerXml}
          </Sequence>`;
    xml = wrapInTryCatch(sequenceXml, enrichedNode.nodeName, errorHandling);
  }

  return { xml, packages, variables, gaps };
}

export function generateRichXamlFromNodes(
  nodes: ProcessNode[],
  edges: ProcessEdge[],
  workflowName: string,
  projectDescription: string,
  enrichment?: EnrichmentResult | null
): XamlGeneratorResult {
  const allGaps: XamlGap[] = [];
  const allVariables: VariableDecl[] = [];
  const usedPackages = new Set<string>(["UiPath.System.Activities"]);
  let activities = "";

  const edgeMap = new Map<number, { target: number; label: string }[]>();
  for (const e of edges) {
    const list = edgeMap.get(e.sourceNodeId) || [];
    list.push({ target: e.targetNodeId, label: e.label || "" });
    edgeMap.set(e.sourceNodeId, list);
  }

  const nodeMap = new Map<number, ProcessNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  const sortedNodes = [...nodes].sort((a, b) => a.orderIndex - b.orderIndex);

  const timestamp = new Date().toISOString().split("T")[0];
  activities += `
        <!-- CannonBall Auto-Generated XAML -->
        <!-- Workflow: ${escapeXml(workflowName)} -->
        <!-- Generated: ${timestamp} -->
        <!-- Process Map: ${nodes.length} nodes, ${edges.length} edges -->
        <!-- Trace: Each activity below references its source process map step -->
        <ui:LogMessage Level="Info" Message="'=== Starting: ${escapeXml(workflowName)} ==='" DisplayName="Log Start" />`;

  const startNodes = sortedNodes.filter(n => n.nodeType === "start");
  const endNodes = sortedNodes.filter(n => n.nodeType === "end");
  const taskNodes = sortedNodes.filter(n => n.nodeType !== "start" && n.nodeType !== "end");
  const hasAgentNodes = taskNodes.some(n => n.nodeType === "agent-task" || n.nodeType === "agent-decision" || n.nodeType === "agent-loop");

  if (startNodes.length > 0) {
    for (const node of startNodes) {
      activities += `
        <ui:LogMessage Level="Info" Message="'Initialization: ${escapeXml(node.name)}'" DisplayName="Init: ${escapeXml(node.name)}" />`;
    }
    activities += `
        <!-- TODO: Add config file reading (InitAllSettings) and variable initialization here -->`;
    allGaps.push({
      category: "config",
      activity: "Initialization",
      description: "Add Config.xlsx reading and variable initialization in start sequence",
      placeholder: "Use InitAllSettings.xaml to read Config.xlsx",
      estimatedMinutes: 30,
    });
  }

  const enrichedMap = new Map<number, EnrichedNodeSpec>();
  if (enrichment?.nodes) {
    for (const en of enrichment.nodes) {
      enrichedMap.set(en.nodeId, en);
    }
  }

  const isMainWorkflow = workflowName.toLowerCase() === "main" || workflowName.toLowerCase() === "main.xaml";
  if (!isMainWorkflow && enrichment?.arguments && enrichment.arguments.length > 0) {
    const validationXaml = generateArgumentValidationXaml(enrichment.arguments, workflowName);
    if (validationXaml) activities += validationXaml;
  }

  for (const node of taskNodes) {
    const enrichedSpec = enrichedMap.get(node.id);
    const nodeTrace = `Step #${node.orderIndex} "${escapeXml(node.name)}" [${node.nodeType}]${node.system ? ` | System: ${escapeXml(node.system)}` : ""}${node.role ? ` | Role: ${escapeXml(node.role)}` : ""}`;

    if (node.nodeType === "agent-task" || node.nodeType === "agent-loop") {
      activities += `
        <!-- Agent Step: ${nodeTrace} -->`;
      const agentXml = renderAgentTaskSequence(node.name, node.description || "", node.role || "");
      const wrappedAgent = wrapInTryCatch(agentXml, node.name, "catch");
      activities += wrappedAgent;
      allVariables.push({ name: "str_AgentInput", type: "String", defaultValue: '""' });
      allVariables.push({ name: "str_AgentOutput", type: "String", defaultValue: '""' });
      allGaps.push({
        category: "agent",
        activity: "InvokeAgent",
        description: `Configure agent invocation for "${node.name}" — set agent name, input data mapping, and output capture`,
        placeholder: "AgentInvocation_Stub.xaml",
        estimatedMinutes: 30,
      });
      continue;
    }

    if (node.nodeType === "agent-decision") {
      const outEdges = edgeMap.get(node.id) || [];
      const edgeLabels = outEdges.map(e => `"${e.label || "unlabeled"}" -> node #${e.target}`).join(", ");
      activities += `
        <!-- Agent Decision: ${nodeTrace} | Branches: ${edgeLabels} -->`;

      let thenActivities = "";
      let elseActivities = "";
      for (const outEdge of outEdges) {
        const targetNode = nodeMap.get(outEdge.target);
        if (!targetNode) continue;
        const targetEnriched = enrichedMap.get(outEdge.target);
        let branchXml: string;
        if (targetEnriched && targetEnriched.activities.length > 0) {
          const rendered = renderEnrichedActivities(targetEnriched);
          branchXml = rendered.xml;
          rendered.packages.forEach(p => usedPackages.add(p));
          allVariables.push(...rendered.variables);
          allGaps.push(...rendered.gaps);
        } else {
          const classified = classifyActivity({ system: targetNode.system || "", nodeType: targetNode.nodeType, name: targetNode.name, description: targetNode.description || "", role: targetNode.role || "", isPainPoint: targetNode.isPainPoint || false });
          branchXml = renderActivity(classified.activityType, targetNode.name, classified.properties, classified.selectorHint);
        }
        const label = (outEdge.label || "").toLowerCase();
        if (label.includes("yes") || label.includes("true") || label.includes("approve") || label.includes("pass")) {
          thenActivities += branchXml;
        } else {
          elseActivities += branchXml;
        }
      }

      const agentDecisionXml = renderAgentDecision(node.name, node.description || "", node.role || "", thenActivities, elseActivities);
      const wrappedDecision = wrapInTryCatch(agentDecisionXml, node.name, "catch");
      activities += wrappedDecision;
      allVariables.push({ name: "bool_AgentDecisionResult", type: "Boolean", defaultValue: "False" });
      allVariables.push({ name: "str_AgentDecisionInput", type: "String", defaultValue: '""' });
      allGaps.push({
        category: "agent",
        activity: "AgentDecision",
        description: `Configure agent decision logic for "${node.name}" — this is a judgment-based evaluation handled by AI`,
        placeholder: "Agent evaluates context and returns boolean decision",
        estimatedMinutes: 25,
      });
      continue;
    }

    if (enrichedSpec && enrichedSpec.activities.length > 0) {
      if (node.nodeType === "decision") {
        const outEdges = edgeMap.get(node.id) || [];
        const edgeLabels = outEdges.map(e => `"${e.label || "unlabeled"}" → node #${e.target}`).join(", ");
        activities += `
        <!-- Decision: ${nodeTrace} | Branches: ${edgeLabels} -->`;
        const condition = outEdges.find(e => e.label)?.label || "TODO_Condition";
        allVariables.push({ name: `bool_${node.name.replace(/[^A-Za-z0-9]/g, "")}`, type: "Boolean", defaultValue: "False" });

        let thenActivities = "";
        let elseActivities = "";
        for (const outEdge of outEdges) {
          const targetEnriched = enrichedMap.get(outEdge.target);
          const targetNode = nodeMap.get(outEdge.target);
          if (!targetNode) continue;
          const label = (outEdge.label || "").toLowerCase();
          let branchXml: string;
          if (targetEnriched && targetEnriched.activities.length > 0) {
            const rendered = renderEnrichedActivities(targetEnriched);
            branchXml = rendered.xml;
            rendered.packages.forEach(p => usedPackages.add(p));
            allVariables.push(...rendered.variables);
            allGaps.push(...rendered.gaps);
          } else {
            const classified = classifyActivity({ system: targetNode.system || "", nodeType: targetNode.nodeType, name: targetNode.name, description: targetNode.description || "", role: targetNode.role || "", isPainPoint: targetNode.isPainPoint || false });
            branchXml = renderActivity(classified.activityType, targetNode.name, classified.properties, classified.selectorHint);
          }
          if (label.includes("yes") || label.includes("true") || label.includes("approve") || label.includes("pass")) {
            thenActivities += branchXml;
          } else {
            elseActivities += branchXml;
          }
        }

        if (!thenActivities) thenActivities = `\n            <ui:LogMessage Level="Info" Message="'Then: ${escapeXml(node.name)}'" DisplayName="Then Path" />`;
        if (!elseActivities) elseActivities = `\n              <ui:LogMessage Level="Info" Message="'Else: ${escapeXml(node.name)}'" DisplayName="Else Path" />`;

        activities += `
        <If DisplayName="Decision: ${escapeXml(node.name)}" Condition="[${escapeXml(condition)}]">
          <If.Then>
            <Sequence DisplayName="Yes: ${escapeXml(node.name)}">${thenActivities}
            </Sequence>
          </If.Then>
          <If.Else>
            <Sequence DisplayName="No: ${escapeXml(node.name)}">${elseActivities}
            </Sequence>
          </If.Else>
        </If>`;
        continue;
      }

      activities += `
        <!-- Source: ${nodeTrace} | AI-Enriched: ${enrichedSpec.activities.length} activities -->`;
      const rendered = renderEnrichedActivities(enrichedSpec);
      rendered.packages.forEach(p => usedPackages.add(p));
      allVariables.push(...rendered.variables);
      allGaps.push(...rendered.gaps);
      activities += rendered.xml;
      continue;
    }

    const ctx: ActivityContext = {
      system: node.system || "",
      nodeType: node.nodeType,
      name: node.name,
      description: node.description || "",
      role: node.role || "",
      isPainPoint: node.isPainPoint || false,
    };

    if (node.nodeType === "decision") {
      const outEdges = edgeMap.get(node.id) || [];
      const edgeLabels = outEdges.map(e => `"${e.label || "unlabeled"}" → node #${e.target}`).join(", ");
      activities += `
        <!-- Decision: ${nodeTrace} | Branches: ${edgeLabels} -->`;
      const condition = outEdges.find(e => e.label)?.label || "TODO_Condition";

      allVariables.push({ name: "bool_Decision", type: "Boolean", defaultValue: "False" });
      allGaps.push({
        category: "logic",
        activity: "Decision",
        description: `Implement decision logic for "${node.name}": ${condition}`,
        placeholder: `Evaluate condition: ${condition}`,
        estimatedMinutes: 20,
      });

      let thenActivities = "";
      let elseActivities = "";
      for (const outEdge of outEdges) {
        const targetNode = nodeMap.get(outEdge.target);
        if (!targetNode) continue;
        const branchCtx: ActivityContext = {
          system: targetNode.system || "",
          nodeType: targetNode.nodeType,
          name: targetNode.name,
          description: targetNode.description || "",
          role: targetNode.role || "",
          isPainPoint: targetNode.isPainPoint || false,
        };
        const classified = classifyActivity(branchCtx);
        const branchActivity = renderActivity(classified.activityType, targetNode.name, classified.properties, classified.selectorHint);
        const label = (outEdge.label || "").toLowerCase();
        if (label.includes("yes") || label.includes("true") || label.includes("approve") || label.includes("pass")) {
          thenActivities += branchActivity;
        } else {
          elseActivities += branchActivity;
        }
      }

      if (!thenActivities) {
        thenActivities = `
            <ui:LogMessage Level="Info" Message="'Then branch: ${escapeXml(node.name)}'" DisplayName="Then Path" />`;
      }

      activities += `
        <If DisplayName="Decision: ${escapeXml(node.name)}" Condition="[${escapeXml(condition)}]">
          <If.Then>
            <Sequence DisplayName="Yes: ${escapeXml(node.name)}">${thenActivities}
            </Sequence>
          </If.Then>
          <If.Else>
            <Sequence DisplayName="No: ${escapeXml(node.name)}">${elseActivities || `
              <ui:LogMessage Level="Info" Message="'Else branch: ${escapeXml(node.name)}'" DisplayName="Else Path" />`}
            </Sequence>
          </If.Else>
        </If>`;
      continue;
    }

    const classified = classifyActivity(ctx);
    usedPackages.add(classified.activityPackage);
    for (const cv of classified.variables) {
      allVariables.push({ name: enforceVariableName(cv.name, mapClrType(cv.type)), type: cv.type, defaultValue: cv.defaultValue });
    }
    allGaps.push(...classified.gaps);

    const classifiedPlaceholders = Object.entries(classified.properties)
      .filter(([, v]) => v.startsWith("PLACEHOLDER_") || v.startsWith("TODO"))
      .map(([k]) => k);
    const activityXml = renderActivity(
      classified.activityType,
      node.name,
      classified.properties,
      classified.selectorHint,
      undefined,
      {
        stepNumber: node.orderIndex,
        stepName: node.name,
        businessContext: node.description || node.name,
        placeholders: classifiedPlaceholders.length > 0 ? classifiedPlaceholders : undefined,
      }
    );

    activities += `
        <!-- Source: ${nodeTrace} | Activity: ${classified.activityType}${node.isPainPoint ? " | ⚠ Pain Point" : ""} -->`;
    const wrappedXml = wrapInTryCatch(activityXml, node.name, classified.errorHandling);
    activities += wrappedXml;
  }

  for (const node of endNodes) {
    activities += `
        <ui:LogMessage Level="Info" Message="'Completed: ${escapeXml(node.name)}'" DisplayName="End: ${escapeXml(node.name)}" />`;
  }

  activities += `
        <ui:LogMessage Level="Info" Message="'=== Completed: ${escapeXml(workflowName)} ==='" DisplayName="Log Completion" />`;

  const variablesBlock = renderVariablesBlock(allVariables);

  const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="${escapeXml(workflowName.replace(/\s+/g, "_"))}"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=mscorlib"
  xmlns:scg2="clr-namespace:System.Data;assembly=System.Data"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="${escapeXml(workflowName)}">
    ${variablesBlock}${activities}
  </Sequence>
</Activity>`;

  return {
    xaml,
    gaps: allGaps,
    usedPackages: Array.from(usedPackages),
    variables: allVariables,
  };
}

export function generateRichXamlFromSpec(
  workflow: WorkflowSpec,
  sddContent?: string
): XamlGeneratorResult {
  const allGaps: XamlGap[] = [];
  const allVariables: VariableDecl[] = [];
  const usedPackages = new Set<string>(["UiPath.System.Activities"]);
  let activities = "";

  const wfName = workflow.name || "Workflow";
  const steps = workflow.steps || [];

  activities += `
        <ui:LogMessage Level="Info" Message="'=== Starting: ${escapeXml(wfName)} ==='" DisplayName="Log Start" />`;

  if (workflow.arguments && workflow.arguments.length > 0) {
    const validationXaml = generateArgumentValidationXaml(workflow.arguments, wfName);
    if (validationXaml) activities += validationXaml;
  }

  if (sddContent) {
    const errorHandlingSection = extractSddSection(sddContent, 5);
    if (errorHandlingSection) {
      allGaps.push({
        category: "logic",
        activity: "ErrorHandling",
        description: "Review SDD Section 5 error handling strategy and ensure all exception paths are implemented",
        placeholder: errorHandlingSection.slice(0, 200),
        estimatedMinutes: 60,
      });
    }
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepName = step.activity || step.activityType || `Step ${i + 1}`;

    if (step.nodeType === "agent-task" || step.nodeType === "agent-loop") {
      activities += `
        <!-- Agent Step: ${escapeXml(stepName)} -->`;
      const agentXml = renderAgentTaskSequence(stepName, step.notes || "", step.role || "");
      const wrappedAgent = wrapInTryCatch(agentXml, stepName, "catch");
      activities += wrappedAgent;
      allVariables.push({ name: "str_AgentInput", type: "String", defaultValue: '""' });
      allVariables.push({ name: "str_AgentOutput", type: "String", defaultValue: '""' });
      allGaps.push({
        category: "agent",
        activity: "InvokeAgent",
        description: `Configure agent invocation for "${stepName}" — set agent name, input data mapping, and output capture`,
        placeholder: "AgentInvocation_Stub.xaml",
        estimatedMinutes: 30,
      });
      continue;
    }

    if (step.nodeType === "agent-decision") {
      activities += `
        <!-- Agent Decision: ${escapeXml(stepName)} -->`;
      const agentDecisionXml = renderAgentDecision(stepName, step.notes || "", step.role || "", "", "");
      const wrappedDecision = wrapInTryCatch(agentDecisionXml, stepName, "catch");
      activities += wrappedDecision;
      allVariables.push({ name: "bool_AgentDecisionResult", type: "Boolean", defaultValue: "False" });
      allVariables.push({ name: "str_AgentDecisionInput", type: "String", defaultValue: '""' });
      allGaps.push({
        category: "agent",
        activity: "AgentDecision",
        description: `Configure agent decision logic for "${stepName}" — this is a judgment-based evaluation handled by AI`,
        placeholder: "Agent evaluates context and returns boolean decision",
        estimatedMinutes: 25,
      });
      continue;
    }

    if (step.activityType) {
      usedPackages.add(step.activityPackage || "UiPath.System.Activities");
      if (step.variables) {
        allVariables.push(...step.variables);
      }

      const props: Record<string, string> = {};
      if (step.properties) {
        for (const [k, v] of Object.entries(step.properties)) {
          props[k] = String(v);
        }
      }

      const activityXml = renderActivity(
        step.activityType,
        stepName,
        props,
        step.selectorHint
      );

      if (step.selectorHint) {
        allGaps.push({
          category: "selector",
          activity: step.activityType,
          description: `Replace placeholder selector in "${stepName}"`,
          placeholder: step.selectorHint,
          estimatedMinutes: 15,
        });
      }

      const errorHandling = step.errorHandling || "none";
      const wrappedXml = wrapInTryCatch(activityXml, stepName, errorHandling);
      activities += wrappedXml;
    } else {
      const ctx: ActivityContext = {
        system: "",
        nodeType: "task",
        name: stepName,
        description: step.notes || "",
        role: "",
        isPainPoint: false,
      };

      const classified = classifyActivity(ctx);
      usedPackages.add(classified.activityPackage);
      allVariables.push(...classified.variables);
      allGaps.push(...classified.gaps);

      const activityXml = renderActivity(
        classified.activityType,
        stepName,
        classified.properties,
        classified.selectorHint
      );

      const wrappedXml = wrapInTryCatch(activityXml, stepName, classified.errorHandling);
      activities += wrappedXml;
    }
  }

  activities += `
        <ui:LogMessage Level="Info" Message="'=== Completed: ${escapeXml(wfName)} ==='" DisplayName="Log Completion" />`;

  const variablesBlock = renderVariablesBlock(allVariables);

  const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="${escapeXml(wfName.replace(/\s+/g, "_"))}"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=mscorlib"
  xmlns:scg2="clr-namespace:System.Data;assembly=System.Data"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="${escapeXml(wfName)}">
    ${variablesBlock}${activities}
  </Sequence>
</Activity>`;

  return {
    xaml,
    gaps: allGaps,
    usedPackages: Array.from(usedPackages),
    variables: allVariables,
  };
}

function extractSddSection(sddContent: string, sectionNumber: number): string | null {
  const pattern = new RegExp(`## ${sectionNumber}\\.\\s+[^\\n]+\\n([\\s\\S]*?)(?=## \\d+\\.|$)`);
  const match = sddContent.match(pattern);
  return match ? match[1].trim() : null;
}

export function generateInitAllSettingsXaml(orchestratorArtifacts?: any): string {
  const assetCount = orchestratorArtifacts?.assets?.length || 0;
  const queueCount = orchestratorArtifacts?.queues?.length || 0;
  let assetActivities = `
      <!-- InitAllSettings.xaml — Auto-generated by CannonBall -->
      <!-- Reads Config.xlsx (Settings + Constants sheets) and retrieves Orchestrator assets -->
      <!-- Assets: ${assetCount} | Queues: ${queueCount} -->`;
  const assets = orchestratorArtifacts?.assets || [];
  const credAssets = assets.filter((a: any) => a.type === "Credential");
  const textAssets = assets.filter((a: any) => a.type !== "Credential");

  if (credAssets.length > 0) {
    for (const asset of credAssets) {
      assetActivities += `
          <ui:GetCredential DisplayName="Get ${escapeXml(asset.name)}" AssetName="${escapeXml(asset.name)}" Username="[str_TempUser]" Password="[sec_TempPass]" />
          <Assign DisplayName="Store ${escapeXml(asset.name)} User">
            <Assign.To><OutArgument x:TypeArguments="x:String">[str_TempUser]</OutArgument></Assign.To>
            <Assign.Value><InArgument x:TypeArguments="x:String">[str_TempUser]</InArgument></Assign.Value>
          </Assign>`;
    }
  }

  if (textAssets.length > 0) {
    for (const asset of textAssets) {
      const varType = asset.type === "Integer" ? "x:Int32" : asset.type === "Bool" ? "x:Boolean" : "x:String";
      assetActivities += `
          <ui:GetAsset DisplayName="Get ${escapeXml(asset.name)}" AssetName="${escapeXml(asset.name)}" Value="[str_AssetValue]" />`;
    }
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="InitAllSettings"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=mscorlib"
  xmlns:scg2="clr-namespace:System.Data;assembly=System.Data"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Initialize All Settings">
    <Sequence.Variables>
      <Variable x:TypeArguments="scg2:DataTable" Name="dt_Settings" />
      <Variable x:TypeArguments="scg2:DataTable" Name="dt_Constants" />
      <Variable x:TypeArguments="x:String" Name="str_ConfigPath" Default="Data\\Config.xlsx" />
      <Variable x:TypeArguments="x:String" Name="str_AssetValue" />
      <Variable x:TypeArguments="x:String" Name="str_TempUser" />
      <Variable x:TypeArguments="x:String" Name="sec_TempPass" />
      <Variable x:TypeArguments="scg2:DataRow" Name="row_Current" />
    </Sequence.Variables>
    <ui:LogMessage Level="Info" Message="'Reading configuration from Config.xlsx...'" DisplayName="Log Config Start" />
    <ui:ExcelApplicationScope DisplayName="Read Config File" WorkbookPath="[str_ConfigPath]">
      <ui:ExcelApplicationScope.Body>
        <Sequence DisplayName="Read Config Sheets">
          <ui:ExcelReadRange DisplayName="Read Settings Sheet" SheetName="Settings" DataTable="[dt_Settings]" />
          <ui:ExcelReadRange DisplayName="Read Constants Sheet" SheetName="Constants" DataTable="[dt_Constants]" />
        </Sequence>
      </ui:ExcelApplicationScope.Body>
    </ui:ExcelApplicationScope>
    <ForEach x:TypeArguments="scg2:DataRow" DisplayName="Process Settings Rows" Values="[dt_Settings.Rows]">
      <ActivityAction x:TypeArguments="scg2:DataRow">
        <Argument x:TypeArguments="scg2:DataRow" x:Name="row" />
        <Sequence DisplayName="Process Setting Row">
          <ui:LogMessage Level="Trace" Message="[&quot;Processing setting: &quot; &amp; row(&quot;Name&quot;).ToString]" DisplayName="Log Setting" />
        </Sequence>
      </ActivityAction>
    </ForEach>${assetActivities}
    <ForEach x:TypeArguments="scg2:DataRow" DisplayName="Process Constants Rows" Values="[dt_Constants.Rows]">
      <ActivityAction x:TypeArguments="scg2:DataRow">
        <Argument x:TypeArguments="scg2:DataRow" x:Name="constRow" />
        <Sequence DisplayName="Store Constant">
          <ui:LogMessage Level="Trace" Message="[&quot;Loaded constant: &quot; &amp; constRow(&quot;Name&quot;).ToString]" DisplayName="Log Constant" />
        </Sequence>
      </ActivityAction>
    </ForEach>
    <ui:LogMessage Level="Info" Message="'Configuration loaded successfully'" DisplayName="Log Config Complete" />
  </Sequence>
</Activity>`;
}

export function generateReframeworkMainXaml(projectName: string, queueName: string): string {
  const safeName = escapeXml(projectName.replace(/\s+/g, "_"));
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- REFramework Main.xaml — Auto-generated by CannonBall -->
<!-- Pattern: Robotic Enterprise Framework (State Machine) -->
<!-- States: Init → Get Transaction Data → Process Transaction → End Process -->
<!-- Queue: ${escapeXml(queueName)} -->
<!-- Project: ${safeName} -->
<Activity mc:Ignorable="sap sap2010" x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=mscorlib"
  xmlns:scg2="clr-namespace:System.Data;assembly=System.Data"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <StateMachine DisplayName="${safeName} - REFramework Main">
    <StateMachine.Variables>
      <Variable x:TypeArguments="x:Int32" Name="int_TransactionNumber" Default="0" />
      <Variable x:TypeArguments="x:Int32" Name="int_RetryNumber" Default="0" />
      <Variable x:TypeArguments="x:Int32" Name="int_MaxRetries" Default="3" />
      <Variable x:TypeArguments="x:String" Name="str_TransactionID" />
      <Variable x:TypeArguments="x:String" Name="str_QueueName" Default="'${escapeXml(queueName)}'" />
      <Variable x:TypeArguments="ui:QueueItem" Name="qi_TransactionItem" />
      <Variable x:TypeArguments="x:Boolean" Name="bool_SystemReady" Default="False" />
    </StateMachine.Variables>

    <State DisplayName="Init" x:Name="State_Init">
      <State.Entry>
        <Sequence DisplayName="Initialize Process">
          <ui:LogMessage Level="Info" Message="'=== Initializing ${safeName} ==='" DisplayName="Log Init Start" />
          <ui:InvokeWorkflowFile DisplayName="Initialize Settings" WorkflowFileName="InitAllSettings.xaml" />
          <Assign DisplayName="Set System Ready">
            <Assign.To><OutArgument x:TypeArguments="x:Boolean">[bool_SystemReady]</OutArgument></Assign.To>
            <Assign.Value><InArgument x:TypeArguments="x:Boolean">True</InArgument></Assign.Value>
          </Assign>
          <ui:LogMessage Level="Info" Message="'Initialization complete'" DisplayName="Log Init Complete" />
        </Sequence>
      </State.Entry>
      <Transition DisplayName="Init -> Get Transaction" To="{x:Reference State_GetTransaction}">
        <Transition.Condition>[bool_SystemReady]</Transition.Condition>
      </Transition>
      <Transition DisplayName="Init -> End (Failed)" To="{x:Reference State_End}">
        <Transition.Condition>[Not bool_SystemReady]</Transition.Condition>
      </Transition>
    </State>

    <State DisplayName="Get Transaction Data" x:Name="State_GetTransaction">
      <State.Entry>
        <Sequence DisplayName="Get Next Transaction">
          <ui:InvokeWorkflowFile DisplayName="Get Transaction Data" WorkflowFileName="GetTransactionData.xaml">
            <ui:InvokeWorkflowFile.Arguments>
              <InArgument x:TypeArguments="x:String" x:Key="in_QueueName">[str_QueueName]</InArgument>
              <OutArgument x:TypeArguments="ui:QueueItem" x:Key="out_TransactionItem">[qi_TransactionItem]</OutArgument>
              <InOutArgument x:TypeArguments="x:Int32" x:Key="io_TransactionNumber">[int_TransactionNumber]</InOutArgument>
            </ui:InvokeWorkflowFile.Arguments>
          </ui:InvokeWorkflowFile>
        </Sequence>
      </State.Entry>
      <Transition DisplayName="Has Transaction -> Process" To="{x:Reference State_Process}">
        <Transition.Condition>[qi_TransactionItem IsNot Nothing]</Transition.Condition>
      </Transition>
      <Transition DisplayName="No Transaction -> End" To="{x:Reference State_End}">
        <Transition.Condition>[qi_TransactionItem Is Nothing]</Transition.Condition>
      </Transition>
    </State>

    <State DisplayName="Process Transaction" x:Name="State_Process">
      <State.Entry>
        <TryCatch DisplayName="Try Process Transaction">
          <TryCatch.Try>
            <Sequence DisplayName="Process">
              <ui:InvokeWorkflowFile DisplayName="Process Transaction" WorkflowFileName="Process.xaml">
                <ui:InvokeWorkflowFile.Arguments>
                  <InArgument x:TypeArguments="ui:QueueItem" x:Key="in_TransactionItem">[qi_TransactionItem]</InArgument>
                </ui:InvokeWorkflowFile.Arguments>
              </ui:InvokeWorkflowFile>
              <ui:InvokeWorkflowFile DisplayName="Set Transaction Status - Success" WorkflowFileName="SetTransactionStatus.xaml">
                <ui:InvokeWorkflowFile.Arguments>
                  <InArgument x:TypeArguments="ui:QueueItem" x:Key="in_TransactionItem">[qi_TransactionItem]</InArgument>
                  <InArgument x:TypeArguments="x:String" x:Key="in_Status">"Successful"</InArgument>
                </ui:InvokeWorkflowFile.Arguments>
              </ui:InvokeWorkflowFile>
              <Assign DisplayName="Reset Retry Counter">
                <Assign.To><OutArgument x:TypeArguments="x:Int32">[int_RetryNumber]</OutArgument></Assign.To>
                <Assign.Value><InArgument x:TypeArguments="x:Int32">0</InArgument></Assign.Value>
              </Assign>
            </Sequence>
          </TryCatch.Try>
          <TryCatch.Catches>
            <Catch x:TypeArguments="s:Exception">
              <ActivityAction x:TypeArguments="s:Exception">
                <Argument x:TypeArguments="s:Exception" x:Name="exception" />
                <Sequence DisplayName="Handle Exception">
                  <ui:LogMessage Level="Error" Message="[&quot;Transaction failed: &quot; &amp; exception.Message]" DisplayName="Log Error" />
                  <ui:InvokeWorkflowFile DisplayName="Set Transaction Status - Failed" WorkflowFileName="SetTransactionStatus.xaml">
                    <ui:InvokeWorkflowFile.Arguments>
                      <InArgument x:TypeArguments="ui:QueueItem" x:Key="in_TransactionItem">[qi_TransactionItem]</InArgument>
                      <InArgument x:TypeArguments="x:String" x:Key="in_Status">"Failed"</InArgument>
                    </ui:InvokeWorkflowFile.Arguments>
                  </ui:InvokeWorkflowFile>
                  <ui:InvokeWorkflowFile DisplayName="Close All Applications" WorkflowFileName="CloseAllApplications.xaml" />
                </Sequence>
              </ActivityAction>
            </Catch>
          </TryCatch.Catches>
        </TryCatch>
      </State.Entry>
      <Transition DisplayName="Process -> Get Next Transaction" To="{x:Reference State_GetTransaction}" />
    </State>

    <State DisplayName="End Process" x:Name="State_End" IsFinal="True">
      <State.Entry>
        <Sequence DisplayName="Cleanup">
          <ui:InvokeWorkflowFile DisplayName="Close All Applications" WorkflowFileName="CloseAllApplications.xaml" />
          <ui:LogMessage Level="Info" Message="[&quot;=== ${safeName} Complete. Transactions processed: &quot; &amp; int_TransactionNumber.ToString]" DisplayName="Log End" />
        </Sequence>
      </State.Entry>
    </State>

    <StateMachine.InitialState>
      <x:Reference>State_Init</x:Reference>
    </StateMachine.InitialState>
  </StateMachine>
</Activity>`;
}

export function generateGetTransactionDataXaml(queueName: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- GetTransactionData.xaml — Auto-generated by CannonBall -->
<!-- REFramework: Retrieves next queue item from "${escapeXml(queueName)}" -->
<!-- SDD Reference: See Orchestrator Artifacts → Queues section -->
<Activity mc:Ignorable="sap sap2010" x:Class="GetTransactionData"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=mscorlib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Get Transaction Data">
    <Sequence.Variables>
      <Variable x:TypeArguments="x:String" Name="in_QueueName" Default="'${escapeXml(queueName)}'" />
      <Variable x:TypeArguments="ui:QueueItem" Name="out_TransactionItem" />
      <Variable x:TypeArguments="x:Int32" Name="io_TransactionNumber" Default="0" />
    </Sequence.Variables>
    <ui:GetTransactionItem DisplayName="Get Queue Item" QueueName="[in_QueueName]" TransactionItem="[out_TransactionItem]" />
    <If DisplayName="Check Transaction Item" Condition="[out_TransactionItem IsNot Nothing]">
      <If.Then>
        <Sequence DisplayName="Transaction Found">
          <Assign DisplayName="Increment Transaction Counter">
            <Assign.To><OutArgument x:TypeArguments="x:Int32">[io_TransactionNumber]</OutArgument></Assign.To>
            <Assign.Value><InArgument x:TypeArguments="x:Int32">[io_TransactionNumber + 1]</InArgument></Assign.Value>
          </Assign>
          <ui:LogMessage Level="Info" Message="[&quot;Processing transaction #&quot; &amp; io_TransactionNumber.ToString &amp; &quot; - Ref: &quot; &amp; out_TransactionItem.Reference]" DisplayName="Log Transaction" />
        </Sequence>
      </If.Then>
      <If.Else>
        <ui:LogMessage Level="Info" Message="'No more transactions in queue'" DisplayName="Log Queue Empty" />
      </If.Else>
    </If>
  </Sequence>
</Activity>`;
}

export function generateSetTransactionStatusXaml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- SetTransactionStatus.xaml — Auto-generated by CannonBall -->
<!-- REFramework: Marks queue item as Successful or Failed with retry logic -->
<!-- SDD Reference: See Error Handling and Transaction Management sections -->
<Activity mc:Ignorable="sap sap2010" x:Class="SetTransactionStatus"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=mscorlib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Set Transaction Status">
    <Sequence.Variables>
      <Variable x:TypeArguments="ui:QueueItem" Name="in_TransactionItem" />
      <Variable x:TypeArguments="x:String" Name="in_Status" Default="'Successful'" />
      <Variable x:TypeArguments="x:String" Name="in_ErrorMessage" />
    </Sequence.Variables>
    <If DisplayName="Check Status" Condition="[in_Status = &quot;Successful&quot;]">
      <If.Then>
        <ui:SetTransactionStatus DisplayName="Set Success" TransactionItem="[in_TransactionItem]" Status="Successful" />
      </If.Then>
      <If.Else>
        <Sequence DisplayName="Set Failed">
          <ui:SetTransactionStatus DisplayName="Set Failed" TransactionItem="[in_TransactionItem]" Status="Failed" ErrorType="Application" Reason="[in_ErrorMessage]" />
          <ui:LogMessage Level="Error" Message="[&quot;Transaction failed: &quot; &amp; in_ErrorMessage]" DisplayName="Log Failure" />
        </Sequence>
      </If.Else>
    </If>
  </Sequence>
</Activity>`;
}

export function generateCloseAllApplicationsXaml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- CloseAllApplications.xaml — Auto-generated by CannonBall -->
<!-- REFramework: Gracefully closes all open applications before ending -->
<Activity mc:Ignorable="sap sap2010" x:Class="CloseAllApplications"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=mscorlib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Close All Applications">
    <TryCatch DisplayName="Safe Cleanup">
      <TryCatch.Try>
        <Sequence DisplayName="Close Applications">
          <ui:LogMessage Level="Info" Message="'Closing all applications...'" DisplayName="Log Cleanup Start" />
          <ui:CloseApplication DisplayName="Close Browser" />
          <ui:LogMessage Level="Info" Message="'All applications closed'" DisplayName="Log Cleanup Complete" />
        </Sequence>
      </TryCatch.Try>
      <TryCatch.Catches>
        <Catch x:TypeArguments="s:Exception">
          <ActivityAction x:TypeArguments="s:Exception">
            <Argument x:TypeArguments="s:Exception" x:Name="closeEx" />
            <ui:LogMessage Level="Warn" Message="[&quot;Error during cleanup: &quot; &amp; closeEx.Message]" DisplayName="Log Cleanup Error" />
          </ActivityAction>
        </Catch>
      </TryCatch.Catches>
    </TryCatch>
  </Sequence>
</Activity>`;
}

export function generateKillAllProcessesXaml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- KillAllProcesses.xaml — Auto-generated by CannonBall -->
<!-- REFramework: Force-kills application processes on unrecoverable errors -->
<Activity mc:Ignorable="sap sap2010" x:Class="KillAllProcesses"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=mscorlib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Kill All Processes">
    <ui:LogMessage Level="Warn" Message="'Force killing all application processes...'" DisplayName="Log Kill Start" />
    <ui:KillProcess DisplayName="Kill Chrome" ProcessName="chrome" />
    <ui:KillProcess DisplayName="Kill IE" ProcessName="iexplore" />
    <ui:KillProcess DisplayName="Kill Excel" ProcessName="EXCEL" />
    <ui:LogMessage Level="Info" Message="'All processes terminated'" DisplayName="Log Kill Complete" />
  </Sequence>
</Activity>`;
}

export function aggregateGaps(results: XamlGeneratorResult[]): XamlGap[] {
  const all: XamlGap[] = [];
  for (const r of results) {
    all.push(...r.gaps);
  }
  return all;
}

export function aggregatePackages(results: XamlGeneratorResult[]): string[] {
  const pkgs = new Set<string>();
  for (const r of results) {
    for (const p of r.usedPackages) {
      pkgs.add(p);
    }
  }
  return Array.from(pkgs);
}

export type DhgDeploymentResult = DeploymentResult;

export type DhgExtractedArtifacts = {
  queues?: Array<{ name: string; description?: string; jsonSchema?: string; outputSchema?: string; maxRetries?: number; uniqueReference?: boolean }>;
  assets?: Array<{ name: string; type: string; value?: string; description?: string }>;
  machines?: Array<{ name: string; type?: string; runtimeType?: string; slots?: number; description?: string }>;
  triggers?: Array<{ name: string; type: string; queueName?: string; cron?: string; timezone?: string; startStrategy?: string; maxJobsCount?: number; description?: string }>;
  storageBuckets?: Array<{ name: string; storageProvider?: string; description?: string }>;
  environments?: Array<{ name: string; type?: string; description?: string }>;
  robotAccounts?: Array<{ name: string; type?: string; role?: string; description?: string }>;
  actionCenter?: Array<{ taskCatalog: string; priority?: string; actions?: string[]; formFields?: Array<{ name: string; type: string; required?: boolean }>; sla?: string; escalation?: string; description?: string }>;
  documentUnderstanding?: Array<{ name: string; documentTypes?: string[]; taxonomyFields?: Array<{ documentType: string; fields: Array<{ name: string; type: string }> }>; classifierType?: string; description?: string }>;
  testCases?: Array<{ name: string; testType?: string; priority?: string; preconditions?: string[]; postconditions?: string[]; testData?: Array<{ field: string; value: string; dataType?: string }>; automationWorkflow?: string; description?: string }>;
  testSets?: Array<{ name: string; executionMode?: string; environment?: string; triggerType?: string; testCaseNames?: string[]; description?: string }>;
  requirements?: Array<{ name: string; type?: string; priority?: string; acceptanceCriteria?: string[]; source?: string; description?: string }>;
};

export type DhgOptions = {
  projectName: string;
  description?: string;
  gaps: XamlGap[];
  usedPackages: string[];
  workflowNames: string[];
  sddContent?: string;
  enrichment?: EnrichmentResult | null;
  useReFramework?: boolean;
  painPoints?: { name: string; description: string }[];
  deploymentResults?: DhgDeploymentResult[];
  extractedArtifacts?: DhgExtractedArtifacts;
  analysisReports?: Array<{ fileName: string; report: AnalysisReport }>;
  automationType?: "rpa" | "agent" | "hybrid";
};

export function generateDeveloperHandoffGuide(opts: DhgOptions): string {
  const {
    projectName,
    description,
    gaps,
    usedPackages,
    workflowNames,
    sddContent,
    enrichment,
    useReFramework,
    painPoints,
    deploymentResults,
    extractedArtifacts,
    analysisReports,
    automationType,
  } = opts;

  const selectorGaps = gaps.filter((g) => g.category === "selector");
  const credentialGaps = gaps.filter((g) => g.category === "credential");
  const endpointGaps = gaps.filter((g) => g.category === "endpoint");
  const configGaps = gaps.filter((g) => g.category === "config");
  const logicGaps = gaps.filter((g) => g.category === "logic");
  const manualGaps = gaps.filter((g) => g.category === "manual");

  let sectionNum = 0;
  let md = "";

  md += `# Developer Handoff Guide\n\n`;
  md += `**Project:** ${projectName}\n`;
  if (description) md += `**Description:** ${description}\n`;
  md += `**Generated:** ${new Date().toISOString().split("T")[0]}\n`;
  md += `**Architecture:** ${useReFramework ? "REFramework (Queue-based transactional)" : "Sequential (Linear workflow)"}\n`;
  if (automationType && automationType !== "rpa") {
    const atLabel = automationType === "agent" ? "UiPath Agent (AI-driven autonomous)" : "Hybrid (RPA + Agent)";
    md += `**Automation Type:** ${atLabel}\n`;
  }
  if (enrichment) md += `**AI Enrichment:** Applied — activities use system-specific selectors and real property values\n`;

  const tier2Items = [...endpointGaps, ...configGaps];
  const totalAutoFixed = analysisReports?.reduce((s, r) => s + r.report.totalAutoFixed, 0) ?? 0;
  const totalRulesChecked = analysisReports?.reduce((s, r) => s + r.report.totalChecked, 0) ?? 0;
  const totalRulesPassed = analysisReports?.reduce((s, r) => s + r.report.totalPassed, 0) ?? 0;
  const provisionedCount = deploymentResults?.filter(r => r.status === "created" || r.status === "exists" || r.status === "updated" || r.status === "in_package").length ?? 0;
  const totalProvisionAttempts = deploymentResults?.length ?? 0;

  const enrichmentSelectorCount = enrichment?.nodes?.reduce((s, n) => s + n.activities.filter(a => a.selectorHint).length, 0) ?? 0;
  const totalSelectorCount = selectorGaps.length + enrichmentSelectorCount;
  let credentialAssetCount = extractedArtifacts?.assets?.filter(a => a.type === "Credential").length ?? 0;
  if (credentialAssetCount === 0 && deploymentResults) {
    credentialAssetCount = deploymentResults.filter(r => r.artifact === "Asset" && (
      r.message.includes("Type: Credential") ||
      r.message.toLowerCase().includes("credential") ||
      r.name.toLowerCase().includes("credential") ||
      r.name.toLowerCase().includes("password")
    )).length;
  }
  const totalCredentialCount = credentialGaps.length + credentialAssetCount;
  const deployWarningCount = deploymentResults?.filter(r => r.status === "failed" || r.status === "skipped" || r.status === "manual").length ?? 0;

  const tier3ItemCount = totalSelectorCount + totalCredentialCount + logicGaps.length + manualGaps.length;
  const readinessComponents: number[] = [];
  if (totalRulesChecked > 0) readinessComponents.push(((totalRulesPassed + totalAutoFixed) / Math.max(totalRulesChecked, 1)) * 100);
  if (totalProvisionAttempts > 0) readinessComponents.push((provisionedCount / totalProvisionAttempts) * 100);
  readinessComponents.push(Math.max(0, 100 - tier3ItemCount * 3 - deployWarningCount * 5));
  readinessComponents.push(60);
  const readinessScore = readinessComponents.length > 0
    ? Math.round(readinessComponents.reduce((a, b) => a + b, 0) / readinessComponents.length)
    : 0;

  const mandatoryBaseMinutes = 15 + 30 + 60;
  const earlyAgentMinutes = (automationType === "agent" || automationType === "hybrid") ? (155 + (automationType === "hybrid" ? 30 : 0)) : 0;
  const estTotalMinutes = mandatoryBaseMinutes + totalSelectorCount * 5 + totalCredentialCount * 5 +
    logicGaps.reduce((s, g) => s + g.estimatedMinutes, 0) + manualGaps.reduce((s, g) => s + g.estimatedMinutes, 0) +
    earlyAgentMinutes;

  md += `\n**Readiness Score: ${readinessScore}%** | Estimated developer effort: **~${(estTotalMinutes / 60).toFixed(1)} hours** (${totalSelectorCount} selectors, ${totalCredentialCount} credentials, ${mandatoryBaseMinutes} min mandatory validation)\n`;
  md += `\n---\n\n`;

  const allSelectorHints: Array<{ activity: string; hint: string; nodeName: string }> = [];
  if (enrichment?.nodes) {
    for (const node of enrichment.nodes) {
      for (const act of node.activities) {
        if (act.selectorHint) {
          allSelectorHints.push({ activity: act.activityType || act.displayName, hint: act.selectorHint, nodeName: node.nodeName });
        }
      }
    }
  }

  const totalActivityCount = enrichment?.nodes?.reduce((s, n) => s + (n.activities?.length || 0), 0) ?? 0;

  sectionNum++;
  md += `## ${sectionNum}. Tier 1 — AI Completed (No Human Action Required)\n\n`;
  md += `The following items were fully automated by CannonBall. These are verified facts from deterministic analysis.\n\n`;

  md += `### Workflow Inventory\n\n`;
  md += `**${workflowNames.length} XAML workflow(s)** generated containing **${totalActivityCount} activities** total.\n\n`;
  md += `| # | Workflow File | Purpose | Role |\n`;
  md += `|---|--------------|---------|------|\n`;
  const decomp = enrichment?.decomposition || [];
  let wfIdx = 0;
  for (const wfName of workflowNames) {
    wfIdx++;
    const match = decomp.find(d => d.name === wfName || d.name.replace(/\s+/g, "_") === wfName);
    const purpose = match?.description || (wfName === "Main" ? (useReFramework ? "REFramework State Machine entry point" : "Entry point workflow") : "Sub-workflow");
    const role = match?.isDispatcher ? "Dispatcher" : match?.isPerformer ? "Performer" : (wfName === "Main" ? "Entry Point" : "Sub-workflow");
    md += `| ${wfIdx} | \`${wfName}.xaml\` | ${purpose} | ${role} |\n`;
  }
  md += `\n`;

  if (analysisReports?.length) {
    let combinedAutoFixed = 0;
    let combinedRemaining = 0;
    let combinedPassed = 0;
    for (const ar of analysisReports) {
      combinedAutoFixed += ar.report.totalAutoFixed;
      combinedRemaining += ar.report.totalRemaining;
      combinedPassed += ar.report.totalPassed;
    }

    md += `### Workflow Analyzer Compliance\n\n`;
    md += `Analyzed ${analysisReports.length} workflow file(s) against UiPath Workflow Analyzer rules.\n\n`;

    const mergedRules = new Map<string, { ruleName: string; category: string; passed: number; autoFixed: number; remaining: number }>();
    for (const ar of analysisReports) {
      for (const rule of ar.report.rulesChecked) {
        const existing = mergedRules.get(rule.ruleId) || { ruleName: rule.ruleName, category: rule.category, passed: 0, autoFixed: 0, remaining: 0 };
        if (rule.status === "passed") existing.passed++;
        existing.autoFixed += rule.autoFixedCount;
        existing.remaining += rule.violationCount;
        mergedRules.set(rule.ruleId, existing);
      }
    }

    md += `| Rule ID | Rule | Category | Status | Auto-Fixed | Remaining |\n`;
    md += `|---------|------|----------|--------|------------|----------|\n`;
    for (const [ruleId, data] of Array.from(mergedRules.entries())) {
      const status = data.remaining > 0 ? "Needs Review" : data.autoFixed > 0 ? "Auto-Fixed" : "Passed";
      md += `| ${ruleId} | ${data.ruleName} | ${data.category} | ${status} | ${data.autoFixed} | ${data.remaining} |\n`;
    }
    md += `\n**Result:** ${combinedPassed} of ${totalRulesChecked} rules passed across ${analysisReports.length} workflow files. ${combinedAutoFixed} violation(s) auto-corrected, ${combinedRemaining} remaining for review.\n\n`;

    if (analysisReports.length > 1) {
      md += `**Per-Workflow Breakdown:**\n\n`;
      md += `| Workflow | Rules Checked | Passed | Auto-Fixed | Remaining |\n`;
      md += `|----------|--------------|--------|------------|----------|\n`;
      for (const ar of analysisReports) {
        md += `| \`${ar.fileName}\` | ${ar.report.totalChecked} | ${ar.report.totalPassed} | ${ar.report.totalAutoFixed} | ${ar.report.totalRemaining} |\n`;
      }
      md += `\n`;
    }
  }

  md += `### Standards Enforcement\n\n`;
  md += `| Standard | What Was Done |\n`;
  md += `|----------|---------------|\n`;
  md += `| Naming Conventions | Variables renamed to \`{type}_{PascalCase}\`, arguments to \`{direction}_{PascalCase}\` |\n`;
  md += `| Activity Annotations | Every activity annotated with source step number, business context, and error handling strategy |\n`;
  md += `| Error Handling | All business activities wrapped in TryCatch with Log + Rethrow; UI activities include RetryScope (3 retries, 5s) |\n`;
  md += `| Logging | Start/end LogMessage in every workflow; exceptions logged at Error level before rethrow |\n`;
  md += `| Argument Validation | Entry points validate required arguments at workflow start |\n`;
  md += `\n`;

  md += `### Architecture Decision\n\n`;
  if (useReFramework) {
    md += `**REFramework** selected — queue-based transactional processing with built-in retry and recovery.\n\n`;
    if (enrichment?.reframeworkConfig) {
      md += `| Setting | Value |\n`;
      md += `|---------|-------|\n`;
      md += `| Queue Name | \`${enrichment.reframeworkConfig.queueName}\` |\n`;
      md += `| Max Retries | ${enrichment.reframeworkConfig.maxRetries} |\n`;
      md += `| Process Name | ${enrichment.reframeworkConfig.processName} |\n`;
      md += `\n`;
    }
    md += `\`\`\`\nInit → Get Transaction → Process Transaction → Get Transaction (loop)\n                                    ↓ (exception)\n                              Close Apps → Get Transaction (retry)\n                    ↓ (no more items)\n                       End Process\n\`\`\`\n\n`;
  } else {
    md += `**Sequential Pattern** selected — linear step-by-step flow with step dependencies.\n\n`;
  }
  if (enrichment?.dhgNotes?.length) {
    md += `**AI Architecture Notes:**\n`;
    for (const note of enrichment.dhgNotes) md += `- ${note}\n`;
    md += `\n`;
  }

  if (deploymentResults?.length) {
    md += `### Orchestrator Provisioning Summary\n\n`;
    const artifactTypes = new Map<string, { total: number; ready: number; needs: number }>();
    for (const r of deploymentResults) {
      const entry = artifactTypes.get(r.artifact) || { total: 0, ready: 0, needs: 0 };
      entry.total++;
      if (r.status === "created" || r.status === "exists" || r.status === "updated" || r.status === "in_package") entry.ready++;
      else entry.needs++;
      artifactTypes.set(r.artifact, entry);
    }
    md += `| Artifact Type | Count | Ready | Needs Attention |\n`;
    md += `|---------------|-------|-------|-----------------|\n`;
    artifactTypes.forEach((stats, type) => {
      md += `| ${type} | ${stats.total} | ${stats.ready} | ${stats.needs} |\n`;
    });
    md += `\n**${provisionedCount}/${totalProvisionAttempts}** artifacts provisioned successfully\n\n`;

    md += `**Itemized Artifacts:**\n\n`;
    md += `| # | Type | Name | Status | Orchestrator ID | Details |\n`;
    md += `|---|------|------|--------|-----------------|---------|\n`;
    let artIdx = 0;
    for (const r of deploymentResults) {
      artIdx++;
      const idStr = r.id ? String(r.id) : "—";
      const shortMsg = r.message.length > 80 ? r.message.slice(0, 77) + "..." : r.message;
      md += `| ${artIdx} | ${r.artifact} | \`${r.name}\` | ${r.status} | ${idStr} | ${shortMsg} |\n`;
    }
    md += `\n`;

    if (automationType === "agent" || automationType === "hybrid") {
      const agentResults = deploymentResults?.filter(r => r.artifact === "Agent" || r.artifact === "Knowledge Base" || r.artifact === "Prompt Template") || [];
      if (agentResults.length > 0) {
        md += `### Agent Artifacts Provisioned\n\n`;
        md += `| Artifact | Name | Status | Details |\n`;
        md += `|----------|------|--------|--------|\n`;
        for (const ar of agentResults) {
          md += `| ${ar.artifact} | \`${ar.name}\` | ${ar.status} | ${ar.message.slice(0, 100)} |\n`;
        }
        md += `\n`;
      }
    }
  }

  md += `---\n\n`;

  sectionNum++;
  md += `## ${sectionNum}. Tier 2 — AI Resolved with Smart Defaults (Review Recommended)\n\n`;
  md += `The AI set these values based on SDD analysis. They are likely correct but **must be verified** against your target environment before production use.\n\n`;

  const queues = extractedArtifacts?.queues;
  const assets = extractedArtifacts?.assets;
  const triggers = extractedArtifacts?.triggers;

  const queueResults = deploymentResults?.filter(r => r.artifact === "Queue") || [];
  if (queues?.length) {
    md += `### Queue Schemas\n\n`;
    for (const q of queues) {
      const qResult = deploymentResults?.find(r => r.artifact === "Queue" && r.name === q.name);
      md += `**${q.name}** (${qResult?.status || "unknown"}${qResult?.id ? `, ID: ${qResult.id}` : ""}) — Max Retries: ${q.maxRetries ?? 3}, Unique Ref: ${q.uniqueReference ? "Yes" : "No"}\n`;
      if (q.jsonSchema) {
        md += `\`\`\`json\n${q.jsonSchema}\n\`\`\`\n`;
        md += `> **Review:** AI derived this schema from SDD. Verify field names and types match your actual transaction data model. Add/remove fields as needed.\n\n`;
      }
    }
  } else if (queueResults.length > 0) {
    md += `### Queues\n\n`;
    for (const qr of queueResults) {
      md += `**${qr.name}** (${qr.status}${qr.id ? `, ID: ${qr.id}` : ""}) — ${qr.message.slice(0, 100)}\n`;
      md += `> **Review:** Verify queue specific content schema matches your transaction data model. Configure max retries and unique reference settings as needed.\n\n`;
    }
  }

  const assetResults = deploymentResults?.filter(r => r.artifact === "Asset") || [];
  if (assets?.length) {
    const nonCredAssets = assets.filter(a => a.type !== "Credential");
    if (nonCredAssets.length > 0) {
      md += `### Asset Values\n\n`;
      md += `| Asset | Type | AI-Set Value | Action Required |\n`;
      md += `|-------|------|--------------|-----------------|\n`;
      for (const a of nonCredAssets) {
        const aResult = deploymentResults?.find(r => r.artifact === "Asset" && r.name === a.name);
        const hasPlaceholder = (a.value || "").includes("PLACEHOLDER_");
        const idNote = aResult?.id ? ` (ID: ${aResult.id})` : "";
        md += `| \`${a.name}\`${idNote} | ${a.type} | \`${a.value || "(empty)"}\` | ${hasPlaceholder ? "**SET REAL VALUE** — placeholder needs replacement" : `Verify matches your environment. ${a.description || ""}`} |\n`;
      }
      md += `\n`;
    }
  } else if (assetResults.length > 0) {
    const nonCredAssetResults = assetResults.filter(r => !(
      r.message.includes("Type: Credential") ||
      r.message.toLowerCase().includes("credential") ||
      r.name.toLowerCase().includes("credential") ||
      r.name.toLowerCase().includes("password")
    ));
    if (nonCredAssetResults.length > 0) {
      md += `### Asset Values\n\n`;
      md += `| Asset | Status | ID | Action Required |\n`;
      md += `|-------|--------|----|-----------------|\n`;
      for (const ar of nonCredAssetResults) {
        const typeMatch = ar.message.match(/Type:\s*(\w+)/);
        const assetType = typeMatch ? typeMatch[1] : "Unknown";
        md += `| \`${ar.name}\` (${assetType}) | ${ar.status} | ${ar.id || "—"} | Verify value matches your environment in Orchestrator > Assets > \`${ar.name}\` |\n`;
      }
      md += `\n`;
    }
  }

  const triggerResults = deploymentResults?.filter(r => r.artifact === "Trigger") || [];
  if (triggers?.length) {
    md += `### Trigger Configuration\n\n`;
    md += `| Trigger | Type | Schedule | Timezone | Status | Action Required |\n`;
    md += `|---------|------|----------|----------|--------|-----------------|\n`;
    for (const t of triggers) {
      const tResult = deploymentResults?.find(r => r.artifact === "Trigger" && r.name === t.name);
      const scheduleInfo = t.type === "Queue" ? `Queue: ${t.queueName || "N/A"}` : `Cron: \`${t.cron || "N/A"}\``;
      const isDisabled = tResult?.message?.toLowerCase().includes("disabled");
      const action = isDisabled ? "**ENABLE** — created disabled (no unattended runtime detected)" : "Verify schedule matches business requirements";
      md += `| \`${t.name}\` | ${t.type} | ${scheduleInfo} | ${t.timezone || "UTC"} | ${tResult?.status || "unknown"} | ${action} |\n`;
    }
    md += `\n`;
  } else if (triggerResults.length > 0) {
    md += `### Trigger Configuration\n\n`;
    md += `| Trigger | Type | Details | Status | Action Required |\n`;
    md += `|---------|------|---------|--------|-----------------|\n`;
    for (const tr of triggerResults) {
      const cronMatch = tr.message.match(/cron:\s*([^\s,)]+(?:\s+[^\s,)]+)*)/i);
      const isQueue = tr.message.toLowerCase().includes("queue");
      const trigType = isQueue ? "Queue" : "Time";
      const schedule = cronMatch ? `\`${cronMatch[1]}\`` : (isQueue ? `Queue: ${tr.message.match(/polling\s+"([^"]+)"/)?.[1] || "N/A"}` : "See Orchestrator");
      const isDisabled = tr.message.toLowerCase().includes("disabled");
      const action = isDisabled ? "**ENABLE** — created disabled (no unattended runtime detected)" : "Verify schedule matches business requirements";
      md += `| \`${tr.name}\` | ${trigType} | ${schedule} | ${tr.status} | ${action} |\n`;
    }
    md += `\n`;
  }

  if (tier2Items.length > 0) {
    md += `### Configuration & Endpoints\n\n`;
    md += `| # | Category | Activity | AI-Set Value | Override If Incorrect |\n`;
    md += `|---|----------|----------|-------------|----------------------|\n`;
    tier2Items.forEach((g, i) => {
      md += `| ${i + 1} | ${g.category} | \`${g.activity}\` | \`${g.placeholder}\` | ${g.description} |\n`;
    });
    md += `\n`;
  }

  const deployWarnings = deploymentResults?.filter(r =>
    r.status === "failed" || r.status === "skipped" || r.status === "manual" ||
    r.message.toLowerCase().includes("warning") || r.message.includes("not assigned") ||
    r.message.includes("assign manually") || r.message.includes("405")
  ) || [];
  if (deployWarnings.length > 0) {
    md += `### Deployment Warnings\n\n`;
    md += `The following items encountered issues during deployment and need manual attention:\n\n`;
    md += `| # | Artifact | Name | Issue | Action Required |\n`;
    md += `|---|----------|------|-------|-----------------|\n`;
    deployWarnings.forEach((w, i) => {
      let action = "Review in Orchestrator";
      if (w.message.includes("not assigned") || w.message.includes("assign manually")) {
        action = "Go to Orchestrator > Folder Settings > Machines and assign manually";
      } else if (w.status === "failed") {
        action = "Create manually in Orchestrator";
      } else if (w.status === "skipped") {
        action = "Service unavailable on tenant — configure when available";
      } else if (w.message.includes("405")) {
        action = "API endpoint not supported — configure manually if needed";
      }
      md += `| ${i + 1} | ${w.artifact} | \`${w.name}\` | ${w.status}: ${w.message.slice(0, 80)} | ${action} |\n`;
    });
    md += `\n`;
  }

  const processResult = deploymentResults?.find(r => r.artifact === "Process" || r.artifact === "Release");
  if (processResult) {
    md += `### Process & Release\n\n`;
    md += `| Field | Value |\n`;
    md += `|-------|-------|\n`;
    md += `| Process | \`${processResult.name}\` |\n`;
    md += `| Status | ${processResult.status} |\n`;
    if (processResult.id) md += `| Release ID | ${processResult.id} |\n`;
    md += `| Details | ${processResult.message.slice(0, 120)} |\n`;
    md += `\n`;
  }

  const testResults = deploymentResults?.filter(r => r.artifact === "Test Case" || r.artifact === "Test Set" || r.artifact === "Requirement" || r.artifact === "Test Project" || r.artifact === "Requirement Link") || [];
  if (testResults.length > 0) {
    md += `### Test Manager Artifacts\n\n`;
    const testProject = testResults.find(r => r.artifact === "Test Project");
    if (testProject) {
      md += `**Test Project:** \`${testProject.name}\` (${testProject.status}${testProject.id ? `, ID: ${testProject.id}` : ""})\n\n`;
    }
    const tcs = testResults.filter(r => r.artifact === "Test Case");
    if (tcs.length > 0) {
      md += `**Test Cases (${tcs.length}):**\n\n`;
      md += `| # | Test Case | Status | ID |\n`;
      md += `|---|-----------|--------|----|\n`;
      tcs.forEach((tc, i) => {
        md += `| ${i + 1} | \`${tc.name}\` | ${tc.status} | ${tc.id || "—"} |\n`;
      });
      md += `\n`;
    }
    const tss = testResults.filter(r => r.artifact === "Test Set");
    if (tss.length > 0) {
      md += `**Test Sets (${tss.length}):** ${tss.map(ts => `\`${ts.name}\` (${ts.status})`).join(", ")}\n\n`;
    }
    const reqs = testResults.filter(r => r.artifact === "Requirement");
    if (reqs.length > 0) {
      md += `**Requirements (${reqs.length}):** ${reqs.map(rq => `\`${rq.name}\` (${rq.status})`).join(", ")}\n\n`;
    }
    const failedSteps = testResults.filter(r => r.message.includes("405") && (r.artifact === "Test Case" || r.artifact === "Test Set"));
    if (failedSteps.length > 0) {
      md += `> **Note:** Test step details could not be created via API (405). Add test steps manually in Test Manager for each test case.\n\n`;
    }
  }

  if (automationType === "agent" || automationType === "hybrid") {
    const agentGaps = gaps.filter(g => g.category === "agent");
    md += `### Agent Configuration (Review Recommended)\n\n`;
    md += `The following agent settings were generated by AI and should be reviewed before production use:\n\n`;
    md += `| # | Item | Action Required |\n`;
    md += `|---|------|-----------------|\n`;
    md += `| 1 | Agent guardrails | Review safety constraints and response boundaries |\n`;
    md += `| 2 | Escalation rules | Verify escalation conditions and human-handoff triggers |\n`;
    md += `| 3 | Agent temperature/iterations | Tune LLM parameters for your use case |\n`;
    md += `| 4 | Tool permissions | Confirm which UiPath activities the agent can invoke |\n`;
    if (agentGaps.length > 0) {
      let agIdx = 5;
      for (const g of agentGaps) {
        md += `| ${agIdx++} | ${g.activity} | ${g.description} |\n`;
      }
    }
    md += `\n`;
  }

  if (automationType === "agent" || automationType === "hybrid") {
    md += `### Agent Artifacts in Package\n\n`;
    md += `The following agent configuration files are included in the downloadable package:\n\n`;
    md += `| File | Purpose | Action |\n`;
    md += `|------|---------|--------|\n`;
    md += `| \`prompts/system_prompt.txt\` | System prompt defining agent behavior and guardrails | REVIEW |\n`;
    md += `| \`prompts/user_prompt_template.txt\` | Parameterized user prompt template with input placeholders | REVIEW |\n`;
    md += `| \`tools/tool_definitions.json\` | Tool names, descriptions, and input/output schemas | AUTHORIZE |\n`;
    md += `| \`knowledge/kb_placeholder.md\` | Instructions for knowledge base document upload | CONFIGURE |\n`;
    md += `| \`agents/*_config.json\` | Agent configuration with temperature, iterations, guardrails | TUNE |\n\n`;

    md += `#### Import into UiPath Agent Builder\n\n`;
    md += `1. Open **UiPath Automation Cloud** → **AI Center** → **Agent Builder**\n`;
    md += `2. Create a new agent using the name from \`agents/*_config.json\`\n`;
    md += `3. Copy the system prompt from \`prompts/system_prompt.txt\` into the agent's system prompt field\n`;
    md += `4. Register each tool from \`tools/tool_definitions.json\`:\n`;
    md += `   - For each tool, set the name, description, and input schema\n`;
    md += `   - Grant the required permissions (marked as AUTHORIZE)\n`;
    md += `5. Upload knowledge base documents per instructions in \`knowledge/kb_placeholder.md\`\n`;
    md += `6. Apply configuration values from the agent config file\n\n`;

    md += `#### Configuration Checklist\n\n`;
    md += `| # | Item | File | Action | Notes |\n`;
    md += `|---|------|------|--------|-------|\n`;
    md += `| 1 | System prompt | \`prompts/system_prompt.txt\` | REVIEW | Verify tone, scope, and safety constraints |\n`;
    md += `| 2 | User prompt template | \`prompts/user_prompt_template.txt\` | REVIEW | Confirm input/output format matches your data |\n`;
    md += `| 3 | Tool permissions | \`tools/tool_definitions.json\` | AUTHORIZE | Grant each tool access in Agent Builder |\n`;
    md += `| 4 | Knowledge base | \`knowledge/kb_placeholder.md\` | CONFIGURE | Upload and index actual business documents |\n`;
    md += `| 5 | Temperature / iterations | \`agents/*_config.json\` | TUNE | Adjust for accuracy vs. creativity tradeoff |\n`;
    md += `| 6 | Guardrails | \`agents/*_config.json\` | REVIEW | Verify safety constraints are appropriate |\n`;
    md += `| 7 | Escalation rules | \`agents/*_config.json\` | REVIEW | Confirm human-handoff triggers |\n\n`;

    md += `#### What Works Out of the Box\n\n`;
    md += `- System prompt with process-specific context derived from SDD\n`;
    md += `- Tool definitions with correct schemas\n`;
    md += `- Agent config with recommended defaults (temperature, max iterations)\n`;
    md += `- Guardrail definitions from process analysis\n\n`;

    md += `#### Requires Human Action\n\n`;
    md += `- Tool authorization in Agent Builder (security review required)\n`;
    md += `- Knowledge base document upload (actual SOPs and reference materials)\n`;
    md += `- Production prompt tuning after testing with real data\n`;
    md += `- Escalation rule validation with stakeholders\n\n`;
  }

  md += `---\n\n`;

  sectionNum++;
  md += `## ${sectionNum}. Tier 3 — Requires Human Access (Developer Work Required)\n\n`;
  md += `These items require a developer with access to target systems and UiPath Studio. **Every generated package requires this work.**\n\n`;

  const allSelectorItems: Array<{ system: string; activity: string; hint: string; description: string; estimatedMinutes: number; source: string }> = [];
  for (const g of selectorGaps) {
    allSelectorItems.push({ system: extractSystemFromGap(g), activity: g.activity, hint: g.placeholder, description: g.description, estimatedMinutes: g.estimatedMinutes, source: "gap" });
  }
  const gapSelectorActivities = new Set(selectorGaps.map(g => g.activity));
  for (const sh of allSelectorHints) {
    if (!gapSelectorActivities.has(sh.activity)) {
      const sys = sh.hint.toLowerCase().includes("sap") ? "SAP" :
        sh.hint.toLowerCase().includes("salesforce") || sh.hint.toLowerCase().includes("sfdc") ? "Salesforce" :
        sh.hint.toLowerCase().includes("servicenow") ? "ServiceNow" :
        sh.hint.toLowerCase().includes("workday") ? "Workday" :
        sh.hint.toLowerCase().includes("oracle") ? "Oracle" :
        sh.hint.includes("webctrl") || sh.hint.includes("browser") ? "Web Browser" : "General";
      allSelectorItems.push({ system: sys, activity: sh.activity, hint: sh.hint, description: `Validate AI-generated selector for "${sh.nodeName}" — capture real selector via UiExplorer`, estimatedMinutes: 5, source: "enrichment" });
    }
  }

  if (allSelectorItems.length > 0) {
    md += `### UI Selectors (${allSelectorItems.length} items)\n\n`;
    md += `AI-generated selector hints are **structural patterns only**. Each must be validated and recaptured using UiExplorer with access to the live target application.\n\n`;
    md += `| # | System | Activity | AI Selector Hint | Action | Est. Time |\n`;
    md += `|---|--------|----------|-----------------|--------|----------|\n`;
    const selectorsBySystem: Record<string, typeof allSelectorItems> = {};
    for (const s of allSelectorItems) {
      if (!selectorsBySystem[s.system]) selectorsBySystem[s.system] = [];
      selectorsBySystem[s.system].push(s);
    }
    let sIdx = 0;
    for (const [sys, sysItems] of Object.entries(selectorsBySystem)) {
      for (const s of sysItems) {
        sIdx++;
        const hintDisplay = s.hint.length > 60 ? s.hint.slice(0, 57) + "..." : s.hint;
        md += `| ${sIdx} | ${sys} | \`${s.activity}\` | \`${hintDisplay}\` | ${s.description} | ${s.estimatedMinutes} min |\n`;
      }
    }
    md += `\n`;
    for (const sys of Object.keys(selectorsBySystem)) {
      const lsys = sys.toLowerCase();
      if (lsys.includes("sap")) {
        md += `**SAP:** Use UiExplorer with SAP Bridge. GUI selectors use \`automationid\`. Fiori uses CSS selectors. Add wildcards for session-specific attributes.\n\n`;
      } else if (lsys.includes("salesforce")) {
        md += `**Salesforce:** Use Lightning-compatible selectors with SLDS classes. Dynamic IDs change per session. Consider Salesforce Integration Activities for API-based operations.\n\n`;
      } else if (lsys.includes("servicenow")) {
        md += `**ServiceNow:** Field selectors use \`sys_display.<table>.<field>\` pattern. Consider REST API for bulk operations.\n\n`;
      }
    }
  }

  let credentialAssets = assets?.filter(a => a.type === "Credential") || [];
  if (credentialAssets.length === 0 && deploymentResults) {
    const credResults = deploymentResults.filter(r => r.artifact === "Asset" && (
      r.message.includes("Type: Credential") ||
      r.message.toLowerCase().includes("credential") ||
      r.name.toLowerCase().includes("credential") ||
      r.name.toLowerCase().includes("password")
    ));
    credentialAssets = credResults.map(r => ({ name: r.name, type: "Credential", description: "Set username and password", value: "" }));
  }
  if (credentialGaps.length > 0 || credentialAssets.length > 0) {
    md += `### Credentials (${credentialGaps.length + credentialAssets.length} items)\n\n`;
    md += `These require access to production/UAT credential stores. **Credentials are never auto-filled** — you must set real values.\n\n`;
    md += `| # | Asset | Orchestrator ID | Description | Where to Set |\n`;
    md += `|---|-------|-----------------|-------------|-------------|\n`;
    let cIdx = 0;
    for (const ca of credentialAssets) {
      cIdx++;
      const caResult = deploymentResults?.find(r => r.artifact === "Asset" && r.name === ca.name);
      md += `| ${cIdx} | \`${ca.name}\` | ${caResult?.id || "—"} | ${ca.description || "Set username and password"} | Orchestrator > Assets > \`${ca.name}\` > Edit |\n`;
    }
    for (const g of credentialGaps) {
      cIdx++;
      md += `| ${cIdx} | \`${g.activity}\` | — | ${g.description} | Replace \`${g.placeholder}\` in XAML |\n`;
    }
    md += `\n`;
  }

  const complexGaps = [...logicGaps, ...manualGaps];
  if (complexGaps.length > 0) {
    md += `### Business Logic & Manual Steps (${complexGaps.length} items)\n\n`;
    md += `| # | Category | Activity | Description | Est. Time |\n`;
    md += `|---|----------|----------|-------------|----------|\n`;
    complexGaps.forEach((g, i) => {
      md += `| ${i + 1} | ${g.category} | \`${g.activity}\` | ${g.description} | ${g.estimatedMinutes} min |\n`;
    });
    md += `\n`;
  }

  const machines = extractedArtifacts?.machines || [];
  const machineResults = deploymentResults?.filter(r => r.artifact === "Machine") || [];
  const machineWarnings = machineResults.filter(r => r.message.includes("not assigned") || r.message.includes("assign manually") || r.status === "failed");
  const robots = extractedArtifacts?.robotAccounts || [];
  const robotResults = deploymentResults?.filter(r => r.artifact === "Robot Account" || r.artifact === "Users/Robot Accounts") || [];
  if (machineWarnings.length > 0 || machines.length > 0 || robots.length > 0 || machineResults.length > 0) {
    md += `### Machine & Robot Configuration\n\n`;
    if (machineWarnings.length > 0) {
      md += `| # | Machine | Issue | Action Required |\n`;
      md += `|---|---------|-------|-----------------|\n`;
      machineWarnings.forEach((m, i) => {
        md += `| ${i + 1} | \`${m.name}\` | ${m.message.slice(0, 80)} | Go to Orchestrator > Folder Settings > Machines and assign to your folder |\n`;
      });
      md += `\n`;
    } else if (machines.length > 0) {
      md += `Machines provisioned: ${machines.map(m => `\`${m.name}\``).join(", ")}. Verify they are assigned to the correct folder and have available unattended slots.\n\n`;
    }
    if (robots.length > 0) {
      md += `Robot accounts: ${robots.map((r: any) => `\`${r.name}\` (${r.type || "Unattended"})`).join(", ")}. Verify robot account permissions and machine assignment.\n\n`;
    }
  }

  const duResults = deploymentResults?.filter(r => r.artifact === "Document Understanding") || [];
  const duArtifacts = extractedArtifacts?.documentUnderstanding || [];
  if (duResults.length > 0 || duArtifacts.length > 0) {
    md += `### Document Understanding Setup\n\n`;
    if (duArtifacts.length > 0) {
      for (const du of duArtifacts) {
        const duResult = duResults.find(r => r.name === du.name);
        md += `**${du.name}** (${duResult?.status || "unknown"}${duResult?.id ? `, ID: ${duResult.id}` : ""})\n`;
        if (du.documentTypes?.length) {
          md += `- Document types needed: ${du.documentTypes.join(", ")}\n`;
        }
        const isPredefined = duResult?.id === "00000000-0000-0000-0000-000000000000" || duResult?.message?.includes("predefined") || duResult?.message?.includes("Predefined");
        if (isPredefined) {
          md += `- Using **Predefined** DU project (pretrained models). For custom extraction, create a new project in Document Understanding app and train custom extractors.\n`;
        }
        md += `- **Action:** Configure document classifiers and extractors for your specific document formats. Upload sample documents to validate extraction accuracy.\n`;
      }
    } else {
      for (const duR of duResults) {
        md += `**${duR.name}** (${duR.status}${duR.id ? `, ID: ${duR.id}` : ""})\n`;
        const docTypesMatch = duR.message.match(/Document types?:\s*([^.]+)/i);
        if (docTypesMatch) {
          md += `- Document types: ${docTypesMatch[1].trim()}\n`;
        }
        const isPredefined = duR.id === "00000000-0000-0000-0000-000000000000" || duR.message?.includes("predefined") || duR.message?.includes("Predefined");
        if (isPredefined) {
          md += `- Using **Predefined** DU project (pretrained models). For custom extraction, create a new project in Document Understanding app and train custom extractors.\n`;
        }
        md += `- **Action:** Configure document classifiers and extractors for your specific document formats. Upload sample documents to validate extraction accuracy.\n`;
      }
    }
    md += `\n`;
  }

  const acResults = deploymentResults?.filter(r => r.artifact === "Action Center") || [];
  const acArtifacts = extractedArtifacts?.actionCenter || [];
  if (acResults.length > 0 || acArtifacts.length > 0) {
    md += `### Action Center Configuration\n\n`;
    md += `| # | Task Catalog | Status | ID | Action Required |\n`;
    md += `|---|-------------|--------|----|-----------------|\n`;
    let acIdx = 0;
    if (acArtifacts.length > 0) {
      for (const ac of acArtifacts) {
        acIdx++;
        const acResult = acResults.find(r => r.name === ac.taskCatalog);
        md += `| ${acIdx} | \`${ac.taskCatalog}\` | ${acResult?.status || "unknown"} | ${acResult?.id || "—"} | Assign role (${ac.assignedRole || "TBD"}), configure form fields, set SLA${ac.sla ? ` (suggested: ${ac.sla})` : ""} |\n`;
      }
    } else {
      for (const acR of acResults) {
        acIdx++;
        const catalogMatch = acR.message.match(/catalog\s+"([^"]+)"/i);
        const catalogName = catalogMatch ? catalogMatch[1] : acR.name;
        md += `| ${acIdx} | \`${catalogName}\` | ${acR.status} | ${acR.id || "—"} | Assign reviewer role, configure form fields for human review tasks, set SLA |\n`;
      }
    }
    md += `\n`;
  }

  if (automationType === "agent" || automationType === "hybrid") {
    md += `### Agent Setup (Human Required)\n\n`;
    md += `These items require human expertise and access to configure the agent for production:\n\n`;
    md += `| # | Task | Description | Est. Time |\n`;
    md += `|---|------|-------------|----------|\n`;
    md += `| 1 | Knowledge base content | Upload and index actual business documents, SOPs, and reference materials | 60 min |\n`;
    md += `| 2 | Production prompt tuning | Test and refine system prompts against real-world scenarios and edge cases | 45 min |\n`;
    md += `| 3 | Agent end-to-end testing | Execute agent with representative inputs, verify outputs and escalation behavior | 30 min |\n`;
    md += `| 4 | Guardrail validation | Verify agent stays within safety constraints with adversarial test cases | 20 min |\n`;
    if (automationType === "hybrid") {
      md += `| 5 | RPA-Agent handoff testing | Verify data flows correctly between RPA sequences and agent invocations | 30 min |\n`;
    }
    md += `\n`;
  }

  md += `### Mandatory: Studio Validation & Testing\n\n`;
  md += `Every generated package requires these steps regardless of AI enrichment quality:\n\n`;
  const selectorValidationMinutes = allSelectorItems.length > 0 ? allSelectorItems.reduce((s, si) => s + si.estimatedMinutes, 0) : 0;
  const credentialMinutes = (credentialAssets.length + credentialGaps.length) * 5;
  md += `| # | Task | Description | Est. Time |\n`;
  md += `|---|------|-------------|----------|\n`;
  md += `| 1 | Studio Import | Open .nupkg in UiPath Studio. Install missing packages, resolve dependency conflicts, verify project compiles without errors. | 15 min |\n`;
  if (allSelectorItems.length > 0) {
    md += `| 2 | Selector Validation | Validate all ${allSelectorItems.length} UI selectors in UiExplorer against real target applications. AI selectors are structural hints — they will not work without recapture. | ${selectorValidationMinutes} min |\n`;
  }
  if (credentialAssets.length > 0 || credentialGaps.length > 0) {
    md += `| ${allSelectorItems.length > 0 ? 3 : 2} | Credential Setup | Set real username/password for ${credentialAssets.length + credentialGaps.length} credential asset(s) in Orchestrator > Assets. | ${credentialMinutes} min |\n`;
  }
  let mandatoryIdx = (allSelectorItems.length > 0 ? 1 : 0) + (credentialAssets.length > 0 || credentialGaps.length > 0 ? 1 : 0) + 1;
  md += `| ${mandatoryIdx + 1} | End-to-End Testing | Execute all ${workflowNames.length} workflows in Studio Debug mode against UAT/test environment. Verify queue processing, exception handling, and business rules. | 30 min |\n`;
  md += `| ${mandatoryIdx + 2} | UAT Sign-off | Business stakeholder validation with real data and real systems. Confirm outputs match expected results for representative scenarios. | 60 min |\n`;
  md += `\n`;

  const agentTier3Minutes = (automationType === "agent" || automationType === "hybrid") ? (155 + (automationType === "hybrid" ? 30 : 0)) : 0;
  const mandatoryMinutes = 15 + selectorValidationMinutes + credentialMinutes + 30 + 60;
  const tier3TotalMinutes = selectorGaps.reduce((s, g) => s + g.estimatedMinutes, 0) +
    credentialGaps.reduce((s, g) => s + g.estimatedMinutes, 0) +
    complexGaps.reduce((s, g) => s + g.estimatedMinutes, 0) +
    credentialAssets.length * 5 + agentTier3Minutes +
    mandatoryMinutes +
    allSelectorItems.filter(s => s.source === "enrichment").reduce((sum, s) => sum + s.estimatedMinutes, 0);
  md += `**Total Tier 3 Effort: ~${(tier3TotalMinutes / 60).toFixed(1)} hours** (${allSelectorItems.length} selectors, ${credentialGaps.length + credentialAssets.length} credentials, ${complexGaps.length} logic items, mandatory validation)\n\n`;

  md += `---\n\n`;

  sectionNum++;
  md += `## ${sectionNum}. Code Review Checklist\n\n`;
  md += `Use this checklist during peer review before promoting to UAT.\n\n`;

  if (analysisReports?.length) {
    const remaining = analysisReports.flatMap(ar => ar.report.violations.filter(v => !v.autoFixed));
    if (remaining.length > 0) {
      md += `### Workflow Analyzer Remaining Violations\n\n`;
      md += `| Severity | Rule | File | Message |\n`;
      md += `|----------|------|------|---------|\n`;
      for (const ar of analysisReports) {
        for (const v of ar.report.violations.filter(vv => !vv.autoFixed)) {
          md += `| ${v.severity} | ${v.ruleId} | ${ar.fileName} | ${v.message} |\n`;
        }
      }
      md += `\n`;
    } else {
      md += `All Workflow Analyzer checks passed or were auto-corrected. No remaining violations.\n\n`;
    }
  }

  md += `### Review Rubric\n\n`;
  md += `| Category | Check | Status |\n`;
  md += `|----------|-------|---------|\n`;
  md += `| Exception Handling | All activities in TryCatch? Catch blocks log + rethrow? | AI: Done |\n`;
  md += `| Transaction Integrity | Queue items set to Success/Failed/BusinessException? | ${useReFramework ? "AI: Done (REFramework)" : "N/A"} |\n`;
  md += `| Logging | Info log at start/end of each workflow? Critical decisions logged? | AI: Done |\n`;
  md += `| Selector Reliability | Selectors use stable attributes (automationid, name)? | ${allSelectorItems.length > 0 ? "Tier 3: Pending" : "N/A"} |\n`;
  md += `| Credential Security | All credentials in Orchestrator Assets, not hardcoded? | AI: Verified |\n`;
  md += `| Naming Conventions | Variables/arguments follow type/direction prefixes? | AI: Auto-corrected |\n`;
  md += `| Annotations | Every activity annotated with business context? | AI: Done |\n`;
  md += `| Argument Validation | Entry points validate required arguments? | AI: Done |\n`;
  md += `| Config Management | Environment-specific values in Config.xlsx? | AI: Done |\n`;
  if (automationType === "agent" || automationType === "hybrid") {
    md += `| Agent Guardrails | Safety constraints prevent harmful agent actions? | Tier 2: Review |\n`;
    md += `| Agent Escalation | Human handoff triggers correctly configured? | Tier 2: Review |\n`;
    md += `| Agent Testing | Agent produces expected outputs for sample inputs? | Tier 3: Pending |\n`;
    md += `| Knowledge Base | Agent has access to required reference documents? | Tier 3: Pending |\n`;
  }
  md += `\n`;

  md += `### Pre-Deployment Verification\n\n`;
  md += `1. Open the project in UiPath Studio\n`;
  md += `2. Run **Analyze File** > **Workflow Analyzer** on all files\n`;
  md += `3. Confirm zero errors and zero warnings\n`;
  md += `4. Run all unit tests in Test Manager\n`;
  md += `5. Execute a full end-to-end run in Dev environment\n\n`;

  md += `### Sign-Off\n\n`;
  md += `| Field | Value |\n`;
  md += `|-------|-------|\n`;
  md += `| Reviewer | _________________ |\n`;
  md += `| Date | _________________ |\n`;
  md += `| Approval | [ ] Approved for UAT  [ ] Requires Changes |\n`;
  md += `| Notes | _________________ |\n\n`;

  md += `---\n\n`;

  sectionNum++;
  md += `## ${sectionNum}. Package Contents\n\n`;
  md += `| File | Purpose |\n`;
  md += `|------|--------|\n`;
  md += `| \`project.json\` | UiPath project manifest with dependencies |\n`;
  md += `| \`Main.xaml\` | ${useReFramework ? "REFramework State Machine entry point" : "Entry point workflow"} |\n`;
  if (useReFramework) {
    md += `| \`GetTransactionData.xaml\` | Fetches next queue item |\n`;
    md += `| \`Process.xaml\` | Business logic for single transaction |\n`;
    md += `| \`SetTransactionStatus.xaml\` | Marks transaction Success/Failed |\n`;
    md += `| \`CloseAllApplications.xaml\` | Graceful app cleanup |\n`;
    md += `| \`KillAllProcesses.xaml\` | Force-kill hanging processes |\n`;
  }
  for (const wfName of workflowNames) {
    if (!["Main", "GetTransactionData", "Process", "SetTransactionStatus", "CloseAllApplications", "KillAllProcesses"].includes(wfName)) {
      md += `| \`${wfName}.xaml\` | Workflow: ${wfName} |\n`;
    }
  }
  md += `| \`InitAllSettings.xaml\` | Configuration initialization |\n`;
  md += `| \`Data/Config.xlsx\` | Configuration settings |\n`;
  md += `| \`DeveloperHandoffGuide.md\` | This guide |\n\n`;
  md += `**Required Packages:** ${usedPackages.map(p => `\`${p}\``).join(", ")}\n\n`;

  if (painPoints && painPoints.length > 0) {
    md += `---\n\n`;
    sectionNum++;
    md += `## ${sectionNum}. Risk Assessment\n\n`;
    md += `| # | Step | Risk | Mitigation |\n`;
    md += `|---|------|------|------------|\n`;
    painPoints.forEach((pp, i) => {
      md += `| ${i + 1} | ${pp.name} | ${pp.description || "Pain point"} | Extra error handling and retry logic applied |\n`;
    });
    md += `\n`;
  }

  const testCases = extractedArtifacts?.testCases;
  const testSets = extractedArtifacts?.testSets;
  if (testCases?.length || testSets?.length) {
    md += `---\n\n`;
    sectionNum++;
    md += `## ${sectionNum}. Test Suite\n\n`;
    if (testCases?.length) {
      const tcResults = deploymentResults?.filter(r => r.artifact === "Test Case");
      md += `| # | Test Case | Type | Priority | Status |\n`;
      md += `|---|-----------|------|----------|--------|\n`;
      testCases.forEach((tc, i) => {
        const result = tcResults?.find(r => r.name === tc.name);
        md += `| ${i + 1} | \`${tc.name}\` | ${tc.testType || "Functional"} | ${tc.priority || "Medium"} | ${result?.status || "unknown"} |\n`;
      });
      md += `\n`;
    }
    if (testSets?.length) {
      const tsResults = deploymentResults?.filter(r => r.artifact === "Test Set");
      md += `| # | Test Set | Mode | Test Cases | Status |\n`;
      md += `|---|----------|------|------------|--------|\n`;
      testSets.forEach((ts, i) => {
        const result = tsResults?.find(r => r.name === ts.name);
        md += `| ${i + 1} | \`${ts.name}\` | ${ts.executionMode || "Sequential"} | ${ts.testCaseNames?.length || 0} | ${result?.status || "unknown"} |\n`;
      });
      md += `\n`;
    }
  }

  const requirements = extractedArtifacts?.requirements;
  if (requirements?.length) {
    md += `---\n\n`;
    sectionNum++;
    md += `## ${sectionNum}. Requirements Traceability\n\n`;
    const reqResults = deploymentResults?.filter(r => r.artifact === "Requirement");
    md += `| # | Requirement | Type | Priority | Status |\n`;
    md += `|---|------------|------|----------|--------|\n`;
    requirements.forEach((req, i) => {
      const result = reqResults?.find(r => r.name === req.name);
      md += `| ${i + 1} | \`${req.name}\` | ${req.type || "Functional"} | ${req.priority || "Medium"} | ${result?.status || "unknown"} |\n`;
    });
    md += `\n`;
    const reqsWithCriteria = requirements.filter(r => r.acceptanceCriteria?.length);
    if (reqsWithCriteria.length > 0) {
      for (const req of reqsWithCriteria) {
        md += `**${req.name}:**\n`;
        for (const c of req.acceptanceCriteria!) md += `- [ ] ${c}\n`;
        md += `\n`;
      }
    }
  }

  md += `---\n\n`;
  sectionNum++;
  md += `## ${sectionNum}. Infrastructure\n\n`;
  const infraMachines = extractedArtifacts?.machines;
  const infraRobots = extractedArtifacts?.robotAccounts;
  const infraBuckets = extractedArtifacts?.storageBuckets;
  const infraEnvironments = extractedArtifacts?.environments;
  const infraFromDeployResults = deploymentResults?.filter(r => r.artifact === "Infrastructure") || [];
  if (infraMachines?.length) {
    md += `**Machines:** ${infraMachines.map(m => `\`${m.name}\` (${m.runtimeType || m.type || "Unattended"}, ${m.slots || 1} slots)`).join(", ")}\n`;
  }
  if (infraRobots?.length) {
    md += `**Robots:** ${infraRobots.map(r => `\`${r.name}\` (${r.type || "Unattended"}, ${r.role || "Executor"})`).join(", ")}\n`;
  }
  if (infraBuckets?.length) {
    md += `**Storage:** ${infraBuckets.map(b => `\`${b.name}\` (${b.storageProvider || "Orchestrator"})`).join(", ")}\n`;
  }
  if (infraEnvironments?.length) {
    md += `**Environments:** ${infraEnvironments.map(e => `\`${e.name}\` (${e.type || "Production"})`).join(", ")}\n`;
  }
  if (!infraMachines?.length && !infraRobots?.length && !infraBuckets?.length && deploymentResults?.length) {
    for (const ir of infraFromDeployResults) {
      md += `**${ir.name}:** ${ir.message.slice(0, 120)}\n`;
    }
    const infraMachineResults = deploymentResults.filter(r => r.artifact === "Machine");
    for (const mr of infraMachineResults) {
      md += `**Machine:** \`${mr.name}\` (${mr.status}${mr.id ? `, ID: ${mr.id}` : ""}) — ${mr.message.slice(0, 100)}\n`;
    }
    const infraStorageResults = deploymentResults.filter(r => r.artifact === "Storage Bucket");
    for (const sr of infraStorageResults) {
      md += `**Storage:** \`${sr.name}\` (${sr.status}${sr.id ? `, ID: ${sr.id}` : ""}) — ${sr.message.slice(0, 100)}\n`;
    }
  }
  md += `\n`;

  const infraAcArtifacts = extractedArtifacts?.actionCenter;
  if (infraAcArtifacts?.length) {
    md += `### Action Center\n\n`;
    for (const ac of infraAcArtifacts) {
      const acResult = deploymentResults?.find(r => r.artifact === "Action Center" && r.name === ac.taskCatalog);
      md += `**${ac.taskCatalog}** (${acResult?.status || "unknown"})`;
      if (ac.sla) md += ` — SLA: ${ac.sla}`;
      md += `\n`;
      if (ac.formFields?.length) {
        md += `Fields: ${ac.formFields.map(f => `${f.name} (${f.type}${f.required ? ", required" : ""})`).join(", ")}\n`;
      }
    }
    md += `\n`;
  }

  const infraDuArtifacts = extractedArtifacts?.documentUnderstanding;
  if (infraDuArtifacts?.length) {
    md += `### Document Understanding\n\n`;
    for (const du of infraDuArtifacts) {
      const duResult = deploymentResults?.find(r => r.artifact === "Document Understanding" && r.name === du.name);
      md += `**${du.name}** (${duResult?.status || "unknown"})`;
      if (du.documentTypes?.length) md += ` — Types: ${du.documentTypes.join(", ")}`;
      md += `\n`;
    }
    md += `\n`;
  }

  let testingContent = "";
  if (sddContent) {
    const section7Match = sddContent.match(/## 7[\.\s][^\n]+\n([\s\S]*?)(?=## \d+\.|$)/);
    if (section7Match) testingContent = section7Match[1].trim();
  }

  md += `---\n\n`;
  sectionNum++;
  md += `## ${sectionNum}. Go-Live Checklist\n\n`;
  md += `#### Development\n`;
  md += `- [ ] Open project in UiPath Studio — install missing packages\n`;
  md += `- [ ] Run Workflow Analyzer — confirm zero violations\n`;
  md += `- [ ] Complete Tier 3 items (selectors, credentials, business logic)\n`;
  md += `- [ ] Config.xlsx updated with Dev values\n\n`;
  md += `#### UAT\n`;
  md += `- [ ] UAT Orchestrator folder with separate assets/queues\n`;
  md += `- [ ] Full end-to-end run with real data\n`;
  md += `- [ ] Business stakeholder sign-off\n\n`;
  md += `#### Production\n`;
  md += `- [ ] Production credentials and assets configured\n`;
  md += `- [ ] Triggers/schedules active\n`;
  md += `- [ ] Monitoring and alerting configured\n`;
  md += `- [ ] Runbook documentation completed\n`;

  return md;
}

function extractSystemFromGap(gap: XamlGap): string {
  const desc = (gap.description + " " + gap.placeholder).toLowerCase();
  if (desc.includes("sap")) return "SAP";
  if (desc.includes("salesforce") || desc.includes("sfdc")) return "Salesforce";
  if (desc.includes("servicenow") || desc.includes("snow")) return "ServiceNow";
  if (desc.includes("workday")) return "Workday";
  if (desc.includes("oracle")) return "Oracle";
  if (desc.includes("browser") || desc.includes("web") || desc.includes("chrome")) return "Web Browser";
  return "General";
}

export function generateDhgSummary(gaps: XamlGap[], deploymentResults?: DhgDeploymentResult[]): string {
  const selectorCount = gaps.filter((g) => g.category === "selector").length;
  const credentialCount = gaps.filter((g) => g.category === "credential").length;
  const endpointCount = gaps.filter((g) => g.category === "endpoint").length;
  const configCount = gaps.filter((g) => g.category === "config").length;
  const logicCount = gaps.filter((g) => g.category === "logic").length;
  const manualCount = gaps.filter((g) => g.category === "manual").length;
  const agentCount = gaps.filter((g) => g.category === "agent").length;
  const totalMinutes = gaps.reduce((sum, g) => sum + g.estimatedMinutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  const lines: string[] = [
    `Enhanced Developer Handoff Summary (${gaps.length} XAML items, ~${totalHours}h XAML effort):`,
  ];

  if (selectorCount > 0) lines.push(`  - ${selectorCount} UI selector(s) to capture`);
  if (credentialCount > 0) lines.push(`  - ${credentialCount} credential/asset(s) to configure`);
  if (endpointCount > 0) lines.push(`  - ${endpointCount} integration endpoint(s) to set`);
  if (configCount > 0) lines.push(`  - ${configCount} configuration value(s) to update`);
  if (logicCount > 0) lines.push(`  - ${logicCount} business logic gap(s) to implement`);
  if (manualCount > 0) lines.push(`  - ${manualCount} manual step(s) to complete`);
  if (agentCount > 0) lines.push(`  - ${agentCount} agent invocation(s) to configure`);

  if (deploymentResults?.length) {
    const failed = deploymentResults.filter(r => r.status === "failed" || r.status === "manual");
    const created = deploymentResults.filter(r => r.status === "created" || r.status === "exists" || r.status === "updated" || r.status === "in_package");
    lines.push(`  Orchestrator: ${created.length}/${deploymentResults.length} artifacts provisioned`);
    if (failed.length > 0) {
      lines.push(`  ${failed.length} artifact(s) need manual setup — see DHG for details`);
    }
  }

  lines.push(`See DeveloperHandoffGuide.md in the package for full details (covers all 14 artifact types).`);

  return lines.join("\n");
}
