import { escapeXml, escapeXmlTextContent } from "../lib/xml-utils";
import { ACTIVITY_NAME_ALIAS_MAP, getActivityPackageFromRegistry } from "../uipath-activity-registry";
import { catalogService } from "../catalog/catalog-service";
import { XMLValidator } from "fast-xml-parser";
import { QualityGateError } from "../uipath-shared";
import { findUndeclaredVariables } from "./vbnet-expression-linter";
import { inferTypeFromPrefix } from "../shared/type-inference";
import { getFilteredSchema, registerStage } from "../catalog/filtered-schema-lookup";

registerStage("xaml-compliance");

let _complianceTargetFramework: "Windows" | "Portable" | undefined;

export type TargetFramework = "Windows" | "Portable";

export const XAML_INFRASTRUCTURE_TYPE_ARGUMENTS = new Set([
  "AssemblyReference",
]);


export interface PackageNamespaceInfo {
  prefix: string;
  xmlns: string;
  assembly: string;
  clrNamespace: string;
}

export const PACKAGE_NAMESPACE_MAP: Record<string, PackageNamespaceInfo> = {
  "UiPath.UIAutomation.Activities": { prefix: "ui", xmlns: "http://schemas.uipath.com/workflow/activities", clrNamespace: "UiPath.Core.Activities", assembly: "UiPath.UIAutomation.Activities" },
  "UiPath.System.Activities": { prefix: "ui", xmlns: "http://schemas.uipath.com/workflow/activities", clrNamespace: "UiPath.Core.Activities", assembly: "UiPath.System.Activities" },
  "UiPath.WebAPI.Activities": { prefix: "uweb", xmlns: "clr-namespace:UiPath.WebAPI.Activities;assembly=UiPath.WebAPI.Activities", clrNamespace: "UiPath.WebAPI.Activities", assembly: "UiPath.WebAPI.Activities" },
  "UiPath.DataService.Activities": { prefix: "uds", xmlns: "clr-namespace:UiPath.DataService.Activities;assembly=UiPath.DataService.Activities", clrNamespace: "UiPath.DataService.Activities", assembly: "UiPath.DataService.Activities" },
  "UiPath.Persistence.Activities": { prefix: "upers", xmlns: "clr-namespace:UiPath.Persistence.Activities;assembly=UiPath.Persistence.Activities", clrNamespace: "UiPath.Persistence.Activities", assembly: "UiPath.Persistence.Activities" },
  "UiPath.Excel.Activities": { prefix: "uexcel", xmlns: "clr-namespace:UiPath.Excel.Activities;assembly=UiPath.Excel.Activities", clrNamespace: "UiPath.Excel.Activities", assembly: "UiPath.Excel.Activities" },
  "UiPath.Mail.Activities": { prefix: "umail", xmlns: "clr-namespace:UiPath.Mail.Activities;assembly=UiPath.Mail.Activities", clrNamespace: "UiPath.Mail.Activities", assembly: "UiPath.Mail.Activities" },
  "UiPath.Database.Activities": { prefix: "udb", xmlns: "clr-namespace:UiPath.Database.Activities;assembly=UiPath.Database.Activities", clrNamespace: "UiPath.Database.Activities", assembly: "UiPath.Database.Activities" },
  "UiPath.MLActivities": { prefix: "uml", xmlns: "clr-namespace:UiPath.MLActivities;assembly=UiPath.MLActivities", clrNamespace: "UiPath.MLActivities", assembly: "UiPath.MLActivities" },
  "UiPath.IntelligentOCR.Activities": { prefix: "uocr", xmlns: "clr-namespace:UiPath.IntelligentOCR.Activities;assembly=UiPath.IntelligentOCR.Activities", clrNamespace: "UiPath.IntelligentOCR.Activities", assembly: "UiPath.IntelligentOCR.Activities" },
  "System.Activities": { prefix: "", xmlns: "http://schemas.microsoft.com/netfx/2009/xaml/activities", clrNamespace: "System.Activities", assembly: "System.Activities" },
  "UiPath.PDF.Activities": { prefix: "updf", xmlns: "clr-namespace:UiPath.PDF.Activities;assembly=UiPath.PDF.Activities", clrNamespace: "UiPath.PDF.Activities", assembly: "UiPath.PDF.Activities" },
  "UiPath.Word.Activities": { prefix: "uword", xmlns: "clr-namespace:UiPath.Word.Activities;assembly=UiPath.Word.Activities", clrNamespace: "UiPath.Word.Activities", assembly: "UiPath.Word.Activities" },
  "UiPath.GSuite.Activities": { prefix: "ugs", xmlns: "clr-namespace:UiPath.GSuite.Activities;assembly=UiPath.GSuite.Activities", clrNamespace: "UiPath.GSuite.Activities", assembly: "UiPath.GSuite.Activities" },
  "UiPath.MicrosoftOffice365.Activities": { prefix: "uo365", xmlns: "clr-namespace:UiPath.MicrosoftOffice365.Activities;assembly=UiPath.MicrosoftOffice365.Activities", clrNamespace: "UiPath.MicrosoftOffice365.Activities", assembly: "UiPath.MicrosoftOffice365.Activities" },
  "UiPath.Testing.Activities": { prefix: "utest", xmlns: "clr-namespace:UiPath.Testing.Activities;assembly=UiPath.Testing.Activities", clrNamespace: "UiPath.Testing.Activities", assembly: "UiPath.Testing.Activities" },
  "UiPath.Form.Activities": { prefix: "uform", xmlns: "clr-namespace:UiPath.Form.Activities;assembly=UiPath.Form.Activities", clrNamespace: "UiPath.Form.Activities", assembly: "UiPath.Form.Activities" },
  "UiPath.Cryptography.Activities": { prefix: "ucrypt", xmlns: "clr-namespace:UiPath.Cryptography.Activities;assembly=UiPath.Cryptography.Activities", clrNamespace: "UiPath.Cryptography.Activities", assembly: "UiPath.Cryptography.Activities" },
  "UiPath.ComplexScenarios.Activities": { prefix: "ucs", xmlns: "clr-namespace:UiPath.ComplexScenarios.Activities;assembly=UiPath.ComplexScenarios.Activities", clrNamespace: "UiPath.ComplexScenarios.Activities", assembly: "UiPath.ComplexScenarios.Activities" },
  "UiPath.AmazonWebServices.Activities": { prefix: "uaws", xmlns: "clr-namespace:UiPath.AmazonWebServices.Activities;assembly=UiPath.AmazonWebServices.Activities", clrNamespace: "UiPath.AmazonWebServices.Activities", assembly: "UiPath.AmazonWebServices.Activities" },
  "UiPath.Amazon.Textract.Activities": { prefix: "utxt", xmlns: "clr-namespace:UiPath.Amazon.Textract.Activities;assembly=UiPath.Amazon.Textract.Activities", clrNamespace: "UiPath.Amazon.Textract.Activities", assembly: "UiPath.Amazon.Textract.Activities" },
  "UiPath.Amazon.Comprehend.Activities": { prefix: "ucmp", xmlns: "clr-namespace:UiPath.Amazon.Comprehend.Activities;assembly=UiPath.Amazon.Comprehend.Activities", clrNamespace: "UiPath.Amazon.Comprehend.Activities", assembly: "UiPath.Amazon.Comprehend.Activities" },
  "UiPath.Amazon.Rekognition.Activities": { prefix: "urek", xmlns: "clr-namespace:UiPath.Amazon.Rekognition.Activities;assembly=UiPath.Amazon.Rekognition.Activities", clrNamespace: "UiPath.Amazon.Rekognition.Activities", assembly: "UiPath.Amazon.Rekognition.Activities" },
  "UiPath.Azure.Activities": { prefix: "uaz", xmlns: "clr-namespace:UiPath.Azure.Activities;assembly=UiPath.Azure.Activities", clrNamespace: "UiPath.Azure.Activities", assembly: "UiPath.Azure.Activities" },
  "UiPath.AzureFormRecognizerV3.Activities": { prefix: "uafr", xmlns: "clr-namespace:UiPath.AzureFormRecognizerV3.Activities;assembly=UiPath.AzureFormRecognizerV3.Activities", clrNamespace: "UiPath.AzureFormRecognizerV3.Activities", assembly: "UiPath.AzureFormRecognizerV3.Activities" },
  "UiPath.GoogleCloud.Activities": { prefix: "ugc", xmlns: "clr-namespace:UiPath.GoogleCloud.Activities;assembly=UiPath.GoogleCloud.Activities", clrNamespace: "UiPath.GoogleCloud.Activities", assembly: "UiPath.GoogleCloud.Activities" },
  "UiPath.GoogleVision.Activities": { prefix: "ugv", xmlns: "clr-namespace:UiPath.GoogleVision.Activities;assembly=UiPath.GoogleVision.Activities", clrNamespace: "UiPath.GoogleVision.Activities", assembly: "UiPath.GoogleVision.Activities" },
  "UiPath.Salesforce.Activities": { prefix: "usf", xmlns: "clr-namespace:UiPath.Salesforce.Activities;assembly=UiPath.Salesforce.Activities", clrNamespace: "UiPath.Salesforce.Activities", assembly: "UiPath.Salesforce.Activities" },
  "UiPath.ServiceNow.Activities": { prefix: "usnow", xmlns: "clr-namespace:UiPath.ServiceNow.Activities;assembly=UiPath.ServiceNow.Activities", clrNamespace: "UiPath.ServiceNow.Activities", assembly: "UiPath.ServiceNow.Activities" },
  "UiPath.Slack.Activities": { prefix: "uslack", xmlns: "clr-namespace:UiPath.Slack.Activities;assembly=UiPath.Slack.Activities", clrNamespace: "UiPath.Slack.Activities", assembly: "UiPath.Slack.Activities" },
  "UiPath.Jira.Activities": { prefix: "ujira", xmlns: "clr-namespace:UiPath.Jira.Activities;assembly=UiPath.Jira.Activities", clrNamespace: "UiPath.Jira.Activities", assembly: "UiPath.Jira.Activities" },
  "UiPath.MicrosoftTeams.Activities": { prefix: "uteams", xmlns: "clr-namespace:UiPath.MicrosoftTeams.Activities;assembly=UiPath.MicrosoftTeams.Activities", clrNamespace: "UiPath.MicrosoftTeams.Activities", assembly: "UiPath.MicrosoftTeams.Activities" },
  "UiPath.FTP.Activities": { prefix: "uftp", xmlns: "clr-namespace:UiPath.FTP.Activities;assembly=UiPath.FTP.Activities", clrNamespace: "UiPath.FTP.Activities", assembly: "UiPath.FTP.Activities" },
  "UiPath.Presentations.Activities": { prefix: "upres", xmlns: "clr-namespace:UiPath.Presentations.Activities;assembly=UiPath.Presentations.Activities", clrNamespace: "UiPath.Presentations.Activities", assembly: "UiPath.Presentations.Activities" },
  "UiPath.Credentials.Activities": { prefix: "ucred", xmlns: "clr-namespace:UiPath.Credentials.Activities;assembly=UiPath.Credentials.Activities", clrNamespace: "UiPath.Credentials.Activities", assembly: "UiPath.Credentials.Activities" },
  "UiPath.DocumentUnderstanding.Activities": { prefix: "udu", xmlns: "clr-namespace:UiPath.DocumentUnderstanding.Activities;assembly=UiPath.DocumentUnderstanding.Activities", clrNamespace: "UiPath.DocumentUnderstanding.Activities", assembly: "UiPath.DocumentUnderstanding.Activities" },
  "UiPath.IntegrationService.Activities": { prefix: "uis", xmlns: "clr-namespace:UiPath.IntegrationService.Activities;assembly=UiPath.IntegrationService.Activities", clrNamespace: "UiPath.IntegrationService.Activities", assembly: "UiPath.IntegrationService.Activities" },
  "UiPath.CommunicationsMining.Activities": { prefix: "ucm", xmlns: "clr-namespace:UiPath.CommunicationsMining.Activities;assembly=UiPath.CommunicationsMining.Activities", clrNamespace: "UiPath.CommunicationsMining.Activities", assembly: "UiPath.CommunicationsMining.Activities" },
  "UiPath.WorkflowEvents.Activities": { prefix: "uwfe", xmlns: "clr-namespace:UiPath.WorkflowEvents.Activities;assembly=UiPath.WorkflowEvents.Activities", clrNamespace: "UiPath.WorkflowEvents.Activities", assembly: "UiPath.WorkflowEvents.Activities" },
  "System.Net.Mail": { prefix: "snetmail", xmlns: "clr-namespace:System.Net.Mail;assembly=System", clrNamespace: "System.Net.Mail", assembly: "System" },
  "UiPath.Box.Activities": { prefix: "ubox", xmlns: "clr-namespace:UiPath.Box.Activities;assembly=UiPath.Box.Activities", clrNamespace: "UiPath.Box.Activities", assembly: "UiPath.Box.Activities" },
  "UiPath.MicrosoftDynamics.Activities": { prefix: "udyn", xmlns: "clr-namespace:UiPath.MicrosoftDynamics.Activities;assembly=UiPath.MicrosoftDynamics.Activities", clrNamespace: "UiPath.MicrosoftDynamics.Activities", assembly: "UiPath.MicrosoftDynamics.Activities" },
  "UiPath.Workday.Activities": { prefix: "uwd", xmlns: "clr-namespace:UiPath.Workday.Activities;assembly=UiPath.Workday.Activities", clrNamespace: "UiPath.Workday.Activities", assembly: "UiPath.Workday.Activities" },
  "UiPath.Coupa.IntegrationService.Activities": { prefix: "ucoupa", xmlns: "clr-namespace:UiPath.Coupa.IntegrationService.Activities;assembly=UiPath.Coupa.IntegrationService.Activities", clrNamespace: "UiPath.Coupa.IntegrationService.Activities", assembly: "UiPath.Coupa.IntegrationService.Activities" },
  "UiPath.Act365.IntegrationService.Activities": { prefix: "uact365", xmlns: "clr-namespace:UiPath.Act365.IntegrationService.Activities;assembly=UiPath.Act365.IntegrationService.Activities", clrNamespace: "UiPath.Act365.IntegrationService.Activities", assembly: "UiPath.Act365.IntegrationService.Activities" },
  "UiPath.ActiveDirectoryDomainServices.Activities": { prefix: "uadds", xmlns: "clr-namespace:UiPath.ActiveDirectoryDomainServices.Activities;assembly=UiPath.ActiveDirectoryDomainServices.Activities", clrNamespace: "UiPath.ActiveDirectoryDomainServices.Activities", assembly: "UiPath.ActiveDirectoryDomainServices.Activities" },
  "UiPath.Adobe.AdobeSign.Activities": { prefix: "uadosign", xmlns: "clr-namespace:UiPath.Adobe.AdobeSign.Activities;assembly=UiPath.Adobe.AdobeSign.Activities", clrNamespace: "UiPath.Adobe.AdobeSign.Activities", assembly: "UiPath.Adobe.AdobeSign.Activities" },
  "UiPath.AdobePdfServices.IntegrationService.Activities": { prefix: "uadobepdf", xmlns: "clr-namespace:UiPath.AdobePdfServices.IntegrationService.Activities;assembly=UiPath.AdobePdfServices.IntegrationService.Activities", clrNamespace: "UiPath.AdobePdfServices.IntegrationService.Activities", assembly: "UiPath.AdobePdfServices.IntegrationService.Activities" },
  "UiPath.Alteryx.Activities": { prefix: "ualteryx", xmlns: "clr-namespace:UiPath.Alteryx.Activities;assembly=UiPath.Alteryx.Activities", clrNamespace: "UiPath.Alteryx.Activities", assembly: "UiPath.Alteryx.Activities" },
  "UiPath.Amazon.Scope.Activities": { prefix: "uamzscope", xmlns: "clr-namespace:UiPath.Amazon.Scope.Activities;assembly=UiPath.Amazon.Scope.Activities", clrNamespace: "UiPath.Amazon.Scope.Activities", assembly: "UiPath.Amazon.Scope.Activities" },
  "UiPath.AmazonConnect.Activities": { prefix: "uamzconn", xmlns: "clr-namespace:UiPath.AmazonConnect.Activities;assembly=UiPath.AmazonConnect.Activities", clrNamespace: "UiPath.AmazonConnect.Activities", assembly: "UiPath.AmazonConnect.Activities" },
  "UiPath.AmazonWorkSpaces.Activities": { prefix: "uamzws", xmlns: "clr-namespace:UiPath.AmazonWorkSpaces.Activities;assembly=UiPath.AmazonWorkSpaces.Activities", clrNamespace: "UiPath.AmazonWorkSpaces.Activities", assembly: "UiPath.AmazonWorkSpaces.Activities" },
  "UiPath.AppleMail.Activities": { prefix: "uaplemail", xmlns: "clr-namespace:UiPath.AppleMail.Activities;assembly=UiPath.AppleMail.Activities", clrNamespace: "UiPath.AppleMail.Activities", assembly: "UiPath.AppleMail.Activities" },
  "UiPath.AppleNumbers.Activities": { prefix: "uaplnum", xmlns: "clr-namespace:UiPath.AppleNumbers.Activities;assembly=UiPath.AppleNumbers.Activities", clrNamespace: "UiPath.AppleNumbers.Activities", assembly: "UiPath.AppleNumbers.Activities" },
  "UiPath.AppleScripting.Activities": { prefix: "uaplscript", xmlns: "clr-namespace:UiPath.AppleScripting.Activities;assembly=UiPath.AppleScripting.Activities", clrNamespace: "UiPath.AppleScripting.Activities", assembly: "UiPath.AppleScripting.Activities" },
  "UiPath.AzureActiveDirectory.Activities": { prefix: "uazad", xmlns: "clr-namespace:UiPath.AzureActiveDirectory.Activities;assembly=UiPath.AzureActiveDirectory.Activities", clrNamespace: "UiPath.AzureActiveDirectory.Activities", assembly: "UiPath.AzureActiveDirectory.Activities" },
  "UiPath.AzureWindowsVirtualDesktop.Activities": { prefix: "uazwvd", xmlns: "clr-namespace:UiPath.AzureWindowsVirtualDesktop.Activities;assembly=UiPath.AzureWindowsVirtualDesktop.Activities", clrNamespace: "UiPath.AzureWindowsVirtualDesktop.Activities", assembly: "UiPath.AzureWindowsVirtualDesktop.Activities" },
  "UiPath.BambooHR.IntegrationService.Activities": { prefix: "ubamboo", xmlns: "clr-namespace:UiPath.BambooHR.IntegrationService.Activities;assembly=UiPath.BambooHR.IntegrationService.Activities", clrNamespace: "UiPath.BambooHR.IntegrationService.Activities", assembly: "UiPath.BambooHR.IntegrationService.Activities" },
  "UiPath.Box.IntegrationService.Activities": { prefix: "uboxis", xmlns: "clr-namespace:UiPath.Box.IntegrationService.Activities;assembly=UiPath.Box.IntegrationService.Activities", clrNamespace: "UiPath.Box.IntegrationService.Activities", assembly: "UiPath.Box.IntegrationService.Activities" },
  "UiPath.Callout.Activities": { prefix: "ucallout", xmlns: "clr-namespace:UiPath.Callout.Activities;assembly=UiPath.Callout.Activities", clrNamespace: "UiPath.Callout.Activities", assembly: "UiPath.Callout.Activities" },
  "UiPath.CampaignMonitor.IntegrationService.Activities": { prefix: "ucampmon", xmlns: "clr-namespace:UiPath.CampaignMonitor.IntegrationService.Activities;assembly=UiPath.CampaignMonitor.IntegrationService.Activities", clrNamespace: "UiPath.CampaignMonitor.IntegrationService.Activities", assembly: "UiPath.CampaignMonitor.IntegrationService.Activities" },
  "UiPath.CiscoWebexTeams.IntegrationService.Activities": { prefix: "uwebex", xmlns: "clr-namespace:UiPath.CiscoWebexTeams.IntegrationService.Activities;assembly=UiPath.CiscoWebexTeams.IntegrationService.Activities", clrNamespace: "UiPath.CiscoWebexTeams.IntegrationService.Activities", assembly: "UiPath.CiscoWebexTeams.IntegrationService.Activities" },
  "UiPath.Citrix.Activities": { prefix: "ucitrix", xmlns: "clr-namespace:UiPath.Citrix.Activities;assembly=UiPath.Citrix.Activities", clrNamespace: "UiPath.Citrix.Activities", assembly: "UiPath.Citrix.Activities" },
  "UiPath.Cognitive.Activities": { prefix: "ucognitive", xmlns: "clr-namespace:UiPath.Cognitive.Activities;assembly=UiPath.Cognitive.Activities", clrNamespace: "UiPath.Cognitive.Activities", assembly: "UiPath.Cognitive.Activities" },
  "UiPath.ConfluenceCloud.IntegrationService.Activities": { prefix: "uconfluence", xmlns: "clr-namespace:UiPath.ConfluenceCloud.IntegrationService.Activities;assembly=UiPath.ConfluenceCloud.IntegrationService.Activities", clrNamespace: "UiPath.ConfluenceCloud.IntegrationService.Activities", assembly: "UiPath.ConfluenceCloud.IntegrationService.Activities" },
  "UiPath.DocuSign.Activities": { prefix: "udocusign", xmlns: "clr-namespace:UiPath.DocuSign.Activities;assembly=UiPath.DocuSign.Activities", clrNamespace: "UiPath.DocuSign.Activities", assembly: "UiPath.DocuSign.Activities" },
  "UiPath.Docusign.IntegrationService.Activities": { prefix: "udocuis", xmlns: "clr-namespace:UiPath.Docusign.IntegrationService.Activities;assembly=UiPath.Docusign.IntegrationService.Activities", clrNamespace: "UiPath.Docusign.IntegrationService.Activities", assembly: "UiPath.Docusign.IntegrationService.Activities" },
  "UiPath.DocumentUnderstanding.ML.Activities": { prefix: "uduml", xmlns: "clr-namespace:UiPath.DocumentUnderstanding.ML.Activities;assembly=UiPath.DocumentUnderstanding.ML.Activities", clrNamespace: "UiPath.DocumentUnderstanding.ML.Activities", assembly: "UiPath.DocumentUnderstanding.ML.Activities" },
  "UiPath.Dropbox.IntegrationService.Activities": { prefix: "udropbox", xmlns: "clr-namespace:UiPath.Dropbox.IntegrationService.Activities;assembly=UiPath.Dropbox.IntegrationService.Activities", clrNamespace: "UiPath.Dropbox.IntegrationService.Activities", assembly: "UiPath.Dropbox.IntegrationService.Activities" },
  "UiPath.DropboxBusiness.IntegrationService.Activities": { prefix: "udropbiz", xmlns: "clr-namespace:UiPath.DropboxBusiness.IntegrationService.Activities;assembly=UiPath.DropboxBusiness.IntegrationService.Activities", clrNamespace: "UiPath.DropboxBusiness.IntegrationService.Activities", assembly: "UiPath.DropboxBusiness.IntegrationService.Activities" },
  "UiPath.ExchangeServer.Activities": { prefix: "uexchange", xmlns: "clr-namespace:UiPath.ExchangeServer.Activities;assembly=UiPath.ExchangeServer.Activities", clrNamespace: "UiPath.ExchangeServer.Activities", assembly: "UiPath.ExchangeServer.Activities" },
  "UiPath.Expensify.IntegrationService.Activities": { prefix: "uexpensify", xmlns: "clr-namespace:UiPath.Expensify.IntegrationService.Activities;assembly=UiPath.Expensify.IntegrationService.Activities", clrNamespace: "UiPath.Expensify.IntegrationService.Activities", assembly: "UiPath.Expensify.IntegrationService.Activities" },
  "UiPath.Freshservice.IntegrationService.Activities": { prefix: "ufreshsvc", xmlns: "clr-namespace:UiPath.Freshservice.IntegrationService.Activities;assembly=UiPath.Freshservice.IntegrationService.Activities", clrNamespace: "UiPath.Freshservice.IntegrationService.Activities", assembly: "UiPath.Freshservice.IntegrationService.Activities" },
  "UiPath.GitHub.IntegrationService.Activities": { prefix: "ugithub", xmlns: "clr-namespace:UiPath.GitHub.IntegrationService.Activities;assembly=UiPath.GitHub.IntegrationService.Activities", clrNamespace: "UiPath.GitHub.IntegrationService.Activities", assembly: "UiPath.GitHub.IntegrationService.Activities" },
  "UiPath.GoogleVertex.IntegrationService.Activities": { prefix: "uvertex", xmlns: "clr-namespace:UiPath.GoogleVertex.IntegrationService.Activities;assembly=UiPath.GoogleVertex.IntegrationService.Activities", clrNamespace: "UiPath.GoogleVertex.IntegrationService.Activities", assembly: "UiPath.GoogleVertex.IntegrationService.Activities" },
  "UiPath.GoToWebinar.IntegrationService.Activities": { prefix: "ugotoweb", xmlns: "clr-namespace:UiPath.GoToWebinar.IntegrationService.Activities;assembly=UiPath.GoToWebinar.IntegrationService.Activities", clrNamespace: "UiPath.GoToWebinar.IntegrationService.Activities", assembly: "UiPath.GoToWebinar.IntegrationService.Activities" },
  "UiPath.HyperV.Activities": { prefix: "uhyperv", xmlns: "clr-namespace:UiPath.HyperV.Activities;assembly=UiPath.HyperV.Activities", clrNamespace: "UiPath.HyperV.Activities", assembly: "UiPath.HyperV.Activities" },
  "UiPath.Java.Activities": { prefix: "ujava", xmlns: "clr-namespace:UiPath.Java.Activities;assembly=UiPath.Java.Activities", clrNamespace: "UiPath.Java.Activities", assembly: "UiPath.Java.Activities" },
  "UiPath.Jira.IntegrationService.Activities": { prefix: "ujirais", xmlns: "clr-namespace:UiPath.Jira.IntegrationService.Activities;assembly=UiPath.Jira.IntegrationService.Activities", clrNamespace: "UiPath.Jira.IntegrationService.Activities", assembly: "UiPath.Jira.IntegrationService.Activities" },
  "UiPath.Mailchimp.IntegrationService.Activities": { prefix: "umailchimp", xmlns: "clr-namespace:UiPath.Mailchimp.IntegrationService.Activities;assembly=UiPath.Mailchimp.IntegrationService.Activities", clrNamespace: "UiPath.Mailchimp.IntegrationService.Activities", assembly: "UiPath.Mailchimp.IntegrationService.Activities" },
  "UiPath.Marketo.Activities": { prefix: "umarketo", xmlns: "clr-namespace:UiPath.Marketo.Activities;assembly=UiPath.Marketo.Activities", clrNamespace: "UiPath.Marketo.Activities", assembly: "UiPath.Marketo.Activities" },
  "UiPath.Marketo.IntegrationService.Activities": { prefix: "umarketois", xmlns: "clr-namespace:UiPath.Marketo.IntegrationService.Activities;assembly=UiPath.Marketo.IntegrationService.Activities", clrNamespace: "UiPath.Marketo.IntegrationService.Activities", assembly: "UiPath.Marketo.IntegrationService.Activities" },
  "UiPath.MicrosoftAzureOpenAI.IntegrationService.Activities": { prefix: "uazoai", xmlns: "clr-namespace:UiPath.MicrosoftAzureOpenAI.IntegrationService.Activities;assembly=UiPath.MicrosoftAzureOpenAI.IntegrationService.Activities", clrNamespace: "UiPath.MicrosoftAzureOpenAI.IntegrationService.Activities", assembly: "UiPath.MicrosoftAzureOpenAI.IntegrationService.Activities" },
  "UiPath.MicrosoftDynamicsCRM.IntegrationService.Activities": { prefix: "udyncrm", xmlns: "clr-namespace:UiPath.MicrosoftDynamicsCRM.IntegrationService.Activities;assembly=UiPath.MicrosoftDynamicsCRM.IntegrationService.Activities", clrNamespace: "UiPath.MicrosoftDynamicsCRM.IntegrationService.Activities", assembly: "UiPath.MicrosoftDynamicsCRM.IntegrationService.Activities" },
  "UiPath.MicrosoftTranslator.Activities": { prefix: "umstrans", xmlns: "clr-namespace:UiPath.MicrosoftTranslator.Activities;assembly=UiPath.MicrosoftTranslator.Activities", clrNamespace: "UiPath.MicrosoftTranslator.Activities", assembly: "UiPath.MicrosoftTranslator.Activities" },
  "UiPath.MicrosoftVision.Activities": { prefix: "umsvision", xmlns: "clr-namespace:UiPath.MicrosoftVision.Activities;assembly=UiPath.MicrosoftVision.Activities", clrNamespace: "UiPath.MicrosoftVision.Activities", assembly: "UiPath.MicrosoftVision.Activities" },
  "UiPath.MLServices.Activities": { prefix: "umlsvc", xmlns: "clr-namespace:UiPath.MLServices.Activities;assembly=UiPath.MLServices.Activities", clrNamespace: "UiPath.MLServices.Activities", assembly: "UiPath.MLServices.Activities" },
  "UiPath.NetIQeDirectory.Activities": { prefix: "unetiq", xmlns: "clr-namespace:UiPath.NetIQeDirectory.Activities;assembly=UiPath.NetIQeDirectory.Activities", clrNamespace: "UiPath.NetIQeDirectory.Activities", assembly: "UiPath.NetIQeDirectory.Activities" },
  "UiPath.OpenAI.IntegrationService.Activities": { prefix: "uopenai", xmlns: "clr-namespace:UiPath.OpenAI.IntegrationService.Activities;assembly=UiPath.OpenAI.IntegrationService.Activities", clrNamespace: "UiPath.OpenAI.IntegrationService.Activities", assembly: "UiPath.OpenAI.IntegrationService.Activities" },
  "UiPath.Oracle.IntegrationCloud.Process.Activities": { prefix: "uoic", xmlns: "clr-namespace:UiPath.Oracle.IntegrationCloud.Process.Activities;assembly=UiPath.Oracle.IntegrationCloud.Process.Activities", clrNamespace: "UiPath.Oracle.IntegrationCloud.Process.Activities", assembly: "UiPath.Oracle.IntegrationCloud.Process.Activities" },
  "UiPath.OracleEloqua.IntegrationService.Activities": { prefix: "ueloqua", xmlns: "clr-namespace:UiPath.OracleEloqua.IntegrationService.Activities;assembly=UiPath.OracleEloqua.IntegrationService.Activities", clrNamespace: "UiPath.OracleEloqua.IntegrationService.Activities", assembly: "UiPath.OracleEloqua.IntegrationService.Activities" },
  "UiPath.OracleNetSuite.Activities": { prefix: "unetsuite", xmlns: "clr-namespace:UiPath.OracleNetSuite.Activities;assembly=UiPath.OracleNetSuite.Activities", clrNamespace: "UiPath.OracleNetSuite.Activities", assembly: "UiPath.OracleNetSuite.Activities" },
  "UiPath.OracleNetSuite.IntegrationService.Activities": { prefix: "unetsuitis", xmlns: "clr-namespace:UiPath.OracleNetSuite.IntegrationService.Activities;assembly=UiPath.OracleNetSuite.IntegrationService.Activities", clrNamespace: "UiPath.OracleNetSuite.IntegrationService.Activities", assembly: "UiPath.OracleNetSuite.IntegrationService.Activities" },
  "UiPath.Python.Activities": { prefix: "upython", xmlns: "clr-namespace:UiPath.Python.Activities;assembly=UiPath.Python.Activities", clrNamespace: "UiPath.Python.Activities", assembly: "UiPath.Python.Activities" },
  "UiPath.QuickBooksOnline.IntegrationService.Activities": { prefix: "uqbo", xmlns: "clr-namespace:UiPath.QuickBooksOnline.IntegrationService.Activities;assembly=UiPath.QuickBooksOnline.IntegrationService.Activities", clrNamespace: "UiPath.QuickBooksOnline.IntegrationService.Activities", assembly: "UiPath.QuickBooksOnline.IntegrationService.Activities" },
  "UiPath.Salesforce.IntegrationService.Activities": { prefix: "usfis", xmlns: "clr-namespace:UiPath.Salesforce.IntegrationService.Activities;assembly=UiPath.Salesforce.IntegrationService.Activities", clrNamespace: "UiPath.Salesforce.IntegrationService.Activities", assembly: "UiPath.Salesforce.IntegrationService.Activities" },
  "UiPath.SalesforceMarketingCloud.IntegrationService.Activities": { prefix: "usfmc", xmlns: "clr-namespace:UiPath.SalesforceMarketingCloud.IntegrationService.Activities;assembly=UiPath.SalesforceMarketingCloud.IntegrationService.Activities", clrNamespace: "UiPath.SalesforceMarketingCloud.IntegrationService.Activities", assembly: "UiPath.SalesforceMarketingCloud.IntegrationService.Activities" },
  "UiPath.SAPCloudForCustomer.IntegrationService.Activities": { prefix: "usapc4c", xmlns: "clr-namespace:UiPath.SAPCloudForCustomer.IntegrationService.Activities;assembly=UiPath.SAPCloudForCustomer.IntegrationService.Activities", clrNamespace: "UiPath.SAPCloudForCustomer.IntegrationService.Activities", assembly: "UiPath.SAPCloudForCustomer.IntegrationService.Activities" },
  "UiPath.SendGrid.IntegrationService.Activities": { prefix: "usendgrid", xmlns: "clr-namespace:UiPath.SendGrid.IntegrationService.Activities;assembly=UiPath.SendGrid.IntegrationService.Activities", clrNamespace: "UiPath.SendGrid.IntegrationService.Activities", assembly: "UiPath.SendGrid.IntegrationService.Activities" },
  "UiPath.ServiceNow.IntegrationService.Activities": { prefix: "usnowis", xmlns: "clr-namespace:UiPath.ServiceNow.IntegrationService.Activities;assembly=UiPath.ServiceNow.IntegrationService.Activities", clrNamespace: "UiPath.ServiceNow.IntegrationService.Activities", assembly: "UiPath.ServiceNow.IntegrationService.Activities" },
  "UiPath.Smartsheet.Activities": { prefix: "usheet", xmlns: "clr-namespace:UiPath.Smartsheet.Activities;assembly=UiPath.Smartsheet.Activities", clrNamespace: "UiPath.Smartsheet.Activities", assembly: "UiPath.Smartsheet.Activities" },
  "UiPath.Smartsheet.IntegrationService.Activities": { prefix: "usheetis", xmlns: "clr-namespace:UiPath.Smartsheet.IntegrationService.Activities;assembly=UiPath.Smartsheet.IntegrationService.Activities", clrNamespace: "UiPath.Smartsheet.IntegrationService.Activities", assembly: "UiPath.Smartsheet.IntegrationService.Activities" },
  "UiPath.Snowflake.IntegrationService.Activities": { prefix: "usnowflake", xmlns: "clr-namespace:UiPath.Snowflake.IntegrationService.Activities;assembly=UiPath.Snowflake.IntegrationService.Activities", clrNamespace: "UiPath.Snowflake.IntegrationService.Activities", assembly: "UiPath.Snowflake.IntegrationService.Activities" },
  "UiPath.SuccessFactors.Activities": { prefix: "usuccfact", xmlns: "clr-namespace:UiPath.SuccessFactors.Activities;assembly=UiPath.SuccessFactors.Activities", clrNamespace: "UiPath.SuccessFactors.Activities", assembly: "UiPath.SuccessFactors.Activities" },
  "UiPath.SugarEnterprise.IntegrationService.Activities": { prefix: "usugare", xmlns: "clr-namespace:UiPath.SugarEnterprise.IntegrationService.Activities;assembly=UiPath.SugarEnterprise.IntegrationService.Activities", clrNamespace: "UiPath.SugarEnterprise.IntegrationService.Activities", assembly: "UiPath.SugarEnterprise.IntegrationService.Activities" },
  "UiPath.SugarProfessional.IntegrationService.Activities": { prefix: "usugarp", xmlns: "clr-namespace:UiPath.SugarProfessional.IntegrationService.Activities;assembly=UiPath.SugarProfessional.IntegrationService.Activities", clrNamespace: "UiPath.SugarProfessional.IntegrationService.Activities", assembly: "UiPath.SugarProfessional.IntegrationService.Activities" },
  "UiPath.SugarSell.IntegrationService.Activities": { prefix: "usugars", xmlns: "clr-namespace:UiPath.SugarSell.IntegrationService.Activities;assembly=UiPath.SugarSell.IntegrationService.Activities", clrNamespace: "UiPath.SugarSell.IntegrationService.Activities", assembly: "UiPath.SugarSell.IntegrationService.Activities" },
  "UiPath.SugarServe.IntegrationService.Activities": { prefix: "usugarv", xmlns: "clr-namespace:UiPath.SugarServe.IntegrationService.Activities;assembly=UiPath.SugarServe.IntegrationService.Activities", clrNamespace: "UiPath.SugarServe.IntegrationService.Activities", assembly: "UiPath.SugarServe.IntegrationService.Activities" },
  "UiPath.SystemCenter.Activities": { prefix: "usysctr", xmlns: "clr-namespace:UiPath.SystemCenter.Activities;assembly=UiPath.SystemCenter.Activities", clrNamespace: "UiPath.SystemCenter.Activities", assembly: "UiPath.SystemCenter.Activities" },
  "UiPath.Tableau.Activities": { prefix: "utableau", xmlns: "clr-namespace:UiPath.Tableau.Activities;assembly=UiPath.Tableau.Activities", clrNamespace: "UiPath.Tableau.Activities", assembly: "UiPath.Tableau.Activities" },
  "UiPath.Terminal.Activities": { prefix: "uterminal", xmlns: "clr-namespace:UiPath.Terminal.Activities;assembly=UiPath.Terminal.Activities", clrNamespace: "UiPath.Terminal.Activities", assembly: "UiPath.Terminal.Activities" },
  "UiPath.Twilio.Activities": { prefix: "utwilio", xmlns: "clr-namespace:UiPath.Twilio.Activities;assembly=UiPath.Twilio.Activities", clrNamespace: "UiPath.Twilio.Activities", assembly: "UiPath.Twilio.Activities" },
  "UiPath.Twilio.IntegrationService.Activities": { prefix: "utwiliois", xmlns: "clr-namespace:UiPath.Twilio.IntegrationService.Activities;assembly=UiPath.Twilio.IntegrationService.Activities", clrNamespace: "UiPath.Twilio.IntegrationService.Activities", assembly: "UiPath.Twilio.IntegrationService.Activities" },
  "UiPath.Twitter.IntegrationService.Activities": { prefix: "utwitter", xmlns: "clr-namespace:UiPath.Twitter.IntegrationService.Activities;assembly=UiPath.Twitter.IntegrationService.Activities", clrNamespace: "UiPath.Twitter.IntegrationService.Activities", assembly: "UiPath.Twitter.IntegrationService.Activities" },
  "UiPath.VMware.Activities": { prefix: "uvmware", xmlns: "clr-namespace:UiPath.VMware.Activities;assembly=UiPath.VMware.Activities", clrNamespace: "UiPath.VMware.Activities", assembly: "UiPath.VMware.Activities" },
  "UiPath.Workato.Activities": { prefix: "uworkato", xmlns: "clr-namespace:UiPath.Workato.Activities;assembly=UiPath.Workato.Activities", clrNamespace: "UiPath.Workato.Activities", assembly: "UiPath.Workato.Activities" },
  "UiPath.Workday.IntegrationService.Activities": { prefix: "uwdis", xmlns: "clr-namespace:UiPath.Workday.IntegrationService.Activities;assembly=UiPath.Workday.IntegrationService.Activities", clrNamespace: "UiPath.Workday.IntegrationService.Activities", assembly: "UiPath.Workday.IntegrationService.Activities" },
  "UiPath.Zendesk.IntegrationService.Activities": { prefix: "uzendesk", xmlns: "clr-namespace:UiPath.Zendesk.IntegrationService.Activities;assembly=UiPath.Zendesk.IntegrationService.Activities", clrNamespace: "UiPath.Zendesk.IntegrationService.Activities", assembly: "UiPath.Zendesk.IntegrationService.Activities" },
  "UiPath.Zoom.IntegrationService.Activities": { prefix: "uzoom", xmlns: "clr-namespace:UiPath.Zoom.IntegrationService.Activities;assembly=UiPath.Zoom.IntegrationService.Activities", clrNamespace: "UiPath.Zoom.IntegrationService.Activities", assembly: "UiPath.Zoom.IntegrationService.Activities" },
};

const EXTRA_PREFIX_ALIASES: Record<string, string> = {
  "ds": "uds",
  "datafabric": "uds",
  "ocr": "uocr",
};

const PREFIX_ALIAS_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [packageName, info] of Object.entries(PACKAGE_NAMESPACE_MAP)) {
    if (!info.prefix) continue;
    const parts = packageName.replace(/^UiPath\./, "").replace(/\.Activities$/, "").split(".");
    for (const part of parts) {
      const alias = part.toLowerCase();
      if (alias !== info.prefix && !map[alias]) {
        map[alias] = info.prefix;
      }
    }
  }
  for (const [alias, canonical] of Object.entries(EXTRA_PREFIX_ALIASES)) {
    if (!map[alias]) {
      map[alias] = canonical;
    }
  }
  return map;
})();

export function normalizeNamespaceAliases(xml: string): { xml: string; warnings: string[] } {
  const warnings: string[] = [];
  let result = xml;

  for (const [alias, canonical] of Object.entries(PREFIX_ALIAS_MAP)) {
    const aliasPattern = new RegExp(`(<\\/?)${alias}:`, "g");
    if (aliasPattern.test(result)) {
      result = result.replace(new RegExp(`(<\\/?)${alias}:`, "g"), `$1${canonical}:`);
      const hasCanonicalXmlns = new RegExp(`xmlns:${canonical}=`).test(result);
      if (hasCanonicalXmlns) {
        result = result.replace(new RegExp(`\\s*xmlns:${alias}="[^"]*"`, "g"), "");
      } else {
        result = result.replace(new RegExp(`xmlns:${alias}=`, "g"), `xmlns:${canonical}=`);
      }
      warnings.push(`Normalized namespace alias "${alias}:" to canonical prefix "${canonical}:"`);
    }
  }

  return { xml: result, warnings };
}

const SYSTEM_ACTIVITIES_NO_PREFIX = new Set([
  "Assign", "If", "TryCatch", "Sequence", "Delay", "Throw", "While", "DoWhile",
  "ForEach", "Flowchart", "FlowStep", "FlowDecision", "FlowSwitch", "Switch",
  "AddToCollection", "RemoveFromCollection", "ClearCollection", "ExistsInCollection",
  "Catch", "Rethrow",
  "State", "StateMachine", "Transition",
]);

export interface NamespaceMismatchDiagnostic {
  type: "prefix-to-xmlns" | "clr-namespace-to-prefix";
  key: string;
  catalogValue: string;
  fallbackValue: string;
  sourceSelected: "catalog";
  packageId?: string;
  prefix?: string;
  clrNamespace?: string;
  assembly?: string;
  fallbackReason?: string;
}

const _namespaceMismatchDiagnostics: NamespaceMismatchDiagnostic[] = [];

export function getNamespaceMismatchDiagnostics(): NamespaceMismatchDiagnostic[] {
  return [..._namespaceMismatchDiagnostics];
}

export function clearNamespaceMismatchDiagnostics(): void {
  _namespaceMismatchDiagnostics.length = 0;
}

export function resetNamespaceCaches(): void {
  _prefixToXmlnsCache = null;
  _prefixToXmlnsCatalogLoaded = null;
  _clrNamespaceToXamlPrefixCache = null;
  _clrNamespaceToXamlPrefixCatalogLoaded = null;
  _namespaceMismatchDiagnostics.length = 0;
}

let _prefixToXmlnsCache: Record<string, string> | null = null;
let _prefixToXmlnsCatalogLoaded: boolean | null = null;

function buildPrefixToXmlnsFallback(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const info of Object.values(PACKAGE_NAMESPACE_MAP)) {
    if (info.prefix && !map[info.prefix]) {
      map[info.prefix] = info.xmlns;
    }
  }
  return map;
}

export function getPrefixToXmlns(): Record<string, string> {
  const catalogLoaded = catalogService.isLoaded();

  if (_prefixToXmlnsCache && _prefixToXmlnsCatalogLoaded === catalogLoaded) {
    return _prefixToXmlnsCache;
  }

  if (!catalogLoaded) {
    _prefixToXmlnsCache = buildPrefixToXmlnsFallback();
    _prefixToXmlnsCatalogLoaded = false;
    return _prefixToXmlnsCache;
  }

  const map: Record<string, string> = {};
  const catalogEntries = catalogService.getAllPackageNamespaceEntries();
  const prefixMetadata: Record<string, { packageId: string; clrNamespace: string; assembly: string }> = {};
  for (const entry of catalogEntries) {
    if (entry.prefix && !map[entry.prefix]) {
      const xmlns = entry.clrNamespace === "UiPath.Core.Activities" && entry.prefix === "ui"
        ? "http://schemas.uipath.com/workflow/activities"
        : `clr-namespace:${entry.clrNamespace};assembly=${entry.assembly}`;
      map[entry.prefix] = xmlns;
      prefixMetadata[entry.prefix] = { packageId: entry.packageId, clrNamespace: entry.clrNamespace, assembly: entry.assembly };
    }
  }

  const fallbackMap = buildPrefixToXmlnsFallback();
  for (const [prefix, xmlns] of Object.entries(fallbackMap)) {
    if (!map[prefix]) {
      map[prefix] = xmlns;
    } else if (map[prefix] !== xmlns) {
      const meta = prefixMetadata[prefix];
      _namespaceMismatchDiagnostics.push({
        type: "prefix-to-xmlns",
        key: prefix,
        catalogValue: map[prefix],
        fallbackValue: xmlns,
        sourceSelected: "catalog",
        packageId: meta?.packageId,
        prefix,
        clrNamespace: meta?.clrNamespace,
        assembly: meta?.assembly,
        fallbackReason: "catalog xmlns differs from hardcoded PACKAGE_NAMESPACE_MAP xmlns for this prefix",
      });
    }
  }

  _prefixToXmlnsCache = map;
  _prefixToXmlnsCatalogLoaded = true;
  return map;
}

const PREFIX_TO_XMLNS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_target, prop: string) {
    return getPrefixToXmlns()[prop];
  },
  has(_target, prop: string) {
    return prop in getPrefixToXmlns();
  },
  ownKeys() {
    return Object.keys(getPrefixToXmlns());
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    const map = getPrefixToXmlns();
    if (prop in map) {
      return { value: map[prop], writable: false, enumerable: true, configurable: true };
    }
    return undefined;
  },
});

export function validateImplementationContainer(xaml: string): { valid: boolean; reason?: string } {
  if (!xaml || xaml.trim().length === 0) {
    return { valid: false, reason: "Empty XAML content" };
  }
  const hasActivityRoot = /<Activity\b[^.]/i.test(xaml);
  if (!hasActivityRoot) {
    return { valid: false, reason: "Missing root <Activity> element" };
  }
  const implPattern = /<(?:Sequence|Flowchart|StateMachine)\b(?!\.)(?:\s|>|\/)/i;
  if (!implPattern.test(xaml)) {
    return { valid: false, reason: "No <Sequence>, <Flowchart>, or <StateMachine> child — DynamicActivity.Implementation is null" };
  }
  return { valid: true };
}

export function injectMissingNamespaceDeclarations(xaml: string): { xml: string; injected: string[] } {
  const injected: string[] = [];

  const declaredPrefixes = new Set<string>();
  const xmlnsPattern = /xmlns:(\w+)="[^"]+"/g;
  let dm;
  while ((dm = xmlnsPattern.exec(xaml)) !== null) {
    declaredPrefixes.add(dm[1]);
  }

  const usedPrefixes = new Set<string>();
  const usagePattern = /<(\w+):/g;
  let um;
  while ((um = usagePattern.exec(xaml)) !== null) {
    if (um[1] !== "xmlns" && um[1] !== "xml") {
      usedPrefixes.add(um[1]);
    }
  }
  const typeArgPattern = /x:TypeArguments="([^"]*)"/g;
  let tam;
  while ((tam = typeArgPattern.exec(xaml)) !== null) {
    const prefixesInTypeArgs = tam[1].match(/(\w+):/g);
    if (prefixesInTypeArgs) {
      for (const p of prefixesInTypeArgs) {
        const prefix = p.slice(0, -1);
        if (prefix !== "x" && prefix !== "xmlns") {
          usedPrefixes.add(prefix);
        }
      }
    }
  }

  const missingPrefixes: string[] = [];
  for (const prefix of usedPrefixes) {
    if (!declaredPrefixes.has(prefix)) {
      missingPrefixes.push(prefix);
    }
  }

  if (missingPrefixes.length === 0) {
    return { xml: xaml, injected };
  }

  let result = xaml;
  for (const prefix of missingPrefixes) {
    const xmlns = PREFIX_TO_XMLNS[prefix];
    if (!xmlns) continue;

    const declaration = `xmlns:${prefix}="${xmlns}"`;
    const activityTagMatch = result.match(/<Activity\s/);
    if (activityTagMatch) {
      const insertPos = activityTagMatch.index! + activityTagMatch[0].length;
      result = result.substring(0, insertPos) + `${declaration}\n  ` + result.substring(insertPos);
      injected.push(prefix);
    }
  }

  return { xml: result, injected };
}

export function getActivityPrefix(templateName: string): string {
  const result = getActivityPrefixStrict(templateName);
  if (result !== null) return result;

  throw new Error(`[XAML Compliance] getActivityPrefix("${templateName}"): no namespace mapping found — activity is unmapped. Add it to GUARANTEED_ACTIVITY_PREFIX_MAP or the activity catalog.`);
}

export const GUARANTEED_ACTIVITY_PREFIX_MAP: Record<string, string> = {
  "LogMessage": "ui", "Comment": "ui", "InvokeWorkflowFile": "ui",
  "RetryScope": "ui", "ShouldRetry": "ui", "GetAsset": "ui", "GetCredential": "ui",
  "AddQueueItem": "ui", "GetTransactionItem": "ui", "SetTransactionStatus": "ui",
  "TakeScreenshot": "ui", "AddLogFields": "ui", "ReadTextFile": "ui", "WriteTextFile": "ui", "PathExists": "ui",
  "Click": "ui", "TypeInto": "ui", "GetText": "ui", "SelectItem": "ui", "CheckState": "ui", "ElementExists": "ui",
  "NClick": "ui", "NTypeInto": "ui", "NGetText": "ui", "NSelectItem": "ui", "NCheckState": "ui", "NApplicationCard": "ui",
  "OpenBrowser": "ui", "NavigateTo": "ui", "AttachBrowser": "ui", "AttachWindow": "ui",
  "UseApplicationBrowser": "ui", "UseBrowser": "ui", "UseApplication": "ui",
  "HttpClient": "uweb", "DeserializeJson": "uweb", "DeserializeJSON": "uweb", "SerializeJson": "uweb",
  "SendSmtpMailMessage": "umail", "SendOutlookMailMessage": "umail", "GetImapMailMessage": "umail",
  "GetOutlookMailMessages": "umail", "SendMail": "umail", "GetMail": "umail",
  "ExcelApplicationScope": "uexcel", "UseExcel": "uexcel", "ExcelReadRange": "uexcel",
  "ExcelWriteRange": "uexcel", "ExcelWriteCell": "uexcel", "ReadRange": "uexcel", "WriteRange": "uexcel",
  "ExecuteQuery": "udb", "ExecuteNonQuery": "udb", "ConnectToDatabase": "udb",
  "CreateFormTask": "upers", "WaitForFormTaskAndResume": "upers",
  "CreateEntity": "uds", "CreateEntityRecord": "uds", "QueryEntity": "uds",
  "UpdateEntity": "uds", "DeleteEntity": "uds", "GetEntityById": "uds",
  "MLSkill": "uml", "Predict": "uml",
  "DigitizeDocument": "uocr", "ClassifyDocument": "uocr", "ExtractDocumentData": "uocr", "ValidateDocumentData": "uocr",
  "ReadPDFText": "updf", "ReadPDFWithOCR": "updf", "ExtractPDFPageRange": "updf", "MergePDF": "updf", "ExportPDFPageAsImage": "updf", "GetPDFPageCount": "updf",
  "ReadDocument": "uword", "WriteDocument": "uword", "ReplaceText": "uword", "AppendText": "uword", "InsertPicture": "uword", "ReadTable": "uword",
  "GoogleSheetsApplicationScope": "ugs", "GoogleSheetsReadRange": "ugs", "GoogleSheetsWriteRange": "ugs", "GoogleSheetsAppendRange": "ugs",
  "GoogleDriveUploadFile": "ugs", "GoogleDriveDownloadFile": "ugs", "GmailSendMessage": "ugs", "GmailGetMessages": "ugs",
  "MicrosoftOffice365Scope": "uo365", "SendMail365": "uo365", "GetMail365": "uo365", "CreateEvent365": "uo365",
  "ExcelCreateSpreadsheet": "uo365", "ExcelReadRange365": "uo365", "ExcelWriteRange365": "uo365",
  "SharePointUploadFile": "uo365", "SharePointDownloadFile": "uo365",
  "VerifyExpression": "utest", "VerifyRange": "utest", "VerifyControlAttribute": "utest", "LogAssert": "utest",
  "GivenName": "utest", "WhenName": "utest", "ThenName": "utest", "AddTestDataQueueItem": "utest",
  "CreateForm": "uform", "ShowForm": "uform", "CalloutActivities": "uform",
  "EncryptText": "ucrypt", "DecryptText": "ucrypt", "EncryptFile": "ucrypt", "DecryptFile": "ucrypt",
  "HashText": "ucrypt", "HashFile": "ucrypt", "KeyedHashText": "ucrypt",
  "HttpClientRequest": "uwapi", "DownloadFile": "uwapi",
  "MultipleAssign": "ucs", "WaitForDownload": "ucs", "RepeatUntil": "ucs",
  "BuildDataTable": "ucs", "FilterDataTable": "ucs", "SortDataTable": "ucs", "RemoveDuplicateRows": "ucs",
  "JoinDataTables": "ucs", "OutputDataTable": "ucs", "AddDataRow": "ucs", "RemoveDataRow": "ucs", "LookupDataTable": "ucs",
  "AmazonScope": "uaws", "S3UploadFile": "uaws", "S3DownloadFile": "uaws", "S3DeleteObject": "uaws", "S3ListObjects": "uaws",
  "TextractAnalyzeDocument": "utxt", "TextractDetectText": "utxt",
  "ComprehendDetectSentiment": "ucmp", "ComprehendDetectEntities": "ucmp", "ComprehendDetectKeyPhrases": "ucmp", "ComprehendDetectLanguage": "ucmp",
  "RekognitionDetectLabels": "urek", "RekognitionDetectText": "urek", "RekognitionDetectFaces": "urek",
  "AzureScope": "uaz", "AzureBlobUpload": "uaz", "AzureBlobDownload": "uaz", "AzureBlobDelete": "uaz", "AzureBlobList": "uaz",
  "FormRecognizerAnalyze": "uafr", "FormRecognizerAnalyzeLayout": "uafr",
  "GoogleCloudScope": "ugc", "GoogleCloudStorageUpload": "ugc", "GoogleCloudStorageDownload": "ugc",
  "GoogleCloudTranslateText": "ugc", "GoogleCloudNLPAnalyzeSentiment": "ugc",
  "GoogleVisionOCR": "ugv", "GoogleVisionLabelDetection": "ugv",
  "SalesforceApplicationScope": "usf", "SalesforceGetRecords": "usf", "SalesforceInsertRecords": "usf",
  "SalesforceUpdateRecords": "usf", "SalesforceDeleteRecords": "usf", "SalesforceSOQLQuery": "usf",
  "ServiceNowApplicationScope": "usnow", "ServiceNowGetRecords": "usnow", "ServiceNowCreateRecord": "usnow",
  "ServiceNowUpdateRecord": "usnow", "ServiceNowDeleteRecord": "usnow",
  "SlackScope": "uslack", "SlackSendMessage": "uslack", "SlackGetMessages": "uslack", "SlackUploadFile": "uslack",
  "JiraScope": "ujira", "JiraCreateIssue": "ujira", "JiraGetIssue": "ujira",
  "JiraUpdateIssue": "ujira", "JiraSearchIssues": "ujira", "JiraAddComment": "ujira",
  "TeamsScope": "uteams", "TeamsSendMessage": "uteams", "TeamsGetMessages": "uteams", "TeamsSendChatMessage": "uteams",
  "FTPScope": "uftp", "FTPUpload": "uftp", "FTPDownload": "uftp", "FTPDelete": "uftp", "FTPListFiles": "uftp", "FTPDirectoryExists": "uftp",
  "PresentationsApplicationScope": "upres", "AddSlide": "upres", "SetText": "upres", "ExportSlideAsImage": "upres", "ReplaceTextInSlide": "upres",
  "GetSecureCredential": "ucred", "AddCredential": "ucred", "DeleteCredential": "ucred", "RequestCredential": "ucred",
  "TaxonomyManager": "udu", "DigitizeScope": "udu", "ClassifyDocumentScope": "udu",
  "ExtractDocumentDataScope": "udu", "ValidationStation": "udu", "ExportExtractionResults": "udu",
  "IntegrationServiceScope": "uis", "IntegrationServiceHTTPRequest": "uis", "IntegrationServiceTrigger": "uis",
  "CommunicationsMiningScope": "ucm", "AnalyzeMessage": "ucm", "UploadCommunications": "ucm",
  "RaiseAlert": "uwfe", "TriggerJob": "uwfe",
  "BoxScope": "ubox", "BoxUploadFile": "ubox", "BoxDownloadFile": "ubox", "BoxDeleteFile": "ubox", "BoxSearchFiles": "ubox",
  "GoogleCalendarGetEvents": "ugs", "GoogleCalendarCreateEvent": "ugs",
  "GoogleContactsSearchContacts": "ugs", "GoogleContactsGetContact": "ugs",
  "DynamicsScope": "udyn", "DynamicsGetRecords": "udyn", "DynamicsCreateRecord": "udyn", "DynamicsUpdateRecord": "udyn",
  "WorkdayScope": "uwd", "WorkdayGetWorkers": "uwd", "WorkdayGetWorkerById": "uwd",
  "CoupaScope": "ucoupa", "CoupaGetPurchaseOrders": "ucoupa", "CoupaCreateRequisition": "ucoupa", "CoupaGetInvoices": "ucoupa",
  "CreateBasicOpportunity": "uact365", "CreateBasicInteraction": "uact365", "UpdateContact": "uact365", "ListAllContacts": "uact365", "ListAllOpportunities": "uact365", "ListAllInteractions": "uact365", "ListAllCampaigns": "uact365", "ReplaceInteraction": "uact365", "ListAllGroups": "uact365", "CreateContact": "uact365", "UpdateOpportunity": "uact365",
  "GetObjectsByFilter": "uadds", "GroupExists": "uadds", "AddComputerToGroup": "uadds", "GetObjectDistinguishedName": "uadds", "UserExists": "uadds", "RemoveGroupFromGroup": "uadds", "ForcePasswordChange": "uadds", "SetUserStatus": "uadds", "IsObjectMemberOfGroup": "uadds", "DeleteOrganizationalUnit": "uadds", "AddUserToGroup": "uadds", "GetComputersInGroup": "uadds", "SetComputerStatus": "uadds", "CreateGroup": "uadds", "GetPasswordExpirationDate": "uadds", "RemoveComputerFromGroup": "uadds", "RemoveUserFromGroup": "uadds", "UpdateObjectProperties": "uadds", "ChangeUserPassword": "uadds", "ComputerExists": "uadds", "AddGroupToGroup": "uadds", "GetUserStatus": "uadds", "GetObjectsByLDAPFilter": "uadds", "GetComputerStatus": "uadds", "CreateOrganizationalUnit": "uadds", "GetUserExpirationDate": "uadds", "JoinComputerToDomain": "uadds", "ActiveDirectoryScope": "uadds", "UnjoinComputerFromDomain": "uadds", "CreateComputer": "uadds", "GetObjectProperties": "uadds", "DeleteComputer": "uadds", "GetUsersInGroup": "uadds", "CreateUser": "uadds", "MoveObject": "uadds", "ValidateUserCredentials": "uadds", "GetUserGroups": "uadds", "DeleteUser": "uadds", "SetUserExpirationDate": "uadds", "RenameObject": "uadds", "DeleteGroup": "uadds",
  "pageManipulation": "uadobepdf", "DownloadPageManipulatedPdf": "uadobepdf", "downloadCompressedPdf": "uadobepdf", "DownloadExportedPDF": "uadobepdf", "compressPdfStatus": "uadobepdf", "linearizePdf": "uadobepdf", "GetpageManipulationStatus": "uadobepdf", "GetDocumentGenerationStatus": "uadobepdf", "compressPdf": "uadobepdf", "GetcreatePDFStatus": "uadobepdf", "GetlinearizePdfStatus": "uadobepdf", "CreateDocument": "uadobepdf", "exportPdf": "uadobepdf", "GetexportPDFStatus": "uadobepdf", "createPdf": "uadobepdf", "DownloadLinearizedPdf": "uadobepdf", "DownloadGeneratedDocument": "uadobepdf", "DownloadCreatedPDF": "uadobepdf",
  "CreateAgreementActivity": "uadosign", "DownloadCombinedAgreementDocumentsActivity": "uadosign", "AdobeSignScopeActivity": "uadosign", "DownloadAuditReportActivity": "uadosign", "CreateTransientDocumentActivity": "uadosign", "DownloadAgreementDocumentsActivity": "uadosign", "InvokeAdobeSignOperationActivity": "uadosign",
  "RunJob": "ualteryx", "FindWorkflowsInSubscription": "ualteryx", "GetAppQuestions": "ualteryx", "GetAppJobs": "ualteryx", "GetJobOutput": "ualteryx", "AlteryxScopeActivity": "ualteryx", "GetJob": "ualteryx", "GetApp": "ualteryx",
  "AmazonConnectScopedActivity": "uamzconn", "MakeVoiceCallActivity": "uamzconn",
  "AWRKSRebootWorkSpace": "uamzws", "AWRKSForEachWorkSpace": "uamzws", "AWRKSCreateWorkSpace": "uamzws", "AWRKSGetWorkSpaceInfo": "uamzws", "AWRKSMigrateWorkSpace": "uamzws", "AWRKSRebuildWorkSpace": "uamzws", "AWRKSRestoreWorkSpace": "uamzws", "AWRKSUpdateWorkSpace": "uamzws", "AWRKSRemoveWorkSpace": "uamzws", "AWRKSScope": "uamzws", "AWRKSStartWorkSpace": "uamzws", "AWRKSStopWorkSpace": "uamzws",
  "AzureADRemoveGroupFromLifecyclePolicy": "uazad", "AzureADRemoveLicenseFromUser": "uazad", "AzureADGroupExists": "uazad", "AzureADAssignLicenseToUser": "uazad", "AzureADForEachGroupInGroup": "uazad", "AzureADGetUser": "uazad", "AzureADAddMemberToGroup": "uazad", "AzureADUserExists": "uazad", "AzureADIsMemberInRole": "uazad", "AzureADForEachLifecyclePolicy": "uazad", "AzureADDeleteUser": "uazad", "AzureADIsGroupInLifecyclePolicy": "uazad", "AzureADCreateLifecyclePolicy": "uazad", "AzureADUpdateUser": "uazad", "AzureADUpdateLifecyclePolicy": "uazad", "AzureADIsOwnerOfGroup": "uazad", "AzureADUpdateGroup": "uazad", "AzureADRemoveOwnerFromGroup": "uazad", "AzureADForEachDirectReport": "uazad", "AzureADDelegatedScope": "uazad", "AzureADRemoveMemberFromGroup": "uazad", "AzureADDeleteLifecyclePolicy": "uazad", "AzureADForEachUserInRole": "uazad", "AzureADSetManager": "uazad", "AzureADForEachGroup": "uazad", "AzureADGetGroupByName": "uazad", "AzureADIsMemberOfGroup": "uazad", "AzureADRemoveMemberFromRole": "uazad", "AzureADGetGroupById": "uazad", "AzureADCreateAssignedGroup": "uazad", "AzureADForEachRole": "uazad", "AzureADAddMemberToRole": "uazad", "AzureADCreateUser": "uazad", "AzureADForEachUserGroup": "uazad", "AzureADDeleteGroup": "uazad", "AzureADAddOwnerToGroup": "uazad", "AzureADForEachUserRole": "uazad", "AzureADAddGroupToLifecyclePolicy": "uazad", "AzureADGetManager": "uazad", "AzureADForEachUser": "uazad", "AzureADForEachUserInGroup": "uazad", "AzureADForEachUserInGroupOwners": "uazad", "AzureADForEachParentGroup": "uazad", "AzureADApplicationScope": "uazad", "AzureADResetPassword": "uazad",
  "DownloadEmployeeFile": "ubamboo", "CreateBasicEmployee": "ubamboo", "UploadCompanyFile": "ubamboo", "UploadEmployeeFile": "ubamboo", "UpdateBasicEmployee": "ubamboo", "GetEmployee": "ubamboo", "DownloadCompanyFile": "ubamboo", "EmployeesDirectory": "ubamboo",
  "CreateFolder": "uboxis", "CancelSignRequest": "uboxis", "GetFileInfo": "uboxis", "GetSignRequest": "uboxis", "ResendSignRequest": "uboxis", "GetFolderInfo": "uboxis", "GetFolderItems": "uboxis", "CopyFile": "uboxis", "CopyFolder": "uboxis", "DeleteFolder": "uboxis", "CreateSignRequest": "uboxis", "GetVersions": "uboxis", "UploadFileVersion": "uboxis", "UploadFile": "uboxis", "DeleteFile": "uboxis",
  "CreateList": "ucampmon", "GetCampaignSummary": "ucampmon", "AddSubscriber": "ucampmon", "SendPreviewCampaign": "ucampmon", "ReplaceSubscriber": "ucampmon", "CreateClient": "ucampmon", "ListAllClients": "ucampmon", "SendCampaign": "ucampmon", "ReplaceList": "ucampmon", "CreateCampaign": "ucampmon",
  "IbmWatsonNluTextAnalysis": "ucognitive", "StanfordCoreNlpGetComponents": "ucognitive", "GoogleTextAnalysis": "ucognitive", "IbmWatsonTextAnalysis": "ucognitive", "MicrosoftTextAnalysis": "ucognitive", "StanfordCoreNlpTextAnalysis": "ucognitive", "GoogleTextTranslate": "ucognitive", "StanfordCoreNlpGetSentenceSentiment": "ucognitive", "StanfordCoreNlpGetOpenIE": "ucognitive",
  "CreateAttachment": "uconfluence", "CreateContent": "uconfluence", "CreateContentHTML": "uconfluence", "SearchContent": "uconfluence", "GetContent": "uconfluence",
  "DownloadDocumentsOfEnvelope": "udocuis", "AddDocumentToEnvelope": "udocuis", "AddRecipientToEnvelope": "udocuis", "CreateByCopyingEnvelope": "udocuis", "CreateEnvelopeUsingTemplate": "udocuis", "ListAllEnvelopeRecipients": "udocuis",
  "GetFormData": "udocusign", "GetTemplate": "udocusign", "GetDocuments": "udocusign", "ListTemplates": "udocusign", "GetBulkSendList": "udocusign", "UpdateEnvelope": "udocusign", "CreateBulkSendList": "udocusign", "ListEnvelopeStatusChanges": "udocusign", "CreateEnvelope": "udocusign", "SendEnvelope": "udocusign", "ListRecipients": "udocusign", "CreateTemplateCustomFields": "udocusign", "ListAttachments": "udocusign", "DocuSignScopeActivity": "udocusign", "CreateEnvelopeAndSend": "udocusign", "GetBulkSendLists": "udocusign", "CreateEnvelopeWithTemplate": "udocusign", "GetEnvelope": "udocusign", "DocuSignOperationGridViewActivity": "udocusign", "CreateRecipients": "udocusign", "ListDocuments": "udocusign", "CreateBulkSendRequest": "udocusign", "GetDocument": "udocusign", "CreateTemplateRecipients": "udocusign", "ListCustomFields": "udocusign",
  "GetMembers": "udropbiz", "AddMembers": "udropbiz", "ListMembers": "udropbiz", "AddFolders": "udropbiz", "DeleteMembers": "udropbiz",
  "CreateSharedLinks": "udropbox", "GetSharedLink": "udropbox", "FileUploads": "udropbox", "DeleteFolders": "udropbox", "CopyFiles": "udropbox", "GetFolderContent": "udropbox", "GetFileDetails": "udropbox", "CreateFolders": "udropbox", "FilesSearch": "udropbox", "GetFolderDetails": "udropbox", "FileDownloads": "udropbox",
  "CreateAccount": "udyncrm", "CloseLostOpportinity": "udyncrm", "UpdateAccount": "udyncrm", "CloseWinOpportinity": "udyncrm", "CreateOpportunity": "udyncrm",
  "EnableMailboxArchive": "uexchange", "DeleteMailbox": "uexchange", "CreateMailbox": "uexchange", "ExchangeServerScope": "uexchange", "DisableMailboxArchive": "uexchange",
  "DownloadExportedReport": "uexpensify", "ExportReportToEmail": "uexpensify",
  "ListTickets": "ufreshsvc", "CreateAReply": "ufreshsvc", "SearchTickets": "ufreshsvc", "CreateTicket": "ufreshsvc", "CreateTicketWithAsset": "ufreshsvc", "GetTicket": "ufreshsvc", "DeleteTicket": "ufreshsvc", "CreateTicketWithAttachment": "ufreshsvc", "UpsertTicket": "ufreshsvc", "ListAllTickets": "ufreshsvc", "GetAllConversations": "ufreshsvc",
  "ListAllIssues": "ugithub", "UpdateIssue": "ugithub", "ListAllBranches": "ugithub", "CreatePull": "ugithub", "GetRepo": "ugithub", "SearchRepos": "ugithub", "GetPull": "ugithub", "CreateIssue": "ugithub", "DeleteRepo": "ugithub", "CreateBranch": "ugithub", "SearchIssues": "ugithub", "UpdatePull": "ugithub", "CreateRepo": "ugithub", "DeleteBranch": "ugithub", "ListAllPulls": "ugithub", "UpdateRepo": "ugithub", "MergePull": "ugithub", "ListAllRepos": "ugithub", "GetIssue": "ugithub",
  "ListAccountWebinar": "ugotoweb", "GetWebinarRegistrant": "ugotoweb", "ListWebinars": "ugotoweb", "SearchRecordingAsset": "ugotoweb", "ListAllInSessionWebinar": "ugotoweb", "ListAllWebinarAttendees": "ugotoweb", "DeleteWebinar": "ugotoweb", "ListAllWebinarSessionAttendees": "ugotoweb", "GetWebinarMeetingTimes": "ugotoweb", "QuickUpdateWebinar": "ugotoweb", "ListWebinarSessionPerformance": "ugotoweb", "ListAllWebinarRegistrants": "ugotoweb", "ListAllWebinars": "ugotoweb", "ListAllWebinarSession": "ugotoweb", "CreateSingleSessionWebinar": "ugotoweb", "GetWebinarStartURL": "ugotoweb", "QuickCreateWebinar": "ugotoweb", "GetWebinar": "ugotoweb",
  "TransitionIssue": "ujirais", "AddAttachment": "ujirais", "UpsertIssue": "ujirais", "SearchIssuebyJQL": "ujirais", "GetComments": "ujirais", "DeleteIssue": "ujirais", "FindUsersbyEmail": "ujirais", "UpdateIssueAssignee": "ujirais", "WhenEventHappens": "ujirais", "AddComment": "ujirais",
  "SendTestEmail": "umailchimp", "GetListMember": "umailchimp", "UpdateListMember": "umailchimp", "SearchMembers": "umailchimp", "ListAllReports": "umailchimp", "AddListMember": "umailchimp", "ListAllOpenReports": "umailchimp", "DeleteCampaign": "umailchimp", "DeleteList": "umailchimp", "SetCampaignContent": "umailchimp", "GetList": "umailchimp", "UpdateList": "umailchimp", "ListAllListsMembers": "umailchimp", "DeleteListMember": "umailchimp", "SearchCampaigns": "umailchimp", "GetCampaign": "umailchimp", "GetReports": "umailchimp", "ListAllLists": "umailchimp", "UpdateCampaign": "umailchimp",
  "BulkImportLeads": "umarketo", "MarketoOperationActivity": "umarketo", "MarketoScopeActivity": "umarketo", "GetEmail": "umarketo", "GetLead": "umarketo", "GetLeads": "umarketo",
  "GetLeadChanges": "umarketois", "CreateLead": "umarketois", "RemoveLeadsFromList": "umarketois", "GetAllLeads": "umarketois", "UpdateLead": "umarketois", "AddLeadsToLists": "umarketois",
  "TranslatorScope": "umstrans", "TranslateActivity": "umstrans", "DetectLanguageActivity": "umstrans", "TransliterateActivity": "umstrans",
  "MicrosoftVisionScope": "umsvision", "GenerateTags": "umsvision", "SafeSearch": "umsvision", "ReadText": "umsvision", "AnalyzeImage": "umsvision", "ReadHandwrittenText": "umsvision", "GenerateDescription": "umsvision", "GetThumbnail": "umsvision", "GetColor": "umsvision", "DetectFaces": "umsvision",
  "InitializeRecord": "unetsuite", "AttachFile": "unetsuite", "DetachFile": "unetsuite", "GetFilesByFolder": "unetsuite", "SavedSearch": "unetsuite", "OracleNetSuiteScopeActivity": "unetsuite", "GetFolders": "unetsuite", "GetFilesByObject": "unetsuite", "DeleteRecords": "unetsuite", "GetRecords": "unetsuite", "GetAllRecords": "unetsuite",
  "UpdateBasicCompanyVendor": "unetsuitis", "CreateBasicCompanyVendor": "unetsuitis", "UpdateBasicIndividualCustomer": "unetsuitis", "CreateBasicContact": "unetsuitis", "UpdateSupportcase": "unetsuitis", "UpdateBasicCompanyCustomer": "unetsuitis", "CreateBasicIndividualVendor": "unetsuitis", "CreateBasicIndividualCustomer": "unetsuitis", "CreateBasicCompanyCustomer": "unetsuitis", "UpdateBasicContact": "unetsuitis", "UpdateBasicIndividualVendor": "unetsuitis", "CreateSupportcase": "unetsuitis",
  "GetAllTasksActivity": "uoic", "ReassignTaskActivity": "uoic", "AddTaskCommentActivity": "uoic", "GetTaskActivity": "uoic", "GetProcessInstanceActivity": "uoic", "GetTaskAttachmentsActivity": "uoic", "AddProcessInstanceCommentActivity": "uoic", "GetProcessInstancesActivity": "uoic", "UpdateProcessInstanceStateActivity": "uoic", "ActionTaskActivity": "uoic", "GetProcessInstanceAttachmentsActivity": "uoic", "GetTaskAssigneesActivity": "uoic", "OracleProcessScope": "uoic", "StartProcessActivity": "uoic", "DownloadAttachmentActivity": "uoic",
  "DeleteAttachment": "uqbo", "UpdateCustomer": "uqbo", "GetAttachmentDownloadLink": "uqbo", "CreateItem": "uqbo", "GetAttachment": "uqbo", "GetCustomer": "uqbo", "GetItem": "uqbo", "UpdateVendor": "uqbo", "CreateCustomer": "uqbo", "GetVendor": "uqbo", "ListAllItems": "uqbo", "UpdateItem": "uqbo", "CreateVendor": "uqbo",
  "RetrieveMarketingLists": "usendgrid", "CreateMarketingLists": "usendgrid", "UpsertContacts": "usendgrid", "SendEmailBasic": "usendgrid", "GetMarketingLists": "usendgrid", "GetContactByEmail": "usendgrid", "CreateBatchID": "usendgrid",
  "SearchUsingSOQL": "usfis", "UploadAttachment": "usfis", "GetDocumentFromFileVersion": "usfis", "GetLeadByID": "usfis", "GetAccountByID": "usfis", "AddFileToRecord": "usfis", "ParameterizedSearch_GET": "usfis", "GetOpportunityById": "usfis", "GetContactByID": "usfis",
  "ListAllJourneys": "usfmc", "ReplaceJourney": "usfmc", "CreateBasicJourney": "usfmc", "DeleteContact": "usfmc", "DeleteJourney": "usfmc", "CreateBasicList": "usfmc", "GetJourney": "usfmc",
  "ListSheets": "usheet", "ListDiscussions": "usheet", "ListFolders": "usheet", "GetSheet": "usheet", "CreateSheetFromTemplate": "usheet", "CopyRows": "usheet", "GetFolder": "usheet", "CreateWorkspace": "usheet", "GetGroup": "usheet", "SendViaEmail": "usheet", "ListReports": "usheet", "ListRows": "usheet", "RemoveGroupMember": "usheet", "UpdateSheet": "usheet", "CreateSheet": "usheet", "AddRows": "usheet", "UpdateRows": "usheet", "GetRow": "usheet", "AddUser": "usheet", "CreateDiscussionOnRow": "usheet", "GetComment": "usheet", "SearchActivity": "usheet", "CopyWorkspace": "usheet", "AddGroupMembers": "usheet", "ListUsers": "usheet", "ListWorkspaces": "usheet", "MoveRows": "usheet", "ImportSheet": "usheet", "CopySheet": "usheet", "DeleteComment": "usheet", "SmartsheetScopeActivity": "usheet", "AttachUrl": "usheet", "GetReport": "usheet", "SmartsheetInvokeActivity": "usheet", "ListGroups": "usheet", "ShareObject": "usheet", "DownloadSheet": "usheet", "DeleteRows": "usheet",
  "AddRow": "usheetis", "DeleteSheet": "usheetis", "GetAttachmentURL": "usheetis", "AttachUrlToRow": "usheetis", "UpdateRow": "usheetis", "DeleteColumn": "usheetis", "UpsertGroup": "usheetis", "QuickUpdateColumn": "usheetis", "AttachUrlToComment": "usheetis", "AttachSheetFile": "usheetis", "ListSheetAttachments": "usheetis", "ListColumns": "usheetis", "QuickAddColumn": "usheetis", "DeleteSheetAttachment": "usheetis", "AttachRowFile": "usheetis", "AddGroupMember": "usheetis", "SearchSheet": "usheetis", "FindFirstGroup": "usheetis", "GetColumn": "usheetis", "CreateBasicSheet": "usheetis", "ListSheet": "usheetis", "DeleteRow": "usheetis", "ListAllSheetAttachments": "usheetis", "FindFirstColumn": "usheetis", "FindFirstSheetAttachment": "usheetis", "AttachUrlToSheet": "usheetis", "ListAllColumns": "usheetis", "AttachCommentFile": "usheetis", "FindFirstSheet": "usheetis", "SearchEverything": "usheetis", "ListAllSheets": "usheetis",
  "NativeSearch": "usnowflake",
  "DownloadAttachment": "usnowis", "UpdateIncidentTask": "usnowis", "CreateIncidentTask": "usnowis", "ListAllAttachment": "usnowis", "ListIncidents": "usnowis", "CreateNewIncident": "usnowis", "GetIncidentTask": "usnowis", "ListIncidentTasks": "usnowis", "UpdateIncident": "usnowis",
  "SuccessFactorsInsertRecordActivity": "usuccfact", "SuccessFactorsUpdateRecordActivity": "usuccfact", "SuccessFactorsUpsertRecordActivity": "usuccfact", "SuccessFactorsDeleteRecordActivity": "usuccfact", "SuccessFactorsSearchRecordsActivity": "usuccfact", "SuccessFactorsScopeActivity": "usuccfact", "SuccessFactorsExecuteFunctionActivity": "usuccfact", "SuccessFactorsGetRecordActivity": "usuccfact",
  "UpdateAccountDetails": "usugare", "UpdateContactDetails": "usugare", "CreateContacts": "usugare", "DeleteAccountDetails": "usugare", "GetAccountDetails": "usugare", "CreateAccounts": "usugare",
  "Opportunities": "usugars", "GetLeadDetails": "usugars",
  "UpdateCase": "usugarv", "CreateCase": "usugarv",
  "RefreshWorkbookData": "utableau", "QueryViewImage": "utableau", "TableauScopeActivity": "utableau", "DownloadWorkbookRevision": "utableau", "QueryViewData": "utableau", "DownloadWorkbookPDF": "utableau", "QueryViewPDF": "utableau", "DownloadWorkbookPPT": "utableau", "DownloadViewCrosstabExcel": "utableau", "DownloadWorkbook": "utableau",
  "TerminalMoveCursor": "uterminal", "TerminalGetTextAtPosition": "uterminal", "TerminalFindTextInScreen": "uterminal", "TerminalGetText": "uterminal", "TerminalGetField": "uterminal", "TerminalGetScreenArea": "uterminal", "TerminalMoveCursorToText": "uterminal", "TerminalWaitScreenText": "uterminal", "TerminalSession": "uterminal", "TerminalSendControlKey": "uterminal", "TerminalWaitTextAtPosition": "uterminal", "TerminalSendKeys": "uterminal", "TerminalWaitScreenReady": "uterminal", "TerminalSetFieldAtPosition": "uterminal", "TerminalSendKeysSecure": "uterminal", "TerminalGetCursorPosition": "uterminal", "TerminalGetFieldAtPosition": "uterminal", "TerminalGetColorAtPosition": "uterminal", "TerminalSetField": "uterminal", "TerminalWaitFieldText": "uterminal",
  "TwilioScopeActivity": "utwilio", "SendMessageActivity": "utwilio",
  "MakeCall": "utwiliois", "SendWhatsappMessage": "utwiliois", "AvailablePhoneNumbersTollFree": "utwiliois", "AvailablePhoneNumbersMobile": "utwiliois", "AvailablePhoneNumbersLocal": "utwiliois", "SendMessage": "utwiliois",
  "SearchTweets": "utwitter", "FollowUser": "utwitter", "ListAllUserMentions": "utwitter", "ListAllFollowers": "utwitter", "GetTweet": "utwitter", "ListAllUserTweets": "utwitter", "Getuser": "utwitter", "SendTweet": "utwitter", "UnfollowUser": "utwitter", "Retweet": "utwitter", "UnlikeTweet": "utwitter", "RemoveRetweet": "utwitter", "ListAllUserRetweeted": "utwitter", "RemoveTweet": "utwitter", "GetUserUsername": "utwitter", "ListUsersByUsernames": "utwitter", "ListAllFollowing": "utwitter", "ListAllUserLiked": "utwitter", "LikeTweet": "utwitter", "CurrentUser": "utwitter",
  "GenerateTextCompletion": "uvertex", "GenerateChatCompletion": "uvertex",
  "CreatePreHire": "uwdis", "ListAllOpenPositions": "uwdis", "CreatePosition": "uwdis", "HireEmployee": "uwdis", "GetPreHireByEmail": "uwdis",
  "GetMyInfo": "uwebex", "DeleteMessage": "uwebex", "FindFirstMessage": "uwebex", "ListAllMessages": "uwebex", "RemoveUser": "uwebex", "ListUser": "uwebex", "SendDirectMessage": "uwebex", "GetMessage": "uwebex", "InviteUser": "uwebex", "SendGroupMessage": "uwebex", "UpdateMessage": "uwebex", "GetUser": "uwebex", "ListMessages": "uwebex",
  "WorkatoScopeActivity": "uworkato", "StartRecipe": "uworkato", "GetRecipeDetails": "uworkato", "InvokeEndpoint": "uworkato", "ListConnections": "uworkato", "StopRecipe": "uworkato", "ListRecipes": "uworkato",
  "TicketsMetrics": "uzendesk", "ShowFile": "uzendesk", "ListAllTicketComments": "uzendesk", "ReplaceTicket": "uzendesk", "ReplaceGroup": "uzendesk", "ReplaceUser": "uzendesk", "ListAllRecentTickets": "uzendesk", "CreateTicketComment": "uzendesk",
  "ScheduleRecurringDailyMeeting": "uzoom", "ScheduleOneTimeMeeting": "uzoom", "InviteMeetingRegistrant": "uzoom", "ScheduleRecurringWeeklyMeeting": "uzoom", "ScheduleRecurringMonthlyMeeting": "uzoom", "GetRecording": "uzoom", "CreateInvitationLink": "uzoom",
};

export function resolveActivityToPackage(activityName: string): string | null {
  const prefix = GUARANTEED_ACTIVITY_PREFIX_MAP[activityName];
  if (prefix === undefined) {
    if (SYSTEM_ACTIVITIES_NO_PREFIX.has(activityName)) return "System.Activities";
    if (catalogService.isLoaded()) {
      const schema = catalogService.getActivitySchema(activityName);
      if (schema) {
        getFilteredSchema(activityName, "xaml-compliance", _complianceTargetFramework);
        return schema.packageId;
      }
    }
    return null;
  }

  const matchingPackages: string[] = [];
  const pkgEntries = Object.entries(PACKAGE_NAMESPACE_MAP);
  for (let i = 0; i < pkgEntries.length; i++) {
    if (pkgEntries[i][1].prefix === prefix) {
      matchingPackages.push(pkgEntries[i][0]);
    }
  }

  if (matchingPackages.length === 1) return matchingPackages[0];

  if (catalogService.isLoaded()) {
    const schema = catalogService.getActivitySchema(activityName);
    if (schema) {
      getFilteredSchema(activityName, "xaml-compliance", _complianceTargetFramework);
      return schema.packageId;
    }
  }

  const registryPackage = getActivityPackageFromRegistry(activityName);
  if (registryPackage && matchingPackages.includes(registryPackage)) {
    return registryPackage;
  }

  return matchingPackages.length > 0 ? matchingPackages[0] : null;
}

export function getActivityPrefixStrict(templateName: string): string | null {
  if (SYSTEM_ACTIVITIES_NO_PREFIX.has(templateName)) return "";

  if (catalogService.isLoaded()) {
    getFilteredSchema(templateName, "xaml-compliance", _complianceTargetFramework);

    const catalogPrefix = catalogService.getPrefixForActivity(templateName);
    if (catalogPrefix !== null) return catalogPrefix;

    const nsInfo = catalogService.getNamespaceInfoForActivity(templateName);
    if (nsInfo) return nsInfo.prefix;

    const schema = catalogService.getActivitySchema(templateName);
    if (schema) {
      const pkgInfo = PACKAGE_NAMESPACE_MAP[schema.packageId];
      if (pkgInfo) return pkgInfo.prefix;
    }
  }

  if (GUARANTEED_ACTIVITY_PREFIX_MAP[templateName] !== undefined) {
    return GUARANTEED_ACTIVITY_PREFIX_MAP[templateName];
  }

  return null;
}

export function getActivityTag(templateName: string): string {
  const strictPrefix = getActivityPrefixStrict(templateName);
  if (strictPrefix === null) {
    throw new Error(`[XAML Compliance] getActivityTag("${templateName}"): no namespace mapping found — activity is unmapped and cannot be emitted safely. Add it to GUARANTEED_ACTIVITY_PREFIX_MAP or the activity catalog.`);
  }
  return strictPrefix ? `${strictPrefix}:${templateName}` : templateName;
}

export function resolvePackageNamespaceInfo(packageId: string): PackageNamespaceInfo | null {
  if (catalogService.isLoaded()) {
    const catalogInfo = catalogService.getPackageNamespaceInfo(packageId);
    if (catalogInfo) {
      return {
        prefix: catalogInfo.prefix,
        clrNamespace: catalogInfo.clrNamespace,
        assembly: catalogInfo.assembly,
        xmlns: `clr-namespace:${catalogInfo.clrNamespace};assembly=${catalogInfo.assembly}`,
      };
    }
  }
  return PACKAGE_NAMESPACE_MAP[packageId] || null;
}

export function collectUsedPackages(xaml: string): Set<string> {
  const usedPackages = new Set<string>();

  const canonicalPrefixToPackage = new Map<string, string>();

  if (catalogService.isLoaded()) {
    for (const entry of catalogService.getAllPackageNamespaceEntries()) {
      if (!entry.prefix) continue;
      if (entry.prefix === "ui") {
        if (!canonicalPrefixToPackage.has(entry.prefix)) {
          canonicalPrefixToPackage.set(entry.prefix, entry.packageId);
        }
        continue;
      }
      if (!canonicalPrefixToPackage.has(entry.prefix)) {
        canonicalPrefixToPackage.set(entry.prefix, entry.packageId);
      }
      const prefixPattern = new RegExp(`<${entry.prefix}:`, "g");
      if (prefixPattern.test(xaml)) {
        usedPackages.add(entry.packageId);
      }
    }
  }

  for (const [packageId, info] of Object.entries(PACKAGE_NAMESPACE_MAP)) {
    if (!info.prefix) continue;
    if (info.prefix === "ui") {
      if (!canonicalPrefixToPackage.has(info.prefix)) {
        canonicalPrefixToPackage.set(info.prefix, packageId);
      }
      continue;
    }
    if (!canonicalPrefixToPackage.has(info.prefix)) {
      canonicalPrefixToPackage.set(info.prefix, packageId);
    }
    const prefixPattern = new RegExp(`<${info.prefix}:`, "g");
    if (prefixPattern.test(xaml)) {
      usedPackages.add(packageId);
    }
  }

  for (const [alias, canonical] of Object.entries(PREFIX_ALIAS_MAP)) {
    const aliasPattern = new RegExp(`<${alias}:`, "g");
    if (aliasPattern.test(xaml)) {
      const packageId = canonicalPrefixToPackage.get(canonical);
      if (packageId) {
        usedPackages.add(packageId);
      }
    }
  }

  if (/<ui:/.test(xaml)) {
    const uiActivityPattern = /<ui:(\w+)[\s>\/]/g;
    let uiMatch;
    const resolvedUiPackages = new Set<string>();
    while ((uiMatch = uiActivityPattern.exec(xaml)) !== null) {
      const activityName = uiMatch[1];
      const pkg = resolveActivityToPackage(activityName);
      if (pkg) {
        resolvedUiPackages.add(pkg);
      }
    }
    if (resolvedUiPackages.size > 0) {
      Array.from(resolvedUiPackages).forEach(pkg => usedPackages.add(pkg));
    } else {
      usedPackages.add("UiPath.System.Activities");
    }
  }

  return usedPackages;
}

export function buildDynamicXmlnsDeclarations(usedPackages: Set<string>, isCrossPlatform: boolean, existingXml?: string): string {
  const lines: string[] = [];
  const existingPrefixes = new Set<string>();

  if (existingXml) {
    const prefixPattern = /xmlns:(\w+)="/g;
    let m;
    while ((m = prefixPattern.exec(existingXml)) !== null) {
      existingPrefixes.add(m[1]);
    }
  }

  Array.from(usedPackages).forEach(packageId => {
    const info = resolvePackageNamespaceInfo(packageId);
    if (!info || !info.prefix || info.prefix === "ui" || info.prefix === "") return;
    if (existingPrefixes.has(info.prefix)) return;
    lines.push(`  xmlns:${info.prefix}="${info.xmlns}"`);
  });

  return lines.join("\n");
}

export function buildDynamicAssemblyRefs(usedPackages: Set<string>, existingXml?: string): string {
  const refs: string[] = [];
  const existingRefs = new Set<string>();

  if (existingXml) {
    const refPattern = /<AssemblyReference>([^<]+)<\/AssemblyReference>/g;
    let m;
    while ((m = refPattern.exec(existingXml)) !== null) {
      existingRefs.add(m[1]);
    }
  }

  Array.from(usedPackages).forEach(packageId => {
    const info = resolvePackageNamespaceInfo(packageId);
    if (!info) return;
    if (existingRefs.has(info.assembly)) return;
    refs.push(`      <AssemblyReference>${info.assembly}</AssemblyReference>`);
  });

  if (usedPackages.has("UiPath.WebAPI.Activities") && !existingRefs.has("Newtonsoft.Json")) {
    refs.push(`      <AssemblyReference>Newtonsoft.Json</AssemblyReference>`);
  }

  return refs.join("\n");
}

export function buildDynamicNamespaceImports(usedPackages: Set<string>, existingXml?: string): string {
  const imports: string[] = [];
  const existingNamespaces = new Set<string>();

  if (existingXml) {
    const nsPattern = /<x:String[^>]*>([^<]+)<\/x:String>/g;
    let m;
    while ((m = nsPattern.exec(existingXml)) !== null) {
      existingNamespaces.add(m[1].trim());
    }
  }

  Array.from(usedPackages).forEach(packageId => {
    const info = resolvePackageNamespaceInfo(packageId);
    if (!info) return;
    if (existingNamespaces.has(info.clrNamespace)) return;
    imports.push(`      <x:String>${info.clrNamespace}</x:String>`);
  });

  if (usedPackages.has("UiPath.WebAPI.Activities")) {
    if (!existingNamespaces.has("Newtonsoft.Json")) {
      imports.push(`      <x:String>Newtonsoft.Json</x:String>`);
    }
    if (!existingNamespaces.has("Newtonsoft.Json.Linq")) {
      imports.push(`      <x:String>Newtonsoft.Json.Linq</x:String>`);
    }
  }

  return imports.join("\n");
}

export interface DeclarationInsertionResult {
  updated: string;
  succeeded: boolean;
}

export function insertBeforeClosingCollectionTag(
  xml: string,
  closingParentTag: string,
  contentToInsert: string,
): DeclarationInsertionResult {
  const escapedParent = closingParentTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const primaryPattern = new RegExp(`<\\/sco:Collection>\\s*${escapedParent}`);
  const primaryMatch = xml.match(primaryPattern);
  if (primaryMatch && primaryMatch.index !== undefined) {
    const updated = xml.slice(0, primaryMatch.index) + contentToInsert + "\n" + xml.slice(primaryMatch.index);
    return { updated, succeeded: true };
  }

  const parentIdx = xml.indexOf(closingParentTag);
  if (parentIdx >= 0) {
    const openingTagName = closingParentTag.slice(2, -1);
    const openingPattern = new RegExp(`<${openingTagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s>]`);
    const openingMatch = xml.match(openingPattern);
    const blockStart = openingMatch ? openingMatch.index! : 0;
    const regionWithinBlock = xml.slice(blockStart, parentIdx);
    const collectionCloseRelIdx = regionWithinBlock.lastIndexOf("</sco:Collection>");
    if (collectionCloseRelIdx >= 0) {
      const absoluteIdx = blockStart + collectionCloseRelIdx;
      const updated = xml.slice(0, absoluteIdx) + contentToInsert + "\n" + xml.slice(absoluteIdx);
      return { updated, succeeded: true };
    }
  }

  return { updated: xml, succeeded: false };
}

export interface AuthoritativeDeclarationResult {
  neededPackages: Set<string>;
  neededAssemblies: Set<string>;
  neededNamespaces: Set<string>;
  neededXmlns: Map<string, string>;
  activitiesDetected: string[];
}

export function deriveRequiredDeclarationsForXaml(content: string): AuthoritativeDeclarationResult {
  const neededPackages = new Set<string>();
  const neededAssemblies = new Set<string>();
  const neededNamespaces = new Set<string>();
  const neededXmlns = new Map<string, string>();
  const activitiesDetected: string[] = [];
  const seenActivities = new Set<string>();

  const SKIP_PREFIXES = new Set(["xmlns", "xml", "x", "sap", "sap2010", "mc", "s", "scg", "sco", "mva", "sads", "scg2"]);

  const activityTagPattern = /<(\w+):(\w+)[\s>\/]/g;
  let atm;
  while ((atm = activityTagPattern.exec(content)) !== null) {
    const prefix = atm[1];
    const activityName = atm[2];
    if (SKIP_PREFIXES.has(prefix)) continue;

    const activityKey = `${prefix}:${activityName}`;
    if (seenActivities.has(activityKey)) continue;
    seenActivities.add(activityKey);
    activitiesDetected.push(activityKey);

    let matchedPackage: string | null = null;

    if (prefix === "ui") {
      matchedPackage = resolveActivityToPackage(activityName);
    }

    if (!matchedPackage) {
      for (const [pkgId, info] of Object.entries(PACKAGE_NAMESPACE_MAP)) {
        if (info.prefix === prefix) {
          matchedPackage = pkgId;
          break;
        }
      }
    }

    if (matchedPackage) {
      neededPackages.add(matchedPackage);
      const info = PACKAGE_NAMESPACE_MAP[matchedPackage];
      if (info) {
        if (info.assembly) neededAssemblies.add(info.assembly);
        if (info.clrNamespace) neededNamespaces.add(info.clrNamespace);
        if (info.prefix && info.xmlns && !neededXmlns.has(info.prefix)) {
          neededXmlns.set(info.prefix, info.xmlns);
        }
      }
    }
  }

  if (neededPackages.has("UiPath.System.Activities") || neededPackages.has("UiPath.UIAutomation.Activities")) {
    neededPackages.add("UiPath.System.Activities");
    neededPackages.add("UiPath.UIAutomation.Activities");

    const sysInfo = PACKAGE_NAMESPACE_MAP["UiPath.System.Activities"];
    if (sysInfo) {
      if (sysInfo.assembly) neededAssemblies.add(sysInfo.assembly);
      if (sysInfo.clrNamespace) neededNamespaces.add(sysInfo.clrNamespace);
    }
    const uiInfo = PACKAGE_NAMESPACE_MAP["UiPath.UIAutomation.Activities"];
    if (uiInfo) {
      if (uiInfo.assembly) neededAssemblies.add(uiInfo.assembly);
      if (uiInfo.clrNamespace) neededNamespaces.add(uiInfo.clrNamespace);
    }
  }

  return { neededPackages, neededAssemblies, neededNamespaces, neededXmlns, activitiesDetected };
}

export function convertMixedLiteralBracketToConcat(val: string): string | null {
  if (!val.includes("[") || !val.includes("]")) return null;

  let inner = val;
  if (inner.startsWith('"') && inner.endsWith('"')) {
    inner = inner.substring(1, inner.length - 1);
  }

  if (inner.startsWith("[") && inner.endsWith("]") && inner.indexOf("]") === inner.length - 1) return null;

  const hasLeadingLiteral = /^[^[]+\[/.test(inner);
  const hasTrailingLiteral = /\][^[\]]+$/.test(inner);
  const hasBracketExpr = /\[[^\]]+\]/.test(inner);
  if (!hasBracketExpr) return null;
  if (!hasLeadingLiteral && !hasTrailingLiteral) {
    if (inner.startsWith("[") && inner.endsWith("]")) return null;
  }

  const parts: string[] = [];
  const bracketPattern = /\[([^\]]+)\]/g;
  let match;
  let lastIdx = 0;
  bracketPattern.lastIndex = 0;
  while ((match = bracketPattern.exec(inner)) !== null) {
    if (match.index > lastIdx) {
      const literal = inner.substring(lastIdx, match.index).replace(/"/g, '""');
      parts.push(`"${literal}"`);
    }
    parts.push(match[1]);
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < inner.length) {
    const literal = inner.substring(lastIdx).replace(/"/g, '""');
    parts.push(`"${literal}"`);
  }
  if (parts.length <= 1) return null;
  return `[${parts.join(" & ")}]`;
}

export function ensureBracketWrapped(val: string, isDeclared?: (name: string) => boolean): string {
  const trimmed = val.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed;
  if (trimmed.startsWith("<InArgument") || trimmed.startsWith("<OutArgument")) return trimmed;
  if (trimmed.startsWith("\"") || trimmed.startsWith("'")) return trimmed;
  if (/^\d+$/.test(trimmed)) return trimmed;
  if (trimmed === "True" || trimmed === "False" || trimmed === "Nothing" || trimmed === "null") return trimmed;

  const mixedConcat = convertMixedLiteralBracketToConcat(trimmed);
  if (mixedConcat) return mixedConcat;

  if (/^TimeSpan\.\w+/i.test(trimmed)) return `[${trimmed}]`;

  if (looksLikePlainText(trimmed, isDeclared)) {
    const escaped = trimmed.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return `[${trimmed}]`;
}

export function looksLikeVariableRef(val: string): boolean {
  const trimmed = val.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return false;
  if (/^[0-9]/.test(trimmed)) return false;
  if (/^".*"$/.test(trimmed)) return false;
  if (/^&quot;/.test(trimmed)) return false;
  if (trimmed === "True" || trimmed === "False" || trimmed === "Nothing" || trimmed === "null" || trimmed === "") return false;
  if (/^[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)*$/.test(trimmed)) return true;
  return false;
}

export function smartBracketWrap(val: string, isDeclared?: (name: string) => boolean): string {
  const trimmed = val.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed;
  if (trimmed.startsWith("<InArgument") || trimmed.startsWith("<OutArgument")) return trimmed;
  if (/^".*"$/.test(trimmed)) {
    const inner = trimmed.slice(1, -1);
    if (/^New\s+\w/.test(inner)) {
      return `[${inner}]`;
    }
    return trimmed;
  }
  if (/^'.*'$/.test(trimmed)) return trimmed;
  if (/^&quot;.*&quot;$/.test(trimmed)) return trimmed;
  if (trimmed === "True" || trimmed === "False" || trimmed === "Nothing" || trimmed === "null") return trimmed;
  if (/^[0-9]+$/.test(trimmed)) return trimmed;
  if (/^New\s+\w/.test(trimmed)) return `[${trimmed}]`;
  if (/^TimeSpan\.\w+/i.test(trimmed)) return `[${trimmed}]`;
  if (/&quot;|&amp;|&lt;|&gt;/.test(trimmed)) return `[${trimmed}]`;

  const mixedConcat = convertMixedLiteralBracketToConcat(trimmed);
  if (mixedConcat) return mixedConcat;

  if (looksLikePlainText(trimmed, isDeclared)) {
    const escaped = trimmed.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return `[${trimmed}]`;
}

export const BARE_WORD_LITERALS_SET = new Set([
  "yes", "no", "normal", "high", "low", "info", "warn", "error", "trace", "fatal",
  "none", "default", "verbose", "debug", "warning", "information", "critical",
  "success", "failed", "pending", "completed", "cancelled", "skipped",
  "sent", "received", "processed", "queued", "active", "inactive",
  "approved", "rejected", "open", "closed", "new", "updated", "deleted",
  "successful", "running", "stopped", "started", "finished", "ready",
]);

export function looksLikePlainText(val: string, isDeclared?: (name: string) => boolean): boolean {
  if (/^[a-zA-Z_]\w*\(/.test(val)) return false;
  if (/[+\-*/&=<>]/.test(val) && !/[.,!?;:'"…]/.test(val)) return false;
  if (/^(str_|int_|bool_|dbl_|dec_|obj_|dt_|ts_|drow_|qi_|sec_)/i.test(val)) return false;
  if (/^(in_|out_|io_)/i.test(val)) return false;
  if (BARE_WORD_LITERALS_SET.has(val.toLowerCase())) return true;
  if (/\b[\w_]+\.(json|xml|xlsx|csv|txt|log|config|pdf|html|xaml)\b/i.test(val)) return true;
  if (/\w+\/\w+\/\w+/.test(val)) return true;
  if (/\u2014/.test(val)) return true;
  if (/^[a-zA-Z_]\w*\.[a-zA-Z_]\w*/.test(val) && !/\s/.test(val)) return false;
  if (/\s/.test(val) || /[.,!?;:()'"…]/.test(val)) return true;
  if (/^[a-zA-Z_]\w*$/.test(val) && !/^(str_|int_|bool_|dbl_|dec_|obj_|dt_|ts_|drow_|qi_|sec_)/i.test(val)) {
    if (isDeclared && isDeclared(val)) {
      return false;
    }
    if (isDeclared && !isDeclared(val)) {
      return true;
    }
    return false;
  }
  return false;
}

let _clrNamespaceToXamlPrefixCache: Record<string, string> | null = null;
let _clrNamespaceToXamlPrefixCatalogLoaded: boolean | null = null;

function buildClrNamespaceToXamlPrefixFallback(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [, info] of Object.entries(PACKAGE_NAMESPACE_MAP)) {
    if (info.prefix && info.clrNamespace) {
      if (!map[info.clrNamespace]) {
        map[info.clrNamespace] = info.prefix;
      }
    }
  }
  map["UiPath.Core"] = "ui";
  map["UiPath.Core.Activities"] = "ui";
  return map;
}

export function getClrNamespaceToXamlPrefix(): Record<string, string> {
  const catalogLoaded = catalogService.isLoaded();

  if (_clrNamespaceToXamlPrefixCache && _clrNamespaceToXamlPrefixCatalogLoaded === catalogLoaded) {
    return _clrNamespaceToXamlPrefixCache;
  }

  if (!catalogLoaded) {
    _clrNamespaceToXamlPrefixCache = buildClrNamespaceToXamlPrefixFallback();
    _clrNamespaceToXamlPrefixCatalogLoaded = false;
    return _clrNamespaceToXamlPrefixCache;
  }

  const map: Record<string, string> = {};
  const catalogEntries = catalogService.getAllPackageNamespaceEntries();
  const clrMetadata: Record<string, { packageId: string; prefix: string; assembly: string }> = {};
  for (const entry of catalogEntries) {
    if (entry.prefix && entry.clrNamespace) {
      if (!map[entry.clrNamespace]) {
        map[entry.clrNamespace] = entry.prefix;
        clrMetadata[entry.clrNamespace] = { packageId: entry.packageId, prefix: entry.prefix, assembly: entry.assembly };
      }
    }
  }
  map["UiPath.Core"] = "ui";
  map["UiPath.Core.Activities"] = "ui";

  const fallbackMap = buildClrNamespaceToXamlPrefixFallback();
  for (const [clrNs, prefix] of Object.entries(fallbackMap)) {
    if (!map[clrNs]) {
      map[clrNs] = prefix;
    } else if (map[clrNs] !== prefix) {
      const meta = clrMetadata[clrNs];
      _namespaceMismatchDiagnostics.push({
        type: "clr-namespace-to-prefix",
        key: clrNs,
        catalogValue: map[clrNs],
        fallbackValue: prefix,
        sourceSelected: "catalog",
        packageId: meta?.packageId,
        prefix: meta?.prefix,
        clrNamespace: clrNs,
        assembly: meta?.assembly,
        fallbackReason: "catalog prefix differs from hardcoded PACKAGE_NAMESPACE_MAP prefix for this CLR namespace",
      });
    }
  }

  _clrNamespaceToXamlPrefixCache = map;
  _clrNamespaceToXamlPrefixCatalogLoaded = true;
  return map;
}

export const CLR_NAMESPACE_TO_XAML_PREFIX: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_target, prop: string) {
    return getClrNamespaceToXamlPrefix()[prop];
  },
  has(_target, prop: string) {
    return prop in getClrNamespaceToXamlPrefix();
  },
  ownKeys() {
    return Object.keys(getClrNamespaceToXamlPrefix());
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    const map = getClrNamespaceToXamlPrefix();
    if (prop in map) {
      return { value: map[prop], writable: false, enumerable: true, configurable: true };
    }
    return undefined;
  },
});

const UIPATH_NAMESPACES = `xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:mva="clr-namespace:Microsoft.VisualBasic.Activities;assembly=System.Activities"
  xmlns:s="clr-namespace:System;assembly=System.Private.CoreLib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=System.Private.CoreLib"
  xmlns:scg2="clr-namespace:System.Data;assembly=System.Data"
  xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=System.Private.CoreLib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:uix="http://schemas.uipath.com/workflow/activities/uix"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"`;

const UIPATH_CROSS_PLATFORM_NAMESPACES = `xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:s="clr-namespace:System;assembly=System.Runtime"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=System.Runtime"
  xmlns:scg2="clr-namespace:System.Data;assembly=System.Data.Common"
  xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=System.Runtime"
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
      <AssemblyReference>System.Activities.Core.Presentation</AssemblyReference>
      <AssemblyReference>Microsoft.VisualBasic</AssemblyReference>
      <AssemblyReference>mscorlib</AssemblyReference>
      <AssemblyReference>System.Data</AssemblyReference>
      <AssemblyReference>System</AssemblyReference>
      <AssemblyReference>System.Core</AssemblyReference>
      <AssemblyReference>System.Xml</AssemblyReference>
      <AssemblyReference>System.Xml.Linq</AssemblyReference>
      <AssemblyReference>UiPath.Core</AssemblyReference>
      <AssemblyReference>UiPath.Core.Activities</AssemblyReference>
      <AssemblyReference>UiPath.System.Activities</AssemblyReference>
      <AssemblyReference>UiPath.UIAutomation.Activities</AssemblyReference>
    </sco:Collection>
  </TextExpression.ReferencesForImplementation>`;

const UIPATH_CSHARP_SETTINGS = `
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
    </sco:Collection>
  </TextExpression.NamespacesForImplementation>
  <TextExpression.ReferencesForImplementation>
    <sco:Collection x:TypeArguments="AssemblyReference">
      <AssemblyReference>System.Runtime</AssemblyReference>
      <AssemblyReference>System.Activities.Core.Presentation</AssemblyReference>
      <AssemblyReference>System.Data.Common</AssemblyReference>
      <AssemblyReference>System.Xml.Linq</AssemblyReference>
      <AssemblyReference>UiPath.Core</AssemblyReference>
      <AssemblyReference>UiPath.Core.Activities</AssemblyReference>
      <AssemblyReference>UiPath.System.Activities</AssemblyReference>
      <AssemblyReference>UiPath.UIAutomation.Activities</AssemblyReference>
    </sco:Collection>
  </TextExpression.ReferencesForImplementation>`;

export function parseInvokeArgs(rawValue: string, direction: "In" | "Out" | "InOut"): string {
  const decoded = rawValue.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  const cleaned = decoded.replace(/^\{\s*/, "").replace(/\s*\}$/, "").trim();
  if (!cleaned) return "";

  let result = "";
  const argType = direction === "In" ? "InArgument" : direction === "Out" ? "OutArgument" : "InOutArgument";

  const pairPattern = /(?:^|,)\s*"([^"]+)"\s*:\s*("(?:[^"\\]|\\.)*"|[^,}]+)/g;
  let m;
  while ((m = pairPattern.exec(cleaned)) !== null) {
    const key = m[1].trim();
    let val = m[2].trim().replace(/^["']|["']$/g, "");
    if (!key) continue;
    if (!val.startsWith("[")) val = `[${val}]`;
    result += `                <${argType} x:TypeArguments="x:String" x:Key="${escapeXml(key)}">${escapeXmlTextContent(val)}</${argType}>\n`;
  }

  if (!result) {
    const simplePairs = cleaned.split(/,\s*/);
    for (const pair of simplePairs) {
      const colonIdx = pair.indexOf(":");
      if (colonIdx < 0) continue;
      const key = pair.substring(0, colonIdx).trim().replace(/^["']|["']$/g, "");
      let val = pair.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!key) continue;
      if (!val.startsWith("[")) val = `[${val}]`;
      result += `                <${argType} x:TypeArguments="x:String" x:Key="${escapeXml(key)}">${escapeXmlTextContent(val)}</${argType}>\n`;
    }
  }

  return result;
}

export function collapseDoubledArgumentsXmlParser(xml: string): string {
  const argTags = ["InArgument", "OutArgument", "InOutArgument"];
  const MAX_PASSES = 20;

  for (const tag of argTags) {
    let pass = 0;
    while (pass < MAX_PASSES) {
      const before = xml;
      const outerPattern = new RegExp(
        `<${tag}(\\s[^>]*)?>\\s*<${tag}(\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>\\s*<\\/${tag}>`,
        "g"
      );
      xml = xml.replace(outerPattern, (_match, outerAttrs, innerAttrs, content) => {
        const attrs = ((innerAttrs || outerAttrs) || "").trim();
        const trimmedContent = content.trim();
        return `<${tag}${attrs ? " " + attrs : ""}>${trimmedContent}</${tag}>`;
      });

      const outerNewlinePattern = new RegExp(
        `<${tag}(\\s[^>]*)?>\\s*\\n\\s*<${tag}(\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>\\s*\\n\\s*<\\/${tag}>`,
        "g"
      );
      xml = xml.replace(outerNewlinePattern, (_match, outerAttrs, innerAttrs, content) => {
        const attrs = ((innerAttrs || outerAttrs) || "").trim();
        const trimmedContent = content.trim();
        return `<${tag}${attrs ? " " + attrs : ""}>${trimmedContent}</${tag}>`;
      });

      if (xml === before) break;
      pass++;
      if (pass > 1) {
        console.log(`[XAML Compliance] collapseDoubledArguments: pass ${pass} for <${tag}> — collapsing deeply nested wrappers`);
      }
    }
  }

  for (const tag of argTags) {
    const nestedPattern = new RegExp(`<${tag}[^>]*>\\s*<${tag}[\\s\\S]*?<\\/${tag}>\\s*<\\/${tag}>`);
    if (nestedPattern.test(xml)) {
      console.warn(`[XAML Compliance] Post-collapse: nested <${tag}> still detected — applying brute-force strip`);
      let stripPass = 0;
      while (stripPass < MAX_PASSES) {
        const beforeStrip = xml;
        xml = xml.replace(new RegExp(`(<${tag}[^>]*>)\\s*<${tag}[^>]*>`, "g"), "$1");
        xml = xml.replace(new RegExp(`<\\/${tag}>\\s*(<\\/${tag}>)`, "g"), "$1");
        if (xml === beforeStrip) break;
        stripPass++;
      }

      if (nestedPattern.test(xml)) {
        const errorMsg = `[XAML Compliance] FATAL: nested <${tag}> persists after ${MAX_PASSES} collapse passes — XAML is malformed`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
    }
  }

  return xml;
}

export function normalizeAssignArgumentNesting(xml: string): string {
  const nestedOutInTo = /<Assign\.To>\s*<OutArgument([^>]*)>\s*<OutArgument[\s\S]*?<\/OutArgument>\s*<\/OutArgument>\s*<\/Assign\.To>/;
  const nestedInInValue = /<Assign\.Value>\s*<InArgument([^>]*)>\s*<InArgument[\s\S]*?<\/InArgument>\s*<\/InArgument>\s*<\/Assign\.Value>/;
  let passes = 0;
  const MAX = 20;

  while (passes < MAX && (nestedOutInTo.test(xml) || nestedInInValue.test(xml))) {
    xml = xml.replace(
      /<Assign\.To>([\s\S]*?)<\/Assign\.To>/g,
      (_match, inner) => {
        let content = inner;
        let stripped = true;
        while (stripped) {
          stripped = false;
          content = content.replace(
            /<OutArgument([^>]*)>\s*<OutArgument([^>]*)>([\s\S]*?)<\/OutArgument>\s*<\/OutArgument>/g,
            (_m: string, outerAttrs: string, innerAttrs: string, c: string) => {
              stripped = true;
              const attrs = (innerAttrs || outerAttrs).trim();
              return `<OutArgument${attrs ? " " + attrs : ""}>${c.trim()}</OutArgument>`;
            }
          );
        }
        return `<Assign.To>${content}</Assign.To>`;
      }
    );

    xml = xml.replace(
      /<Assign\.Value>([\s\S]*?)<\/Assign\.Value>/g,
      (_match, inner) => {
        let content = inner;
        let stripped = true;
        while (stripped) {
          stripped = false;
          content = content.replace(
            /<InArgument([^>]*)>\s*<InArgument([^>]*)>([\s\S]*?)<\/InArgument>\s*<\/InArgument>/g,
            (_m: string, outerAttrs: string, innerAttrs: string, c: string) => {
              stripped = true;
              const attrs = (innerAttrs || outerAttrs).trim();
              return `<InArgument${attrs ? " " + attrs : ""}>${c.trim()}</InArgument>`;
            }
          );
        }
        return `<Assign.Value>${content}</Assign.Value>`;
      }
    );

    passes++;
  }

  if (nestedOutInTo.test(xml) || nestedInInValue.test(xml)) {
    throw new Error(`[XAML Compliance] FATAL: Assign argument nesting persists after ${MAX} normalization passes — XAML is malformed`);
  }

  const assignToBlocks = xml.match(/<Assign\.To>[\s\S]*?<\/Assign\.To>/g) || [];
  for (const block of assignToBlocks) {
    const outArgCount = (block.match(/<OutArgument[\s>]/g) || []).length;
    if (outArgCount === 0) {
      throw new Error(`[XAML Compliance] Assign.To missing <OutArgument> wrapper: ${block.slice(0, 200)}`);
    }
    if (outArgCount > 1) {
      throw new Error(`[XAML Compliance] Assign.To has ${outArgCount} <OutArgument> wrappers (expected 1): ${block.slice(0, 200)}`);
    }
  }

  const assignValueBlocks = xml.match(/<Assign\.Value>[\s\S]*?<\/Assign\.Value>/g) || [];
  for (const block of assignValueBlocks) {
    const inArgCount = (block.match(/<InArgument[\s>]/g) || []).length;
    if (inArgCount === 0) {
      throw new Error(`[XAML Compliance] Assign.Value missing <InArgument> wrapper: ${block.slice(0, 200)}`);
    }
    if (inArgCount > 1) {
      throw new Error(`[XAML Compliance] Assign.Value has ${inArgCount} <InArgument> wrappers (expected 1): ${block.slice(0, 200)}`);
    }
  }

  return xml;
}

const VB_RESERVED_WORDS = new Set([
  "true", "false", "nothing", "null", "not", "and", "or", "andalso", "orelse",
  "is", "isnot", "if", "ctype", "directcast", "gettype", "typeof", "new",
  "throw", "string", "integer", "boolean", "double", "object", "datetime",
  "math", "convert", "int32", "int64", "exception", "system", "console",
  "environment", "char", "byte", "short", "long", "single", "decimal", "date",
  "timespan", "array", "type", "enum", "dictionary", "list", "cstr", "cint",
  "cdbl", "cbool", "cdate", "clng", "csng", "cdec", "cbyte", "cshort", "cchar",
  "mod", "like", "xor", "me", "mybase", "addressof", "dim", "as", "of", "from",
  "where", "select", "in", "step", "to", "byval", "byref", "optional",
  "paramarray", "handles", "implements", "inherits", "overrides", "overloads",
  "mustoverride", "mustinherit", "shared", "static", "const", "readonly",
  "writeonly", "friend", "protected", "private", "public", "return", "exit",
  "continue", "do", "loop", "until", "wend", "each", "next", "case", "end",
  "sub", "function", "property", "event", "class", "structure", "module",
  "interface", "namespace", "imports", "try", "catch", "finally", "using",
  "with", "synclock", "raiseevent", "removehandler", "addhandler", "let",
  "set", "get", "then", "else", "elseif", "for", "while", "goto", "redim",
  "preserve", "erase", "stop", "on", "error", "resume", "option", "strict",
  "explicit", "compare", "binary", "text", "cbyte",
]);

const DOTNET_MEMBERS = new Set([
  "tostring", "substring", "length", "count", "rows", "message", "stacktrace",
  "name", "reference", "min", "max", "contains", "startswith", "endswith",
  "trim", "replace", "split", "join", "format", "parse", "tryparse", "now",
  "today", "utcnow", "adddays", "addhours", "item", "value", "key", "hasvalue",
  "result", "body", "subject", "content", "equals", "compareto", "indexof",
  "lastindexof", "remove", "insert", "padleft", "padright", "tolower", "toupper",
  "toarray", "tolist", "firstordefault", "lastordefault", "any", "all", "sum",
  "average", "orderby", "groupby", "concat", "append", "clear", "add",
  "addrange", "copyto", "clone", "dispose", "close", "flush", "read", "write",
  "seek", "getbytes", "getstring", "encode", "decode", "invoke", "execute",
  "cancel", "abort", "wait", "reset", "trygetvalue", "containskey", "keys",
  "values", "empty", "isnullorempty", "isnullorwhitespace", "toint32",
  "toint64", "todouble", "toboolean", "tosingle", "todecimal", "tobyte",
  "tochar", "tostring", "gettype", "gethashcode", "referenceequals",
  "memberwise", "finalize", "op_equality", "op_inequality",
]);

const XML_PREFIXES = new Set([
  "x", "s", "scg", "scg2", "ui", "sap", "sap2010", "mc", "mva", "sco",
  "sads", "sapv", "p", "local", "xmlns", "clr",
]);

function inferVariableTypeFromBindingContext(varName: string, xml: string): string | null {
  const escapedName = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const catchPattern = new RegExp(`<Catch\\s[^>]*>\\s*<Catch\\.Action>\\s*<ActivityAction[^>]*>\\s*<ActivityAction\\.Argument>\\s*<DelegateInArgument[^>]*Name="${escapedName}"`, "s");
  if (catchPattern.test(xml)) {
    const catchTypeMatch = xml.match(new RegExp(`<Catch\\s[^>]*x:TypeArguments="([^"]+)"[^>]*>[\\s\\S]*?Name="${escapedName}"`));
    if (catchTypeMatch) {
      return catchTypeMatch[1];
    }
    return "s:Exception";
  }

  const inArgPattern = new RegExp(`<InArgument\\s[^>]*x:TypeArguments="([^"]+)"[^>]*>\\s*\\[?${escapedName}\\]?\\s*</InArgument>`);
  const inArgMatch = xml.match(inArgPattern);
  if (inArgMatch) return inArgMatch[1];

  const outArgPattern = new RegExp(`<OutArgument\\s[^>]*x:TypeArguments="([^"]+)"[^>]*>\\s*\\[?${escapedName}\\]?\\s*</OutArgument>`);
  const outArgMatch = xml.match(outArgPattern);
  if (outArgMatch) return outArgMatch[1];

  const TEMPLATE_VAR_PATTERNS: Record<string, string> = {
    "currentItem": "x:Object",
    "retryAttempts": "x:Int32",
    "retryCount": "x:Int32",
    "rawResult": "x:String",
    "rawValue": "x:String",
    "transactionItem": "ui:QueueItem",
  };
  const templateType = TEMPLATE_VAR_PATTERNS[varName];
  if (templateType) return templateType;

  return null;
}

const KNOWN_DOTNET_TYPES = new Set([
  "string", "stringcomparer", "integer", "int32", "int64", "boolean", "double",
  "decimal", "byte", "char", "single", "object", "datetime", "timespan",
  "datatable", "datarow", "datacolumn", "dataset", "exception", "guid",
  "uri", "regex", "math", "convert", "environment", "path", "file",
  "directory", "console", "array", "list", "dictionary", "hashset",
  "queue", "stack", "tuple", "task", "thread", "encoding", "streamreader",
  "streamwriter", "xmldocument", "xmlnode", "jsonconvert", "jtoken", "jobject",
  "jarray", "activator", "type", "enumerable", "queryable",
  "stringbuilder", "memorystream", "filestream", "stopwatch",
  "cancellationtoken", "semaphore", "mutex",
]);

const DOMAIN_TERMS = new Set([
  "birthdays", "home", "personal", "work", "calendar", "events",
  "contacts", "settings", "inbox", "outbox", "drafts", "archive",
  "favorites", "categories", "labels", "tags", "notes", "tasks",
  "projects", "reports", "dashboard", "profile", "notifications",
  "messages", "files", "folders", "documents", "templates",
  "users", "groups", "roles", "permissions", "admin",
  "dispatcher", "performer", "transaction", "queue", "status",
  "config", "init", "setup", "cleanup", "process", "main",
  "retry", "exhausted", "completed", "pending", "failed",
  "yes", "no", "true", "false", "success", "error", "warning",
  "start", "stop", "open", "close", "save", "delete", "update",
  "input", "output", "result", "value", "item", "data", "name",
  "email", "password", "username", "login", "logout", "submit",
]);

const CONSTANT_PATTERNS = /^[A-Z][A-Z0-9_]+$/;

function isUnicodeEscapeFragment(token: string): boolean {
  if (/^[0-9a-fA-F]{2,5}$/.test(token)) return true;
  if (/^u[0-9a-fA-F]{4,5}$/.test(token)) return true;
  if (/^[A-Fa-f][0-9a-fA-F]{3}$/.test(token)) return true;
  return false;
}

function isExcludedToken(token: string): boolean {
  if (token.length <= 1) return true;
  const lower = token.toLowerCase();
  if (VB_RESERVED_WORDS.has(lower)) return true;
  if (DOTNET_MEMBERS.has(lower)) return true;
  if (XML_PREFIXES.has(lower)) return true;
  if (/^\d/.test(token)) return true;
  if (/^[A-Z][a-z]+[A-Z]/.test(token) === false && /^[A-Z]{2,}$/.test(token)) return true;
  if (isUnicodeEscapeFragment(token)) return true;
  if (KNOWN_DOTNET_TYPES.has(lower)) return true;
  if (DOMAIN_TERMS.has(lower)) return true;
  if (CONSTANT_PATTERNS.test(token)) return true;
  return false;
}

function findNearestEnclosingSequenceIndex(xml: string, refIndex: number): number {
  let bestIdx = -1;
  const seqPattern = /<Sequence\s[^>]*>/g;
  let sm;
  while ((sm = seqPattern.exec(xml)) !== null) {
    if (sm.index < refIndex) {
      const closeTag = "</Sequence>";
      const closeIdx = xml.indexOf(closeTag, sm.index);
      if (closeIdx === -1 || closeIdx > refIndex) {
        bestIdx = sm.index;
      }
    }
  }
  return bestIdx;
}

function ensureVariableDeclarations(xml: string): string {
  const declaredVars = new Set<string>();
  let m;

  const varDeclPattern = /<Variable\s[^>]*Name="([^"]+)"/g;
  while ((m = varDeclPattern.exec(xml)) !== null) declaredVars.add(m[1]);

  const delegatePattern = /<DelegateInArgument[^>]*Name="([^"]+)"/g;
  while ((m = delegatePattern.exec(xml)) !== null) declaredVars.add(m[1]);

  const propPattern = /<x:Property\s[^>]*Name="([^"]+)"/g;
  while ((m = propPattern.exec(xml)) !== null) declaredVars.add(m[1]);

  const argBindingPattern = /<(?:In|Out|InOut)Argument[^>]*>\s*\[?([a-zA-Z_]\w*)\]?\s*<\/(?:In|Out|InOut)Argument>/g;
  while ((m = argBindingPattern.exec(xml)) !== null) declaredVars.add(m[1]);

  const classMatch = xml.match(/x:Class="([^"]+)"/);
  const workflowSelfName = classMatch ? classMatch[1].split(".").pop() || "" : "";
  if (workflowSelfName) declaredVars.add(workflowSelfName);

  const referencedVarsWithPos = new Map<string, number>();

  const bracketExprPattern = /\[([^\[\]]+)\]/g;
  let bracketMatch;
  while ((bracketMatch = bracketExprPattern.exec(xml)) !== null) {
    const expr = bracketMatch[1];
    if (expr.startsWith("&quot;") || expr.startsWith('"')) continue;
    if (expr.includes("xmlns") || expr.includes("clr-namespace")) continue;

    const undeclared = findUndeclaredVariables(expr, declaredVars);
    for (const varName of undeclared) {
      if (!referencedVarsWithPos.has(varName)) {
        referencedVarsWithPos.set(varName, bracketMatch.index);
      }
    }
  }

  const missingVars: { name: string; type: string | null; refIndex: number }[] = [];
  for (const [varName, refIdx] of Array.from(referencedVarsWithPos)) {
    if (!declaredVars.has(varName)) {
      const bindingType = inferVariableTypeFromBindingContext(varName, xml);
      const type = bindingType ?? inferTypeFromPrefix(varName);
      missingVars.push({ name: varName, type, refIndex: refIdx });
    }
  }

  if (missingVars.length === 0) return xml;

  const classMatch2 = xml.match(/x:Class="([^"]+)"/);
  const workflowName = classMatch2 ? classMatch2[1] : "unknown";

  const declarableVars = missingVars.filter(v => v.type !== null);
  const undeclarableVars = missingVars.filter(v => v.type === null);

  for (const v of undeclarableVars) {
    const lineNum = xml.substring(0, v.refIndex).split("\n").length;
    console.warn(`[XAML Compliance] Undeclared variable "${v.name}" at line ${lineNum} in ${workflowName} — type cannot be deterministically inferred from binding context, skipping auto-declaration (will be reported as quality gate violation)`);
  }

  if (declarableVars.length === 0) return xml;

  const seqInsertions = new Map<number, { name: string; type: string }[]>();
  for (const v of declarableVars) {
    console.log(`Auto-declared variable ${v.name} as ${v.type} in ${workflowName} (deterministic from binding context)`);
    const seqIdx = findNearestEnclosingSequenceIndex(xml, v.refIndex);
    const key = seqIdx >= 0 ? seqIdx : 0;
    if (!seqInsertions.has(key)) seqInsertions.set(key, []);
    seqInsertions.get(key)!.push({ name: v.name, type: v.type! });
  }

  const sortedKeys = Array.from(seqInsertions.keys()).sort((a, b) => b - a);

  for (const seqIdx of sortedKeys) {
    const vars = seqInsertions.get(seqIdx)!;
    const varsXml = vars.map(v =>
      `      <Variable x:TypeArguments="${v.type}" Name="${v.name}" />`
    ).join("\n");

    if (seqIdx <= 0) {
      const seqVarsPattern = /(<Sequence[^>]*>)\s*(<Sequence\.Variables>)/;
      if (seqVarsPattern.test(xml)) {
        xml = xml.replace(seqVarsPattern, (match, seqTag, varsTag) => {
          return `${seqTag}\n    ${varsTag}\n${varsXml}`;
        });
      } else {
        const firstSeqPattern = /(<Sequence\s+DisplayName="[^"]*"[^>]*>)/;
        if (firstSeqPattern.test(xml)) {
          xml = xml.replace(firstSeqPattern, (match, seqTag) => {
            return `${seqTag}\n    <Sequence.Variables>\n${varsXml}\n    </Sequence.Variables>`;
          });
        }
      }
      continue;
    }

    const seqTagEndIdx = xml.indexOf(">", seqIdx);
    if (seqTagEndIdx === -1) continue;

    const afterTag = xml.substring(seqTagEndIdx + 1);
    const existingVarsMatch = afterTag.match(/^\s*<Sequence\.Variables>/);
    if (existingVarsMatch) {
      const insertPos = seqTagEndIdx + 1 + existingVarsMatch[0].length;
      xml = xml.slice(0, insertPos) + "\n" + varsXml + xml.slice(insertPos);
    } else {
      const seqTag = xml.substring(seqIdx, seqTagEndIdx + 1);
      xml = xml.slice(0, seqTagEndIdx + 1) +
        `\n    <Sequence.Variables>\n${varsXml}\n    </Sequence.Variables>` +
        xml.slice(seqTagEndIdx + 1);
    }
  }

  return xml;
}

const VARIABLE_PREFIX_PATTERN = /^(str_|int_|dbl_|bool_|sec_|dt_|drow_|obj_|dec_|ts_|lst_|dic_|arr_|row_|qi_)/i;

const QUOTED_EXPRESSION_PATTERNS = [
  /^"Exception\.Message"$/,
  /^"exception\.Message"$/,
  /^"Exception\.ToString\(\)"$/,
  /^"exception\.ToString\(\)"$/,
];

function fixBareVariableRefsInExpressionAttributes(xml: string): string {
  const expressionAttrs = ["Message", "Condition", "To", "Value"];

  for (const attr of expressionAttrs) {
    const pattern = new RegExp(`${attr}="([^"]*)"`, "g");
    xml = xml.replace(pattern, (match, val) => {
      if (!val || val.startsWith("[") || val.startsWith("&quot;") || val.startsWith("<")) return match;
      if (val === "True" || val === "False" || val === "Nothing" || val === "null") return match;
      if (/^[0-9]+$/.test(val)) return match;

      if (VARIABLE_PREFIX_PATTERN.test(val) && /^[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)*$/.test(val)) {
        return `${attr}="[${val}]"`;
      }

      for (const qp of QUOTED_EXPRESSION_PATTERNS) {
        if (qp.test(val)) {
          const inner = val.slice(1, -1);
          return `${attr}="[${inner}]"`;
        }
      }

      return match;
    });
  }

  return xml;
}

const XAML_MARKUP_EXTENSION_PATTERN = /^\{(?:\w+:\w+|Binding|StaticResource|DynamicResource|TemplateBinding|RelativeSource)\b/;

function isXamlMarkupExtension(value: string): boolean {
  return XAML_MARKUP_EXTENSION_PATTERN.test(value.trim());
}

export function sanitizeXmlArtifacts(xml: string): string {
  xml = xml.replace(/="([^"]*?[^}\]])(\}+)"/g, (match, val, braces) => {
    if (isXamlMarkupExtension(val)) return match;
    if (/\[.*\]/.test(val + braces)) return match;
    if (/New\s+Dictionary|From\s*\{/.test(val)) return match;
    console.log(`[XAML Compliance] Removed stray } from attribute value`);
    return `="${val}"`;
  });

  xml = xml.replace(/"([^"]*?)"\s*\}(?=\s|>|\/)/g, (match, val) => {
    if (isXamlMarkupExtension(val)) return match;
    if (/\[.*\]/.test(match)) return match;
    return `"${val}"`;
  });

  xml = xml.replace(/\s+[a-zA-Z_][\w]*="No auto-correction[^"]*"/g, "");
  xml = xml.replace(/\s+[a-zA-Z_][\w]*="[^"]*;\s*(?:do not|must not|should not|cannot)[^"]*"/gi, "");

  return xml;
}

function injectDynamicNamespaceDeclarations(xml: string, isCrossPlatform: boolean, fileName?: string): string {
  const fileLabel = fileName || (xml.match(/x:Class="([^"]+)"/)?.[1]) || "unknown file";
  const declarations = deriveRequiredDeclarationsForXaml(xml);
  const usedPackages = declarations.neededPackages;

  const hasNewtonsoftTypes = /JObject|JToken|JArray|JsonConvert|Newtonsoft/i.test(xml);
  if (hasNewtonsoftTypes) {
    usedPackages.add("UiPath.WebAPI.Activities");
  }

  const additionalXmlns = buildDynamicXmlnsDeclarations(usedPackages, isCrossPlatform, xml);
  const additionalAssemblyRefs = buildDynamicAssemblyRefs(usedPackages, xml);
  let additionalNamespaceImports = buildDynamicNamespaceImports(usedPackages, xml);

  const hasStateMachine = /<StateMachine[\s>]|<State[\s>]|<Transition[\s>]/.test(xml);
  if (hasStateMachine && !xml.includes("System.Activities.Statements")) {
    additionalNamespaceImports += `\n      <x:String>System.Activities.Statements</x:String>`;
    if (!xml.includes('xmlns:sads=')) {
      const sadsXmlns = isCrossPlatform
        ? `  xmlns:sads="clr-namespace:System.Activities.Statements;assembly=System.Activities"`
        : `  xmlns:sads="clr-namespace:System.Activities.Statements;assembly=System.Activities"`;
      const xmlnsInsert = xml.indexOf('xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"');
      if (xmlnsInsert >= 0) {
        const insertAfter = xmlnsInsert + 'xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"'.length;
        xml = xml.slice(0, insertAfter) + "\n" + sadsXmlns + xml.slice(insertAfter);
      }
    }
  }

  const hasMailActivities = /<umail:|<ui:SendSmtpMailMessage|<ui:SendOutlookMailMessage|<ui:GetImapMailMessage|<ui:GetOutlookMailMessages|<ui:SendMail[\s>]|<ui:GetMail[\s>]|System\.Net\.Mail\.MailMessage/.test(xml);
  if (hasMailActivities && !xml.includes("System.Net.Mail")) {
    additionalNamespaceImports += `\n      <x:String>System.Net.Mail</x:String>`;
  }

  if (usedPackages.size > 0) {
    const packageList = Array.from(usedPackages).filter(p => p !== "UiPath.System.Activities" && p !== "UiPath.UIAutomation.Activities");
    if (packageList.length > 0) {
      console.log(`[XAML Compliance] Dynamic namespace injection: detected packages [${packageList.join(", ")}]`);
    }
  }

  if (additionalXmlns) {
    const xmlnsInsertPoint = xml.indexOf('xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"');
    if (xmlnsInsertPoint >= 0) {
      const insertAfter = xmlnsInsertPoint + 'xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"'.length;
      xml = xml.slice(0, insertAfter) + "\n" + additionalXmlns + xml.slice(insertAfter);
    }
  }

  if (additionalAssemblyRefs) {
    const result = insertBeforeClosingCollectionTag(xml, "</TextExpression.ReferencesForImplementation>", additionalAssemblyRefs);
    if (result.succeeded) {
      xml = result.updated;
    } else {
      const refsBlockPattern = /<TextExpression\.ReferencesForImplementation>[\s\S]*?<\/TextExpression\.ReferencesForImplementation>/;
      const existingRefsBlock = xml.match(refsBlockPattern);
      if (existingRefsBlock) {
        const existingAsmEntries: string[] = [];
        const existAsmPat = /<AssemblyReference>([^<]+)<\/AssemblyReference>/g;
        let ea;
        while ((ea = existAsmPat.exec(existingRefsBlock[0])) !== null) {
          existingAsmEntries.push(`      <AssemblyReference>${ea[1].trim()}</AssemblyReference>`);
        }
        const additionalLines = additionalAssemblyRefs.split("\n").filter((l: string) => l.trim());
        const allAsmEntries = [...existingAsmEntries, ...additionalLines];
        const freshRefsBlock = `<TextExpression.ReferencesForImplementation>\n    <sco:Collection x:TypeArguments="AssemblyReference">\n${allAsmEntries.join("\n")}\n    </sco:Collection>\n  </TextExpression.ReferencesForImplementation>`;
        xml = xml.replace(refsBlockPattern, freshRefsBlock);
        console.log(`[XAML Compliance] [${fileLabel}] Rebuilt malformed ReferencesForImplementation block — injected assembly references`);
      } else {
        console.warn(`[XAML Compliance] WARNING: [${fileLabel}] Failed to inject assembly references — no ReferencesForImplementation block found`);
      }
    }
  }

  if (additionalNamespaceImports) {
    const result = insertBeforeClosingCollectionTag(xml, "</TextExpression.NamespacesForImplementation>", additionalNamespaceImports);
    if (result.succeeded) {
      xml = result.updated;
    } else {
      const nsBlockPattern = /<TextExpression\.NamespacesForImplementation>[\s\S]*?<\/TextExpression\.NamespacesForImplementation>/;
      const existingNsBlock = xml.match(nsBlockPattern);
      if (existingNsBlock) {
        const existingNsEntries: string[] = [];
        const existNsPat = /<x:String[^>]*>([^<]+)<\/x:String>/g;
        let en;
        while ((en = existNsPat.exec(existingNsBlock[0])) !== null) {
          existingNsEntries.push(`      <x:String>${en[1].trim()}</x:String>`);
        }
        const additionalLines = additionalNamespaceImports.split("\n").filter((l: string) => l.trim());
        const allNsEntries = [...existingNsEntries, ...additionalLines];
        const freshNsBlock = `<TextExpression.NamespacesForImplementation>\n    <sco:Collection x:TypeArguments="x:String">\n${allNsEntries.join("\n")}\n    </sco:Collection>\n  </TextExpression.NamespacesForImplementation>`;
        xml = xml.replace(nsBlockPattern, freshNsBlock);
        console.log(`[XAML Compliance] [${fileLabel}] Rebuilt malformed NamespacesForImplementation block — injected namespace imports`);
      } else {
        console.warn(`[XAML Compliance] WARNING: [${fileLabel}] Failed to inject namespace imports — no NamespacesForImplementation block found`);
      }
    }
  }

  return xml;
}

const APPROVED_XMLNS_MAPPINGS: Record<string, { validUris: string[] }> = {
  "ui": { validUris: ["http://schemas.uipath.com/workflow/activities"] },
  "x": { validUris: ["http://schemas.microsoft.com/winfx/2006/xaml"] },
  "mc": { validUris: ["http://schemas.openxmlformats.org/markup-compatibility/2006"] },
  "s": { validUris: ["clr-namespace:System;assembly=System.Private.CoreLib", "clr-namespace:System;assembly=mscorlib", "clr-namespace:System;assembly=System.Runtime"] },
  "sap": { validUris: ["http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"] },
  "sap2010": { validUris: ["http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"] },
  "scg": { validUris: ["clr-namespace:System.Collections.Generic;assembly=System.Private.CoreLib", "clr-namespace:System.Collections.Generic;assembly=mscorlib", "clr-namespace:System.Collections.Generic;assembly=System.Runtime"] },
  "scg2": { validUris: ["clr-namespace:System.Data;assembly=System.Data", "clr-namespace:System.Data;assembly=System.Data.Common"] },
  "sco": { validUris: ["clr-namespace:System.Collections.ObjectModel;assembly=System.Private.CoreLib", "clr-namespace:System.Collections.ObjectModel;assembly=mscorlib", "clr-namespace:System.Collections.ObjectModel;assembly=System.Runtime"] },
  "uix": { validUris: ["http://schemas.uipath.com/workflow/activities/uix"] },
  "ucs": { validUris: ["http://schemas.uipath.com/workflow/activities/collection", "clr-namespace:UiPath.Core.Activities;assembly=UiPath.System.Activities", "clr-namespace:UiPath.ComplexScenarios.Activities;assembly=UiPath.ComplexScenarios.Activities"] },
  "udb": { validUris: ["http://schemas.uipath.com/workflow/activities/database", "clr-namespace:UiPath.Database.Activities;assembly=UiPath.Database.Activities"] },
  "umail": { validUris: ["http://schemas.uipath.com/workflow/activities/mail", "clr-namespace:UiPath.Mail.Activities;assembly=UiPath.Mail.Activities"] },
  "updf": { validUris: ["http://schemas.uipath.com/workflow/activities/pdf", "clr-namespace:UiPath.PDF.Activities;assembly=UiPath.PDF.Activities"] },
  "upers": { validUris: ["http://schemas.uipath.com/workflow/activities/persistence", "clr-namespace:UiPath.Persistence.Activities;assembly=UiPath.Persistence.Activities"] },
  "uweb": { validUris: ["http://schemas.uipath.com/workflow/activities/web", "clr-namespace:UiPath.Web.Activities;assembly=UiPath.Web.Activities", "clr-namespace:UiPath.WebAPI.Activities;assembly=UiPath.WebAPI.Activities"] },
  "ss": { validUris: ["clr-namespace:System.Security;assembly=System.Private.CoreLib", "clr-namespace:System.Security;assembly=mscorlib"] },
  "mva": { validUris: ["clr-namespace:Microsoft.VisualBasic.Activities;assembly=System.Activities"] },
  "sads": { validUris: ["clr-namespace:System.Activities.Statements;assembly=System.Activities"] },
};

for (const [, info] of Object.entries(PACKAGE_NAMESPACE_MAP)) {
  if (info.prefix && info.prefix !== "") {
    if (!APPROVED_XMLNS_MAPPINGS[info.prefix]) {
      APPROVED_XMLNS_MAPPINGS[info.prefix] = { validUris: [info.xmlns] };
    } else if (!APPROVED_XMLNS_MAPPINGS[info.prefix].validUris.includes(info.xmlns)) {
      APPROVED_XMLNS_MAPPINGS[info.prefix].validUris.push(info.xmlns);
    }
  }
}

const DATETIME_FORMAT_SAFE_PREFIXES = new Set(["HH", "MM", "ss", "dd", "yyyy", "mm", "hh"]);

function stripAttributeValuesAndTextContent(xml: string): string {
  let result = "";
  let i = 0;
  while (i < xml.length) {
    if (xml.startsWith("<!--", i)) {
      const commentEnd = xml.indexOf("-->", i + 4);
      if (commentEnd === -1) {
        break;
      }
      i = commentEnd + 3;
      continue;
    }
    if (xml[i] === "<") {
      const tagEnd = xml.indexOf(">", i);
      if (tagEnd === -1) {
        result += xml.slice(i);
        break;
      }
      const tagContent = xml.slice(i, tagEnd + 1);
      let cleaned = "";
      let j = 0;
      while (j < tagContent.length) {
        if (tagContent[j] === '"') {
          cleaned += '"';
          j++;
          while (j < tagContent.length && tagContent[j] !== '"') j++;
          if (j < tagContent.length) {
            cleaned += '"';
            j++;
          }
        } else if (tagContent[j] === "'") {
          cleaned += "'";
          j++;
          while (j < tagContent.length && tagContent[j] !== "'") j++;
          if (j < tagContent.length) {
            cleaned += "'";
            j++;
          }
        } else {
          cleaned += tagContent[j];
          j++;
        }
      }
      result += cleaned;
      i = tagEnd + 1;
    } else {
      const nextTag = xml.indexOf("<", i);
      if (nextTag === -1) {
        break;
      }
      i = nextTag;
    }
  }
  return result;
}

export function validateNamespacePrefixes(xml: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const declaredPrefixes = new Map<string, string>();
  const xmlnsPattern = /xmlns:([a-zA-Z][a-zA-Z0-9]*)="([^"]+)"/g;
  let m;
  while ((m = xmlnsPattern.exec(xml)) !== null) {
    declaredPrefixes.set(m[1], m[2]);
  }

  const strippedXml = stripAttributeValuesAndTextContent(xml);

  const usedPrefixes = new Set<string>();
  const tagPrefixPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*):/g;
  while ((m = tagPrefixPattern.exec(strippedXml)) !== null) {
    usedPrefixes.add(m[1]);
  }

  const attrPrefixPattern = /\s([a-zA-Z][a-zA-Z0-9]*):[a-zA-Z]/g;
  while ((m = attrPrefixPattern.exec(strippedXml)) !== null) {
    if (m[1] !== "xmlns") {
      usedPrefixes.add(m[1]);
    }
  }

  Array.from(usedPrefixes).forEach(prefix => {
    if (prefix === "xml") return;
    if (DATETIME_FORMAT_SAFE_PREFIXES.has(prefix)) return;
    if (!declaredPrefixes.has(prefix)) {
      errors.push(`Namespace prefix "${prefix}" is used in activity tags but has no corresponding xmlns declaration`);
      return;
    }

    const declaredUri = declaredPrefixes.get(prefix)!;
    const approved = APPROVED_XMLNS_MAPPINGS[prefix];
    if (approved) {
      if (!approved.validUris.includes(declaredUri)) {
        errors.push(`Namespace prefix "${prefix}" is declared with URI "${declaredUri}" which does not match any approved CLR namespace mapping. Expected one of: ${approved.validUris.join(", ")}`);
      }
    }
  });

  return { valid: errors.length === 0, errors };
}

export function validateActivityTagSemantics(xml: string): { valid: boolean; errors: string[]; warnings: string[]; repairedXml: string } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let repairedXml = xml;

  const activityTagPattern = /<([a-zA-Z][a-zA-Z0-9]*):([A-Z][a-zA-Z0-9]*)[\s>\/]/g;
  let m;
  const checkedTags = new Set<string>();

  while ((m = activityTagPattern.exec(xml)) !== null) {
    const emittedPrefix = m[1];
    const activityName = m[2];
    const tagKey = `${emittedPrefix}:${activityName}`;

    if (checkedTags.has(tagKey)) continue;
    checkedTags.add(tagKey);

    if (["x", "s", "scg", "scg2", "sco", "sap", "sap2010", "mva", "mc"].includes(emittedPrefix)) continue;

    if (SYSTEM_ACTIVITIES_NO_PREFIX.has(activityName)) {
      const escaped = activityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      repairedXml = repairedXml.replace(new RegExp(`<${emittedPrefix}:${escaped}(\\s|>|\\/)`, "g"), `<${activityName}$1`);
      repairedXml = repairedXml.replace(new RegExp(`<\\/${emittedPrefix}:${escaped}>`, "g"), `</${activityName}>`);
      repairedXml = repairedXml.replace(new RegExp(`<${emittedPrefix}:${escaped}\\.`, "g"), `<${activityName}.`);
      repairedXml = repairedXml.replace(new RegExp(`<\\/${emittedPrefix}:${escaped}\\.`, "g"), `</${activityName}.`);
      warnings.push(`Activity "${activityName}" had prefix "${emittedPrefix}:" auto-corrected to no prefix (System.Activities type)`);
      continue;
    }

    const strictPrefix = getActivityPrefixStrict(activityName);
    if (strictPrefix === null) {
      if (emittedPrefix === "ui") {
        warnings.push(`Activity "${activityName}" has no catalog mapping — emitted with default ui: prefix (may be incorrect)`);
      }
      continue;
    }

    if (strictPrefix !== emittedPrefix) {
      const escaped = activityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const targetTag = strictPrefix ? `${strictPrefix}:${activityName}` : activityName;
      repairedXml = repairedXml.replace(new RegExp(`<${emittedPrefix}:${escaped}(\\s|>|\\/)`, "g"), `<${targetTag}$1`);
      repairedXml = repairedXml.replace(new RegExp(`<\\/${emittedPrefix}:${escaped}>`, "g"), `</${targetTag}>`);
      repairedXml = repairedXml.replace(new RegExp(`<${emittedPrefix}:${escaped}\\.`, "g"), `<${targetTag}.`);
      repairedXml = repairedXml.replace(new RegExp(`<\\/${emittedPrefix}:${escaped}\\.`, "g"), `</${targetTag}.`);
      warnings.push(`Activity "${activityName}" had prefix "${emittedPrefix}:" auto-corrected to "${strictPrefix || "(no prefix)"}:" (catalog prefix mismatch)`);
    }
  }

  return { valid: errors.length === 0, errors, warnings, repairedXml };
}

export function repairDottedTagPrefixConsistency(xml: string): string {
  const dottedOpenPrefixed = /<([a-zA-Z]+):([A-Za-z]+(?:\.[A-Za-z]+)+)[\s>\/]/g;
  const dottedPrefixMap = new Map<string, string>();
  let dm;
  while ((dm = dottedOpenPrefixed.exec(xml)) !== null) {
    const prefix = dm[1];
    const localName = dm[2];
    if (!dottedPrefixMap.has(localName)) {
      dottedPrefixMap.set(localName, prefix);
    }
  }

  const unprefixedDottedOpen = /<(?![a-zA-Z]+:)([A-Za-z]+)((?:\.[A-Za-z]+)+)([\s>\/])/g;
  xml = xml.replace(unprefixedDottedOpen, (match, baseName, dottedSuffix, after) => {
    const localName = `${baseName}${dottedSuffix}`;
    let prefix = dottedPrefixMap.get(localName);
    if (!prefix) {
      const strictPrefix = getActivityPrefixStrict(baseName);
      if (strictPrefix) {
        prefix = strictPrefix;
      }
    }
    if (prefix) {
      return `<${prefix}:${baseName}${dottedSuffix}${after}`;
    }
    return match;
  });

  const unprefixedDottedClose = /<\/(?![a-zA-Z]+:)([A-Za-z]+(?:\.[A-Za-z]+)+)>/g;
  xml = xml.replace(unprefixedDottedClose, (match, localName) => {
    let prefix = dottedPrefixMap.get(localName);
    if (!prefix) {
      const baseName = localName.split(".")[0];
      const strictPrefix = getActivityPrefixStrict(baseName);
      if (strictPrefix) {
        prefix = strictPrefix;
      }
    }
    if (prefix) {
      return `</${prefix}:${localName}>`;
    }
    return match;
  });

  const closingDottedPrefixed = /<\/([a-zA-Z]+):([A-Za-z]+(?:\.[A-Za-z]+)+)>/g;
  xml = xml.replace(closingDottedPrefixed, (match, closingPrefix, localName) => {
    const expectedPrefix = dottedPrefixMap.get(localName);
    if (expectedPrefix && expectedPrefix !== closingPrefix) {
      return `</${expectedPrefix}:${localName}>`;
    }
    return match;
  });

  return xml;
}

export function validateXmlWellFormedness(xml: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const result = XMLValidator.validate(xml, {
    allowBooleanAttributes: true,
  });

  if (result !== true) {
    const errObj = result as { err: { code: string; msg: string; line: number; col: number } };
    if (errObj.err) {
      errors.push(`XML well-formedness error at line ${errObj.err.line}, col ${errObj.err.col}: ${errObj.err.msg} (code: ${errObj.err.code})`);
    } else {
      errors.push(`XML well-formedness validation failed with unknown error`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export interface ComplianceFinding {
  type: "expression-rewrite" | "attribute-restructure" | "variable-declaration" | "expression-fixup";
  description: string;
  severity: "info" | "warning";
}

const COMPLIANCE_ADDITIVE_ALLOWLIST = new Set([
  "namespace-injection",
  "assembly-reference-injection",
  "namespace-import-injection",
  "viewstate-id-assignment",
  "vb-settings-injection",
  "activity-alias-normalization",
  "prefix-correction",
  "xml-deduplication",
  "argument-nesting-normalization",
  "empty-container-fill",
  "wellformedness-validation",
]);

let _lastComplianceFindings: ComplianceFinding[] = [];
export function getLastComplianceFindings(): ComplianceFinding[] { return _lastComplianceFindings; }

export function normalizeXaml(rawXaml: string, targetFramework: TargetFramework = "Windows"): string {
  _complianceTargetFramework = targetFramework;
  const findings: ComplianceFinding[] = [];
  _lastComplianceFindings = findings;
  let idCounter = 0;
  const viewStateEntries: { id: string; width: number; height: number }[] = [];
  const isCrossPlatform = targetFramework === "Portable";

  for (const [aliasName, canonicalName] of Object.entries(ACTIVITY_NAME_ALIAS_MAP)) {
    const escapedAlias = aliasName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    rawXaml = rawXaml.replace(new RegExp(`<${escapedAlias}(\\s|>|\\/)`, "g"), `<${canonicalName}$1`);
    rawXaml = rawXaml.replace(new RegExp(`</${escapedAlias}>`, "g"), `</${canonicalName}>`);
  }

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

  const isStateMachineWorkflow = /<Activity[\s\S]*?>\s*(?:<[^>]*>\s*)*<StateMachine[\s>]/.test(xml) ||
    (/<StateMachine\s/.test(xml) && /<State\s/.test(xml) && /<Transition\s/.test(xml));

  if (!isStateMachineWorkflow) {
    const targetNamespaces = isCrossPlatform ? UIPATH_CROSS_PLATFORM_NAMESPACES : UIPATH_NAMESPACES;
    const oldNsBlock = xml.match(/xmlns="http:\/\/schemas\.microsoft\.com\/netfx\/2009\/xaml\/activities"[\s\S]*?xmlns:x="http:\/\/schemas\.microsoft\.com\/winfx\/2006\/xaml"/);
    if (oldNsBlock) {
      xml = xml.replace(oldNsBlock[0], targetNamespaces);
    }
  }

  const classMatch = xml.match(/x:Class="([^"]+)"/);
  const className = classMatch ? classMatch[1].replace(/[^A-Za-z0-9_]/g, "") : "Workflow";
  const rootId = nextId(className);

  const activityTagPattern = /<(Sequence|If|TryCatch|ForEach|Assign|State|StateMachine|Transition|Flowchart|FlowStep|FlowDecision|[a-zA-Z]+:[A-Za-z]+)\s+((?:[^>]*?\s+)?)DisplayName="([^"]*)"([^>]*?)(\s*\/?>)/g;
  xml = xml.replace(activityTagPattern, (match, tag, preAttrs, displayName, rest, closing) => {
    if (preAttrs.includes("WorkflowViewState.IdRef") || rest.includes("WorkflowViewState.IdRef")) return match;
    const prefix = tag.replace(/^[a-zA-Z]+:/, "").replace(/[^A-Za-z]/g, "");
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

  if (!isStateMachineWorkflow) {
    const settingsBlock = isCrossPlatform
      ? UIPATH_CSHARP_SETTINGS.replace("__ROOT_ID__", rootId)
      : UIPATH_VB_SETTINGS.replace("__ROOT_ID__", rootId);

    const alreadyHasSettings = /VisualBasic\.Settings|TextExpression\.NamespacesForImplementation/.test(xml);
    const firstTag = xml.match(/<(Sequence|StateMachine|Flowchart)\s/);
    if (firstTag && firstTag.index !== undefined && !alreadyHasSettings) {
      xml = xml.slice(0, firstTag.index) + settingsBlock + "\n  " + xml.slice(firstTag.index);
    }
  }

  xml = xml.replace(/scg:DataTable/g, "scg2:DataTable");
  xml = xml.replace(/scg:DataRow/g, "scg2:DataRow");


  const secVarPattern1 = /<Variable\s+x:TypeArguments="([^"]*?)"\s+Name="(sec_[^"]*?)"\s*\/>/g;
  let secM;
  while ((secM = secVarPattern1.exec(xml)) !== null) {
    if (secM[1] !== "s:Security.SecureString") {
      findings.push({ type: "attribute-restructure", description: `sec_ variable "${secM[2]}" has type "${secM[1]}" instead of s:Security.SecureString`, severity: "warning" });
      console.log(`[Compliance READ-ONLY] sec_ variable ${secM[2]} type mismatch: ${secM[1]} (not mutated)`);
    }
  }

  xml = xml.replace(/<sap:WorkflowViewState\.ViewStateManager>[\s\S]*?<\/sap:WorkflowViewState\.ViewStateManager>/g, "");
  xml = xml.replace(/<WorkflowViewState\.ViewStateManager>[\s\S]*?<\/WorkflowViewState\.ViewStateManager>/g, "");


  const toStringMatches = xml.match(/\.ToString(?!\()/g);
  if (toStringMatches && toStringMatches.length > 0) {
    findings.push({ type: "expression-fixup", description: `${toStringMatches.length} .ToString without () detected`, severity: "info" });
    console.log(`[Compliance READ-ONLY] ${toStringMatches.length} .ToString without () detected (not mutated)`);
  }

  if (isCrossPlatform) {
    const vbConditions = (xml.match(/IsNot Nothing|Is Nothing|\bNot \w+| &amp; /g) || []).length;
    if (vbConditions > 0) {
      findings.push({ type: "expression-rewrite", description: `${vbConditions} VB-to-C# expression conversions needed for cross-platform`, severity: "warning" });
      console.log(`[Compliance READ-ONLY] ${vbConditions} VB-to-C# expression conversions detected (not mutated)`);
    }
  }

  const sanitizeBefore = xml;
  const sanitized = sanitizeXmlArtifacts(xml);
  if (sanitized !== sanitizeBefore) {
    findings.push({ type: "expression-rewrite", description: "sanitizeXmlArtifacts would have modified XAML", severity: "info" });
    console.log(`[Compliance READ-ONLY] sanitizeXmlArtifacts detected issues (not mutated)`);
  }

  const KNOWN_PREFIXED_ACTIVITIES = catalogService.isLoaded()
    ? catalogService.getAllPrefixableActivityNames()
    : Object.keys(GUARANTEED_ACTIVITY_PREFIX_MAP);

  for (const actName of KNOWN_PREFIXED_ACTIVITIES) {
    const prefix = getActivityPrefix(actName);
    if (!prefix) continue;

    const noPrefixOpen = new RegExp(`<(?![a-zA-Z]+:)${actName}(\\s|>|\\/)`, "g");
    xml = xml.replace(noPrefixOpen, `<${prefix}:${actName}$1`);
    const noPrefixClose = new RegExp(`<\\/(?![a-zA-Z]+:)${actName}>`, "g");
    xml = xml.replace(noPrefixClose, `</${prefix}:${actName}>`);

    if (prefix !== "ui") {
      const wrongUiOpen = new RegExp(`<ui:${actName}(\\s|>|\\/)`, "g");
      xml = xml.replace(wrongUiOpen, `<${prefix}:${actName}$1`);
      const wrongUiClose = new RegExp(`<\\/ui:${actName}>`, "g");
      xml = xml.replace(wrongUiClose, `</${prefix}:${actName}>`);
      const wrongUiProp = new RegExp(`<ui:${actName}\\.`, "g");
      xml = xml.replace(wrongUiProp, `<${prefix}:${actName}.`);
      const wrongUiPropClose = new RegExp(`<\\/ui:${actName}\\.`, "g");
      xml = xml.replace(wrongUiPropClose, `</${prefix}:${actName}.`);
    }
  }

  const openingTagPrefixes = new Map<string, string>();
  const openTagPrefixPattern = /<([a-zA-Z]+):([A-Za-z]+(?:\.[A-Za-z]+)*)[\s>\/]/g;
  let otm;
  while ((otm = openTagPrefixPattern.exec(xml)) !== null) {
    const prefix = otm[1];
    const localName = otm[2];
    if (!openingTagPrefixes.has(localName)) {
      openingTagPrefixes.set(localName, prefix);
    }
  }
  xml = xml.replace(/<\/([A-Za-z]+(?:\.[A-Za-z]+)+)>/g, (match, localName) => {
    const expectedPrefix = openingTagPrefixes.get(localName);
    if (expectedPrefix) {
      return `</${expectedPrefix}:${localName}>`;
    }
    const baseName = localName.split(".")[0];
    const basePrefix = openingTagPrefixes.get(baseName);
    if (basePrefix) {
      return `</${basePrefix}:${localName}>`;
    }
    const strictPrefix = getActivityPrefixStrict(baseName);
    if (strictPrefix) {
      return `</${strictPrefix}:${localName}>`;
    }
    return match;
  });

  xml = xml.replace(/<(ui:(?:While|RetryScope))\s+([^>]*?)\/>/g, (match, tag, attrs) => {
    if (tag === "ui:While") {
      return `<${tag} ${attrs}>
              <${tag}.Body>
                <Sequence DisplayName="While Body" />
              </${tag}.Body>
            </${tag}>`;
    }
    return `<${tag} ${attrs}>
              <${tag}.Condition>
                <ui:ShouldRetry />
              </${tag}.Condition>
              <Sequence DisplayName="Retry Body" />
            </${tag}>`;
  });

  xml = xml.replace(/<(While)\s+([^>]*?)\/>/g, (match, tag, attrs) => {
    return `<${tag} ${attrs}>
              <${tag}.Body>
                <Sequence DisplayName="While Body" />
              </${tag}.Body>
            </${tag}>`;
  });
  xml = xml.replace(/<(RetryScope)\s+([^>]*?)\/>/g, (match, tag, attrs) => {
    return `<ui:${tag} ${attrs}>
              <ui:${tag}.Condition>
                <ui:ShouldRetry />
              </ui:${tag}.Condition>
              <Sequence DisplayName="Retry Body" />
            </ui:${tag}>`;
  });

  xml = xml.replace(/<ui:InvokeWorkflowFile\s([^>]*?)Input="([^"]*)"([^>]*?)(\/?>)/g, (match, before, inputVal, after, closing) => {
    let argElements = parseInvokeArgs(inputVal, "In");
    const outputMatch = (before + after).match(/Output="([^"]*)"/);
    if (outputMatch) {
      argElements += parseInvokeArgs(outputMatch[1], "Out");
      before = before.replace(/\s*Output="[^"]*"/, "");
      after = after.replace(/\s*Output="[^"]*"/, "");
    }
    if (argElements) {
      const attrs = (before + after).trim();
      return `<ui:InvokeWorkflowFile ${attrs}>\n              <ui:InvokeWorkflowFile.Arguments>\n${argElements}              </ui:InvokeWorkflowFile.Arguments>\n            </ui:InvokeWorkflowFile>`;
    }
    return `<ui:InvokeWorkflowFile ${(before + after).trim()}${closing}`;
  });
  xml = xml.replace(/<ui:InvokeWorkflowFile\s([^>]*?)Output="([^"]*)"([^>]*?)(\/?>)/g, (match, before, outputVal, after, closing) => {
    if (match.includes("InvokeWorkflowFile.Arguments")) return match;
    const argElements = parseInvokeArgs(outputVal, "Out");
    if (argElements) {
      const attrs = (before + after).trim();
      return `<ui:InvokeWorkflowFile ${attrs}>\n              <ui:InvokeWorkflowFile.Arguments>\n${argElements}              </ui:InvokeWorkflowFile.Arguments>\n            </ui:InvokeWorkflowFile>`;
    }
    return `<ui:InvokeWorkflowFile ${(before + after).trim()}${closing}`;
  });

  xml = xml.replace(/<ui:TakeScreenshot\s+([^>]*?)OutputPath="([^"]*)"([^>]*?)\/>/g, (_match, before, _outputPathVal, after) => {
    const attrs = (before + after).trim();
    return `<ui:TakeScreenshot ${attrs} />`;
  });
  xml = xml.replace(/<ui:TakeScreenshot\s+([^>]*?)FileName="([^"]*)"([^>]*?)\/>/g, (_match, before, _fileNameVal, after) => {
    const attrs = (before + after).trim();
    return `<ui:TakeScreenshot ${attrs} />`;
  });



  xml = xml.replace(/<(InArgument|OutArgument)([^>]*)>\s*<\1([^>]*)>([^<]*)<\/\1>\s*<\/\1>/g, (_m, tag, outerAttrs, innerAttrs, content) => {
    const attrs = (innerAttrs || outerAttrs).trim();
    return `<${tag}${attrs ? " " + attrs : ""}>${content}</${tag}>`;
  });

  xml = xml.replace(/<(InArgument|OutArgument)([^>]*)>\s*\n\s*<\1([^>]*)>([^<]*)<\/\1>\s*\n\s*<\/\1>/g, (_m, tag, outerAttrs, innerAttrs, content) => {
    const attrs = (innerAttrs || outerAttrs).trim();
    return `<${tag}${attrs ? " " + attrs : ""}>${content}</${tag}>`;
  });

  xml = collapseDoubledArgumentsXmlParser(xml);

  xml = injectInArgumentTypeArguments(xml);

  const bareVarBefore = xml;
  const bareVarResult = fixBareVariableRefsInExpressionAttributes(xml);
  if (bareVarResult !== bareVarBefore) {
    findings.push({ type: "expression-rewrite", description: "Bare variable references detected in expression attributes", severity: "warning" });
    console.log(`[Compliance READ-ONLY] fixBareVariableRefsInExpressionAttributes detected issues (not mutated)`);
  }

  const varDeclBefore = xml;
  const varDeclResult = ensureVariableDeclarations(xml);
  if (varDeclResult !== varDeclBefore) {
    findings.push({ type: "variable-declaration", description: "Missing variable declarations detected and auto-declared", severity: "warning" });
    xml = varDeclResult;
    console.log(`[Compliance] ensureVariableDeclarations applied auto-declarations`);
  }

  xml = xml.replace(/WorkflowFileName="Workflows\\([^"]+)"/g, 'WorkflowFileName="$1"');
  xml = xml.replace(/WorkflowFileName="Workflows\/([^"]+)"/g, 'WorkflowFileName="$1"');
  xml = xml.replace(/WorkflowFileName="([^"]+)"/g, (_match: string, p1: string) => {
    const cleaned = p1.replace(/\\/g, "/").replace(/^[./]+/, "");
    return `WorkflowFileName="${cleaned}"`;
  });


  for (const sysActivity of Array.from(SYSTEM_ACTIVITIES_NO_PREFIX)) {
    const escaped = sysActivity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    xml = xml.replace(new RegExp(`<ui:${escaped}(\\s|>|\\/)`, "g"), `<${sysActivity}$1`);
    xml = xml.replace(new RegExp(`<\\/ui:${escaped}>`, "g"), `</${sysActivity}>`);
    xml = xml.replace(new RegExp(`<ui:${escaped}\\.`, "g"), `<${sysActivity}.`);
    xml = xml.replace(new RegExp(`<\\/ui:${escaped}\\.`, "g"), `</${sysActivity}.`);
  }

  xml = repairDottedTagPrefixConsistency(xml);

  const aliasNormalization = normalizeNamespaceAliases(xml);
  if (aliasNormalization.warnings.length > 0) {
    xml = aliasNormalization.xml;
    for (const warn of aliasNormalization.warnings) {
      console.warn(`[XAML Compliance] Alias normalization: ${warn}`);
    }
  }

  const semanticValidation = validateActivityTagSemantics(xml);
  if (semanticValidation.repairedXml !== xml) {
    console.log(`[XAML Compliance] Auto-repaired activity prefix mismatches`);
    xml = semanticValidation.repairedXml;
  }
  if (semanticValidation.warnings.length > 0) {
    for (const warn of semanticValidation.warnings) {
      console.warn(`[XAML Compliance] Activity tag warning: ${warn}`);
    }
  }
  if (!semanticValidation.valid) {
    for (const err of semanticValidation.errors) {
      console.error(`[XAML Compliance] Activity tag semantic error: ${err}`);
    }
    throw new Error(`XAML activity tag semantic validation failed: ${semanticValidation.errors.join("; ")}`);
  }

  xml = repairDottedTagPrefixConsistency(xml);

  xml = injectDynamicNamespaceDeclarations(xml, isCrossPlatform);

  const nsValidation = validateNamespacePrefixes(xml);
  if (!nsValidation.valid) {
    for (const err of nsValidation.errors) {
      console.error(`[XAML Compliance] Namespace validation: ${err}`);
    }
    const nsMessage = `XAML namespace validation failed: ${nsValidation.errors.join("; ")}`;
    console.warn(`[XAML Compliance] Namespace failure will trigger auto-downgrade path: ${nsMessage}`);
    throw new QualityGateError(nsMessage, {
      passed: false,
      violations: nsValidation.errors.map(e => ({
        check: "namespace-prefix-undeclared",
        severity: "error" as const,
        category: "completeness" as const,
        file: "Main.xaml",
        detail: e,
      })),
      positiveEvidence: [],
      typeRepairs: [],
      completenessLevel: "incomplete" as const,
      summary: {
        blockedPatterns: 0,
        completenessErrors: nsValidation.errors.length,
        completenessWarnings: 0,
        accuracyErrors: 0,
        accuracyWarnings: 0,
        runtimeSafetyErrors: 0,
        runtimeSafetyWarnings: 0,
        logicLocationWarnings: 0,
        totalErrors: nsValidation.errors.length,
        totalWarnings: 0,
      },
    });
  }

  xml = normalizeAssignArgumentNesting(xml);

  xml = deduplicateXmlAttributes(xml);

  xml = fillEmptyContainers(xml);

  const xmlValidation = validateXmlWellFormedness(xml);
  if (!xmlValidation.valid) {
    for (const err of xmlValidation.errors) {
      console.error(`[XAML Compliance] XML well-formedness: ${err}`);
    }
    throw new Error(`XAML XML well-formedness validation failed: ${xmlValidation.errors.join("; ")}`);
  }

  return xml;
}

export function injectInArgumentTypeArguments(xml: string): string {
  xml = xml.replace(/<(InArgument|OutArgument)(?![^>]*x:TypeArguments)(\s[^>]*)?>([^<]+)<\/\1>/g, (match: string, tag: string, attrs: string, content: string) => {
    const trimmed = content.trim();
    if (/^-?\d+$/.test(trimmed)) {
      return `<${tag} x:TypeArguments="x:Int32"${attrs || ""}>${content}</${tag}>`;
    }
    if (/^-?\d+\.\d+(?:[eE][+-]?\d+)?$/.test(trimmed) || /^-?\d+[eE][+-]?\d+$/.test(trimmed)) {
      return `<${tag} x:TypeArguments="x:Double"${attrs || ""}>${content}</${tag}>`;
    }
    if (/^(True|False)$/i.test(trimmed)) {
      return `<${tag} x:TypeArguments="x:Boolean"${attrs || ""}>${content}</${tag}>`;
    }
    return match;
  });
  return xml;
}

function deduplicateXmlAttributes(xml: string): string {
  let totalDedupCount = 0;
  xml = xml.replace(/<([a-zA-Z_][\w.:]*)((?:\s+[\w.:]+\s*=\s*"[^"]*")+)\s*(\/?>)/g, (match, tagName, attrsBlock, closing) => {
    const attrPattern = /([\w.:]+)\s*=\s*"([^"]*)"/g;
    const seen = new Map<string, string>();
    const order: string[] = [];
    let localDupCount = 0;
    let attrMatch;
    while ((attrMatch = attrPattern.exec(attrsBlock)) !== null) {
      const name = attrMatch[1];
      const value = attrMatch[2];
      if (seen.has(name)) {
        localDupCount++;
      } else {
        order.push(name);
      }
      seen.set(name, value);
    }
    if (localDupCount === 0) return match;
    totalDedupCount += localDupCount;
    const rebuiltAttrs = order.map(n => `${n}="${seen.get(n)}"`).join(" ");
    return `<${tagName} ${rebuiltAttrs} ${closing}`.replace(/\s+(\/?>) *$/, ` $1`);
  });
  if (totalDedupCount > 0) {
    console.log(`[XAML Compliance] Deduplicated ${totalDedupCount} duplicate XML attribute(s)`);
  }
  return xml;
}

function fillEmptyContainers(xml: string): string {
  const hasUiNs = /xmlns:ui\s*=/.test(xml);
  const placeholder = hasUiNs
    ? `<ui:LogMessage Level="Warn" Message="[&quot;Placeholder: no activities generated for this container&quot;]" DisplayName="Placeholder — implement logic" />`
    : `<WriteLine Text="Placeholder: no activities generated for this container — implement logic" DisplayName="Placeholder — implement logic" />`;

  xml = xml.replace(
    /(<Sequence\s[^>]*>)\s*(<\/Sequence>)/g,
    (_, open: string, close: string) => `${open}\n      ${placeholder}\n    ${close}`
  );

  xml = xml.replace(
    /(<Sequence\s[^>]*>)\s*(<Sequence\.Variables\s*\/>)\s*(<\/Sequence>)/g,
    (_, open: string, vars: string, close: string) => `${open}\n      ${vars}\n      ${placeholder}\n    ${close}`
  );

  return xml;
}
