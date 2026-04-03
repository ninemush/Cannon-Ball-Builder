import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { ActivityCatalog, CatalogActivity, CatalogPackage, CanonicalIdentity, CompositionRule, PropertyConflict } from "./catalog-service";
import { PACKAGE_NAMESPACE_MAP } from "../xaml/xaml-compliance";

type Provenance = "authoritative" | "curated";

interface EnrichmentReportEntry {
  packageId: string;
  className: string;
  field: string;
  value: string | string[] | boolean | Record<string, unknown> | Record<string, unknown>[];
  provenance: Provenance;
}

const NAMESPACE_MAP: Record<string, Record<string, string>> = {
  "System.Activities": {
    "FlowDecision": "System.Activities.Statements",
    "FlowSwitch": "System.Activities.Statements",
    "Assign": "System.Activities.Statements",
    "If": "System.Activities.Statements",
    "Sequence": "System.Activities.Statements",
    "TryCatch": "System.Activities.Statements",
    "Flowchart": "System.Activities.Statements",
    "ForEach": "System.Activities.Statements",
    "While": "System.Activities.Statements",
    "DoWhile": "System.Activities.Statements",
    "Switch": "System.Activities.Statements",
    "Throw": "System.Activities.Statements",
    "Rethrow": "System.Activities.Statements",
    "Delay": "System.Activities.Statements",
    "ParallelForEach": "System.Activities.Statements",
  },
  "UiPath.System.Activities": {
    "ReadTextFile": "UiPath.Core.Activities",
    "WriteTextFile": "UiPath.Core.Activities",
    "PathExists": "UiPath.Core.Activities",
    "Comment": "UiPath.Core.Activities",
    "Rethrow": "UiPath.Core.Activities",
    "KillProcess": "UiPath.Core.Activities",
    "Delay": "UiPath.Core.Activities",
    "GetTransactionItem": "UiPath.Core.Activities",
    "SetTransactionStatus": "UiPath.Core.Activities",
    "LogMessage": "UiPath.Core.Activities",
    "InvokeWorkflowFile": "UiPath.Core.Activities",
    "AddQueueItem": "UiPath.Core.Activities",
    "GetCredential": "UiPath.Core.Activities",
    "GetAsset": "UiPath.Core.Activities",
    "AddLogFields": "UiPath.Core.Activities",
    "RetryScope": "UiPath.Core.Activities",
    "ShouldRetry": "UiPath.Core.Activities",
    "ExcelApplicationScope": "UiPath.Core.Activities",
    "ExcelReadRange": "UiPath.Core.Activities",
    "ExcelWriteRange": "UiPath.Core.Activities",
  },
  "UiPath.UIAutomation.Activities": {
    "UseBrowser": "UiPath.UIAutomation.Activities",
    "NavigateTo": "UiPath.UIAutomation.Activities",
    "AttachBrowser": "UiPath.UIAutomation.Activities",
    "AttachWindow": "UiPath.UIAutomation.Activities",
    "UseApplicationBrowser": "UiPath.UIAutomation.Activities",
    "ElementExists": "UiPath.UIAutomation.Activities",
    "UseApplication": "UiPath.UIAutomation.Activities",
    "TakeScreenshot": "UiPath.UIAutomation.Activities",
    "Click": "UiPath.UIAutomation.Activities",
    "TypeInto": "UiPath.UIAutomation.Activities",
    "GetText": "UiPath.UIAutomation.Activities",
    "OpenBrowser": "UiPath.UIAutomation.Activities",
    "CloseApplication": "UiPath.UIAutomation.Activities",
    "KillProcess": "UiPath.UIAutomation.Activities",
    "SendOutlookMailMessage": "UiPath.UIAutomation.Activities",
  },
  "UiPath.Excel.Activities": {
    "UseExcel": "UiPath.Excel.Activities",
    "ReadRange": "UiPath.Excel.Activities",
    "WriteRange": "UiPath.Excel.Activities",
    "ExcelApplicationScope": "UiPath.Excel.Activities",
    "ExcelReadRange": "UiPath.Excel.Activities",
    "ExcelWriteRange": "UiPath.Excel.Activities",
    "CloseWorkbook": "UiPath.Excel.Activities",
    "SaveWorkbook": "UiPath.Excel.Activities",
    "InsertColumns": "UiPath.Excel.Activities",
    "InsertRows": "UiPath.Excel.Activities",
    "DeleteColumn": "UiPath.Excel.Activities",
    "DeleteRows": "UiPath.Excel.Activities",
    "GetWorkbookSheet": "UiPath.Excel.Activities",
    "GetWorkbookSheets": "UiPath.Excel.Activities",
    "CopyPasteRange": "UiPath.Excel.Activities",
    "AutoFillRange": "UiPath.Excel.Activities",
    "LookupRange": "UiPath.Excel.Activities",
    "ReadCell": "UiPath.Excel.Activities",
    "WriteCell": "UiPath.Excel.Activities",
    "AppendRange": "UiPath.Excel.Activities",
    "CreatePivotTable": "UiPath.Excel.Activities",
    "ForEachExcelRow": "UiPath.Excel.Activities",
    "ForEachSheet": "UiPath.Excel.Activities",
  },
  "UiPath.Mail.Activities": {
    "SendOutlookMailMessage": "UiPath.Mail.Activities",
    "GetOutlookMailMessages": "UiPath.Mail.Activities",
    "SendSmtpMailMessage": "UiPath.Mail.Activities",
    "GetImapMailMessages": "UiPath.Mail.Activities",
    "GetPop3MailMessages": "UiPath.Mail.Activities",
    "SaveMailMessage": "UiPath.Mail.Activities",
    "MoveMail": "UiPath.Mail.Activities",
    "SendExchangeMailMessage": "UiPath.Mail.Activities",
    "GetExchangeMailMessages": "UiPath.Mail.Activities",
    "SaveAttachments": "UiPath.Mail.Activities",
    "ForEachMail": "UiPath.Mail.Activities",
    "ReplyToMail": "UiPath.Mail.Activities",
    "ForwardMail": "UiPath.Mail.Activities",
    "MarkMailAsRead": "UiPath.Mail.Activities",
    "DeleteMail": "UiPath.Mail.Activities",
  },
  "UiPath.WebAPI.Activities": {
    "HttpClientRequest": "UiPath.WebAPI.Activities",
    "DownloadFile": "UiPath.WebAPI.Activities",
    "HttpClient": "UiPath.WebAPI.Activities",
    "DeserializeJSON": "UiPath.WebAPI.Activities",
    "SerializeJson": "UiPath.WebAPI.Activities",
    "DeserializeJson": "UiPath.WebAPI.Activities",
  },
  "UiPath.PDF.Activities": {
    "ReadPDFText": "UiPath.PDF.Activities",
    "ReadPDFWithOCR": "UiPath.PDF.Activities",
    "ExtractPDFPageRange": "UiPath.PDF.Activities",
    "MergePDF": "UiPath.PDF.Activities",
    "GetPDFPageCount": "UiPath.PDF.Activities",
  },
  "UiPath.Word.Activities": {
    "ReadDocument": "UiPath.Word.Activities",
    "WriteDocument": "UiPath.Word.Activities",
    "ReplaceText": "UiPath.Word.Activities",
    "AppendText": "UiPath.Word.Activities",
    "InsertPicture": "UiPath.Word.Activities",
    "ReadTable": "UiPath.Word.Activities",
  },
  "UiPath.Database.Activities": {
    "DatabaseConnect": "UiPath.Database.Activities",
    "DatabaseDisconnect": "UiPath.Database.Activities",
    "ExecuteQuery": "UiPath.Database.Activities",
    "ExecuteNonQuery": "UiPath.Database.Activities",
    "InsertDataTable": "UiPath.Database.Activities",
  },
  "UiPath.ComplexScenarios.Activities": {
    "MultipleAssign": "UiPath.ComplexScenarios.Activities",
    "WaitForDownload": "UiPath.ComplexScenarios.Activities",
    "RepeatUntil": "UiPath.ComplexScenarios.Activities",
    "BuildDataTable": "UiPath.ComplexScenarios.Activities",
    "FilterDataTable": "UiPath.ComplexScenarios.Activities",
    "SortDataTable": "UiPath.ComplexScenarios.Activities",
    "RemoveDuplicateRows": "UiPath.ComplexScenarios.Activities",
    "JoinDataTables": "UiPath.ComplexScenarios.Activities",
    "OutputDataTable": "UiPath.ComplexScenarios.Activities",
  },
  "UiPath.Testing.Activities": {
    "VerifyExpression": "UiPath.Testing.Activities",
    "VerifyRange": "UiPath.Testing.Activities",
    "VerifyControlAttribute": "UiPath.Testing.Activities",
    "LogAssert": "UiPath.Testing.Activities",
    "GivenName": "UiPath.Testing.Activities",
    "WhenName": "UiPath.Testing.Activities",
    "ThenName": "UiPath.Testing.Activities",
    "AddTestDataQueueItem": "UiPath.Testing.Activities",
  },
  "UiPath.Cryptography.Activities": {
    "EncryptText": "UiPath.Cryptography.Activities",
    "DecryptText": "UiPath.Cryptography.Activities",
    "HashText": "UiPath.Cryptography.Activities",
    "HashFile": "UiPath.Cryptography.Activities",
    "EncryptFile": "UiPath.Cryptography.Activities",
    "DecryptFile": "UiPath.Cryptography.Activities",
    "KeyedHashText": "UiPath.Cryptography.Activities",
    "KeyedHashFile": "UiPath.Cryptography.Activities",
  },
  "UiPath.Credentials.Activities": {
    "GetSecureCredential": "UiPath.Credentials.Activities",
    "RequestCredential": "UiPath.Credentials.Activities",
  },
  "UiPath.FTP.Activities": {
    "FTPConnect": "UiPath.FTP.Activities",
    "FTPDisconnect": "UiPath.FTP.Activities",
    "FTPUploadFile": "UiPath.FTP.Activities",
    "FTPDownloadFile": "UiPath.FTP.Activities",
    "FTPDeleteFile": "UiPath.FTP.Activities",
    "FTPListFiles": "UiPath.FTP.Activities",
    "FTPDirectoryExists": "UiPath.FTP.Activities",
    "FTPFileExists": "UiPath.FTP.Activities",
  },
  "UiPath.Salesforce.Activities": {
    "SalesforceApplicationScope": "UiPath.Salesforce.Activities",
    "SalesforceGetRecords": "UiPath.Salesforce.Activities",
    "SalesforceInsertRecords": "UiPath.Salesforce.Activities",
    "SalesforceUpdateRecords": "UiPath.Salesforce.Activities",
    "SalesforceDeleteRecords": "UiPath.Salesforce.Activities",
    "SalesforceSOQLQuery": "UiPath.Salesforce.Activities",
  },
  "UiPath.ServiceNow.Activities": {
    "ServiceNowApplicationScope": "UiPath.ServiceNow.Activities",
    "ServiceNowGetRecords": "UiPath.ServiceNow.Activities",
    "ServiceNowCreateRecord": "UiPath.ServiceNow.Activities",
    "ServiceNowUpdateRecord": "UiPath.ServiceNow.Activities",
    "ServiceNowDeleteRecord": "UiPath.ServiceNow.Activities",
  },
  "UiPath.Slack.Activities": {
    "SlackScope": "UiPath.Slack.Activities",
    "SlackSendMessage": "UiPath.Slack.Activities",
    "SlackGetMessages": "UiPath.Slack.Activities",
    "SlackUploadFile": "UiPath.Slack.Activities",
  },
  "UiPath.Jira.Activities": {
    "JiraScope": "UiPath.Jira.Activities",
    "JiraGetIssues": "UiPath.Jira.Activities",
    "JiraCreateIssue": "UiPath.Jira.Activities",
    "JiraUpdateIssue": "UiPath.Jira.Activities",
    "JiraAddComment": "UiPath.Jira.Activities",
    "JiraTransitionIssue": "UiPath.Jira.Activities",
  },
  "UiPath.MicrosoftTeams.Activities": {
    "TeamsScope": "UiPath.MicrosoftTeams.Activities",
    "TeamsSendMessage": "UiPath.MicrosoftTeams.Activities",
    "TeamsGetMessages": "UiPath.MicrosoftTeams.Activities",
  },
  "UiPath.GSuite.Activities": {
    "GSuiteApplicationScope": "UiPath.GSuite.Activities",
    "GoogleSheetReadRange": "UiPath.GSuite.Activities",
    "GoogleSheetWriteRange": "UiPath.GSuite.Activities",
    "GoogleSheetAppendRange": "UiPath.GSuite.Activities",
    "GoogleSheetDeleteRange": "UiPath.GSuite.Activities",
    "GoogleDocsReadDocument": "UiPath.GSuite.Activities",
    "GoogleDocsWriteDocument": "UiPath.GSuite.Activities",
    "GoogleDriveUploadFile": "UiPath.GSuite.Activities",
    "GoogleDriveDownloadFile": "UiPath.GSuite.Activities",
    "GoogleDriveDeleteFile": "UiPath.GSuite.Activities",
    "GoogleDriveListFiles": "UiPath.GSuite.Activities",
    "GoogleDriveCreateFolder": "UiPath.GSuite.Activities",
    "GmailSendMessage": "UiPath.GSuite.Activities",
    "GmailGetMessages": "UiPath.GSuite.Activities",
    "GoogleCalendarCreateEvent": "UiPath.GSuite.Activities",
    "GoogleCalendarGetEvents": "UiPath.GSuite.Activities",
    "GoogleCalendarDeleteEvent": "UiPath.GSuite.Activities",
    "GoogleCalendarUpdateEvent": "UiPath.GSuite.Activities",
  },
  "UiPath.MicrosoftOffice365.Activities": {
    "Office365ApplicationScope": "UiPath.MicrosoftOffice365.Activities",
    "O365SendMail": "UiPath.MicrosoftOffice365.Activities",
    "O365GetMail": "UiPath.MicrosoftOffice365.Activities",
    "O365ReadRange": "UiPath.MicrosoftOffice365.Activities",
    "O365WriteRange": "UiPath.MicrosoftOffice365.Activities",
    "O365CreateFile": "UiPath.MicrosoftOffice365.Activities",
    "O365DownloadFile": "UiPath.MicrosoftOffice365.Activities",
    "O365DeleteFile": "UiPath.MicrosoftOffice365.Activities",
    "O365ListFiles": "UiPath.MicrosoftOffice365.Activities",
    "O365CalendarCreateEvent": "UiPath.MicrosoftOffice365.Activities",
    "O365CalendarGetEvents": "UiPath.MicrosoftOffice365.Activities",
  },
  "UiPath.AmazonWebServices.Activities": {
    "AmazonScope": "UiPath.AmazonWebServices.Activities",
    "S3UploadFile": "UiPath.AmazonWebServices.Activities",
    "S3DownloadFile": "UiPath.AmazonWebServices.Activities",
    "S3DeleteObject": "UiPath.AmazonWebServices.Activities",
    "S3ListObjects": "UiPath.AmazonWebServices.Activities",
  },
  "UiPath.Amazon.Comprehend.Activities": {
    "ComprehendDetectSentiment": "UiPath.Amazon.Comprehend.Activities",
    "ComprehendDetectEntities": "UiPath.Amazon.Comprehend.Activities",
    "ComprehendDetectKeyPhrases": "UiPath.Amazon.Comprehend.Activities",
    "ComprehendDetectLanguage": "UiPath.Amazon.Comprehend.Activities",
  },
  "UiPath.Amazon.Rekognition.Activities": {
    "RekognitionDetectLabels": "UiPath.Amazon.Rekognition.Activities",
    "RekognitionDetectText": "UiPath.Amazon.Rekognition.Activities",
    "RekognitionDetectFaces": "UiPath.Amazon.Rekognition.Activities",
  },
  "UiPath.Amazon.Textract.Activities": {
    "TextractAnalyzeDocument": "UiPath.Amazon.Textract.Activities",
    "TextractDetectText": "UiPath.Amazon.Textract.Activities",
  },
  "UiPath.Azure.Activities": {
    "AzureScope": "UiPath.Azure.Activities",
    "AzureBlobUpload": "UiPath.Azure.Activities",
    "AzureBlobDownload": "UiPath.Azure.Activities",
    "AzureBlobDelete": "UiPath.Azure.Activities",
    "AzureBlobList": "UiPath.Azure.Activities",
  },
  "UiPath.AzureFormRecognizerV3.Activities": {
    "FormRecognizerAnalyze": "UiPath.AzureFormRecognizerV3.Activities",
    "FormRecognizerAnalyzeLayout": "UiPath.AzureFormRecognizerV3.Activities",
  },
  "UiPath.Box.Activities": {
    "BoxScope": "UiPath.Box.Activities",
    "BoxUploadFile": "UiPath.Box.Activities",
    "BoxDownloadFile": "UiPath.Box.Activities",
    "BoxDeleteFile": "UiPath.Box.Activities",
    "BoxSearchFiles": "UiPath.Box.Activities",
  },
  "UiPath.CommunicationsMining.Activities": {
    "CommunicationsMiningScope": "UiPath.CommunicationsMining.Activities",
    "AnalyzeMessage": "UiPath.CommunicationsMining.Activities",
    "UploadCommunications": "UiPath.CommunicationsMining.Activities",
  },
  "UiPath.DataService.Activities": {
    "CreateEntityRecord": "UiPath.DataService.Activities",
    "UpdateEntityRecord": "UiPath.DataService.Activities",
    "DeleteEntityRecord": "UiPath.DataService.Activities",
    "GetEntityRecords": "UiPath.DataService.Activities",
    "GetEntityRecordById": "UiPath.DataService.Activities",
  },
  "UiPath.DocumentUnderstanding.Activities": {
    "DigitizeDocument": "UiPath.DocumentUnderstanding.Activities",
    "ClassifyDocument": "UiPath.DocumentUnderstanding.Activities",
    "ExtractDocumentData": "UiPath.DocumentUnderstanding.Activities",
    "CreateDocumentValidationAction": "UiPath.DocumentUnderstanding.Activities",
    "WaitForDocumentValidationAction": "UiPath.DocumentUnderstanding.Activities",
  },
  "UiPath.Form.Activities": {
    "ShowFormDialog": "UiPath.Form.Activities",
    "CreateFormTask": "UiPath.Form.Activities",
    "WaitFormTask": "UiPath.Form.Activities",
  },
  "UiPath.GenAI.Activities": {
    "GenerateText": "UiPath.GenAI.Activities",
    "ChatCompletion": "UiPath.GenAI.Activities",
    "Summarize": "UiPath.GenAI.Activities",
  },
  "UiPath.GoogleCloud.Activities": {
    "GoogleCloudScope": "UiPath.GoogleCloud.Activities",
    "GoogleStorageUploadFile": "UiPath.GoogleCloud.Activities",
    "GoogleStorageDownloadFile": "UiPath.GoogleCloud.Activities",
    "GoogleStorageDeleteFile": "UiPath.GoogleCloud.Activities",
    "GoogleStorageListFiles": "UiPath.GoogleCloud.Activities",
  },
  "UiPath.GoogleVision.Activities": {
    "GoogleVisionDetectLabels": "UiPath.GoogleVision.Activities",
    "GoogleVisionDetectText": "UiPath.GoogleVision.Activities",
    "GoogleVisionDetectFaces": "UiPath.GoogleVision.Activities",
  },
  "UiPath.IntelligentOCR.Activities": {
    "LoadTaxonomy": "UiPath.IntelligentOCR.Activities",
    "DigitizeDocument": "UiPath.IntelligentOCR.Activities",
    "ClassifyDocumentScope": "UiPath.IntelligentOCR.Activities",
    "DataExtractionScope": "UiPath.IntelligentOCR.Activities",
    "PresentValidationStation": "UiPath.IntelligentOCR.Activities",
    "TrainClassifiers": "UiPath.IntelligentOCR.Activities",
    "TrainExtractors": "UiPath.IntelligentOCR.Activities",
    "ExportExtractionResults": "UiPath.IntelligentOCR.Activities",
  },
  "UiPath.IntegrationService.Activities": {
    "IntegrationServiceScope": "UiPath.IntegrationService.Activities",
    "IntegrationServiceConnector": "UiPath.IntegrationService.Activities",
  },
  "UiPath.MLActivities": {
    "MLSkill": "UiPath.MLActivities",
    "MLModelRun": "UiPath.MLActivities",
  },
  "UiPath.MicrosoftDynamics.Activities": {
    "DynamicsScope": "UiPath.MicrosoftDynamics.Activities",
    "DynamicsGetRecords": "UiPath.MicrosoftDynamics.Activities",
    "DynamicsCreateRecord": "UiPath.MicrosoftDynamics.Activities",
    "DynamicsUpdateRecord": "UiPath.MicrosoftDynamics.Activities",
    "DynamicsDeleteRecord": "UiPath.MicrosoftDynamics.Activities",
  },
  "UiPath.Persistence.Activities": {
    "CreateStorageBucket": "UiPath.Persistence.Activities",
    "ListStorageFiles": "UiPath.Persistence.Activities",
    "ReadStorageText": "UiPath.Persistence.Activities",
    "WriteStorageText": "UiPath.Persistence.Activities",
    "DeleteStorageFile": "UiPath.Persistence.Activities",
  },
  "UiPath.Presentations.Activities": {
    "ReadPresentation": "UiPath.Presentations.Activities",
    "AddSlide": "UiPath.Presentations.Activities",
    "SavePresentation": "UiPath.Presentations.Activities",
  },
  "UiPath.Workday.Activities": {
    "WorkdayScope": "UiPath.Workday.Activities",
    "WorkdayGetWorkers": "UiPath.Workday.Activities",
    "WorkdayGetWorkerById": "UiPath.Workday.Activities",
  },
  "UiPath.WorkflowEvents.Activities": {
    "RaiseAlert": "UiPath.WorkflowEvents.Activities",
    "TriggerJob": "UiPath.WorkflowEvents.Activities",
  },
  "UiPath.Coupa.IntegrationService.Activities": {
    "CoupaScope": "UiPath.Coupa.IntegrationService.Activities",
    "CoupaGetPurchaseOrders": "UiPath.Coupa.IntegrationService.Activities",
    "CoupaCreateRequisition": "UiPath.Coupa.IntegrationService.Activities",
  },
};

const CANONICAL_IDENTITY_DATA: Record<string, {
  canonicalPackageId: string;
  alternatePackageId: string;
}> = {
  "Rethrow": { canonicalPackageId: "System.Activities", alternatePackageId: "UiPath.System.Activities" },
  "Delay": { canonicalPackageId: "System.Activities", alternatePackageId: "UiPath.System.Activities" },
  "KillProcess": { canonicalPackageId: "UiPath.UIAutomation.Activities", alternatePackageId: "UiPath.System.Activities" },
  "ExcelApplicationScope": { canonicalPackageId: "UiPath.Excel.Activities", alternatePackageId: "UiPath.System.Activities" },
  "ExcelReadRange": { canonicalPackageId: "UiPath.Excel.Activities", alternatePackageId: "UiPath.System.Activities" },
  "ExcelWriteRange": { canonicalPackageId: "UiPath.Excel.Activities", alternatePackageId: "UiPath.System.Activities" },
  "SendOutlookMailMessage": { canonicalPackageId: "UiPath.Mail.Activities", alternatePackageId: "UiPath.UIAutomation.Activities" },
};

const DEPRECATION_DATA: Record<string, { isDeprecated: boolean; preferModern?: string; provenance: Provenance }> = {
  "ExcelApplicationScope": { isDeprecated: false, preferModern: "UseExcel", provenance: "curated" },
  "OpenBrowser": { isDeprecated: false, preferModern: "UseBrowser", provenance: "curated" },
  "AttachBrowser": { isDeprecated: false, preferModern: "UseBrowser", provenance: "curated" },
  "AttachWindow": { isDeprecated: false, preferModern: "UseApplication", provenance: "curated" },
  "GetOutlookMailMessages": { isDeprecated: false, preferModern: "UseOutlookAccount + ForEachMail", provenance: "curated" },
  "SendSmtpMailMessage": { isDeprecated: false, preferModern: "SendMail (Integration Service)", provenance: "curated" },
};

const COMPOSITION_RULES_DATA: Record<string, CompositionRule[]> = {
  "TryCatch": [
    { rule: "Body goes in <TryCatch.Try>. Catches require typed <Catch> children with x:TypeArguments. Finally goes in <TryCatch.Finally>.", provenance: "curated" },
  ],
  "Switch": [
    { rule: "Requires x:TypeArguments on the Switch element. Cases are <Switch.Cases> containing typed key-value pairs. Default case goes in <Switch.Default>.", provenance: "curated" },
  ],
  "ForEach": [
    { rule: "Requires TypeArgument attribute (e.g., x:TypeArguments=\"x:String\"). Body goes in <ForEach.Body><ActivityAction x:TypeArguments=\"x:String\"><Sequence>...</Sequence></ActivityAction></ForEach.Body>.", provenance: "curated" },
  ],
  "UseExcel": [
    { rule: "Must wrap child activities that operate on Excel. Children execute within the Excel file scope defined by FilePath.", provenance: "curated" },
  ],
  "UseBrowser": [
    { rule: "Must wrap child activities that interact with the browser. Url specifies the initial navigation target. Children execute within the browser scope.", provenance: "curated" },
  ],
  "UseApplication": [
    { rule: "Must wrap child activities that interact with a desktop application. Children execute within the application scope.", provenance: "curated" },
  ],
  "Flowchart": [
    { rule: "Contains FlowStep and FlowDecision nodes. StartNode attribute points to the first node. Nodes connect via FlowStep.Next or FlowDecision.True/False.", provenance: "curated" },
  ],
};

const PROPERTY_CONFLICTS_DATA: Record<string, PropertyConflict[]> = {
  "Click": [
    { property: "Selector", conflictsWith: ["Target"], reason: "Modern Target-based identification replaces classic Selector strings. Use one or the other.", provenance: "curated" },
  ],
  "TypeInto": [
    { property: "Selector", conflictsWith: ["Target"], reason: "Modern Target-based identification replaces classic Selector strings. Use one or the other.", provenance: "curated" },
  ],
  "GetText": [
    { property: "Selector", conflictsWith: ["Target"], reason: "Modern Target-based identification replaces classic Selector strings. Use one or the other.", provenance: "curated" },
  ],
  "ElementExists": [
    { property: "Selector", conflictsWith: ["Target"], reason: "Modern Target-based identification replaces classic Selector strings. Use one or the other.", provenance: "curated" },
  ],
  "TakeScreenshot": [
    { property: "Selector", conflictsWith: ["Target"], reason: "Modern Target-based identification replaces classic Selector strings. Use one or the other.", provenance: "curated" },
  ],
};

const ADDITIONAL_ENUM_DATA: Record<string, Record<string, string[]>> = {
  "ReadTextFile": { "Encoding": ["UTF-8", "UTF-16", "ASCII", "Unicode", "Default"] },
  "WriteTextFile": { "Encoding": ["UTF-8", "UTF-16", "ASCII", "Unicode", "Default"] },
  "Click": { "ClickType": ["Single", "Double"], "MouseButton": ["Left", "Right", "Middle"] },
  "TypeInto": { "ClickBeforeTyping": ["True", "False"], "EmptyField": ["True", "False"] },
  "OpenBrowser": { "BrowserType": ["Chrome", "Firefox", "Edge", "IE"] },
  "NavigateTo": { "BrowserType": ["Chrome", "Firefox", "Edge", "IE"] },
  "SendSmtpMailMessage": { "SecureConnection": ["None", "Auto", "SSL", "TLS"] },
  "GetImapMailMessages": { "SecureConnection": ["None", "Auto", "SSL", "TLS"] },
  "GetPop3MailMessages": { "SecureConnection": ["None", "Auto", "SSL", "TLS"] },
  "ExecuteQuery": { "CommandType": ["Text", "StoredProcedure", "TableDirect"] },
  "ExecuteNonQuery": { "CommandType": ["Text", "StoredProcedure", "TableDirect"] },
  "EncryptText": { "Algorithm": ["AES", "DES", "RC2", "Rijndael", "TripleDES"] },
  "DecryptText": { "Algorithm": ["AES", "DES", "RC2", "Rijndael", "TripleDES"] },
  "HashText": { "Algorithm": ["SHA256", "SHA384", "SHA512", "MD5", "RIPEMD160", "SHA1"] },
  "HashFile": { "Algorithm": ["SHA256", "SHA384", "SHA512", "MD5", "RIPEMD160", "SHA1"] },
  "EncryptFile": { "Algorithm": ["AES", "DES", "RC2", "Rijndael", "TripleDES"] },
  "DecryptFile": { "Algorithm": ["AES", "DES", "RC2", "Rijndael", "TripleDES"] },
  "SetTransactionStatus": { "Status": ["Successful", "Failed", "Abandoned"] },
  "PathExists": { "PathType": ["File", "Directory", "Any"] },
  "FilterDataTable": { "FilterRowsMode": ["Keep", "Remove"] },
  "SortDataTable": { "SortDirection": ["Ascending", "Descending"] },
  "JoinDataTables": { "JoinType": ["Inner", "Left", "Full"] },
  "VerifyExpression": { "ComparisonType": ["Equal", "NotEqual", "GreaterThan", "LessThan", "GreaterThanOrEqual", "LessThanOrEqual", "Contains", "NotContains"] },
};

const ADDITIONAL_DEFAULTS_DATA: Record<string, Record<string, string>> = {
  "LogMessage": { "Level": "Info" },
  "Click": { "ClickType": "Single", "MouseButton": "Left" },
  "TypeInto": { "DelayBetweenKeys": "10" },
  "RetryScope": { "NumberOfRetries": "3" },
  "GetTransactionItem": { "QueueName": "" },
  "HttpClient": { "Method": "GET", "AcceptFormat": "JSON" },
  "HttpClientRequest": { "Method": "GET", "AcceptFormat": "JSON" },
  "ReadTextFile": { "Encoding": "UTF-8" },
  "WriteTextFile": { "Encoding": "UTF-8" },
};

const TOP30_XAML_EXAMPLES: Record<string, string> = {
  "Assign": `<Assign DisplayName="Set variable">
  <Assign.To><OutArgument x:TypeArguments="x:String">[myVar]</OutArgument></Assign.To>
  <Assign.Value><InArgument x:TypeArguments="x:String">Hello</InArgument></Assign.Value>
</Assign>`,
  "If": `<If Condition="[myVar = &quot;Hello&quot;]" DisplayName="Check value">
  <If.Then><Sequence><ui:LogMessage Message="Match" Level="Info" /></Sequence></If.Then>
  <If.Else><Sequence><ui:LogMessage Message="No match" Level="Warn" /></Sequence></If.Else>
</If>`,
  "Sequence": `<Sequence DisplayName="Main Sequence">
  <Sequence.Variables><Variable x:TypeArguments="x:String" Name="result" /></Sequence.Variables>
  <!-- child activities here -->
</Sequence>`,
  "ForEach": `<ForEach x:TypeArguments="x:String" Values="[itemList]" DisplayName="Process each item">
  <ForEach.Body><ActivityAction x:TypeArguments="x:String">
    <ActivityAction.Argument><DelegateInArgument x:TypeArguments="x:String" Name="item" /></ActivityAction.Argument>
    <Sequence><ui:LogMessage Message="[item]" Level="Info" /></Sequence>
  </ActivityAction></ForEach.Body>
</ForEach>`,
  "While": `<While Condition="[counter &lt; 10]" DisplayName="Loop while counter less than 10">
  <Sequence><!-- loop body --></Sequence>
</While>`,
  "TryCatch": `<TryCatch DisplayName="Error handler">
  <TryCatch.Try><Sequence><!-- protected activities --></Sequence></TryCatch.Try>
  <TryCatch.Catches>
    <Catch x:TypeArguments="s:Exception">
      <ActivityAction x:TypeArguments="s:Exception">
        <ActivityAction.Argument><DelegateInArgument x:TypeArguments="s:Exception" Name="exception" /></ActivityAction.Argument>
        <Sequence><ui:LogMessage Message="[exception.Message]" Level="Error" /></Sequence>
      </ActivityAction>
    </Catch>
  </TryCatch.Catches>
</TryCatch>`,
  "LogMessage": `<ui:LogMessage Message="Processing started" Level="Info" DisplayName="Log start" />`,
  "Flowchart": `<Flowchart DisplayName="Decision flow">
  <Flowchart.StartNode>
    <FlowStep x:Name="step1">
      <ui:LogMessage Message="Step 1" Level="Info" />
      <FlowStep.Next><FlowStep x:Name="step2"><!-- next step --></FlowStep></FlowStep.Next>
    </FlowStep>
  </Flowchart.StartNode>
</Flowchart>`,
  "Switch": `<Switch x:TypeArguments="x:String" Expression="[status]" DisplayName="Route by status">
  <Switch.Default><Sequence><ui:LogMessage Message="Unknown status" Level="Warn" /></Sequence></Switch.Default>
</Switch>`,
  "Throw": `<Throw DisplayName="Throw error">
  <Throw.Exception><InArgument x:TypeArguments="s:Exception">[New System.Exception("Error message")]</InArgument></Throw.Exception>
</Throw>`,
  "Delay": `<Delay Duration="[TimeSpan.FromSeconds(5)]" DisplayName="Wait 5 seconds" />`,
  "InvokeWorkflowFile": `<ui:InvokeWorkflowFile WorkflowFileName="SubProcess.xaml" DisplayName="Run sub-process" />`,
  "ReadTextFile": `<ui:ReadTextFile FileName="input.txt" Encoding="UTF-8" DisplayName="Read file">
  <ui:ReadTextFile.Content><OutArgument x:TypeArguments="x:String">[fileContent]</OutArgument></ui:ReadTextFile.Content>
</ui:ReadTextFile>`,
  "WriteTextFile": `<ui:WriteTextFile FileName="output.txt" Text="[result]" Encoding="UTF-8" DisplayName="Write file" />`,
  "Click": `<ui:Click DisplayName="Click button">
  <ui:Click.Target><ui:Target /><ui:Click.Selector>&lt;html /&gt;&lt;webctrl tag='BUTTON' /&gt;</ui:Click.Selector></ui:Click.Target>
</ui:Click>`,
  "TypeInto": `<ui:TypeInto Text="[inputText]" DisplayName="Type into field">
  <ui:TypeInto.Target><ui:Target /><ui:TypeInto.Selector>&lt;html /&gt;&lt;webctrl tag='INPUT' /&gt;</ui:TypeInto.Selector></ui:TypeInto.Target>
</ui:TypeInto>`,
  "GetText": `<ui:GetText DisplayName="Get element text">
  <ui:GetText.Value><OutArgument x:TypeArguments="x:String">[extractedText]</OutArgument></ui:GetText.Value>
</ui:GetText>`,
  "UseBrowser": `<ui:UseBrowser Url="https://example.com" BrowserType="Chrome" DisplayName="Browser scope">
  <ui:UseBrowser.Body><ActivityAction x:TypeArguments="x:Object">
    <Sequence><!-- browser activities --></Sequence>
  </ActivityAction></ui:UseBrowser.Body>
</ui:UseBrowser>`,
  "NavigateTo": `<ui:NavigateTo Url="[targetUrl]" DisplayName="Navigate to URL" />`,
  "HttpClient": `<uweb:HttpClient EndPoint="[apiUrl]" Method="GET" AcceptFormat="JSON" DisplayName="API call">
  <uweb:HttpClient.Result><OutArgument x:TypeArguments="x:String">[response]</OutArgument></uweb:HttpClient.Result>
</uweb:HttpClient>`,
  "DeserializeJson": `<uweb:DeserializeJson JsonString="[jsonText]" DisplayName="Parse JSON">
  <uweb:DeserializeJson.JsonObject><OutArgument x:TypeArguments="x:Object">[jsonObj]</OutArgument></uweb:DeserializeJson.JsonObject>
</uweb:DeserializeJson>`,
  "SerializeJson": `<uweb:SerializeJson JsonObject="[dataObj]" DisplayName="Convert to JSON">
  <uweb:SerializeJson.JsonString><OutArgument x:TypeArguments="x:String">[jsonOutput]</OutArgument></uweb:SerializeJson.JsonString>
</uweb:SerializeJson>`,
  "RetryScope": `<ui:RetryScope NumberOfRetries="3" DisplayName="Retry on failure">
  <ui:RetryScope.Body><ActivityAction>
    <Sequence><!-- retryable activities --></Sequence>
  </ActivityAction></ui:RetryScope.Body>
</ui:RetryScope>`,
  "AddQueueItem": `<ui:AddQueueItem QueueName="MyQueue" DisplayName="Add to queue" />`,
  "GetTransactionItem": `<ui:GetTransactionItem QueueName="MyQueue" DisplayName="Get transaction">
  <ui:GetTransactionItem.TransactionItem><OutArgument x:TypeArguments="x:Object">[transactionItem]</OutArgument></ui:GetTransactionItem.TransactionItem>
</ui:GetTransactionItem>`,
  "SetTransactionStatus": `<ui:SetTransactionStatus Status="Successful" DisplayName="Mark success" />`,
  "BuildDataTable": `<ucs:BuildDataTable DisplayName="Build DataTable">
  <ucs:BuildDataTable.DataTable><OutArgument x:TypeArguments="scg:DataTable">[dt]</OutArgument></ucs:BuildDataTable.DataTable>
</ucs:BuildDataTable>`,
  "FilterDataTable": `<ucs:FilterDataTable DisplayName="Filter rows" FilterRowsMode="Keep">
  <ucs:FilterDataTable.DataTable><InArgument x:TypeArguments="scg:DataTable">[dt]</InArgument></ucs:FilterDataTable.DataTable>
</ucs:FilterDataTable>`,
  "OutputDataTable": `<ucs:OutputDataTable InputDataTable="[dt]" DisplayName="DataTable to string">
  <ucs:OutputDataTable.Text><OutArgument x:TypeArguments="x:String">[dtText]</OutArgument></ucs:OutputDataTable.Text>
</ucs:OutputDataTable>`,
  "SendOutlookMailMessage": `<umail:SendOutlookMailMessage To="[recipient]" Subject="[subject]" Body="[body]" DisplayName="Send email" />`,
};

export function enrichCatalog(catalogPath?: string): { catalog: ActivityCatalog; report: EnrichmentReportEntry[] } {
  const path = catalogPath || join(process.cwd(), "catalog", "activity-catalog.json");
  const raw = readFileSync(path, "utf-8");
  const catalog: ActivityCatalog = JSON.parse(raw);
  const report: EnrichmentReportEntry[] = [];

  const packagePrefixMap: Record<string, string> = {};
  for (const [pkgId, info] of Object.entries(PACKAGE_NAMESPACE_MAP)) {
    packagePrefixMap[pkgId] = info.prefix;
  }

  for (const pkg of catalog.packages) {
    const pkgNamespaces = NAMESPACE_MAP[pkg.packageId] || {};
    const pkgPrefix = packagePrefixMap[pkg.packageId] || pkg.prefix || "";
    const defaultNs = pkg.clrNamespace || pkg.packageId;

    for (const activity of pkg.activities) {
      if (!activity.namespace) {
        const ns = pkgNamespaces[activity.className] || defaultNs;
        activity.namespace = ns;
        report.push({
          packageId: pkg.packageId,
          className: activity.className,
          field: "namespace",
          value: ns,
          provenance: "curated",
        });
      }

      const canonicalData = CANONICAL_IDENTITY_DATA[activity.className];
      if (canonicalData) {
        const isCanonical = canonicalData.canonicalPackageId === pkg.packageId;
        const alternateId = isCanonical ? canonicalData.alternatePackageId : canonicalData.canonicalPackageId;
        const altPrefix = packagePrefixMap[alternateId] || "";
        const altNs = (NAMESPACE_MAP[alternateId] || {})[activity.className] || alternateId;

        const canonPkgId = isCanonical ? pkg.packageId : alternateId;
        const canonPrefix = isCanonical ? pkgPrefix : altPrefix;
        const canonNs = isCanonical ? (activity.namespace || defaultNs) : altNs;

        activity.canonicalIdentity = {
          canonicalPackageId: canonPkgId,
          canonicalPrefix: canonPrefix,
          canonicalNamespace: canonNs,
          alternates: [{
            packageId: alternateId,
            prefix: altPrefix,
            namespace: altNs,
          }],
        };
        report.push({
          packageId: pkg.packageId,
          className: activity.className,
          field: "canonicalIdentity",
          value: { canonicalPackageId: canonPkgId, canonicalPrefix: canonPrefix, canonicalNamespace: canonNs } as Record<string, unknown>,
          provenance: "curated",
        });
      }

      const deprecation = DEPRECATION_DATA[activity.className];
      if (deprecation) {
        if (deprecation.isDeprecated) {
          activity.isDeprecated = true;
          report.push({
            packageId: pkg.packageId,
            className: activity.className,
            field: "isDeprecated",
            value: true,
            provenance: deprecation.provenance,
          });
        }
        if (deprecation.preferModern) {
          activity.preferModern = deprecation.preferModern;
          report.push({
            packageId: pkg.packageId,
            className: activity.className,
            field: "preferModern",
            value: deprecation.preferModern,
            provenance: deprecation.provenance,
          });
        }
      }

      const compositionRules = COMPOSITION_RULES_DATA[activity.className];
      if (compositionRules) {
        activity.compositionRules = compositionRules;
        report.push({
          packageId: pkg.packageId,
          className: activity.className,
          field: "compositionRules",
          value: compositionRules.map(r => ({ rule: r.rule, provenance: r.provenance }) as Record<string, unknown>),
          provenance: "curated",
        });
      }

      const propertyConflicts = PROPERTY_CONFLICTS_DATA[activity.className];
      if (propertyConflicts) {
        activity.propertyConflicts = propertyConflicts;
        report.push({
          packageId: pkg.packageId,
          className: activity.className,
          field: "propertyConflicts",
          value: propertyConflicts.map(c => ({ property: c.property, conflictsWith: c.conflictsWith.join(","), reason: c.reason }) as Record<string, unknown>),
          provenance: "curated",
        });
      }

      const xamlExample = TOP30_XAML_EXAMPLES[activity.className];
      if (xamlExample) {
        activity.xamlExample = xamlExample;
        report.push({
          packageId: pkg.packageId,
          className: activity.className,
          field: "xamlExample",
          value: "(XAML snippet stored)",
          provenance: "curated",
        });
      }

      const additionalEnums = ADDITIONAL_ENUM_DATA[activity.className];
      if (additionalEnums) {
        for (const [propName, enumValues] of Object.entries(additionalEnums)) {
          const prop = activity.properties.find(p => p.name === propName);
          if (prop && (!prop.validValues || prop.validValues.length === 0)) {
            prop.validValues = enumValues;
            report.push({
              packageId: pkg.packageId,
              className: activity.className,
              field: `properties.${propName}.validValues`,
              value: enumValues,
              provenance: "curated",
            });
          }
        }
      }

      const additionalDefaults = ADDITIONAL_DEFAULTS_DATA[activity.className];
      if (additionalDefaults) {
        for (const [propName, defaultVal] of Object.entries(additionalDefaults)) {
          const prop = activity.properties.find(p => p.name === propName);
          if (prop && prop.default === undefined) {
            prop.default = defaultVal;
            report.push({
              packageId: pkg.packageId,
              className: activity.className,
              field: `properties.${propName}.default`,
              value: defaultVal,
              provenance: "curated",
            });
          }
        }
      }
    }
  }

  return { catalog, report };
}

export function runEnrichment(): void {
  const catalogPath = join(process.cwd(), "catalog", "activity-catalog.json");
  const { catalog, report } = enrichCatalog(catalogPath);

  const now = new Date().toISOString();
  catalog.generatedAt = now;
  catalog.lastVerifiedAt = now;

  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf-8");
  console.log(`[Enrichment] Updated catalog: ${catalog.packages.length} packages`);

  const reportPath = join(process.cwd(), "catalog", "catalog-enrichment-report.json");
  const reportOutput = {
    generatedAt: now,
    totalEnrichments: report.length,
    byProvenance: {
      authoritative: report.filter(r => r.provenance === "authoritative").length,
      curated: report.filter(r => r.provenance === "curated").length,
    },
    byField: {} as Record<string, number>,
    entries: report,
  };

  for (const entry of report) {
    const fieldKey = entry.field.includes(".") ? entry.field.split(".").slice(0, -1).join(".") + ".*" : entry.field;
    reportOutput.byField[fieldKey] = (reportOutput.byField[fieldKey] || 0) + 1;
  }

  writeFileSync(reportPath, JSON.stringify(reportOutput, null, 2), "utf-8");
  console.log(`[Enrichment] Report: ${report.length} enrichments (${reportOutput.byProvenance.authoritative} authoritative, ${reportOutput.byProvenance.curated} curated)`);
  console.log(`[Enrichment] Report written to ${reportPath}`);
}

if (process.argv[1]?.endsWith("catalog-enrichment.ts") || process.argv[1]?.endsWith("catalog-enrichment.js")) {
  runEnrichment();
}
