export const simpleLinearNodes = [
  { id: "1", name: "Login to Portal", nodeType: "task", description: "Open browser and log in to the HR portal using credentials from Orchestrator assets", system: "HR Portal" },
  { id: "2", name: "Download Report", nodeType: "task", description: "Navigate to the reports section and download the monthly attendance CSV", system: "HR Portal" },
  { id: "3", name: "Save to SharePoint", nodeType: "task", description: "Upload the downloaded CSV file to the SharePoint document library", system: "SharePoint" },
];

export const simpleLinearEdges = [
  { sourceNodeId: "1", targetNodeId: "2", label: "on success" },
  { sourceNodeId: "2", targetNodeId: "3", label: "on success" },
];

export const apiDataDrivenNodes = [
  { id: "1", name: "Fetch API Token", nodeType: "task", description: "Call the OAuth2 token endpoint to obtain a bearer token for the REST API", system: "Auth API" },
  { id: "2", name: "Query Customer Records", nodeType: "task", description: "GET /api/customers with pagination, collect all records into a DataTable", system: "CRM API" },
  { id: "3", name: "Transform Records", nodeType: "task", description: "Filter and reshape the customer records, applying business rules for deduplication", system: "Internal" },
  { id: "4", name: "Write to Database", nodeType: "task", description: "Insert transformed records into the staging SQL database table using bulk insert", system: "SQL Database" },
];

export const apiDataDrivenEdges = [
  { sourceNodeId: "1", targetNodeId: "2", label: "" },
  { sourceNodeId: "2", targetNodeId: "3", label: "" },
  { sourceNodeId: "3", targetNodeId: "4", label: "" },
];

export const transactionalQueueNodes = [
  { id: "1", name: "Initialize Settings", nodeType: "task", description: "Read config from Orchestrator assets and initialize application settings", system: "Orchestrator" },
  { id: "2", name: "Get Transaction Item", nodeType: "task", description: "Get the next queue item from the InvoiceQueue in Orchestrator", system: "Orchestrator" },
  { id: "3", name: "Open Invoice App", nodeType: "task", description: "Launch the invoice processing desktop application and log in", system: "Invoice App" },
  { id: "4", name: "Process Invoice", nodeType: "task", description: "Enter invoice details from the queue item into the application form fields", system: "Invoice App" },
  { id: "5", name: "Set Transaction Status", nodeType: "task", description: "Mark the queue item as successful or failed based on processing outcome", system: "Orchestrator" },
];

export const transactionalQueueEdges = [
  { sourceNodeId: "1", targetNodeId: "2", label: "" },
  { sourceNodeId: "2", targetNodeId: "3", label: "" },
  { sourceNodeId: "3", targetNodeId: "4", label: "" },
  { sourceNodeId: "4", targetNodeId: "5", label: "" },
  { sourceNodeId: "5", targetNodeId: "2", label: "next item" },
];

export const lowConfidenceNodes = [
  { id: "1", name: "Do Something", nodeType: "task", description: "Perform the task", system: "" },
];

export const lowConfidenceEdges: any[] = [];

export function makeProjectJson(projectName: string, deps: Record<string, string>): string {
  return JSON.stringify({
    name: projectName,
    projectVersion: "1.0.0",
    description: `${projectName} automation`,
    main: "Main.xaml",
    dependencies: deps,
    toolVersion: "23.10.0",
    projectType: "Workflow",
    libraryOptions: { includeOriginalXaml: false, packageId: projectName, version: "1.0.0" },
    designOptions: { projectProfile: "Developement", outputType: "Process" },
    expressionLanguage: "VisualBasic",
    entryPoints: [{ filePath: "Main.xaml", uniqueId: "00000000-0000-0000-0000-000000000001", input: [], output: [] }],
    schemaVersion: "4.0",
    studioVersion: "23.10.0.0",
    isTemplate: false,
    templateProjectData: {},
    publishData: {},
    targetFramework: "Windows",
  }, null, 2);
}
