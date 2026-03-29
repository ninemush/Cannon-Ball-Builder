import type { QualityGateResult } from "./uipath-quality-gate";

export class QualityGateError extends Error {
  qualityGateResult: QualityGateResult;
  compliantWorkflows?: Array<{ name: string; content: string }>;
  constructor(message: string, result: QualityGateResult, compliantWorkflows?: Array<{ name: string; content: string }>) {
    super(message);
    this.name = "QualityGateError";
    this.qualityGateResult = result;
    this.compliantWorkflows = compliantWorkflows;
  }
}

export const UIPATH_PACKAGE_ALIAS_MAP: Record<string, string> = {
  "UiPath.WebAPI.Activities": "UiPath.Web.Activities",
  "UiPath.HTTP.Activities": "UiPath.Web.Activities",
  "UiPath.REST.Activities": "UiPath.Web.Activities",
  "UiPath.HttpClient.Activities": "UiPath.Web.Activities",
  "UiPath.Orchestrator.Activities": "UiPath.System.Activities",
  "UiPath.OrchestratorAPI.Activities": "UiPath.System.Activities",
  "UiPath.Core.Activities": "UiPath.System.Activities",
  "UiPath.Automation.Activities": "UiPath.System.Activities",
  "UiPath.UI.Activities": "UiPath.UIAutomation.Activities",
  "UiPath.UIAutomationNext.Activities": "UiPath.UIAutomation.Activities",
  "UiPath.Browser.Activities": "UiPath.UIAutomation.Activities",
  "UiPath.Selenium.Activities": "UiPath.UIAutomation.Activities",
  "UiPath.Email.Activities": "UiPath.Mail.Activities",
  "UiPath.Outlook.Activities": "UiPath.Mail.Activities",
  "UiPath.SMTP.Activities": "UiPath.Mail.Activities",
  "UiPath.CSV.Activities": "UiPath.Excel.Activities",
  "UiPath.Spreadsheet.Activities": "UiPath.Excel.Activities",
  "UiPath.DataTable.Activities": "UiPath.System.Activities",
  "UiPath.File.Activities": "UiPath.System.Activities",
  "UiPath.PDF.Activities": "UiPath.UIAutomation.Activities",
  "UiPath.Cognitive.Activities": "UiPath.MLActivities",
  "UiPath.AI.Activities": "UiPath.MLActivities",
  "UiPath.MachineLearning.Activities": "UiPath.MLActivities",
  "UiPath.Credentials.Activities": "UiPath.System.Activities",
  "UiPath.Queue.Activities": "UiPath.System.Activities",
  "UiPath.Storage.Activities": "UiPath.Persistence.Activities",
  "UiPath.DB.Activities": "UiPath.Database.Activities",
  "UiPath.SQL.Activities": "UiPath.Database.Activities",
};

export const FRAMEWORK_ASSEMBLIES = new Set<string>([
  "System.Activities",
  "System.ServiceModel",
  "System.Xaml",
  "System.Runtime",
  "System.Core",
  "Microsoft.CSharp",
  "Microsoft.VisualBasic",
  "Microsoft.VisualBasic.Activities",
  "PresentationFramework",
  "PresentationCore",
  "WindowsBase",
]);

export function isFrameworkAssembly(pkgName: string): boolean {
  return FRAMEWORK_ASSEMBLIES.has(pkgName);
}

export type UiPathConfig = {
  orgName: string;
  tenantName: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  folderId?: string;
  folderName?: string;
};
