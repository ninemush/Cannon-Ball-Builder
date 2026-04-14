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
  "UiPath.Web.Activities": "UiPath.WebAPI.Activities",
  "UiPath.HTTP.Activities": "UiPath.WebAPI.Activities",
  "UiPath.REST.Activities": "UiPath.WebAPI.Activities",
  "UiPath.HttpClient.Activities": "UiPath.WebAPI.Activities",
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
  "UiPath.DataService.Activities.Core": "UiPath.DataService.Activities",
  "UiPath.Agentic": "UiPath.Agentic.Activities",
};

let _catalogAssemblyToPackageCache: Record<string, string> | null = null;
let _catalogAssemblyCacheGeneration = -1;

function getCatalogAssemblyMap(): Record<string, string> | null {
  try {
    const { catalogService } = require("./catalog/catalog-service");
    if (!catalogService.isLoaded()) return null;
    const currentGeneration = typeof catalogService.getLoadGeneration === "function"
      ? catalogService.getLoadGeneration()
      : 0;
    if (_catalogAssemblyToPackageCache && _catalogAssemblyCacheGeneration === currentGeneration) {
      return _catalogAssemblyToPackageCache;
    }
    const entries = catalogService.getAllPackageNamespaceEntries();
    const map: Record<string, string> = {};
    for (const entry of entries) {
      if (entry.assembly && entry.packageId && !map[entry.assembly]) {
        map[entry.assembly] = entry.packageId;
      }
    }
    _catalogAssemblyToPackageCache = map;
    _catalogAssemblyCacheGeneration = currentGeneration;
    return map;
  } catch {
    return null;
  }
}

export function normalizePackageName(name: string): string {
  const catalogMap = getCatalogAssemblyMap();
  if (catalogMap) {
    const catalogResolved = catalogMap[name];
    if (catalogResolved) return catalogResolved;

    try {
      const { catalogService } = require("./catalog/catalog-service");
      const typePkg = catalogService.resolveTypeToPackage(name);
      if (typePkg) return typePkg;
      const actPkg = catalogService.getPackageForActivity(name);
      if (actPkg) return actPkg;
    } catch {}
  }

  if (UIPATH_PACKAGE_ALIAS_MAP[name]) return UIPATH_PACKAGE_ALIAS_MAP[name];

  return name;
}

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
  "System.Drawing.Common",
  "System.Drawing.Primitives",
  "System.Data.Common",
  "System.Data.DataSetExtensions",
  "System.Net.Mail",
  "System.ObjectModel",
  "System.Linq",
  "System.ComponentModel.TypeConverter",
  "mscorlib",
  "System.Drawing",
  "System.Runtime.Serialization",
  "System.ServiceModel.Activities",
  "System.Private.CoreLib",
  "System.Data",
  // UiPath.Platform is an infrastructure assembly providing CLR types (IResource, ILocalResource)
  // used as argument types inside other packages' activities. It has no entry in generation-metadata.json
  // and is not a standalone installable NuGet package. Excluded from required-package scanning.
  "UiPath.Platform",
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
