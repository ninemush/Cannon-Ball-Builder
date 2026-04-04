import { describe, it, expect } from "vitest";
import {
  getCriticalActivityFamilyContracts,
  lookupContractByFamilyId,
  lookupContractByTemplate,
  lowerCriticalActivityNode,
  detectMixedFamilyDrift,
  runCriticalActivityLowering,
  runPreEmissionLoweringGate,
  runXamlLevelCriticalActivityLowering,
  loweringDiagnosticsToPackageViolations,
  mergeLoweringDiagnostics,
  detectMailSendClusters,
  lockClusterToFamily,
  buildMailFamilyLockDiagnostics,
  runMailFamilyLockAnalysis,
  runXamlLevelMailFamilyLockAnalysis,
  checkCrossFamilyDriftInXaml,
  checkCrossFamilyDriftInDependencies,
  mailFamilyLockToPackageViolations,
  crossFamilyDriftToPackageViolations,
  type CriticalActivityFamilyContract,
  type CriticalStepLoweringResult,
  type CriticalActivityLoweringDiagnostics,
  type MailSendCluster,
  type MailFamilyLockResult,
  type MailFamilyLockDiagnostics,
} from "../critical-activity-lowering";
import type { StudioProfile } from "../catalog/metadata-service";
import type { ActivityNode, WorkflowNode } from "../workflow-spec-types";

const WINDOWS_PROFILE: StudioProfile = {
  studioLine: "StudioX",
  studioVersion: "2024.10",
  targetFramework: "Windows",
  projectType: "Process",
  expressionLanguage: "VisualBasic",
  minimumRequiredPackages: [],
};

const PORTABLE_PROFILE: StudioProfile = {
  studioLine: "StudioX",
  studioVersion: "2024.10",
  targetFramework: "Portable",
  projectType: "Process",
  expressionLanguage: "VisualBasic",
  minimumRequiredPackages: [],
};

const ALL_PACKAGES = new Set([
  "UiPath.GSuite.Activities",
  "UiPath.Mail.Activities",
  "UiPath.System.Activities",
  "UiPath.Persistence.Activities",
  "UiPath.DataService.Activities",
]);

describe("Critical Activity Family Contracts", () => {
  it("defines contracts for all expected families", () => {
    const contracts = getCriticalActivityFamilyContracts();
    const familyIds = contracts.map(c => c.familyId);
    expect(familyIds).toContain("gmail-send");
    expect(familyIds).toContain("smtp-send");
    expect(familyIds).toContain("outlook-send");
    expect(familyIds).toContain("action-center-create");
    expect(familyIds).toContain("action-center-wait");
    expect(familyIds).toContain("retry-scope");
    expect(familyIds).toContain("invoke-workflow");
    expect(familyIds).toContain("data-service-create");
    expect(familyIds).toContain("data-service-update");
    expect(familyIds).toContain("data-service-query");
  });

  it("gmail-send contract has correct concrete type and package", () => {
    const contract = lookupContractByFamilyId("gmail-send");
    expect(contract).not.toBeNull();
    expect(contract!.concreteType).toBe("UiPath.GSuite.Activities.GmailSendMessage");
    expect(contract!.packageId).toBe("UiPath.GSuite.Activities");
    expect(contract!.requiredProperties).toContain("To");
    expect(contract!.requiredProperties).toContain("Subject");
    expect(contract!.requiredProperties).toContain("Body");
  });

  it("smtp-send contract requires Server (derived from registry)", () => {
    const contract = lookupContractByFamilyId("smtp-send");
    expect(contract).not.toBeNull();
    expect(contract!.requiredProperties).toContain("Server");
  });

  it("outlook-send is Windows-only", () => {
    const contract = lookupContractByFamilyId("outlook-send");
    expect(contract).not.toBeNull();
    expect(contract!.targetFrameworkCompat).toBe("Windows");
  });

  it("lookupContractByTemplate resolves GmailSendMessage", () => {
    const contract = lookupContractByTemplate("GmailSendMessage");
    expect(contract).not.toBeNull();
    expect(contract!.familyId).toBe("gmail-send");
  });

  it("lookupContractByTemplate resolves ui:GmailSendMessage", () => {
    const contract = lookupContractByTemplate("ui:GmailSendMessage");
    expect(contract).not.toBeNull();
    expect(contract!.familyId).toBe("gmail-send");
  });
});

describe("Gmail send with Body in spec lowers to valid Gmail activity", () => {
  it("lowers successfully with all required properties", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "GmailSendMessage",
      displayName: "Send Gmail",
      properties: {
        To: "recipient@example.com",
        Subject: "Test Subject",
        Body: "Test Body Content",
      },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "SendEmail.xaml", "SendEmail", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("lowered");
    expect(result.selectedFamily).toBe("gmail-send");
    expect(result.resolvedConcreteType).toBe("UiPath.GSuite.Activities.GmailSendMessage");
    expect(result.resolvedPackage).toBe("UiPath.GSuite.Activities");
    expect(result.contractSatisfied).toBe(true);
    expect(result.missingRequiredProperties).toHaveLength(0);
    expect(result.packageFatal).toBe(false);
  });
});

describe("Gmail intent does not produce SMTP fallback", () => {
  it("Gmail template maps to gmail-send family not smtp-send", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "GmailSendMessage",
      displayName: "Send Gmail Message",
      properties: { To: "a@b.com", Subject: "S", Body: "B" },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.selectedFamily).toBe("gmail-send");
    expect(result.selectedFamily).not.toBe("smtp-send");
    expect(result.resolvedConcreteType).toBe("UiPath.GSuite.Activities.GmailSendMessage");
    expect(result.resolvedConcreteType).not.toContain("SendSmtp");
  });
});

describe("Narrative TryCatch send step is rejected", () => {
  it("rejects pseudo TryCatch text in property payloads", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "GmailSendMessage",
      displayName: "Send Email with TryCatch",
      properties: {
        To: "a@b.com",
        Subject: "S",
        Body: 'TryCatch { Try: GmailSendMessage(To="a@b.com") Catches: Exception -> log error }',
      },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("rejected_pseudo_representation");
    expect(result.rejectedPseudoRepresentations.length).toBeGreaterThan(0);
    expect(result.packageFatal).toBe(true);
  });
});

describe("Critical send step missing Body is rejected before emission", () => {
  it("rejects Gmail send with missing Body", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "GmailSendMessage",
      displayName: "Send Gmail",
      properties: { To: "a@b.com", Subject: "S" },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("rejected_incomplete_contract");
    expect(result.missingRequiredProperties).toContain("Body");
    expect(result.packageFatal).toBe(true);
  });

  it("rejects Gmail send with PLACEHOLDER Body", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "GmailSendMessage",
      displayName: "Send Gmail",
      properties: { To: "a@b.com", Subject: "S", Body: "PLACEHOLDER" },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("rejected_incomplete_contract");
    expect(result.missingRequiredProperties).toContain("Body");
  });

  it("rejects SMTP send with missing Server", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "SendSmtpMailMessage",
      displayName: "Send SMTP Mail",
      properties: { To: "a@b.com", Subject: "S", Body: "B", Port: "25" },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("rejected_incomplete_contract");
    expect(result.missingRequiredProperties).toContain("Server");
  });
});

describe("Family valid for Windows but targeted at Portable is rejected", () => {
  it("rejects Outlook send when target is Portable", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "SendOutlookMailMessage",
      displayName: "Send Outlook",
      properties: { To: "a@b.com", Subject: "S", Body: "B" },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", PORTABLE_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("rejected_framework_incompatible");
    expect(result.packageFatal).toBe(true);
    expect(result.remediationHint).toContain("Windows");
    expect(result.remediationHint).toContain("Portable");
  });

  it("allows Outlook send when target is Windows", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "SendOutlookMailMessage",
      displayName: "Send Outlook",
      properties: { To: "a@b.com", Subject: "S", Body: "B" },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("lowered");
  });
});

describe("Family whose package is not in verified dependency set", () => {
  it("rejects Gmail send when GSuite package is not verified", () => {
    const limitedPackages = new Set(["UiPath.System.Activities", "UiPath.Mail.Activities"]);

    const node: ActivityNode = {
      kind: "activity",
      template: "GmailSendMessage",
      displayName: "Send Gmail",
      properties: { To: "a@b.com", Subject: "S", Body: "B" },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", WINDOWS_PROFILE, limitedPackages,
    );

    expect(result.loweringOutcome).toBe("rejected_package_unavailable");
    expect(result.packageFatal).toBe(true);
    expect(result.remediationHint).toContain("UiPath.GSuite.Activities");
  });
});

describe("Mixed-family drift detection", () => {
  it("detects mixed Gmail and SMTP in same workflow as non-fatal when explicit", () => {
    const nodes: ActivityNode[] = [
      {
        kind: "activity",
        template: "GmailSendMessage",
        displayName: "Send Gmail",
        properties: { To: "a@b.com", Subject: "S", Body: "B" },
        errorHandling: "none",
      },
      {
        kind: "activity",
        template: "SendSmtpMailMessage",
        displayName: "Send SMTP",
        properties: { To: "a@b.com", Subject: "S", Body: "B", Server: "smtp.x.com", Port: "25" },
        errorHandling: "none",
      },
    ];

    const drift = detectMixedFamilyDrift(nodes, "Main.xaml", "Main");
    expect(drift).not.toBeNull();
    expect(drift!.loweringOutcome).toBe("rejected_mixed_family");
    expect(drift!.packageFatal).toBe(false);
    expect(drift!.candidatesConsidered).toContain("gmail-send");
    expect(drift!.candidatesConsidered).toContain("smtp-send");
  });

  it("detects mixed families as fatal when ambiguous template involved", () => {
    const nodes: ActivityNode[] = [
      {
        kind: "activity",
        template: "GmailSendMessage",
        displayName: "Send Gmail",
        properties: { To: "a@b.com", Subject: "S", Body: "B" },
        errorHandling: "none",
      },
      {
        kind: "activity",
        template: "SendMail",
        displayName: "Send Mail",
        properties: { To: "a@b.com", Subject: "S", Body: "B" },
        errorHandling: "none",
      },
    ];

    const drift = detectMixedFamilyDrift(nodes, "Main.xaml", "Main");
    expect(drift).not.toBeNull();
    expect(drift!.loweringOutcome).toBe("rejected_mixed_family");
    expect(drift!.packageFatal).toBe(true);
  });

  it("does not flag single-family workflows", () => {
    const nodes: ActivityNode[] = [
      {
        kind: "activity",
        template: "GmailSendMessage",
        displayName: "Send Gmail 1",
        properties: { To: "a@b.com", Subject: "S", Body: "B" },
        errorHandling: "none",
      },
      {
        kind: "activity",
        template: "GmailSendMessage",
        displayName: "Send Gmail 2",
        properties: { To: "c@d.com", Subject: "S2", Body: "B2" },
        errorHandling: "none",
      },
    ];

    const drift = detectMixedFamilyDrift(nodes, "Main.xaml", "Main");
    expect(drift).toBeNull();
  });
});

describe("Action Center create/wait handling", () => {
  it("action-center-create with valid properties lowers successfully", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "CreateFormTask",
      displayName: "Create Approval Task",
      properties: {
        Title: "Approval",
        FormSchemaPath: "schema.json",
        TaskDataJson: '{"field1": "value1"}',
      },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Process.xaml", "Process", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.selectedFamily).toBe("action-center-create");
    expect(result.loweringOutcome).toBe("lowered");
    expect(result.contractSatisfied).toBe(true);
  });

  it("action-center-create with narrative pseudo-properties is rejected", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "CreateFormTask",
      displayName: "Create Approval Task",
      properties: {
        Title: "Approval",
        FormSchemaPath: "schema.json",
        TaskDataJson: 'Action: Create Task with approval form data for manager review',
      },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Process.xaml", "Process", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.selectedFamily).toBe("action-center-create");
    expect(result.loweringOutcome).toBe("rejected_pseudo_representation");
    expect(result.packageFatal).toBe(true);
  });

  it("action-center-create with missing Title is rejected", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "CreateFormTask",
      displayName: "Create Task",
      properties: { FormSchemaPath: "schema.json" },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Process.xaml", "Process", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("rejected_incomplete_contract");
    expect(result.missingRequiredProperties).toContain("Title");
  });
});

describe("Data Service update with concrete entity lowers correctly", () => {
  it("update entity with all required properties lowers successfully", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "UpdateEntity",
      displayName: "Update Customer Record",
      properties: {
        EntityType: "Customer",
        EntityObject: "[customerRecord]",
      },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "UpdateCustomer.xaml", "UpdateCustomer", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("lowered");
    expect(result.selectedFamily).toBe("data-service-update");
    expect(result.resolvedConcreteType).toBe("UiPath.DataService.Activities.UpdateEntity");
    expect(result.resolvedPackage).toBe("UiPath.DataService.Activities");
  });
});

describe("No placeholder injection for rejected contracts", () => {
  it("rejected lowering generates package violations", () => {
    const diagnostics: CriticalActivityLoweringDiagnostics = {
      perStepResults: [
        {
          file: "Main.xaml",
          workflow: "Main",
          sourceStep: "Send Gmail",
          detectedIntent: "GmailSendMessage",
          selectedFamily: "gmail-send",
          resolvedConcreteType: "UiPath.GSuite.Activities.GmailSendMessage",
          resolvedPackage: "UiPath.GSuite.Activities",
          targetFrameworkCompatibility: "Both (target: Windows)",
          verifiedDependencyMatch: true,
          candidatesConsidered: ["gmail-send"],
          contractSatisfied: false,
          missingRequiredProperties: ["Body"],
          rejectedPseudoRepresentations: [],
          loweringOutcome: "rejected_incomplete_contract",
          packageFatal: true,
          remediationHint: "Activity is missing required properties: Body",
        },
      ],
      summary: {
        totalCriticalSteps: 1,
        totalLoweredSuccessfully: 0,
        totalRejectedForIncompleteContract: 1,
        totalRejectedForNoConcreteMapping: 0,
        totalMixedFamilyConflicts: 0,
        totalPseudoRepresentationRejections: 0,
        totalFrameworkIncompatible: 0,
        totalPackageUnavailable: 0,
      },
    };

    const violations = loweringDiagnosticsToPackageViolations(diagnostics);
    expect(violations.length).toBe(1);
    expect(violations[0].violationType).toBe("critical_activity_lowering_failure");
    expect(violations[0].packageFatal).toBe(true);
    expect(violations[0].severity).toBe("execution_blocking");
  });
});

describe("runCriticalActivityLowering (spec-level)", () => {
  it("processes specs with mixed critical and non-critical nodes", () => {
    const specs = [{
      file: "Main.xaml",
      workflow: "Main",
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main Sequence",
        children: [
          {
            kind: "activity" as const,
            template: "LogMessage",
            displayName: "Log Start",
            properties: { Message: "Starting" },
            errorHandling: "none" as const,
          },
          {
            kind: "activity" as const,
            template: "GmailSendMessage",
            displayName: "Send Email",
            properties: { To: "a@b.com", Subject: "S", Body: "B" },
            errorHandling: "none" as const,
          },
        ] as WorkflowNode[],
      },
    }];

    const result = runCriticalActivityLowering(specs, WINDOWS_PROFILE, ALL_PACKAGES);
    expect(result.summary.totalCriticalSteps).toBe(1);
    expect(result.summary.totalLoweredSuccessfully).toBe(1);
    expect(result.perStepResults[0].selectedFamily).toBe("gmail-send");
  });
});

describe("runXamlLevelCriticalActivityLowering", () => {
  it("detects Gmail send in XAML with all properties present", () => {
    const xaml = `<Activity>
  <Sequence DisplayName="Main">
    <ui:GmailSendMessage DisplayName="Send Gmail" To="a@b.com" Subject="Test">
      <ui:GmailSendMessage.Body>
        <InArgument x:TypeArguments="x:String">Hello</InArgument>
      </ui:GmailSendMessage.Body>
    </ui:GmailSendMessage>
  </Sequence>
</Activity>`;

    const result = runXamlLevelCriticalActivityLowering(
      [{ name: "Main.xaml", content: xaml }],
      WINDOWS_PROFILE,
      ALL_PACKAGES,
    );

    expect(result.summary.totalCriticalSteps).toBeGreaterThanOrEqual(1);
    const gmailResult = result.perStepResults.find(r => r.selectedFamily === "gmail-send");
    expect(gmailResult).toBeDefined();
    expect(gmailResult!.loweringOutcome).toBe("lowered");
  });

  it("detects mixed Gmail and SMTP in same XAML file", () => {
    const xaml = `<Activity>
  <Sequence DisplayName="Main">
    <ui:GmailSendMessage DisplayName="Send Gmail" To="a@b.com" Subject="S" />
    <ui:SendSmtpMailMessage DisplayName="Send SMTP" To="b@c.com" Subject="S2" Server="smtp.x.com" Port="25" />
  </Sequence>
</Activity>`;

    const result = runXamlLevelCriticalActivityLowering(
      [{ name: "Main.xaml", content: xaml }],
      WINDOWS_PROFILE,
      ALL_PACKAGES,
    );

    const mixedResult = result.perStepResults.find(r => r.loweringOutcome === "rejected_mixed_family");
    expect(mixedResult).toBeDefined();
    expect(mixedResult!.packageFatal).toBe(false);
  });

  it("rejects Outlook send in Portable target XAML", () => {
    const xaml = `<Activity>
  <Sequence DisplayName="Main">
    <ui:SendOutlookMailMessage DisplayName="Send Outlook" To="a@b.com" Subject="S" />
  </Sequence>
</Activity>`;

    const result = runXamlLevelCriticalActivityLowering(
      [{ name: "Main.xaml", content: xaml }],
      PORTABLE_PROFILE,
      ALL_PACKAGES,
    );

    const outlookResult = result.perStepResults.find(r => r.selectedFamily === "outlook-send");
    expect(outlookResult).toBeDefined();
    expect(outlookResult!.loweringOutcome).toBe("rejected_framework_incompatible");
    expect(outlookResult!.packageFatal).toBe(true);
  });

  it("rejects Gmail when package is not in verified set", () => {
    const xaml = `<Activity>
  <Sequence DisplayName="Main">
    <ui:GmailSendMessage DisplayName="Send Gmail" To="a@b.com" Subject="S" />
  </Sequence>
</Activity>`;

    const limitedPackages = new Set(["UiPath.System.Activities"]);
    const result = runXamlLevelCriticalActivityLowering(
      [{ name: "Main.xaml", content: xaml }],
      WINDOWS_PROFILE,
      limitedPackages,
    );

    const gmailResult = result.perStepResults.find(r => r.selectedFamily === "gmail-send");
    expect(gmailResult).toBeDefined();
    expect(gmailResult!.loweringOutcome).toBe("rejected_package_unavailable");
  });
});

describe("Non-critical activities are skipped", () => {
  it("LogMessage is skipped", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "LogMessage",
      displayName: "Log Info",
      properties: { Message: "Hello" },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("skipped_not_critical");
    expect(result.packageFatal).toBe(false);
  });
});

describe("InvokeWorkflowFile lowering", () => {
  it("lowers successfully with WorkflowFileName", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "InvokeWorkflowFile",
      displayName: "Invoke Process",
      properties: { WorkflowFileName: "Process.xaml" },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("lowered");
    expect(result.selectedFamily).toBe("invoke-workflow");
  });

  it("rejects when WorkflowFileName is missing", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "InvokeWorkflowFile",
      displayName: "Invoke Process",
      properties: {},
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("rejected_incomplete_contract");
    expect(result.missingRequiredProperties).toContain("WorkflowFileName");
  });
});

describe("diagnostics summary accuracy", () => {
  it("summary counts match per-step results", () => {
    const specs = [{
      file: "Main.xaml",
      workflow: "Main",
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main",
        children: [
          {
            kind: "activity" as const,
            template: "GmailSendMessage",
            displayName: "Gmail OK",
            properties: { To: "a@b.com", Subject: "S", Body: "B" },
            errorHandling: "none" as const,
          },
          {
            kind: "activity" as const,
            template: "GmailSendMessage",
            displayName: "Gmail Missing Body",
            properties: { To: "a@b.com", Subject: "S" },
            errorHandling: "none" as const,
          },
          {
            kind: "activity" as const,
            template: "LogMessage",
            displayName: "Log",
            properties: {},
            errorHandling: "none" as const,
          },
        ] as WorkflowNode[],
      },
    }];

    const result = runCriticalActivityLowering(specs, WINDOWS_PROFILE, ALL_PACKAGES);
    expect(result.summary.totalCriticalSteps).toBe(2);
    expect(result.summary.totalLoweredSuccessfully).toBe(1);
    expect(result.summary.totalRejectedForIncompleteContract).toBe(1);
    expect(result.summary.totalMixedFamilyConflicts).toBe(0);
  });
});

describe("Retry scope lowering", () => {
  it("retry scope lowers with no required properties", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "RetryScope",
      displayName: "Retry Operation",
      properties: {},
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("lowered");
    expect(result.selectedFamily).toBe("retry-scope");
    expect(result.resolvedConcreteType).toBe("UiPath.System.Activities.RetryScope");
  });
});

describe("XAML-level pseudo-representation detection", () => {
  it("rejects XAML activity with narrative pseudo text in attributes", () => {
    const xaml = `<Activity>
      <Sequence DisplayName="Main">
        <GmailSendMessage DisplayName="Send Email" To="a@b.com" Subject="Test" Body="Step 1: Send the email to the recipient" />
      </Sequence>
    </Activity>`;

    const result = runXamlLevelCriticalActivityLowering(
      [{ name: "Process.xaml", content: xaml }],
      WINDOWS_PROFILE,
      ALL_PACKAGES,
    );

    const gmailResult = result.perStepResults.find(r => r.selectedFamily === "gmail-send");
    expect(gmailResult).toBeDefined();
    expect(gmailResult!.loweringOutcome).toBe("rejected_pseudo_representation");
    expect(gmailResult!.packageFatal).toBe(true);
  });

  it("XAML scoped child properties do not bleed across activity instances", () => {
    const xaml = `<Activity>
      <Sequence DisplayName="Main">
        <GmailSendMessage DisplayName="Gmail1" To="a@b.com" Subject="S1">
          <GmailSendMessage.Body>Hello World</GmailSendMessage.Body>
        </GmailSendMessage>
        <GmailSendMessage DisplayName="Gmail2" To="b@c.com" Subject="S2" />
      </Sequence>
    </Activity>`;

    const result = runXamlLevelCriticalActivityLowering(
      [{ name: "Process.xaml", content: xaml }],
      WINDOWS_PROFILE,
      ALL_PACKAGES,
    );

    const gmail1 = result.perStepResults.find(r => r.sourceStep === "Gmail1");
    const gmail2 = result.perStepResults.find(r => r.sourceStep === "Gmail2");
    expect(gmail1).toBeDefined();
    expect(gmail2).toBeDefined();
    expect(gmail1!.loweringOutcome).toBe("lowered");
    expect(gmail2!.loweringOutcome).toBe("rejected_incomplete_contract");
    expect(gmail2!.missingRequiredProperties).toContain("Body");
  });
});

describe("Child-element property shape validation", () => {
  it("accepts child-element property with valid string value", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "GmailSendMessage",
      displayName: "Send Gmail",
      properties: { To: "a@b.com", Subject: "S", Body: "Hello world" },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("lowered");
    expect(result.missingRequiredProperties).not.toContain("Body");
  });

  it("rejects child-element property with placeholder value", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "GmailSendMessage",
      displayName: "Send Gmail",
      properties: { To: "a@b.com", Subject: "S", Body: "PLACEHOLDER" },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("rejected_incomplete_contract");
    expect(result.missingRequiredProperties).toContain("Body");
  });

  it("rejects child-element property with empty string", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "GmailSendMessage",
      displayName: "Send Gmail",
      properties: { To: "a@b.com", Subject: "S", Body: "" },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("rejected_incomplete_contract");
    expect(result.missingRequiredProperties).toContain("Body");
  });

  it("accepts child-element property with object value containing valid content", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "GmailSendMessage",
      displayName: "Send Gmail",
      properties: { To: "a@b.com", Subject: "S", Body: { value: "Real email body content" } },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("lowered");
  });

  it("rejects child-element property with object missing value key", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "GmailSendMessage",
      displayName: "Send Gmail",
      properties: { To: "a@b.com", Subject: "S", Body: { someOtherKey: "data" } },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("rejected_incomplete_contract");
    expect(result.missingRequiredProperties).toContain("Body");
  });

  it("rejects child-element property with object containing placeholder value", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "GmailSendMessage",
      displayName: "Send Gmail",
      properties: { To: "a@b.com", Subject: "S", Body: { value: "STUB_BODY" } },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("rejected_incomplete_contract");
    expect(result.missingRequiredProperties).toContain("Body");
  });
});

describe("Package verification is fail-closed", () => {
  it("empty verified set rejects critical activities as package unavailable", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "GmailSendMessage",
      displayName: "Send Gmail",
      properties: { To: "a@b.com", Subject: "S", Body: "B" },
      errorHandling: "none",
    };

    const emptySet = new Set<string>();
    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", WINDOWS_PROFILE, emptySet,
    );

    expect(result.loweringOutcome).toBe("rejected_package_unavailable");
    expect(result.packageFatal).toBe(true);
  });

  it("accepts critical activities when package is in verified set", () => {
    const node: ActivityNode = {
      kind: "activity",
      template: "GmailSendMessage",
      displayName: "Send Gmail",
      properties: { To: "a@b.com", Subject: "S", Body: "B" },
      errorHandling: "none",
    };

    const result = lowerCriticalActivityNode(
      node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES,
    );

    expect(result.loweringOutcome).toBe("lowered");
  });
});

describe("Pre-emission lowering gate", () => {
  it("passes when all critical activities are complete", () => {
    const spec = {
      name: "Process",
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main",
        children: [
          {
            kind: "activity" as const,
            template: "GmailSendMessage",
            displayName: "Send Gmail",
            properties: { To: "a@b.com", Subject: "S", Body: "B" },
            errorHandling: "none" as const,
          },
          {
            kind: "activity" as const,
            template: "LogMessage",
            displayName: "Log",
            properties: { Message: "Done" },
            errorHandling: "none" as const,
          },
        ] as WorkflowNode[],
      },
    };

    const result = runPreEmissionLoweringGate(spec, "Windows", ALL_PACKAGES);
    expect(result.passed).toBe(true);
    expect(result.fatalFailures).toHaveLength(0);
    expect(result.diagnostics.summary.totalLoweredSuccessfully).toBe(1);
  });

  it("fails when critical activity has missing properties", () => {
    const spec = {
      name: "Process",
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main",
        children: [
          {
            kind: "activity" as const,
            template: "GmailSendMessage",
            displayName: "Send Gmail",
            properties: { To: "a@b.com" },
            errorHandling: "none" as const,
          },
        ] as WorkflowNode[],
      },
    };

    const result = runPreEmissionLoweringGate(spec, "Windows", ALL_PACKAGES);
    expect(result.passed).toBe(false);
    expect(result.fatalFailures.length).toBeGreaterThan(0);
    expect(result.fatalFailures[0].loweringOutcome).toBe("rejected_incomplete_contract");
  });

  it("fails when critical activity has pseudo-representation", () => {
    const spec = {
      name: "Process",
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main",
        children: [
          {
            kind: "activity" as const,
            template: "GmailSendMessage",
            displayName: "Send Gmail",
            properties: { To: "a@b.com", Subject: "S", Body: "Step 1: Send the email to manager" },
            errorHandling: "none" as const,
          },
        ] as WorkflowNode[],
      },
    };

    const result = runPreEmissionLoweringGate(spec, "Windows", ALL_PACKAGES);
    expect(result.passed).toBe(false);
    expect(result.fatalFailures[0].loweringOutcome).toBe("rejected_pseudo_representation");
  });

  it("fails when mixed mail families with ambiguous template are present", () => {
    const spec = {
      name: "Process",
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main",
        children: [
          {
            kind: "activity" as const,
            template: "GmailSendMessage",
            displayName: "Send Gmail",
            properties: { To: "a@b.com", Subject: "S", Body: "B" },
            errorHandling: "none" as const,
          },
          {
            kind: "activity" as const,
            template: "SendMail",
            displayName: "Send Mail",
            properties: { To: "a@b.com", Subject: "S", Body: "B" },
            errorHandling: "none" as const,
          },
        ] as WorkflowNode[],
      },
    };

    const result = runPreEmissionLoweringGate(spec, "Windows", ALL_PACKAGES);
    expect(result.passed).toBe(false);
    const mixedFamilyFailure = result.fatalFailures.find(f => f.loweringOutcome === "rejected_mixed_family");
    expect(mixedFamilyFailure).toBeDefined();
    expect(mixedFamilyFailure!.packageFatal).toBe(true);
  });

  it("allows explicit multi-provider mail families as non-fatal", () => {
    const spec = {
      name: "Process",
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main",
        children: [
          {
            kind: "activity" as const,
            template: "GmailSendMessage",
            displayName: "Send Gmail",
            properties: { To: "a@b.com", Subject: "S", Body: "B" },
            errorHandling: "none" as const,
          },
          {
            kind: "activity" as const,
            template: "SendSmtpMailMessage",
            displayName: "Send SMTP",
            properties: { To: "a@b.com", Subject: "S", Body: "B", Server: "smtp.test.com" },
            errorHandling: "none" as const,
          },
        ] as WorkflowNode[],
      },
    };

    const result = runPreEmissionLoweringGate(spec, "Windows", ALL_PACKAGES);
    const mixedFamily = result.diagnostics.perStepResults.find(r => r.loweringOutcome === "rejected_mixed_family");
    expect(mixedFamily).toBeDefined();
    expect(mixedFamily!.packageFatal).toBe(false);
  });

  it("rejects ambiguous SendMail template as unmappable critical family", () => {
    const spec = {
      name: "Process",
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main",
        children: [
          {
            kind: "activity" as const,
            template: "SendMail",
            displayName: "Send Mail",
            properties: { To: "a@b.com", Subject: "S", Body: "B" },
            errorHandling: "none" as const,
          },
        ] as WorkflowNode[],
      },
    };

    const result = runPreEmissionLoweringGate(spec, "Windows", ALL_PACKAGES);
    expect(result.passed).toBe(false);
    expect(result.fatalFailures.length).toBeGreaterThan(0);
    expect(result.fatalFailures[0].loweringOutcome).toBe("rejected_no_concrete_mapping");
  });

  it("contracts are derived from activity-definitions registry", () => {
    const contracts = getCriticalActivityFamilyContracts();
    const gmailContract = contracts.find(c => c.familyId === "gmail-send");
    expect(gmailContract).toBeDefined();
    expect(gmailContract!.requiredProperties).toContain("To");
    expect(gmailContract!.requiredProperties).toContain("Subject");
    expect(gmailContract!.requiredProperties).toContain("Body");
    expect(gmailContract!.className).toBe("GmailSendMessage");

    const smtpContract = contracts.find(c => c.familyId === "smtp-send");
    expect(smtpContract).toBeDefined();
    expect(smtpContract!.requiredProperties).toContain("Server");
    expect(smtpContract!.requiredProperties).toContain("To");

    const createEntityContract = contracts.find(c => c.familyId === "data-service-create");
    expect(createEntityContract).toBeDefined();
    expect(createEntityContract!.requiredProperties).toContain("EntityType");
    expect(createEntityContract!.requiredProperties).toContain("EntityObject");
  });
});

describe("mergeLoweringDiagnostics", () => {
  it("merges pre-emission and XAML-level diagnostics", () => {
    const preEmission: CriticalActivityLoweringDiagnostics = {
      perStepResults: [{
        file: "Main.xaml",
        workflow: "Main",
        sourceStep: "Send Gmail (pre-emission)",
        detectedIntent: "GmailSendMessage",
        selectedFamily: "gmail-send",
        resolvedConcreteType: "GmailSendMessage",
        resolvedPackage: "UiPath.GSuite.Activities",
        targetFrameworkCompatibility: "Windows",
        verifiedDependencyMatch: true,
        candidatesConsidered: ["gmail-send"],
        contractSatisfied: false,
        missingRequiredProperties: ["Body"],
        rejectedPseudoRepresentations: [],
        loweringOutcome: "rejected_incomplete_contract",
        packageFatal: true,
        remediationHint: "Missing Body",
      }],
      summary: {
        totalCriticalSteps: 1,
        totalLoweredSuccessfully: 0,
        totalRejectedForIncompleteContract: 1,
        totalRejectedForNoConcreteMapping: 0,
        totalMixedFamilyConflicts: 0,
        totalPseudoRepresentationRejections: 0,
        totalFrameworkIncompatible: 0,
        totalPackageUnavailable: 0,
      },
    };

    const xamlLevel: CriticalActivityLoweringDiagnostics = {
      perStepResults: [{
        file: "Helper.xaml",
        workflow: "Helper",
        sourceStep: "Send SMTP",
        detectedIntent: "SendSmtpMailMessage",
        selectedFamily: "smtp-send",
        resolvedConcreteType: "SendSmtpMailMessage",
        resolvedPackage: "UiPath.Mail.Activities",
        targetFrameworkCompatibility: "Windows",
        verifiedDependencyMatch: true,
        candidatesConsidered: ["smtp-send"],
        contractSatisfied: true,
        missingRequiredProperties: [],
        rejectedPseudoRepresentations: [],
        loweringOutcome: "lowered",
        packageFatal: false,
        remediationHint: "",
      }],
      summary: {
        totalCriticalSteps: 1,
        totalLoweredSuccessfully: 1,
        totalRejectedForIncompleteContract: 0,
        totalRejectedForNoConcreteMapping: 0,
        totalMixedFamilyConflicts: 0,
        totalPseudoRepresentationRejections: 0,
        totalFrameworkIncompatible: 0,
        totalPackageUnavailable: 0,
      },
    };

    const merged = mergeLoweringDiagnostics(preEmission, xamlLevel);
    expect(merged.perStepResults).toHaveLength(2);
    expect(merged.summary.totalCriticalSteps).toBe(2);
    expect(merged.summary.totalLoweredSuccessfully).toBe(1);
    expect(merged.summary.totalRejectedForIncompleteContract).toBe(1);
    expect(merged.perStepResults.find(r => r.sourceStep === "Send Gmail (pre-emission)")).toBeDefined();
    expect(merged.perStepResults.find(r => r.sourceStep === "Send SMTP")).toBeDefined();
  });

  it("deduplicates identical step results", () => {
    const diag: CriticalActivityLoweringDiagnostics = {
      perStepResults: [{
        file: "Main.xaml",
        workflow: "Main",
        sourceStep: "Send Gmail",
        detectedIntent: "GmailSendMessage",
        selectedFamily: "gmail-send",
        resolvedConcreteType: "GmailSendMessage",
        resolvedPackage: "UiPath.GSuite.Activities",
        targetFrameworkCompatibility: "Windows",
        verifiedDependencyMatch: true,
        candidatesConsidered: ["gmail-send"],
        contractSatisfied: true,
        missingRequiredProperties: [],
        rejectedPseudoRepresentations: [],
        loweringOutcome: "lowered",
        packageFatal: false,
        remediationHint: "",
      }],
      summary: {
        totalCriticalSteps: 1,
        totalLoweredSuccessfully: 1,
        totalRejectedForIncompleteContract: 0,
        totalRejectedForNoConcreteMapping: 0,
        totalMixedFamilyConflicts: 0,
        totalPseudoRepresentationRejections: 0,
        totalFrameworkIncompatible: 0,
        totalPackageUnavailable: 0,
      },
    };

    const merged = mergeLoweringDiagnostics(diag, diag);
    expect(merged.perStepResults).toHaveLength(1);
    expect(merged.summary.totalCriticalSteps).toBe(1);
  });

  it("handles undefined sources gracefully", () => {
    const diag: CriticalActivityLoweringDiagnostics = {
      perStepResults: [{
        file: "Main.xaml",
        workflow: "Main",
        sourceStep: "Send Gmail",
        detectedIntent: "GmailSendMessage",
        selectedFamily: "gmail-send",
        resolvedConcreteType: "GmailSendMessage",
        resolvedPackage: "UiPath.GSuite.Activities",
        targetFrameworkCompatibility: "Windows",
        verifiedDependencyMatch: true,
        candidatesConsidered: ["gmail-send"],
        contractSatisfied: true,
        missingRequiredProperties: [],
        rejectedPseudoRepresentations: [],
        loweringOutcome: "lowered",
        packageFatal: false,
        remediationHint: "",
      }],
      summary: {
        totalCriticalSteps: 1,
        totalLoweredSuccessfully: 1,
        totalRejectedForIncompleteContract: 0,
        totalRejectedForNoConcreteMapping: 0,
        totalMixedFamilyConflicts: 0,
        totalPseudoRepresentationRejections: 0,
        totalFrameworkIncompatible: 0,
        totalPackageUnavailable: 0,
      },
    };

    const merged = mergeLoweringDiagnostics(undefined, diag, undefined);
    expect(merged.perStepResults).toHaveLength(1);
    expect(merged.summary.totalCriticalSteps).toBe(1);
  });

  it("preserves pre-emission fatal failures even when stub replaces workflow", () => {
    const preEmissionFatal: CriticalActivityLoweringDiagnostics = {
      perStepResults: [{
        file: "Main.xaml",
        workflow: "Main",
        sourceStep: "Send Gmail",
        detectedIntent: "GmailSendMessage",
        selectedFamily: "gmail-send",
        resolvedConcreteType: "GmailSendMessage",
        resolvedPackage: "UiPath.GSuite.Activities",
        targetFrameworkCompatibility: "Windows",
        verifiedDependencyMatch: false,
        candidatesConsidered: ["gmail-send"],
        contractSatisfied: false,
        missingRequiredProperties: ["Body", "Subject"],
        rejectedPseudoRepresentations: [],
        loweringOutcome: "rejected_incomplete_contract",
        packageFatal: true,
        remediationHint: "Missing Body, Subject",
      }],
      summary: {
        totalCriticalSteps: 1,
        totalLoweredSuccessfully: 0,
        totalRejectedForIncompleteContract: 1,
        totalRejectedForNoConcreteMapping: 0,
        totalMixedFamilyConflicts: 0,
        totalPseudoRepresentationRejections: 0,
        totalFrameworkIncompatible: 0,
        totalPackageUnavailable: 0,
      },
    };

    const xamlLevelEmpty: CriticalActivityLoweringDiagnostics = {
      perStepResults: [],
      summary: {
        totalCriticalSteps: 0,
        totalLoweredSuccessfully: 0,
        totalRejectedForIncompleteContract: 0,
        totalRejectedForNoConcreteMapping: 0,
        totalMixedFamilyConflicts: 0,
        totalPseudoRepresentationRejections: 0,
        totalFrameworkIncompatible: 0,
        totalPackageUnavailable: 0,
      },
    };

    const merged = mergeLoweringDiagnostics(preEmissionFatal, xamlLevelEmpty);
    expect(merged.perStepResults).toHaveLength(1);
    expect(merged.perStepResults[0].packageFatal).toBe(true);
    expect(merged.perStepResults[0].loweringOutcome).toBe("rejected_incomplete_contract");
    expect(merged.perStepResults[0].missingRequiredProperties).toContain("Body");
    expect(merged.summary.totalRejectedForIncompleteContract).toBe(1);
  });
});

describe("Mail family lock — cluster detection", () => {
  it("detects a standalone Gmail send as a single cluster", () => {
    const nodes: WorkflowNode[] = [
      {
        kind: "activity" as const,
        template: "GmailSendMessage",
        displayName: "Send Gmail",
        properties: { To: "a@b.com", Subject: "S", Body: "B" },
        errorHandling: "none" as const,
      },
    ];

    const clusters = detectMailSendClusters(nodes, "Main.xaml", "Main");
    expect(clusters).toHaveLength(1);
    expect(clusters[0].concreteSendNode).toBeDefined();
    expect(clusters[0].concreteSendNode!.template).toBe("GmailSendMessage");
    expect(clusters[0].detectedFamilies.has("gmail-send")).toBe(true);
    expect(clusters[0].hasNarrativeContainer).toBe(false);
  });

  it("detects Gmail inside TryCatch as a cluster", () => {
    const nodes: WorkflowNode[] = [
      {
        kind: "tryCatch" as const,
        displayName: "Try Send Email",
        tryChildren: [
          {
            kind: "activity" as const,
            template: "GmailSendMessage",
            displayName: "Send Gmail",
            properties: { To: "a@b.com", Subject: "S", Body: "B" },
            errorHandling: "none" as const,
          },
        ],
        catchChildren: [
          {
            kind: "activity" as const,
            template: "LogMessage",
            displayName: "Log Error",
            properties: { Message: "Failed" },
            errorHandling: "none" as const,
          },
        ],
        finallyChildren: [],
      },
    ];

    const clusters = detectMailSendClusters(nodes, "Main.xaml", "Main");
    expect(clusters).toHaveLength(1);
    expect(clusters[0].concreteSendNode).toBeDefined();
    expect(clusters[0].concreteSendNode!.template).toBe("GmailSendMessage");
    expect(clusters[0].nodes.some(n => n.role === "trycatch-wrapper")).toBe(true);
    expect(clusters[0].nodes.some(n => n.role === "catch-step")).toBe(true);
  });

  it("detects Gmail inside RetryScope as a cluster", () => {
    const nodes: WorkflowNode[] = [
      {
        kind: "retryScope" as const,
        displayName: "Retry Send",
        numberOfRetries: 3,
        retryInterval: "00:00:05",
        bodyChildren: [
          {
            kind: "activity" as const,
            template: "GmailSendMessage",
            displayName: "Send Gmail",
            properties: { To: "a@b.com", Subject: "S", Body: "B" },
            errorHandling: "none" as const,
          },
        ],
      },
    ];

    const clusters = detectMailSendClusters(nodes, "Main.xaml", "Main");
    expect(clusters).toHaveLength(1);
    expect(clusters[0].nodes.some(n => n.role === "retryscope-wrapper")).toBe(true);
  });

  it("detects mail send nested inside an if-then branch", () => {
    const nodes: WorkflowNode[] = [
      {
        kind: "if" as const,
        displayName: "Check condition",
        condition: "True",
        thenChildren: [
          {
            kind: "activity" as const,
            template: "GmailSendMessage",
            displayName: "Send Gmail",
            properties: { To: "a@b.com", Subject: "S", Body: "B" },
            errorHandling: "none" as const,
          },
        ],
        elseChildren: [],
      },
    ];

    const clusters = detectMailSendClusters(nodes, "Main.xaml", "Main");
    expect(clusters).toHaveLength(1);
    expect(clusters[0].concreteSendNode!.template).toBe("GmailSendMessage");
  });

  it("detects mail send nested inside a sequence inside a while loop", () => {
    const nodes: WorkflowNode[] = [
      {
        kind: "while" as const,
        displayName: "Retry loop",
        condition: "retryCount < 3",
        bodyChildren: [
          {
            kind: "sequence" as const,
            displayName: "Inner Sequence",
            children: [
              {
                kind: "activity" as const,
                template: "SendSmtpMailMessage",
                displayName: "Send SMTP",
                properties: { To: "a@b.com", Subject: "S", Body: "B", Server: "smtp.x.com", Port: "25" },
                errorHandling: "none" as const,
              },
            ],
          },
        ],
      },
    ];

    const clusters = detectMailSendClusters(nodes, "Main.xaml", "Main");
    expect(clusters).toHaveLength(1);
    expect(clusters[0].concreteSendNode!.template).toBe("SendSmtpMailMessage");
    expect(clusters[0].detectedFamilies.has("smtp-send")).toBe(true);
  });

  it("detects mail send nested inside a forEach loop", () => {
    const nodes: WorkflowNode[] = [
      {
        kind: "forEach" as const,
        displayName: "For Each Recipient",
        itemType: "System.String",
        valuesExpression: "recipients",
        iteratorName: "item",
        bodyChildren: [
          {
            kind: "activity" as const,
            template: "SendOutlookMailMessage",
            displayName: "Send Outlook",
            properties: { To: "item", Subject: "S", Body: "B" },
            errorHandling: "none" as const,
          },
        ],
      },
    ];

    const clusters = detectMailSendClusters(nodes, "Main.xaml", "Main");
    expect(clusters).toHaveLength(1);
    expect(clusters[0].concreteSendNode!.template).toBe("SendOutlookMailMessage");
    expect(clusters[0].detectedFamilies.has("outlook-send")).toBe(true);
  });

  it("detects mail sends at multiple nesting depths", () => {
    const nodes: WorkflowNode[] = [
      {
        kind: "activity" as const,
        template: "GmailSendMessage",
        displayName: "Top-level Gmail",
        properties: { To: "a@b.com", Subject: "S", Body: "B" },
        errorHandling: "none" as const,
      },
      {
        kind: "if" as const,
        displayName: "Conditional",
        condition: "True",
        thenChildren: [
          {
            kind: "sequence" as const,
            displayName: "Nested Seq",
            children: [
              {
                kind: "activity" as const,
                template: "SendSmtpMailMessage",
                displayName: "Nested SMTP",
                properties: { To: "b@c.com", Subject: "S2", Body: "B2", Server: "smtp.x.com", Port: "25" },
                errorHandling: "none" as const,
              },
            ],
          },
        ],
        elseChildren: [],
      },
    ];

    const clusters = detectMailSendClusters(nodes, "Main.xaml", "Main");
    expect(clusters).toHaveLength(2);
    expect(clusters[0].concreteSendNode!.template).toBe("GmailSendMessage");
    expect(clusters[1].concreteSendNode!.template).toBe("SendSmtpMailMessage");
  });
});

describe("Mail family lock — locking", () => {
  it("locks a Gmail cluster successfully with all properties", () => {
    const cluster: MailSendCluster = {
      clusterId: "Main.xaml:Main:mail-cluster-0",
      file: "Main.xaml",
      workflow: "Main",
      nodes: [{
        nodeIndex: 0,
        displayName: "Send Gmail",
        template: "GmailSendMessage",
        detectedFamily: "gmail-send",
        role: "concrete-send",
        properties: { To: "a@b.com", Subject: "S", Body: "B" },
      }],
      concreteSendNode: {
        nodeIndex: 0,
        displayName: "Send Gmail",
        template: "GmailSendMessage",
        detectedFamily: "gmail-send",
        role: "concrete-send",
        properties: { To: "a@b.com", Subject: "S", Body: "B" },
      },
      detectedFamilies: new Set(["gmail-send"]),
      hasNarrativeContainer: false,
      narrativeRepresentationsFound: [],
    };

    const result = lockClusterToFamily(cluster, WINDOWS_PROFILE, ALL_PACKAGES);
    expect(result.locked).toBe(true);
    expect(result.selectedFamily).toBe("gmail-send");
    expect(result.concreteActivityType).toBe("UiPath.GSuite.Activities.GmailSendMessage");
    expect(result.packageFatal).toBe(false);
  });

  it("rejects cluster with missing Body property", () => {
    const cluster: MailSendCluster = {
      clusterId: "Main.xaml:Main:mail-cluster-0",
      file: "Main.xaml",
      workflow: "Main",
      nodes: [{
        nodeIndex: 0,
        displayName: "Send Gmail",
        template: "GmailSendMessage",
        detectedFamily: "gmail-send",
        role: "concrete-send",
        properties: { To: "a@b.com", Subject: "S" },
      }],
      concreteSendNode: {
        nodeIndex: 0,
        displayName: "Send Gmail",
        template: "GmailSendMessage",
        detectedFamily: "gmail-send",
        role: "concrete-send",
        properties: { To: "a@b.com", Subject: "S" },
      },
      detectedFamilies: new Set(["gmail-send"]),
      hasNarrativeContainer: false,
      narrativeRepresentationsFound: [],
    };

    const result = lockClusterToFamily(cluster, WINDOWS_PROFILE, ALL_PACKAGES);
    expect(result.locked).toBe(false);
    expect(result.packageFatal).toBe(true);
    expect(result.missingRequiredProperties).toContain("Body");
  });

  it("rejects cluster with ambiguous mail family", () => {
    const cluster: MailSendCluster = {
      clusterId: "Main.xaml:Main:mail-cluster-0",
      file: "Main.xaml",
      workflow: "Main",
      nodes: [{
        nodeIndex: 0,
        displayName: "Send Mail",
        template: "SendMail",
        detectedFamily: "ambiguous-mail",
        role: "concrete-send",
        properties: { To: "a@b.com", Subject: "S", Body: "B" },
      }],
      concreteSendNode: {
        nodeIndex: 0,
        displayName: "Send Mail",
        template: "SendMail",
        detectedFamily: "ambiguous-mail",
        role: "concrete-send",
        properties: { To: "a@b.com", Subject: "S", Body: "B" },
      },
      detectedFamilies: new Set(["ambiguous-mail-send"]),
      hasNarrativeContainer: false,
      narrativeRepresentationsFound: [],
    };

    const result = lockClusterToFamily(cluster, WINDOWS_PROFILE, ALL_PACKAGES);
    expect(result.locked).toBe(false);
    expect(result.packageFatal).toBe(true);
    expect(result.lockRejectionReason).toContain("ambiguous");
  });

  it("rejects cluster with ambiguous-mail via dedicated branch", () => {
    const cluster: MailSendCluster = {
      clusterId: "Main.xaml:Main:mail-cluster-0",
      file: "Main.xaml",
      workflow: "Main",
      nodes: [],
      concreteSendNode: null,
      detectedFamilies: new Set(["ambiguous-mail-send"]),
      hasNarrativeContainer: false,
      narrativeRepresentationsFound: [],
    };

    const result = lockClusterToFamily(cluster, WINDOWS_PROFILE, ALL_PACKAGES);
    expect(result.locked).toBe(false);
    expect(result.packageFatal).toBe(true);
  });

  it("rejects cluster with conflicting families", () => {
    const cluster: MailSendCluster = {
      clusterId: "Main.xaml:Main:mail-cluster-0",
      file: "Main.xaml",
      workflow: "Main",
      nodes: [],
      concreteSendNode: null,
      detectedFamilies: new Set(["gmail-send", "smtp-send"]),
      hasNarrativeContainer: false,
      narrativeRepresentationsFound: [],
    };

    const result = lockClusterToFamily(cluster, WINDOWS_PROFILE, ALL_PACKAGES);
    expect(result.locked).toBe(false);
    expect(result.packageFatal).toBe(true);
    expect(result.crossFamilyDriftViolation).toBe(true);
  });
});

describe("Mail family lock — narrative container elimination", () => {
  it("rejects cluster with narrative TryCatch representation", () => {
    const cluster: MailSendCluster = {
      clusterId: "Main.xaml:Main:mail-cluster-0",
      file: "Main.xaml",
      workflow: "Main",
      nodes: [{
        nodeIndex: 0,
        displayName: "Send Gmail",
        template: "GmailSendMessage",
        detectedFamily: "gmail-send",
        role: "concrete-send",
        properties: { To: "a@b.com", Subject: "S", Body: 'Try = "GmailSendMessage(to=user)"' },
      }],
      concreteSendNode: {
        nodeIndex: 0,
        displayName: "Send Gmail",
        template: "GmailSendMessage",
        detectedFamily: "gmail-send",
        role: "concrete-send",
        properties: { To: "a@b.com", Subject: "S", Body: 'Try = "GmailSendMessage(to=user)"' },
      },
      detectedFamilies: new Set(["gmail-send"]),
      hasNarrativeContainer: true,
      narrativeRepresentationsFound: ["narrative-try-send"],
    };

    const result = lockClusterToFamily(cluster, WINDOWS_PROFILE, ALL_PACKAGES);
    expect(result.locked).toBe(false);
    expect(result.packageFatal).toBe(true);
    expect(result.narrativeRepresentationsRejected).toContain("narrative-try-send");
    expect(result.lockRejectionReason).toContain("narrative container");
  });

  it("rejects cluster with catch narrative representation", () => {
    const cluster: MailSendCluster = {
      clusterId: "Main.xaml:Main:mail-cluster-0",
      file: "Main.xaml",
      workflow: "Main",
      nodes: [{
        nodeIndex: 0,
        displayName: "Send Gmail",
        template: "GmailSendMessage",
        detectedFamily: "gmail-send",
        role: "concrete-send",
        properties: { To: "a@b.com", Subject: "S", Body: 'B', Catches: '"Exception -> LogError"' },
      }],
      concreteSendNode: null,
      detectedFamilies: new Set(["gmail-send"]),
      hasNarrativeContainer: true,
      narrativeRepresentationsFound: ["narrative-catch-block"],
    };

    const result = lockClusterToFamily(cluster, WINDOWS_PROFILE, ALL_PACKAGES);
    expect(result.locked).toBe(false);
    expect(result.packageFatal).toBe(true);
    expect(result.narrativeRepresentationsRejected).toContain("narrative-catch-block");
  });

  it("does not inject placeholders for rejected narrative clusters", () => {
    const cluster: MailSendCluster = {
      clusterId: "Main.xaml:Main:mail-cluster-0",
      file: "Main.xaml",
      workflow: "Main",
      nodes: [{
        nodeIndex: 0,
        displayName: "Send Gmail",
        template: "GmailSendMessage",
        detectedFamily: "gmail-send",
        role: "concrete-send",
        properties: { To: "a@b.com", Subject: "S", Body: 'Try = "GmailSendMessage(to=user)"' },
      }],
      concreteSendNode: null,
      detectedFamilies: new Set(["gmail-send"]),
      hasNarrativeContainer: true,
      narrativeRepresentationsFound: ["narrative-try-send"],
    };

    const result = lockClusterToFamily(cluster, WINDOWS_PROFILE, ALL_PACKAGES);
    expect(result.locked).toBe(false);
    expect(result.concreteActivityType).toBeNull();
    expect(result.concretePackage).toBeNull();
  });
});

describe("Mail family lock — cross-family drift guardrails", () => {
  it("detects Gmail-locked cluster producing SMTP activity tag in XAML", () => {
    const lockResults: MailFamilyLockResult[] = [{
      clusterId: "Main.xaml:Main:mail-cluster-0",
      file: "Main.xaml",
      workflow: "Main",
      selectedFamily: "gmail-send",
      concreteActivityType: "UiPath.GSuite.Activities.GmailSendMessage",
      concretePackage: "UiPath.GSuite.Activities",
      locked: true,
      lockRejectionReason: null,
      narrativeRepresentationsRejected: [],
      missingRequiredProperties: [],
      packageFatal: false,
      crossFamilyDriftViolation: false,
    }];

    const xaml = `<Activity>
      <Sequence DisplayName="Main">
        <ui:GmailSendMessage DisplayName="Send Gmail" To="a@b.com" Subject="S" Body="B" />
        <ui:SendSmtpMailMessage DisplayName="Send SMTP" To="b@c.com" Subject="S2" Body="B2" Server="smtp.x.com" Port="25" />
      </Sequence>
    </Activity>`;

    const violations = checkCrossFamilyDriftInXaml(xaml, lockResults, "Main.xaml");
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].violationType).toBe("wrong-family-activity-tag");
    expect(violations[0].packageFatal).toBe(true);
    expect(violations[0].lockedFamily).toBe("gmail-send");
  });

  it("detects Gmail-locked cluster with UiPath.Mail.Activities in dependencies", () => {
    const lockResults: MailFamilyLockResult[] = [{
      clusterId: "Main.xaml:Main:mail-cluster-0",
      file: "Main.xaml",
      workflow: "Main",
      selectedFamily: "gmail-send",
      concreteActivityType: "UiPath.GSuite.Activities.GmailSendMessage",
      concretePackage: "UiPath.GSuite.Activities",
      locked: true,
      lockRejectionReason: null,
      narrativeRepresentationsRejected: [],
      missingRequiredProperties: [],
      packageFatal: false,
      crossFamilyDriftViolation: false,
    }];

    const violations = checkCrossFamilyDriftInDependencies(
      { "UiPath.GSuite.Activities": {}, "UiPath.Mail.Activities": {} },
      lockResults,
    );

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].violationType).toBe("wrong-family-package");
    expect(violations[0].violatingArtifact).toBe("UiPath.Mail.Activities");
    expect(violations[0].packageFatal).toBe(true);
  });

  it("no violations when Gmail-locked and only GSuite package present", () => {
    const lockResults: MailFamilyLockResult[] = [{
      clusterId: "Main.xaml:Main:mail-cluster-0",
      file: "Main.xaml",
      workflow: "Main",
      selectedFamily: "gmail-send",
      concreteActivityType: "UiPath.GSuite.Activities.GmailSendMessage",
      concretePackage: "UiPath.GSuite.Activities",
      locked: true,
      lockRejectionReason: null,
      narrativeRepresentationsRejected: [],
      missingRequiredProperties: [],
      packageFatal: false,
      crossFamilyDriftViolation: false,
    }];

    const violations = checkCrossFamilyDriftInDependencies(
      { "UiPath.GSuite.Activities": {} },
      lockResults,
    );

    expect(violations).toHaveLength(0);
  });
});

describe("Mail family lock — diagnostics and package violations", () => {
  it("buildMailFamilyLockDiagnostics produces correct summary", () => {
    const lockResults: MailFamilyLockResult[] = [
      {
        clusterId: "c1", file: "Main.xaml", workflow: "Main",
        selectedFamily: "gmail-send", concreteActivityType: "GmailSendMessage",
        concretePackage: "UiPath.GSuite.Activities", locked: true,
        lockRejectionReason: null, narrativeRepresentationsRejected: [],
        missingRequiredProperties: [], packageFatal: false, crossFamilyDriftViolation: false,
      },
      {
        clusterId: "c2", file: "Main.xaml", workflow: "Main",
        selectedFamily: null, concreteActivityType: null,
        concretePackage: null, locked: false,
        lockRejectionReason: "ambiguous mail family", narrativeRepresentationsRejected: [],
        missingRequiredProperties: [], packageFatal: true, crossFamilyDriftViolation: false,
      },
      {
        clusterId: "c3", file: "Main.xaml", workflow: "Main",
        selectedFamily: "gmail-send", concreteActivityType: "GmailSendMessage",
        concretePackage: "UiPath.GSuite.Activities", locked: false,
        lockRejectionReason: "narrative container", narrativeRepresentationsRejected: ["narrative-try-send"],
        missingRequiredProperties: [], packageFatal: true, crossFamilyDriftViolation: false,
      },
    ];

    const diag = buildMailFamilyLockDiagnostics(lockResults);
    expect(diag.summary.totalClusters).toBe(3);
    expect(diag.summary.totalLocked).toBe(1);
    expect(diag.summary.totalRejectedAmbiguous).toBe(1);
    expect(diag.summary.totalRejectedNarrative).toBe(1);
  });

  it("rejected clusters feed into packageCompletenessViolations", () => {
    const diag: MailFamilyLockDiagnostics = {
      perClusterResults: [{
        clusterId: "Main.xaml:Main:mail-cluster-0",
        file: "Main.xaml",
        workflow: "Main",
        selectedFamily: null,
        concreteActivityType: null,
        concretePackage: null,
        locked: false,
        lockRejectionReason: "Cluster has ambiguous mail family",
        narrativeRepresentationsRejected: [],
        missingRequiredProperties: [],
        packageFatal: true,
        crossFamilyDriftViolation: false,
      }],
      summary: {
        totalClusters: 1, totalLocked: 0, totalRejectedAmbiguous: 1,
        totalRejectedNarrative: 0, totalRejectedMissingProperties: 0,
        totalCrossFamilyDriftViolations: 0,
      },
    };

    const violations = mailFamilyLockToPackageViolations(diag);
    expect(violations).toHaveLength(1);
    expect(violations[0].packageFatal).toBe(true);
    expect(violations[0].violationType).toBe("critical_activity_lowering_failure");
    expect(violations[0].severity).toBe("execution_blocking");
  });

  it("cross-family drift violations feed into packageCompletenessViolations", () => {
    const driftViolations = [{
      clusterId: "Main.xaml:Main:mail-cluster-0",
      lockedFamily: "gmail-send" as const,
      violatingArtifact: "SendSmtpMailMessage",
      violationType: "wrong-family-activity-tag" as const,
      detail: "Locked to gmail-send but emitted XAML contains <SendSmtpMailMessage>",
      packageFatal: true,
    }];

    const violations = crossFamilyDriftToPackageViolations(driftViolations);
    expect(violations).toHaveLength(1);
    expect(violations[0].packageFatal).toBe(true);
    expect(violations[0].activityType).toBe("SendSmtpMailMessage");
    expect(violations[0].propertyName).toBe("CrossFamilyDrift");
  });
});

describe("Mail family lock — runMailFamilyLockAnalysis integration", () => {
  it("locks Gmail-only workflow successfully", () => {
    const specs = [{
      file: "Main.xaml",
      workflow: "Main",
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main",
        children: [
          {
            kind: "activity" as const,
            template: "GmailSendMessage",
            displayName: "Send Gmail",
            properties: { To: "a@b.com", Subject: "S", Body: "B" },
            errorHandling: "none" as const,
          },
        ] as WorkflowNode[],
      },
    }];

    const result = runMailFamilyLockAnalysis(specs, WINDOWS_PROFILE, ALL_PACKAGES);
    expect(result.summary.totalClusters).toBe(1);
    expect(result.summary.totalLocked).toBe(1);
    expect(result.perClusterResults[0].selectedFamily).toBe("gmail-send");
  });

  it("rejects Gmail cluster with missing properties via lock analysis", () => {
    const specs = [{
      file: "Main.xaml",
      workflow: "Main",
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main",
        children: [
          {
            kind: "activity" as const,
            template: "GmailSendMessage",
            displayName: "Send Gmail",
            properties: { To: "a@b.com" },
            errorHandling: "none" as const,
          },
        ] as WorkflowNode[],
      },
    }];

    const result = runMailFamilyLockAnalysis(specs, WINDOWS_PROFILE, ALL_PACKAGES);
    expect(result.summary.totalClusters).toBe(1);
    expect(result.summary.totalLocked).toBe(0);
    expect(result.summary.totalRejectedMissingProperties).toBe(1);
    expect(result.perClusterResults[0].packageFatal).toBe(true);
  });
});

describe("Mail family lock — XAML-level analysis", () => {
  it("locks Gmail XAML with all properties", () => {
    const xaml = `<Activity>
  <Sequence DisplayName="Main">
    <ui:GmailSendMessage DisplayName="Send Gmail" To="a@b.com" Subject="Test" Body="Hello" />
  </Sequence>
</Activity>`;

    const { diagnostics } = runXamlLevelMailFamilyLockAnalysis(
      [{ name: "Main.xaml", content: xaml }],
      WINDOWS_PROFILE,
      ALL_PACKAGES,
    );

    expect(diagnostics.summary.totalClusters).toBeGreaterThanOrEqual(1);
    const gmailLock = diagnostics.perClusterResults.find(r => r.selectedFamily === "gmail-send");
    expect(gmailLock).toBeDefined();
    expect(gmailLock!.locked).toBe(true);
  });

  it("allows independent clusters of different families in the same XAML (no false-positive drift)", () => {
    const xaml = `<Activity>
  <Sequence DisplayName="Main">
    <ui:GmailSendMessage DisplayName="Send Gmail" To="a@b.com" Subject="S" Body="B" />
    <ui:SendSmtpMailMessage DisplayName="Send SMTP" To="b@c.com" Subject="S2" Body="B2" Server="smtp.x.com" Port="25" />
  </Sequence>
</Activity>`;

    const { crossFamilyViolations, diagnostics } = runXamlLevelMailFamilyLockAnalysis(
      [{ name: "Main.xaml", content: xaml }],
      WINDOWS_PROFILE,
      ALL_PACKAGES,
    );

    expect(diagnostics.summary.totalClusters).toBeGreaterThanOrEqual(2);
    expect(crossFamilyViolations.length).toBe(0);
  });

  it("detects cross-family drift when unattributed wrong-family tag appears in XAML", () => {
    const lockResults: MailFamilyLockResult[] = [{
      clusterId: "test.xaml:Main:mail-cluster-0",
      file: "test.xaml",
      workflow: "Main",
      selectedFamily: "gmail-send",
      concreteActivityType: "GmailSendMessage",
      concretePackage: "UiPath.GSuite.Activities",
      locked: true,
      lockRejectionReason: null,
      narrativeRepresentationsRejected: [],
      missingRequiredProperties: [],
      packageFatal: false,
      crossFamilyDriftViolation: false,
    }];

    const xamlWithDrift = `<Activity><Sequence><ui:GmailSendMessage /><ui:SendSmtpMailMessage /></Sequence></Activity>`;
    const violations = checkCrossFamilyDriftInXaml(xamlWithDrift, lockResults, "test.xaml");
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].violationType).toBe("wrong-family-activity-tag");
    expect(violations[0].packageFatal).toBe(true);
  });
});
