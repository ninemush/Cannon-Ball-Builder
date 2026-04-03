# Pipeline Run Diagnostic: 47058712-07a2-4bdc-8af8-9552ef165ac7

  ## Run Info
  - Idea ID: fcbe5f6d-60a1-45f7-8c96-5df24f1173b0
  - Status: completed_with_warnings
  - Mode: baseline_openable
  - Duration: 277,503ms
  - Completed: 2026-04-03 15:01:21 UTC

  ## Spec Snapshot

  ```json
  {
  "timestamp": "2026-04-03T15:00:49.597Z",
  "partialSpec": {
    "workflows": [
      {
        "name": "HandleHumanReview",
        "steps": [
          {
            "notes": "INFO: Entry log; captures all routing context. Mode is either ContentReview or ContactDisambiguation.",
            "activity": "Log entry into HandleHumanReview with mode and context",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[HandleHumanReview] START - RunId=\" & InRunId & \" | FullName=\" & InFullName & \" | Mode=\" & InReviewMode & \" | RecipientEmail=\" & InRecipientEmail"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: If asset read fails (network/Orchestrator unavailable), default allowActionCenterFallback remains True so the task creation attempt still proceeds. Log warning on catch.",
            "activity": "Read BGV26_AllowActionCenterFallback asset",
            "properties": {
              "Value": {
                "name": "allowActionCenterFallback",
                "type": "variable"
              },
              "AssetName": {
                "type": "literal",
                "value": "BGV26_AllowActionCenterFallback"
              }
            },
            "activityType": "GetAsset",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "INFO: Confirms runtime asset value so ops can diagnose if tasks are unexpectedly suppressed.",
            "activity": "Log asset read result for AllowActionCenterFallback",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[HandleHumanReview] AllowActionCenterFallback=\" & allowActionCenterFallback.ToString()"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "DECISION: If asset disables AC fallback, assign default Reject outcomes and return immediately to avoid creating unwanted tasks.",
            "activity": "Guard: if Action Center fallback disabled, assign Reject and exit early",
            "properties": {
              "Condition": {
                "left": "allowActionCenterFallback",
                "type": "expression",
                "right": "False",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "Assigns all output arguments to safe defaults. OutDecision=Reject tells caller to skip sending. Log immediately after.",
            "activity": "Assign Reject defaults when Action Center is disabled",
            "properties": {
              "Assigns": {
                "type": "vb_expression",
                "value": "New Object() {New Object() {\"OutDecision\", \"Reject\"}, New Object() {\"OutApprovedSubject\", \"\"}, New Object() {\"OutApprovedBody\", \"\"}, New Object() {\"OutSelectedEmail\", \"\"}, New Object() {\"OutReviewerComments\", \"ActionCenterFallbackDisabled\"}}"
              }
            },
            "activityType": "MultipleAssign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.ComplexScenarios.Activities"
          },
          {
            "notes": "WARN: Ops visibility when tasks are suppressed by config. Caller will skip sending for this person.",
            "activity": "Log early exit because Action Center fallback is disabled",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Warn"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[HandleHumanReview] Action Center fallback disabled via asset. Returning Reject for FullName=\" & InFullName & \" RunId=\" & InRunId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Sets boolean used in subsequent branching. True = draft validation failure; False = ContactDisambiguation.",
            "activity": "Determine review mode: set isContentReviewMode flag",
            "properties": {
              "To": {
                "name": "isContentReviewMode",
                "type": "variable"
              },
              "Value": {
                "left": "InReviewMode",
                "type": "expression",
                "right": "\"ContentReview\"",
                "operator": "="
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "DECISION: Branches to assign mode-specific task title. ContentReview vs ContactDisambiguation affects form population and reviewer instructions.",
            "activity": "Build task title based on review mode",
            "properties": {
              "Condition": {
                "left": "isContentReviewMode",
                "type": "expression",
                "right": "True",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "Title includes FullName and RunId so reviewers can immediately identify the record in Action Center inbox.",
            "activity": "Assign task title for ContentReview mode",
            "properties": {
              "To": {
                "name": "taskTitle",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "\"[BGV26] Content Review Required - \" & InFullName & \" (RunId: \" & InRunId & \")\""
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "Else branch: ContactDisambiguation title. Reviewers will see candidate contacts list in form body.",
            "activity": "Assign task title for ContactDisambiguation mode",
            "properties": {
              "To": {
                "name": "taskTitle",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "\"[BGV26] Contact Disambiguation Required - \" & InFullName & \" (RunId: \" & InRunId & \")\""
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "INFO: Pre-creation audit log. If task creation fails, this log confirms the title/mode that was attempted.",
            "activity": "Log task title and mode before task creation",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[HandleHumanReview] Creating Action Center task. Title=\" & taskTitle & \" | Mode=\" & InReviewMode & \" | Catalog=\" & taskCatalogName"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: Specific failures: Action Center API unavailable (network), invalid catalog name (config error), authentication expiry. On catch, set taskCreationFailed=True, log error with RunId+FullName, take screenshot, assign Reject outputs, and return. Do NOT rethrow — caller must continue processing remaining birthdays.",
            "activity": "Create Action Center form task for human review",
            "properties": {
              "Title": {
                "name": "taskTitle",
                "type": "variable"
              },
              "Priority": {
                "type": "literal",
                "value": "High"
              },
              "TaskObject": {
                "name": "taskObject",
                "type": "variable"
              },
              "AssignedToUser": {
                "type": "literal",
                "value": "BirthdayGreetings_Reviewer"
              },
              "FormSchemaPath": {
                "name": "taskFormSchemaPath",
                "type": "variable"
              },
              "TaskCatalogName": {
                "name": "taskCatalogName",
                "type": "variable"
              }
            },
            "activityType": "CreateFormTask",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.Persistence.Activities"
          },
          {
            "notes": "ERROR: Logged only when taskCreationFailed=True. Provides full context for ops investigation. exceptionMessage populated in catch handler before this step.",
            "activity": "Log Action Center task creation failure and assign Reject",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Error"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[HandleHumanReview] CATCH CreateFormTask failed. RunId=\" & InRunId & \" | FullName=\" & InFullName & \" | Mode=\" & InReviewMode & \" | Exception=\" & exceptionMessage"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Screenshot captured even on unattended sessions for error artifacts. Path pattern is BGV26_HandleHumanReview_CreateFail_{RunId}_{Timestamp}.png.",
            "activity": "Take screenshot as evidence on task creation failure",
            "properties": {
              "FileName": {
                "type": "vb_expression",
                "value": "\"C:\\Temp\\BGV26_HandleHumanReview_CreateFail_\" & InRunId & \"_\" & System.DateTime.UtcNow.ToString(\"yyyyMMddHHmmss\") & \".png\""
              }
            },
            "activityType": "TakeScreenshot",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.UIAutomation.Activities"
          },
          {
            "notes": "Safe fallback: caller receives Reject so it skips sending rather than sending unvalidated content.",
            "activity": "Assign Reject defaults on task creation failure",
            "properties": {
              "Assigns": {
                "type": "vb_expression",
                "value": "New Object() {New Object() {\"OutDecision\", \"Reject\"}, New Object() {\"OutApprovedSubject\", \"\"}, New Object() {\"OutApprovedBody\", \"\"}, New Object() {\"OutSelectedEmail\", \"\"}, New Object() {\"OutReviewerComments\", \"TaskCreationFailed: \" & exceptionMessage}}"
              }
            },
            "activityType": "MultipleAssign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.ComplexScenarios.Activities"
          },
          {
            "notes": "DECISION: If task was not created successfully, skip the WaitForFormTask block entirely and proceed to output assignment. Prevents null reference on taskObject.",
            "activity": "Guard: skip wait if task creation already failed",
            "properties": {
              "Condition": {
                "left": "taskCreationFailed",
                "type": "expression",
                "right": "True",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "INFO: Confirms task object is valid and workflow is entering wait state. SLA hours recorded for ops awareness.",
            "activity": "Log task created successfully; waiting for reviewer",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[HandleHumanReview] Task created. Waiting for reviewer. SLA=\" & slaDurationHours.ToString() & \" hours | RunId=\" & InRunId & \" | FullName=\" & InFullName"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: Specific failures: timeout (SLA exceeded — assign Reject and log Warn), Action Center service error (assign Reject, log Error, take screenshot). TimeoutMS = slaDurationHours * 3600000 milliseconds (6 hours default = 21600000 ms). On timeout, do not block the run — Reject prevents unsafe send.",
            "activity": "Wait for Action Center form task and resume on completion or timeout",
            "properties": {
              "FormData": {
                "name": "taskActionCenterResult",
                "type": "variable"
              },
              "TimeoutMS": {
                "type": "vb_expression",
                "value": "slaDurationHours * 3600000"
              },
              "TaskObject": {
                "name": "taskObject",
                "type": "variable"
              },
              "TaskStatus": {
                "name": "approvalDecisionRaw",
                "type": "variable"
              }
            },
            "activityType": "WaitForFormTaskAndResume",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.Persistence.Activities"
          },
          {
            "notes": "WARN: SLA timeout is expected in some scenarios (reviewer unavailable). Logged as Warn not Error. System exception from AC would be Error level.",
            "activity": "Log wait failure or timeout and assign Reject outcome",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Warn"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[HandleHumanReview] CATCH WaitForFormTaskAndResume failed or timed out. Assigning Reject. RunId=\" & InRunId & \" | FullName=\" & InFullName & \" | Exception=\" & exceptionMessage"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "taskWaitFailed=True used by downstream guard to skip result extraction. Safe defaults prevent stale/null data flowing to caller.",
            "activity": "Assign Reject defaults on wait failure or timeout",
            "properties": {
              "Assigns": {
                "type": "vb_expression",
                "value": "New Object() {New Object() {\"taskWaitFailed\", True}, New Object() {\"OutDecision\", \"Reject\"}, New Object() {\"OutApprovedSubject\", \"\"}, New Object() {\"OutApprovedBody\", \"\"}, New Object() {\"OutSelectedEmail\", \"\"}, New Object() {\"OutReviewerComments\", \"SLATimeoutOrWaitError: \" & exceptionMessage}}"
              }
            },
            "activityType": "MultipleAssign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.ComplexScenarios.Activities"
          },
          {
            "notes": "Evidence artifact stored locally; caller workflow or Finalize may upload to Storage Bucket.",
            "activity": "Take screenshot on wait failure for evidence",
            "properties": {
              "FileName": {
                "type": "vb_expression",
                "value": "\"C:\\Temp\\BGV26_HandleHumanReview_WaitFail_\" & InRunId & \"_\" & System.DateTime.UtcNow.ToString(\"yyyyMMddHHmmss\") & \".png\""
              }
            },
            "activityType": "TakeScreenshot",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.UIAutomation.Activities"
          },
          {
            "notes": "DECISION: If wait failed, skip all result extraction steps. Reject outputs are already assigned. Log and return.",
            "activity": "Guard: skip result extraction if wait failed or timed out",
            "properties": {
              "Condition": {
                "left": "taskWaitFailed",
                "type": "expression",
                "right": "True",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "INFO: Confirms reviewer acted within SLA. Downstream extraction reads taskActionCenterResult dictionary.",
            "activity": "Log task completed by reviewer; extracting result",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[HandleHumanReview] Task completed by reviewer. Extracting form data. RunId=\" & InRunId & \" | FullName=\" & InFullName & \" | Mode=\" & InReviewMode"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "DECISION: ContentReview extracts ApprovalDecision, ProposedSubject, ProposedBody, ReviewerComments. ContactDisambiguation extracts Decision and SelectedRecipientEmail.",
            "activity": "Branch result extraction by review mode",
            "properties": {
              "Condition": {
                "left": "isContentReviewMode",
                "type": "expression",
                "right": "True",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "CATCH: KeyNotFoundException if form schema changed and expected keys missing. On catch, assign Reject and log Error with field names attempted. Defensive null-check guards against null taskActionCenterResult.",
            "activity": "Extract ContentReview fields from Action Center form data",
            "properties": {
              "Assigns": {
                "type": "vb_expression",
                "value": "New Object() {New Object() {\"approvalDecisionRaw\", If(taskActionCenterResult IsNot Nothing AndAlso CType(taskActionCenterResult, System.Collections.Generic.Dictionary(Of String, Object)).ContainsKey(\"ApprovalDecision\"), CType(taskActionCenterResult, System.Collections.Generic.Dictionary(Of String, Object))(\"ApprovalDecision\").ToString(), \"Reject\")}, New Object() {\"approvedSubjectRaw\", If(taskActionCenterResult IsNot Nothing AndAlso CType(taskActionCenterResult, System.Collections.Generic.Dictionary(Of String, Object)).ContainsKey(\"ProposedSubject\"), CType(taskActionCenterResult, System.Collections.Generic.Dictionary(Of String, Object))(\"ProposedSubject\").ToString(), \"\")}, New Object() {\"approvedBodyRaw\", If(taskActionCenterResult IsNot Nothing AndAlso CType(taskActionCenterResult, System.Collections.Generic.Dictionary(Of String, Object)).ContainsKey(\"ProposedBody\"), CType(taskActionCenterResult, System.Collections.Generic.Dictionary(Of String, Object))(\"ProposedBody\").ToString(), \"\")}, New Object() {\"reviewerCommentsRaw\", If(taskActionCenterResult IsNot Nothing AndAlso CType(taskActionCenterResult, System.Collections.Generic.Dictionary(Of String, Object)).ContainsKey(\"ReviewerComments\"), CType(taskActionCenterResult, System.Collections.Generic.Dictionary(Of String, Object))(\"ReviewerComments\").ToString(), \"\")}}"
              }
            },
            "activityType": "MultipleAssign",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.ComplexScenarios.Activities"
          },
          {
            "notes": "CATCH: Same guard as ContentReview branch. Decision key for ContactDisambiguation is 'Decision' (SelectEmailAndContinue or Skip). SelectedRecipientEmail carries the chosen email address.",
            "activity": "Extract ContactDisambiguation fields from Action Center form data",
            "properties": {
              "Assigns": {
                "type": "vb_expression",
                "value": "New Object() {New Object() {\"approvalDecisionRaw\", If(taskActionCenterResult IsNot Nothing AndAlso CType(taskActionCenterResult, System.Collections.Generic.Dictionary(Of String, Object)).ContainsKey(\"Decision\"), CType(taskActionCenterResult, System.Collections.Generic.Dictionary(Of String, Object))(\"Decision\").ToString(), \"Skip\")}, New Object() {\"selectedEmailRaw\", If(taskActionCenterResult IsNot Nothing AndAlso CType(taskActionCenterResult, System.Collections.Generic.Dictionary(Of String, Object)).ContainsKey(\"SelectedRecipientEmail\"), CType(taskActionCenterResult, System.Collections.Generic.Dictionary(Of String, Object))(\"SelectedRecipientEmail\").ToString(), \"\")}, New Object() {\"reviewerCommentsRaw\", If(taskActionCenterResult IsNot Nothing AndAlso CType(taskActionCenterResult, System.Collections.Generic.Dictionary(Of String, Object)).ContainsKey(\"ReviewerComments\"), CType(taskActionCenterResult, System.Collections.Generic.Dictionary(Of String, Object))(\"ReviewerComments\").ToString(), \"\")}}"
              }
            },
            "activityType": "MultipleAssign",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.ComplexScenarios.Activities"
          },
          {
            "notes": "INFO: Confirms what the reviewer chose. Subject/body not logged here to avoid PII in Orchestrator logs; they are in Data Service records.",
            "activity": "Log extracted decision values before output assignment",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[HandleHumanReview] Extracted reviewer decision. Mode=\" & InReviewMode & \" | Decision=\" & approvalDecisionRaw & \" | SelectedEmail=\" & selectedEmailRaw & \" | RunId=\" & InRunId & \" | FullName=\" & InFullName"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "DECISION: Checks for 'Approve' in ContentReview mode. Separate downstream If checks EditAndApprove and Reject. For ContactDisambiguation, decision is SelectEmailAndContinue or Skip — handled in output mapping below.",
            "activity": "Validate ApprovalDecision value is within expected set",
            "properties": {
              "Condition": {
                "left": "approvalDecisionRaw",
                "type": "expression",
                "right": "\"Approve\"",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "Reviewer approved the draft as-is. Subject and body passed back from the original proposed values stored in approvedSubjectRaw/approvedBodyRaw.",
            "activity": "Assign output arguments for Approve decision (ContentReview)",
            "properties": {
              "Assigns": {
                "type": "vb_expression",
                "value": "New Object() {New Object() {\"OutDecision\", \"Approve\"}, New Object() {\"OutApprovedSubject\", approvedSubjectRaw}, New Object() {\"OutApprovedBody\", approvedBodyRaw}, New Object() {\"OutSelectedEmail\", \"\"}, New Object() {\"OutReviewerComments\", reviewerCommentsRaw}}"
              }
            },
            "activityType": "MultipleAssign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.ComplexScenarios.Activities"
          },
          {
            "notes": "DECISION: EditAndApprove means reviewer has edited subject/body in the form. approvedSubjectRaw and approvedBodyRaw contain reviewer edits.",
            "activity": "Check for EditAndApprove decision (ContentReview)",
            "properties": {
              "Condition": {
                "left": "approvalDecisionRaw",
                "type": "expression",
                "right": "\"EditAndApprove\"",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "OutDecision=Approve so caller treats both Approve and EditAndApprove the same way (proceed to send). Edited content comes from form fields.",
            "activity": "Assign output arguments for EditAndApprove decision (ContentReview)",
            "properties": {
              "Assigns": {
                "type": "vb_expression",
                "value": "New Object() {New Object() {\"OutDecision\", \"Approve\"}, New Object() {\"OutApprovedSubject\", approvedSubjectRaw}, New Object() {\"OutApprovedBody\", approvedBodyRaw}, New Object() {\"OutSelectedEmail\", \"\"}, New Object() {\"OutReviewerComments\", reviewerCommentsRaw}}"
              }
            },
            "activityType": "MultipleAssign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.ComplexScenarios.Activities"
          },
          {
            "notes": "",
            "activity": "Assign output arguments for Reject decision (ContentReview) or default",
            "properties": {
              "Assigns": {
                "type": "vb_expression",
                "value": "New Object() {New Object() {\"OutDecision\", \"Reject\"}, New Object() {\"OutApprovedSubject\", \"\"}, New Object() {\"OutApprovedBody\", \"\"}, New Object() {\"OutSelectedEmail\", \"\"}, New Object() {\"OutReviewerComments\", reviewerCommentsRaw}}"
              }
            },
            "activityType": "MultipleAssign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.ComplexScenarios.Activities"
          }
        ],
        "variables": [
          {
            "name": "allowActionCenterFallback",
            "type": "Boolean",
            "scope": "workflow",
            "defaultValue": "True"
          },
          {
            "name": "taskTitle",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "taskObject",
            "type": "Object",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "taskFormData",
            "type": "Dictionary<String,Object>",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "taskActionCenterResult",
            "type": "Object",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "approvalDecisionRaw",
            "type": "String",
            "scope": "workflow",
            "defaultValue": "Reject"
          },
          {
            "name": "selectedEmailRaw",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "approvedSubjectRaw",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "approvedBodyRaw",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "reviewerCommentsRaw",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "taskCreationFailed",
            "type": "Boolean",
            "scope": "workflow",
            "defaultValue": "False"
          },
          {
            "name": "taskWaitFailed",
            "type": "Boolean",
            "scope": "workflow",
            "defaultValue": "False"
          },
          {
            "name": "logMessage",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "exceptionMessage",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "screenshotPath",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "slaDurationHours",
            "type": "Int32",
            "scope": "workflow",
            "defaultValue": "6"
          },
          {
            "name": "taskCatalogName",
            "type": "String",
            "scope": "workflow",
            "defaultValue": "AC_BirthdayGreetingsV26_HumanReview"
          },
          {
            "name": "isContentReviewMode",
            "type": "Boolean",
            "scope": "workflow",
            "defaultValue": "False"
          },
          {
            "name": "taskFormSchemaPath",
            "type": "String",
            "scope": "workflow",
            "defaultValue": "FormSchemas\\BGV26_HumanReview.json"
          }
        ],
        "description": "Creates an Action Center task in catalog AC_BirthdayGreetingsV26_HumanReview for either draft validation failures (ContentReview mode) or ambiguous contact matches (ContactDisambiguation mode). Populates the task form with run context, proposed subject/body or candidate contacts. Waits for task completion (with SLA awareness). On task resume, reads ApprovalDecision or SelectedRecipientEmail and returns approved content or selected email back to the caller. Inline TryCatch handles Action Center API failures; timeout after SLA triggers rejection outcome rather than blocking the run."
      },
      {
        "name": "GetBirthdays",
        "steps": [
          {
            "notes": "Structured entry log. Level=Info. Records all driving arguments so any issue can be correlated by RunId in Orchestrator logs.",
            "activity": "Log workflow entry with RunId and calendar context",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[GetBirthdays][INFO] Starting. RunId=\" & InRunId & \" | CalendarName=\" & InCalendarName & \" | TimeZone=\" & InTimeZone"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Guards against empty InTimeZone argument from asset. Falls back to America/New_York. No failure path possible for a conditional string assignment.",
            "activity": "Resolve effective timezone — default to InTimeZone arg or fallback constant",
            "properties": {
              "To": {
                "name": "resolvedTimeZone",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "If(String.IsNullOrWhiteSpace(InTimeZone), \"America/New_York\", InTimeZone.Trim())"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: TimeZoneNotFoundException if resolvedTimeZone is unrecognized. Log [WARN] and fall back to UTC date. This prevents a bad asset value from killing the run.",
            "activity": "Compute today's local date from resolved timezone",
            "properties": {
              "To": {
                "name": "todayLocal",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById(resolvedTimeZone)).Date"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Derives start of query window as midnight of today. No runtime failure possible.",
            "activity": "Set calendar query window start (midnight local)",
            "properties": {
              "To": {
                "name": "todayStart",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "todayLocal.Date"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Sets end of query window to 23:59:59 local so all-day birthday events within the calendar date are included.",
            "activity": "Set calendar query window end (end of day local)",
            "properties": {
              "To": {
                "name": "todayEnd",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "todayLocal.Date.AddDays(1).AddSeconds(-1)"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Initializes the output DataTable with the agreed three-column schema. BuildDataTable is configuration-time; no runtime failure expected.",
            "activity": "Build output DataTable schema (FullNameRaw, FullNameNormalized, CalendarEventId)",
            "properties": {
              "Columns": {
                "type": "literal",
                "value": "FullNameRaw(String), FullNameNormalized(String), CalendarEventId(String)"
              },
              "DataTable": {
                "name": "workItemsTable",
                "type": "variable"
              }
            },
            "activityType": "BuildDataTable",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.ComplexScenarios.Activities"
          },
          {
            "notes": "Pre-API-call log. Level=Info. Records exact query window for troubleshooting event retrieval gaps.",
            "activity": "Log: querying Google Calendar Birthdays feed",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[GetBirthdays][INFO] Querying calendar='\" & InCalendarName & \"' for date=\" & todayLocal.ToString(\"yyyy-MM-dd\") & \" (window: \" & todayStart.ToString(\"o\") & \" to \" & todayEnd.ToString(\"o\") & \").\""
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Wraps GoogleCalendarGetEvents to handle transient Google API 503/429/network errors. 3 retries with 10-second interval (exponential backoff would require ShouldRetry; 10s fixed interval is production-safe for this volume). CATCH after exhaustion logs [ERROR] with RunId, uploads screenshot, then rethrows so Main marks the run Failed.",
            "activity": "RetryScope: Get today's events from Google Calendar (up to 3 attempts)",
            "properties": {
              "RetryInterval": {
                "type": "literal",
                "value": "00:00:10"
              },
              "NumberOfRetries": {
                "type": "literal",
                "value": "3"
              }
            },
            "activityType": "RetryScope",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Calls Google Calendar API via GSuite Activities. CalendarId is the calendar name/ID from the BGV26_BirthdaysCalendarName asset passed as InCalendarName. On API timeout or 5xx, RetryScope parent re-executes. On 403/credential error, catch in parent TryCatch logs [ERROR] with ExceptionType=CredentialExpiry and rethrows.",
            "activity": "GoogleCalendarGetEvents: Retrieve birthday events for today",
            "properties": {
              "Events": {
                "name": "birthdayEvents",
                "type": "variable"
              },
              "TimeMax": {
                "name": "todayEnd",
                "type": "variable"
              },
              "TimeMin": {
                "name": "todayStart",
                "type": "variable"
              },
              "CalendarId": {
                "name": "InCalendarName",
                "type": "variable"
              }
            },
            "activityType": "GoogleCalendarGetEvents",
            "selectorHint": null,
            "errorHandling": "retry",
            "activityPackage": "UiPath.GSuite.Activities"
          },
          {
            "notes": "Triggers retry within RetryScope if the events collection returned is Nothing (null API response without exception). Complements exception-based retry for silent null returns.",
            "activity": "ShouldRetry: Check if calendar API returned valid results",
            "properties": {
              "Condition": {
                "left": "birthdayEvents",
                "type": "expression",
                "right": "Nothing",
                "operator": "Is"
              }
            },
            "activityType": "ShouldRetry",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Post-API success confirmation. Level=Info. Logged after RetryScope completes successfully so log shows how many attempts were needed implicitly.",
            "activity": "Log: Calendar API call succeeded",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[GetBirthdays][INFO] GoogleCalendarGetEvents succeeded. RunId=\" & InRunId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Defensive null-guard after RetryScope. If API returned Nothing without throwing (silent failure), log [WARN] and exit cleanly with empty DataTable. This prevents NullReferenceException in the ForEach below.",
            "activity": "Guard: If birthdayEvents is Nothing after retry exhaustion, assign empty collection",
            "properties": {
              "Else": {
                "type": "literal",
                "value": "Proceed to event count and loop"
              },
              "Then": {
                "type": "literal",
                "value": "Log [WARN] no events returned; OutBirthdayWorkItems = empty DataTable; return"
              },
              "Condition": {
                "left": "birthdayEvents",
                "type": "expression",
                "right": "Nothing",
                "operator": "Is"
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Level=Warn. Indicates unexpected null without exception; may indicate API contract change or credential scope gap. Operations can investigate from this log entry.",
            "activity": "Log WARN: Calendar returned null/empty events collection unexpectedly",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Warn"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[GetBirthdays][WARN] birthdayEvents is Nothing after API call. RunId=\" & InRunId & \". Returning empty work items.\""
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: InvalidCastException if GSuite Activities returns an incompatible collection type. Log [ERROR] with ExceptionType=CollectionCastFailure and rethrow. Count used for structured logging.",
            "activity": "Assign eventCount from retrieved events collection length",
            "properties": {
              "To": {
                "name": "eventCount",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "If(birthdayEvents IsNot Nothing, DirectCast(birthdayEvents, System.Collections.ICollection).Count, 0)"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Level=Info. Key operational metric. If eventCount=0, the main workflow will end cleanly. This log provides a daily baseline even on zero-birthday days.",
            "activity": "Log: Event count retrieved from Birthdays calendar",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[GetBirthdays][INFO] Birthday events found today: \" & eventCount.ToString() & \" | Date=\" & todayLocal.ToString(\"yyyy-MM-dd\") & \" | RunId=\" & InRunId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Decision point. Level=Info logged in Then branch. Prevents executing loop body when there are no events. Clean early-exit path per process spec.",
            "activity": "Decision: Are there any birthday events to process?",
            "properties": {
              "Else": {
                "type": "literal",
                "value": "Proceed to ForEach event loop"
              },
              "Then": {
                "type": "literal",
                "value": "Log INFO no birthdays today and skip to output assignment"
              },
              "Condition": {
                "left": "eventCount",
                "type": "expression",
                "right": "0",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Level=Info. Logged inside the Then branch of the zero-event decision. Provides clear operational confirmation that the process reached this branch intentionally.",
            "activity": "Log INFO: No birthday events found for today — clean exit",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[GetBirthdays][INFO] No birthday events found for \" & todayLocal.ToString(\"yyyy-MM-dd\") & \". RunId=\" & InRunId & \". OutBirthdayWorkItems will be empty.\""
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Iterates over the event collection returned by GoogleCalendarGetEvents. TypeArgument=Object because GSuite Activities returns a typed collection but we handle via dynamic cast. CATCH: InvalidOperationException (collection modified during iteration — unlikely but guarded). Log [ERROR] with RunId and rethrow.",
            "activity": "ForEach birthday event: extract and normalize name",
            "properties": {
              "Values": {
                "name": "birthdayEvents",
                "type": "variable"
              },
              "TypeArgument": {
                "type": "literal",
                "value": "Object"
              },
              "iteratorName": {
                "type": "literal",
                "value": "currentEvent"
              }
            },
            "activityType": "ForEach",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: Exception extracting Summary property (stale/null event object, API schema change). Log [WARN] with Step=ExtractSummary, EventIndex, ExceptionType, skip this event via Continue. Defensive reflection-based access guards against GSuite Activities version changes in event object shape.",
            "activity": "Extract raw event title (FullNameRaw) from current event object",
            "properties": {
              "To": {
                "name": "rawEventTitle",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "If(currentEvent IsNot Nothing AndAlso currentEvent.GetType().GetProperty(\"Summary\") IsNot Nothing, CStr(currentEvent.GetType().GetProperty(\"Summary\").GetValue(currentEvent)), String.Empty)"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Decision point. Level=Warn in Then branch. Prevents adding a blank name row to the output DataTable. Per spec: exact-name matching; empty title cannot be matched.",
            "activity": "Guard: Skip event if raw title is empty or whitespace",
            "properties": {
              "Else": {
                "type": "literal",
                "value": "Continue to normalization"
              },
              "Then": {
                "type": "literal",
                "value": "Log WARN empty title and skip this event"
              },
              "Condition": {
                "type": "vb_expression",
                "value": "String.IsNullOrWhiteSpace(rawEventTitle)"
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Level=Warn. Logged inside the Then branch. Allows operations to detect calendar data quality issues without failing the run.",
            "activity": "Log WARN: Skipping event with empty title",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Warn"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[GetBirthdays][WARN] Birthday event has empty Summary/title. Skipping. RunId=\" & InRunId & \" | CalendarEventId=\" & calendarEventId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: Exception extracting Id property (null event, schema mismatch). Log [WARN] with Step=ExtractEventId. Use empty string as fallback so the row is still added with FullName; CalendarEventId is optional for dedup but useful for traceability.",
            "activity": "Extract CalendarEventId from current event object",
            "properties": {
              "To": {
                "name": "calendarEventId",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "If(currentEvent IsNot Nothing AndAlso currentEvent.GetType().GetProperty(\"Id\") IsNot Nothing, CStr(currentEvent.GetType().GetProperty(\"Id\").GetValue(currentEvent)), String.Empty)"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: RegexMatchTimeoutException (unlikely for short strings but defensively guarded). Log [WARN] with Step=NormalizeName, RawTitle. Fall back to rawEventTitle.Trim() as normalizedFullName. Per spec: whitespace trim/collapse ONLY — no fuzzy matching, no character substitution.",
            "activity": "Normalize FullName: trim and collapse internal whitespace only",
            "properties": {
              "To": {
                "name": "normalizedFullName",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "System.Text.RegularExpressions.Regex.Replace(rawEventTitle.Trim(), \"\\s+\", \" \")"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Level=Trace. Per-event detail for debugging name normalization. Not Info to avoid log spam on days with many birthdays.",
            "activity": "Log TRACE: Normalized name for current event",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Trace"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[GetBirthdays][TRACE] Event processed. Raw='\" & rawEventTitle & \"' | Normalized='\" & normalizedFullName & \"' | EventId=\" & calendarEventId & \" | RunId=\" & InRunId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: ConstraintException or ArgumentException if column count mismatch (schema mismatch between BuildDataTable and ArrayRow). Log [ERROR] with Step=AddDataRow, FullNameRaw, ExceptionType, and rethrow to bubble to Main. DataTable integrity is critical for downstream processing.",
            "activity": "Add work item row to output DataTable",
            "properties": {
              "ArrayRow": {
                "type": "vb_expression",
                "value": "New Object() {rawEventTitle, normalizedFullName, calendarEventId}"
              },
              "DataTable": {
                "name": "workItemsTable",
                "type": "variable"
              }
            },
            "activityType": "AddDataRow",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.ComplexScenarios.Activities"
          },
          {
            "notes": "Level=Info. Confirms each successfully added work item. Used to verify event-to-row mapping during troubleshooting.",
            "activity": "Log INFO: Work item added for birthday person",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[GetBirthdays][INFO] Work item added. FullNameNormalized='\" & normalizedFullName & \"' | CalendarEventId=\" & calendarEventId & \" | RunId=\" & InRunId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Reuses eventCount variable to reflect final work items added (may differ from raw event count if any were skipped). Used in the final summary log.",
            "activity": "Assign final row count for summary log",
            "properties": {
              "To": {
                "name": "eventCount",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "workItemsTable.Rows.Count"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Level=Info. Exit log confirming final work item count. Matches the BirthdaysFound counter that Main will write to BGV26_Run entity.",
            "activity": "Log INFO: GetBirthdays workflow completing — work items count",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[GetBirthdays][INFO] Workflow complete. WorkItemsAdded=\" & eventCount.ToString() & \" | Date=\" & todayLocal.ToString(\"yyyy-MM-dd\") & \" | RunId=\" & InRunId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Assigns the populated DataTable to the Out argument so the caller (Main) receives the work items list. Must be the final step before workflow exit to guarantee the argument is always set even on zero-event paths.",
            "activity": "Assign OutBirthdayWorkItems from workItemsTable",
            "properties": {
              "To": {
                "name": "OutBirthdayWorkItems",
                "type": "variable"
              },
              "Value": {
                "name": "workItemsTable",
                "type": "variable"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Captured inside catch blocks for external API and DataTable failures. Unattended robot captures desktop context. screenshotPath returned to caller for Storage Bucket upload by Main. Screenshot filename includes RunId and UTC timestamp for correlation.",
            "activity": "Take screenshot on exception for error evidence (inside catch handler)",
            "properties": {
              "Result": {
                "name": "screenshotPath",
                "type": "variable"
              },
              "FileName": {
                "type": "vb_expression",
                "value": "\"GetBirthdays_Error_\" & InRunId & \"_\" & DateTime.UtcNow.ToString(\"yyyyMMdd_HHmmss\") & \".png\""
              }
            },
            "activityType": "TakeScreenshot",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.UIAutomation.Activities"
          },
          {
            "notes": "Level=Error. Structured log fields: RunId, Step, ExceptionType, Message, Screenshot path. Enables Orchestrator alert correlation and Storage Bucket artifact lookup. Logged before Rethrow.",
            "activity": "Log ERROR: Structured exception details in catch block",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Error"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[GetBirthdays][ERROR] Exception caught. RunId=\" & InRunId & \" | Step=CalendarApiOrNormalization | ExceptionType=\" & calendarApiException.GetType().Name & \" | Message=\" & calendarApiException.ToString() & \" | Screenshot=\" & screenshotPath"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Rethrows the caught exception so the caller (Main) receives it and can update BGV26_Run.RunStatus to Failed and trigger Orchestrator job failure alerting. GetBirthdays does not suppress system exceptions — it only logs and re-raises.",
            "activity": "Rethrow exception after logging so Main marks Run as Failed",
            "properties": {},
            "activityType": "Rethrow",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          }
        ],
        "variables": [
          {
            "name": "birthdayEvents",
            "type": "Object",
            "scope": "workflow",
            "defaultValue": "Nothing"
          },
          {
            "name": "workItemsTable",
            "type": "DataTable",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "todayLocal",
            "type": "DateTime",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "todayStart",
            "type": "DateTime",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "todayEnd",
            "type": "DateTime",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "currentEvent",
            "type": "Object",
            "scope": "workflow",
            "defaultValue": "Nothing"
          },
          {
            "name": "rawEventTitle",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "normalizedFullName",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "calendarEventId",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "retryAttempt",
            "type": "Int32",
            "scope": "workflow",
            "defaultValue": "0"
          },
          {
            "name": "screenshotPath",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "logMessage",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "eventCount",
            "type": "Int32",
            "scope": "workflow",
            "defaultValue": "0"
          },
          {
            "name": "resolvedTimeZone",
            "type": "String",
            "scope": "workflow",
            "defaultValue": "America/New_York"
          },
          {
            "name": "newDataRow",
            "type": "Object",
            "scope": "workflow",
            "defaultValue": "Nothing"
          },
          {
            "name": "calendarApiException",
            "type": "Object",
            "scope": "workflow",
            "defaultValue": "Nothing"
          },
          {
            "name": "retryDelaySeconds",
            "type": "Int32",
            "scope": "workflow",
            "defaultValue": "5"
          }
        ],
        "description": "Reads today's birthday events from the built-in Google 'Birthdays' calendar feed via UiPath GSuite Activities. Normalizes each event title to FullNameNormalized (whitespace trim/collapse only). Returns a DataTable of work items (FullNameRaw, FullNameNormalized, CalendarEventId). Inline RetryScope handles transient Google API errors (up to 3 attempts with backoff); TryCatch captures and logs structured exceptions with screenshot evidence."
      },
      {
        "name": "ComposeDraft",
        "steps": [
          {
            "notes": "Structured entry log. Captures RunId, FullName, and validation thresholds so any downstream failure can be correlated back to this invocation.",
            "activity": "Log start of ComposeDraft workflow with key input parameters",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[ComposeDraft][START] RunId=\" & InRunId & \" | FullName=\" & InFullName & \" | WordCountRange=\" & InWordCountMin.ToString() & \"-\" & InWordCountMax.ToString()"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Concatenates the asset-driven style spec with the recipient name and explicit JSON-only output instruction to minimize parse failures downstream. The JSON instruction is appended here rather than baked into the asset so the asset remains human-readable.",
            "activity": "Build GenAI prompt string combining style spec and recipient full name",
            "properties": {
              "To": {
                "name": "genAiPrompt",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "InStyleSpec & System.Environment.NewLine & System.Environment.NewLine & \"Recipient full name: \" & InFullName & System.Environment.NewLine & \"Return ONLY valid JSON with exactly two keys: \\\"subject\\\" (string) and \\\"body\\\" (string). No markdown fencing, no extra commentary.\""
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Trace-level so it does not pollute Info logs in production but is available when log level is lowered for debugging. Logs prompt length rather than full content to avoid PII sprawl in Orchestrator logs.",
            "activity": "Log the constructed GenAI prompt for traceability",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Trace"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[ComposeDraft][PROMPT] RunId=\" & InRunId & \" | FullName=\" & InFullName & \" | Prompt length=\" & genAiPrompt.Length.ToString() & \" chars\""
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "IMPLEMENTATION NOTE: Replace HttpClientRequest with the actual UiPath native GenAI 'Generate Text' activity from UiPath.IntegrationService.Activities when available in the installed package. The HttpClientRequest here uses the UiPath LLM Gateway endpoint as the nearest catalog-compliant substitute. The Result property maps to genAiRawResponse. Catch block must log ExceptionType, Message, and RunId; take screenshot; assign genAiRawResponse to empty string so downstream parse step sets OutIsValid=False rather than throwing unhandled. Do NOT retry GenAI on API failures — escalate to human review.",
            "activity": "Invoke UiPath GenAI Generate Text to produce birthday email draft (TryCatch: catch GenAI API failures)",
            "properties": {
              "Body": {
                "type": "vb_expression",
                "value": "\"{\\\"model\\\":\\\"gpt-4o\\\",\\\"messages\\\":[{\\\"role\\\":\\\"system\\\",\\\"content\\\":\\\"You generate birthday email drafts. Return ONLY valid JSON with keys: subject and body.\\\"},\\ {\\\"role\\\":\\\"user\\\",\\\"content\\\":\\\"\" & genAiPrompt.Replace(\"\\\"\",\"'\") & \"\\\"}],\\\"temperature\\\":0.4,\\\"max_tokens\\\":400}\""
              },
              "Method": {
                "type": "literal",
                "value": "POST"
              },
              "Result": {
                "name": "genAiRawResponse",
                "type": "variable"
              },
              "EndPoint": {
                "type": "literal",
                "value": "https://cloud.uipath.com/llmgateway_/openai/deployments/gpt-4o/chat/completions?api-version=2024-12-01-preview"
              }
            },
            "activityType": "HttpClientRequest",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.WebAPI.Activities"
          },
          {
            "notes": "Trace log confirming GenAI returned a non-empty response before attempting JSON parse. Length logged only.",
            "activity": "Log raw GenAI response receipt (length only to avoid PII in logs)",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Trace"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[ComposeDraft][GENAI_RESPONSE] RunId=\" & InRunId & \" | FullName=\" & InFullName & \" | ResponseLength=\" & If(String.IsNullOrEmpty(genAiRawResponse), \"0\", genAiRawResponse.Length.ToString()) & \" chars\""
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "If GenAI returned nothing (API error path), set parsedSubject and parsedBody to empty, jsonParseSuccess=False, and log a Warn. The validation block below will then produce OutIsValid=False and OutValidationNotes indicating empty GenAI response.",
            "activity": "Guard: check if GenAI returned empty or null response before attempting JSON parse",
            "properties": {
              "Condition": {
                "left": "String.IsNullOrWhiteSpace(genAiRawResponse)",
                "type": "expression",
                "right": "True",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Executed in the Then branch of the null-response guard. Sets parsedSubject to empty so validation marks the draft invalid.",
            "activity": "Assign empty draft fields when GenAI response is null/empty",
            "properties": {
              "To": {
                "name": "parsedSubject",
                "type": "variable"
              },
              "Value": {
                "type": "literal",
                "value": ""
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Executed in the Then branch of the null-response guard. Sets parsedBody to empty.",
            "activity": "Assign empty body when GenAI response is null/empty",
            "properties": {
              "To": {
                "name": "parsedBody",
                "type": "variable"
              },
              "Value": {
                "type": "literal",
                "value": ""
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Executed in the Then branch. Downstream validation notes will capture 'GenAI returned empty response'.",
            "activity": "Assign jsonParseSuccess=False when GenAI response is null/empty",
            "properties": {
              "To": {
                "name": "jsonParseSuccess",
                "type": "variable"
              },
              "Value": {
                "type": "literal",
                "value": "False"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Warn-level so Orchestrator monitoring surfaces this without being a job-level error. Human review path in ProcessBirthday handles the escalation.",
            "activity": "Log Warn when GenAI returned empty response",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Warn"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[ComposeDraft][WARN] RunId=\" & InRunId & \" | FullName=\" & InFullName & \" | GenAI returned null/empty response. Draft will fail validation and escalate to human review.\""
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "IMPLEMENTATION NOTE: DeserializeJson outputs a JObject (Newtonsoft.Json.Linq.JObject). The variable 'logMessage' is typed Object here to receive the JObject; it is reused for this parse step only. In production, declare a dedicated Object variable 'parsedJsonObject' and assign parsedSubject = CStr(parsedJsonObject(\"subject\")) and parsedBody = CStr(parsedJsonObject(\"body\")) in subsequent Assign steps. The Catch must set jsonParseSuccess=False, log the malformed JSON error with RunId+FullName+first 200 chars of raw response (truncated), take a screenshot, and continue — NOT rethrow — so the validation block produces OutIsValid=False and triggers human review. Raw VB expression for subject extraction: CStr(DirectCast(parsedJsonObject, Newtonsoft.Json.Linq.JObject)(\"subject\")). Catch exception type: System.Exception.",
            "activity": "Deserialize GenAI JSON response to extract subject and body (TryCatch: catch malformed JSON)",
            "properties": {
              "JsonObject": {
                "name": "logMessage",
                "type": "variable"
              },
              "JsonString": {
                "name": "genAiRawResponse",
                "type": "variable"
              }
            },
            "activityType": "DeserializeJson",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.WebAPI.Activities"
          },
          {
            "notes": "Safely extracts 'subject' key from the JObject. Catches KeyNotFoundException or NullReferenceException if the key is absent, setting parsedSubject to empty string. Catch should set jsonParseSuccess=False and log the missing key error with RunId and FullName.",
            "activity": "Assign parsedSubject from deserialized JSON object",
            "properties": {
              "To": {
                "name": "parsedSubject",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "If(TypeOf logMessage Is Newtonsoft.Json.Linq.JObject, CStr(DirectCast(logMessage, Newtonsoft.Json.Linq.JObject)(\"subject\")), String.Empty)"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Safely extracts 'body' key. Same catch strategy as parsedSubject step — missing key sets parsedBody to empty and marks parse as failed. Catch logs '[ComposeDraft][ERROR] JSON key body missing | RunId=' & InRunId.",
            "activity": "Assign parsedBody from deserialized JSON object",
            "properties": {
              "To": {
                "name": "parsedBody",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "If(TypeOf logMessage Is Newtonsoft.Json.Linq.JObject, CStr(DirectCast(logMessage, Newtonsoft.Json.Linq.JObject)(\"body\")), String.Empty)"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "jsonParseSuccess is True only when BOTH subject and body are non-empty after extraction. A JSON response with empty strings for either key is treated as a parse failure and will produce OutIsValid=False.",
            "activity": "Assign jsonParseSuccess=True after successful subject and body extraction",
            "properties": {
              "To": {
                "name": "jsonParseSuccess",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "Not String.IsNullOrWhiteSpace(parsedSubject) AndAlso Not String.IsNullOrWhiteSpace(parsedBody)"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Info-level decision-point log. Captures parse success/failure and field lengths so downstream monitoring can detect truncated or empty fields without reading content.",
            "activity": "Log JSON parse outcome",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[ComposeDraft][JSON_PARSE] RunId=\" & InRunId & \" | FullName=\" & InFullName & \" | ParseSuccess=\" & jsonParseSuccess.ToString() & \" | SubjectLength=\" & parsedSubject.Length.ToString() & \" | BodyLength=\" & parsedBody.Length.ToString()"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Reset accumulator before appending individual validation rule failures below.",
            "activity": "Initialize validationErrors to empty before running validation checks",
            "properties": {
              "To": {
                "name": "validationErrors",
                "type": "variable"
              },
              "Value": {
                "type": "literal",
                "value": ""
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Decision point — logs Warn and appends to validationErrors if subject is empty. Then branch appends 'SUBJECT_EMPTY' to validationErrors. Else branch is no-op.",
            "activity": "Validation Rule 1: Check subject is non-empty",
            "properties": {
              "Condition": {
                "left": "String.IsNullOrWhiteSpace(parsedSubject)",
                "type": "expression",
                "right": "True",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Executed in Then branch of subject empty check. Semi-colon delimiter separates multiple errors in the final validationNotes output.",
            "activity": "Append SUBJECT_EMPTY to validationErrors when subject is blank",
            "properties": {
              "To": {
                "name": "validationErrors",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "validationErrors & If(String.IsNullOrEmpty(validationErrors), \"\", \"; \") & \"SUBJECT_EMPTY\""
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Decision point — Then branch appends 'BODY_EMPTY'. If body is empty, word count check is meaningless so wordCount stays 0.",
            "activity": "Validation Rule 2: Check body is non-empty",
            "properties": {
              "Condition": {
                "left": "String.IsNullOrWhiteSpace(parsedBody)",
                "type": "expression",
                "right": "True",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Executed in Then branch of body empty check.",
            "activity": "Append BODY_EMPTY to validationErrors when body is blank",
            "properties": {
              "To": {
                "name": "validationErrors",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "validationErrors & If(String.IsNullOrEmpty(validationErrors), \"\", \"; \") & \"BODY_EMPTY\""
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Splits on space, newline chars, and tab with RemoveEmptyEntries so multiple consecutive spaces do not inflate count. Returns 0 if body is empty, consistent with BODY_EMPTY validation error already recorded above.",
            "activity": "Compute word count of parsedBody by splitting on whitespace",
            "properties": {
              "To": {
                "name": "wordCount",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "If(String.IsNullOrWhiteSpace(parsedBody), 0, parsedBody.Trim().Split(New Char(){\" \"c, System.Environment.NewLine(0), System.Environment.NewLine(1), CChar(\"\\t\")}, StringSplitOptions.RemoveEmptyEntries).Length)"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Decision point — Then branch appends WORD_COUNT_OUT_OF_RANGE with actual/expected values. Skipped when body is empty (covered by BODY_EMPTY already), but the check still runs to record word count = 0 as a violation.",
            "activity": "Validation Rule 3: Check word count is within InWordCountMin–InWordCountMax",
            "properties": {
              "Condition": {
                "left": "wordCount < InWordCountMin OrElse wordCount > InWordCountMax",
                "type": "expression",
                "right": "True",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Encodes actual word count and expected range in the error token for precise human review context.",
            "activity": "Append WORD_COUNT_OUT_OF_RANGE to validationErrors",
            "properties": {
              "To": {
                "name": "validationErrors",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "validationErrors & If(String.IsNullOrEmpty(validationErrors), \"\", \"; \") & \"WORD_COUNT_OUT_OF_RANGE(actual=\" & wordCount.ToString() & \",min=\" & InWordCountMin.ToString() & \",max=\" & InWordCountMax.ToString() & \")\""
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Regex spans common emoji Unicode ranges including surrogate pairs (emoji in .NET strings), Miscellaneous Symbols, Dingbats, and ZWJ sequences. Catch handles any RegexParseException (malformed pattern), sets containsEmoji=False, and logs Warn '[ComposeDraft][WARN] Emoji regex failed to compile | RunId=' & InRunId. Not retried — if regex fails, we conservatively treat as no-emoji and log the anomaly.",
            "activity": "Validation Rule 4: Detect emoji characters in subject or body using Unicode regex",
            "properties": {
              "To": {
                "name": "containsEmoji",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "System.Text.RegularExpressions.Regex.IsMatch(parsedSubject & \" \" & parsedBody, \"[\\uD83C-\\uDBFF\\uDC00-\\uDFFF\\u2600-\\u27BF\\u2300-\\u23FF\\u2B50\\u2B55\\u231A\\u231B\\u2328\\u23CF\\u23E9-\\u23F3\\u23F8-\\u23FA\\u200D\\uFE0F]\")"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Decision point for emoji validation. Then branch appends CONTAINS_EMOJI to validationErrors. Logs Warn when emoji found.",
            "activity": "Validation Rule 4b: Append CONTAINS_EMOJI to validationErrors if emoji detected",
            "properties": {
              "Condition": {
                "left": "containsEmoji",
                "type": "expression",
                "right": "True",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Executed in Then branch of emoji check. Subject and body both scanned in the single regex above.",
            "activity": "Append CONTAINS_EMOJI to validationErrors",
            "properties": {
              "To": {
                "name": "validationErrors",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "validationErrors & If(String.IsNullOrEmpty(validationErrors), \"\", \"; \") & \"CONTAINS_EMOJI\""
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Single source of truth: isValid=True only when no validation errors were accumulated. Simplifies the caller check in ProcessBirthday.",
            "activity": "Determine overall isValid from absence of validationErrors",
            "properties": {
              "To": {
                "name": "isValid",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "String.IsNullOrEmpty(validationErrors)"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Structured string persisted to BGV26_Draft.ValidationNotes in Data Service. Includes all metrics regardless of pass/fail for audit completeness.",
            "activity": "Build structured validationNotes string for output",
            "properties": {
              "To": {
                "name": "validationNotes",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "If(isValid, \"VALIDATION_PASSED | WordCount=\" & wordCount.ToString() & \" | ContainsEmoji=False\", \"VALIDATION_FAILED | Errors=[\" & validationErrors & \"] | WordCount=\" & wordCount.ToString() & \" | ContainsEmoji=\" & containsEmoji.ToString() & \" | ParseSuccess=\" & jsonParseSuccess.ToString())"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "",
            "activity": "Log validation outcome at Info level with all key metrics",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[ComposeDraft][VALIDATION] RunId=\" & InRunId & \" | FullName=\" & InFullName & \" | IsValid=\" & isValid.ToString() & \" | WordCount=\" & wordCount.ToString() & \" | ContainsEmoji=\" & containsEmoji.ToString() & \" | Notes=\" & validationNotes"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          }
        ],
        "variables": [
          {
            "name": "genAiPrompt",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "genAiRawResponse",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "parsedSubject",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "parsedBody",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "wordCount",
            "type": "Int32",
            "scope": "workflow",
            "defaultValue": "0"
          },
          {
            "name": "containsEmoji",
            "type": "Boolean",
            "scope": "workflow",
            "defaultValue": "False"
          },
          {
            "name": "isValid",
            "type": "Boolean",
            "scope": "workflow",
            "defaultValue": "False"
          },
          {
            "name": "validationNotes",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "jsonParseSuccess",
            "type": "Boolean",
            "scope": "workflow",
            "defaultValue": "False"
          },
          {
            "name": "logMessage",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "validationErrors",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "emojiRegexPattern",
            "type": "String",
            "scope": "workflow",
            "defaultValue": "[\\u00A9\\u00AE\\u203C\\u2049\\u20E3\\u2122\\u2139\\u2194-\\u2199\\u21A9-\\u21AA\\u231A-\\u231B\\u2328\\u23CF\\u23E9-\\u23F3\\u23F8-\\u23FA\\u24C2\\u25AA-\\u25AB\\u25B6\\u25C0\\u25FB-\\u25FE\\u2600-\\u2604\\u260E\\u2611\\u2614-\\u2615\\u2618\\u261D\\u2620\\u2622-\\u2623\\u2626\\u262A\\u262E-\\u262F\\u2638-\\u263A\\u2640\\u2642\\u2648-\\u2653\\u265F-\\u2660\\u2663\\u2665-\\u2666\\u2668\\u267B\\u267E-\\u267F\\u2692-\\u2697\\u2699\\u269B-\\u269C\\u26A0-\\u26A1\\u26AA-\\u26AB\\u26B0-\\u26B1\\u26BD-\\u26BE\\u26C4-\\u26C5\\u26CE-\\u26CF\\u26D1\\u26D3-\\u26D4\\u26E9-\\u26EA\\u26F0-\\u26F5\\u26F7-\\u26FA\\u26FD\\u2702\\u2705\\u2708-\\u270D\\u270F\\u2712\\u2714\\u2716\\u271D\\u2721\\u2728\\u2733-\\u2734\\u2744\\u2747\\u274C\\u274E\\u2753-\\u2755\\u2757\\u2763-\\u2764\\u2795-\\u2797\\u27A1\\u27B0\\u27BF\\u2934-\\u2935\\u2B05-\\u2B07\\u2B1B-\\u2B1C\\u2B50\\u2B55\\u3030\\u303D\\u3297\\u3299\\uD83C-\\uDBFF\\uDC00-\\uDFFF]"
          },
          {
            "name": "screenshotPath",
            "type": "String",
            "scope": "workflow",
            "defaultValue": "C:\\Temp\\BGV26_ComposeDraft_Error.png"
          },
          {
            "name": "wordArray",
            "type": "Array<String>",
            "scope": "workflow",
            "defaultValue": ""
          }
        ],
        "description": "Generates a birthday email subject and body using UiPath native GenAI Activities (Generate Text) with the approved style spec prompt. Parses the JSON response to extract subject and body fields. Performs inline validation: checks subject and body are non-empty, body word count is within InWordCountMin–InWordCountMax, and no emoji characters are present (Unicode regex). Returns validation outcome, the draft fields, and structured validation notes. Inline TryCatch handles GenAI API errors and malformed JSON responses; does NOT retry GenAI on content failures (those escalate to human review)."
      },
      {
        "name": "Finalize",
        "steps": [
          {
            "notes": "INFO log: records entry into Finalize with all counters for audit trail. No failure possible.",
            "activity": "Log entry into Finalize workflow with run context",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[Finalize] Starting finalization. RunId=\" & InRunId & \" | InRunStatus=\" & InRunStatus & \" | BirthdaysFound=\" & InBirthdaysFound.ToString() & \" | SentCount=\" & InSentCount.ToString() & \" | SkippedCount=\" & InSkippedCount.ToString() & \" | ErrorCount=\" & InErrorCount.ToString()"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Captures the exact UTC time at finalization start. Used to stamp EndTimeUtc on the Run record.",
            "activity": "Capture EndTimeUtc as current UTC time",
            "properties": {
              "To": {
                "name": "endTimeUtc",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "DateTime.UtcNow"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "INFO decision: maps InRunStatus directly to finalizedRunStatus. If caller passes 'Failed', that is preserved. If 'Completed', confirms it. Logs at Trace level for decision audit.",
            "activity": "Resolve effective RunStatus (Completed vs Failed based on ErrorCount)",
            "properties": {
              "Else": {
                "type": "vb_expression",
                "value": "finalizedRunStatus = InRunStatus"
              },
              "Then": {
                "type": "vb_expression",
                "value": "finalizedRunStatus = \"Completed\""
              },
              "Condition": {
                "left": "InRunStatus",
                "type": "expression",
                "right": "\"Completed\"",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "INFO log: confirms which status will be written to the Run record. Important for debugging reruns.",
            "activity": "Log resolved RunStatus before Data Service update",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[Finalize] Resolved finalizedRunStatus=\" & finalizedRunStatus & \" for RunId=\" & InRunId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "WARN on retry: anticipates transient Data Service HTTP 429 or 503 errors. RetryScope will wrap this with up to 3 attempts and exponential backoff. Queries BGV26_Run entity filtered by RunId to retrieve the entity identifier needed for UpdateEntity.",
            "activity": "Query BGV26_Run record by RunId to obtain entity record for update",
            "properties": {
              "Result": {
                "name": "queriedRunRecords",
                "type": "variable"
              },
              "EntityType": {
                "type": "literal",
                "value": "BGV26_Run"
              },
              "FilterExpression": {
                "type": "vb_expression",
                "value": "\"RunId eq '\" & InRunId & \"'\""
              }
            },
            "activityType": "QueryEntity",
            "selectorHint": null,
            "errorHandling": "retry",
            "activityPackage": "UiPath.DataService.Activities"
          },
          {
            "notes": "INFO log: confirms the query completed. Downstream Assign will extract the entity ID.",
            "activity": "Log result of BGV26_Run query",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[Finalize] BGV26_Run query returned result for RunId=\" & InRunId & \". Proceeding to extract record ID.\""
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Stores the queried Run entity object reference. The UpdateEntity activity will accept this object with mutated field values set in subsequent Assign steps.",
            "activity": "Extract entity record object from query result for update",
            "properties": {
              "To": {
                "name": "runEntityObject",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "queriedRunRecords"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "ERROR catch: anticipates Data Service update failures (network timeout, entity lock, schema mismatch). Catches all Exception; logs structured error with RunId, Step=UpdateRunRecord, ExceptionType, Message. Takes screenshot as evidence. Sets dataServiceUpdateSuccess=False so summary email still proceeds independently. Does NOT rethrow — per design, summary send must not be blocked.",
            "activity": "Update BGV26_Run record: EndTimeUtc, RunStatus, and counters (TryCatch — Data Service)",
            "properties": {
              "Try": {
                "type": "literal",
                "value": "UpdateEntity(BGV26_Run, runEntityObject with EndTimeUtc=endTimeUtc, RunStatus=finalizedRunStatus, BirthdaysFound=InBirthdaysFound, SentCount=InSentCount, SkippedCount=InSkippedCount, ErrorCount=InErrorCount)"
              },
              "Catches": {
                "type": "literal",
                "value": "Exception -> log ERROR with RunId and exception message; TakeScreenshot; set dataServiceUpdateSuccess=False"
              },
              "Finally": {
                "type": "literal",
                "value": "None"
              }
            },
            "activityType": "TryCatch",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "WARN on retry: anticipates transient 429/503 from Data Service. This is the authoritative write of EndTimeUtc, RunStatus, and all counters to BGV26_Run. Field values (EndTimeUtc, RunStatus, BirthdaysFound, SentCount, SkippedCount, ErrorCount) must be set on runEntityObject before this call via Assign steps.",
            "activity": "Update BGV26_Run entity with final status and counters",
            "properties": {
              "EntityType": {
                "type": "literal",
                "value": "BGV26_Run"
              },
              "EntityObject": {
                "name": "runEntityObject",
                "type": "variable"
              }
            },
            "activityType": "UpdateEntity",
            "selectorHint": null,
            "errorHandling": "retry",
            "activityPackage": "UiPath.DataService.Activities"
          },
          {
            "notes": "Sets the success flag after confirmed UpdateEntity. Used in the summary email body and post-finalize log.",
            "activity": "Mark Data Service update as successful",
            "properties": {
              "To": {
                "name": "dataServiceUpdateSuccess",
                "type": "variable"
              },
              "Value": {
                "type": "literal",
                "value": "True"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "INFO log: records outcome of the Data Service update step. If False, the catch handler already logged ERROR details. This provides a consolidated outcome line for ops monitoring queries.",
            "activity": "Log Data Service update outcome",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[Finalize] BGV26_Run update outcome: dataServiceUpdateSuccess=\" & dataServiceUpdateSuccess.ToString() & \" | RunId=\" & InRunId & \" | FinalStatus=\" & finalizedRunStatus"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Constructs the summary email subject with run date and status. Format: '[BGV26] Daily Birthday Greetings Run Summary – 2026-01-15 | Status: Completed'.",
            "activity": "Build summary email subject line",
            "properties": {
              "To": {
                "name": "summarySubject",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "\"[BGV26] Daily Birthday Greetings Run Summary – \" & DateTime.UtcNow.ToString(\"yyyy-MM-dd\") & \" | Status: \" & finalizedRunStatus"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Constructs the multi-line summary body. Includes Run ID, status, UTC end time, all four counters, and the Data Service update outcome. Plain text only — no HTML, no emojis — consistent with the project email style spec.",
            "activity": "Build summary email body with run counters and Data Service update status",
            "properties": {
              "To": {
                "name": "summaryBody",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "\"BGV26 Daily Run Summary\" & Environment.NewLine & \"========================\" & Environment.NewLine & \"Run ID: \" & InRunId & Environment.NewLine & \"Status: \" & finalizedRunStatus & Environment.NewLine & \"End Time (UTC): \" & endTimeUtc.ToString(\"yyyy-MM-dd HH:mm:ss\") & Environment.NewLine & Environment.NewLine & \"Counters:\" & Environment.NewLine & \"  Birthdays Found : \" & InBirthdaysFound.ToString() & Environment.NewLine & \"  Emails Sent     : \" & InSentCount.ToString() & Environment.NewLine & \"  Skipped         : \" & InSkippedCount.ToString() & Environment.NewLine & \"  Errors          : \" & InErrorCount.ToString() & Environment.NewLine & Environment.NewLine & \"Data Service Update: \" & If(dataServiceUpdateSuccess, \"SUCCESS\", \"FAILED – check Orchestrator logs\") & Environment.NewLine & Environment.NewLine & \"This is an automated message from BirthdayGreetingsV26.\""
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "INFO log: records intent to send summary email with subject and connection name. Enables ops tracing if the send fails.",
            "activity": "Log summary email content before sending",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[Finalize] Preparing to send daily summary email. Subject=\" & summarySubject & \" | To=ninemush@gmail.com | GmailConnection=\" & InGmailConnectionName"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "ERROR catch: anticipates Gmail Integration Service failures (OAuth token expiry, rate limit, network timeout). Catches all Exception; logs structured error with RunId, Step=SendSummaryEmail. Takes screenshot. Sets summarySendSuccess=False. Does NOT rethrow — summary send failure must not fail the run or block Data Service update result reporting. This TryCatch is intentionally independent of the Data Service TryCatch above.",
            "activity": "Send daily summary email via Gmail Integration Service connector (TryCatch — independent)",
            "properties": {
              "Try": {
                "type": "literal",
                "value": "GmailSendMessage(To=ninemush@gmail.com, Subject=summarySubject, Body=summaryBody) via Integration Service connection InGmailConnectionName"
              },
              "Catches": {
                "type": "literal",
                "value": "Exception -> log ERROR with RunId, Step=SendSummaryEmail, ExceptionType, Message; TakeScreenshot; set summarySendSuccess=False"
              },
              "Finally": {
                "type": "literal",
                "value": "None"
              }
            },
            "activityType": "TryCatch",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "WARN on retry: wraps send with RetryScope (up to 2 attempts). Anticipates transient network errors and OAuth token refresh delays. Uses GmailSendMessage from GSuite Activities package as the available catalog activity for Gmail sending. Connection context is provided by the GSuite service account credential asset.",
            "activity": "Send daily summary email via Gmail GSuite Activities",
            "properties": {
              "To": {
                "type": "literal",
                "value": "ninemush@gmail.com"
              },
              "Body": {
                "name": "summaryBody",
                "type": "variable"
              },
              "Subject": {
                "name": "summarySubject",
                "type": "variable"
              }
            },
            "activityType": "GmailSendMessage",
            "selectorHint": null,
            "errorHandling": "retry",
            "activityPackage": "UiPath.GSuite.Activities"
          },
          {
            "notes": "Sets the summary send success flag after confirmed GmailSendMessage. Used in the final structured log.",
            "activity": "Mark summary email send as successful",
            "properties": {
              "To": {
                "name": "summarySendSuccess",
                "type": "variable"
              },
              "Value": {
                "type": "literal",
                "value": "True"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "INFO log: records outcome of summary email send. If False, the catch handler already logged ERROR details. Provides consolidated outcome line for ops monitoring.",
            "activity": "Log summary email send outcome",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[Finalize] Summary email send outcome: summarySendSuccess=\" & summarySendSuccess.ToString() & \" | RunId=\" & InRunId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "WARN decision: if Data Service update failed, emit a WARN-level log. This is the critical failure branch — run record is not fully closed. Ops must investigate. Summary send failure is logged at WARN separately.",
            "activity": "Warn if either finalization step failed (Data Service update or summary send)",
            "properties": {
              "Condition": {
                "left": "dataServiceUpdateSuccess",
                "type": "expression",
                "right": "False",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "WARN log: emitted only when dataServiceUpdateSuccess=False. This is a deferred-critical warning — the run completed processing but its audit record is incomplete. Orchestrator log monitoring should alert on this message pattern.",
            "activity": "Log WARN if Data Service update failed — run record is not closed",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Warn"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[Finalize][WARN] BGV26_Run record was NOT updated for RunId=\" & InRunId & \". Data Service update failed. Manual reconciliation required. Check error logs and Orchestrator job for details.\""
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "WARN decision: checks if summary email send failed. Non-critical but worth noting in logs. Only emits WARN log in the then-branch; no action needed.",
            "activity": "Log WARN if summary email failed to send",
            "properties": {
              "Condition": {
                "left": "summarySendSuccess",
                "type": "expression",
                "right": "False",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "WARN log: emitted only when summarySendSuccess=False. Non-critical — run processing already completed. Ops should note for observability but no remediation action is required for the run itself.",
            "activity": "Log WARN — daily summary email was not sent",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Warn"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[Finalize][WARN] Daily summary email was NOT sent for RunId=\" & InRunId & \". Gmail send failed. Check error logs for details. Run processing was unaffected.\""
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Adds structured log fields for the finalization event. These fields will be queryable in Orchestrator Logs / Elastic / Splunk for ops dashboards. Provides machine-readable telemetry for the run outcome.",
            "activity": "AddLogFields for structured finalization telemetry",
            "properties": {
              "Fields": {
                "type": "vb_expression",
                "value": "New Dictionary(Of String, Object) From {{\"RunId\", InRunId}, {\"FinalRunStatus\", finalizedRunStatus}, {\"BirthdaysFound\", InBirthdaysFound}, {\"SentCount\", InSentCount}, {\"SkippedCount\", InSkippedCount}, {\"ErrorCount\", InErrorCount}, {\"DataServiceUpdateSuccess\", dataServiceUpdateSuccess}, {\"SummarySendSuccess\", summarySendSuccess}, {\"EndTimeUtc\", endTimeUtc.ToString(\"yyyy-MM-dd HH:mm:ss\")}}"
              }
            },
            "activityType": "AddLogFields",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "INFO log: terminal log line for the Finalize workflow. Provides a single searchable line with all outcome fields for ops monitoring. No exceptions are thrown from Finalize — all errors are caught inline and logged.",
            "activity": "Final INFO log — Finalize workflow completed",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[Finalize] Finalization complete. RunId=\" & InRunId & \" | FinalStatus=\" & finalizedRunStatus & \" | DataServiceUpdated=\" & dataServiceUpdateSuccess.ToString() & \" | SummaryEmailSent=\" & summarySendSuccess.ToString() & \" | EndTimeUtc=\" & endTimeUtc.ToString(\"yyyy-MM-dd HH:mm:ss\")"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          }
        ],
        "variables": [
          {
            "name": "endTimeUtc",
            "type": "DateTime",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "runRecordId",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "queriedRunRecords",
            "type": "Object",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "runEntityObject",
            "type": "Object",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "dataServiceUpdateSuccess",
            "type": "Boolean",
            "scope": "workflow",
            "defaultValue": "False"
          },
          {
            "name": "summarySendSuccess",
            "type": "Boolean",
            "scope": "workflow",
            "defaultValue": "False"
          },
          {
            "name": "summarySubject",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "summaryBody",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "logMessage",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "dataServiceException",
            "type": "Object",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "summaryException",
            "type": "Object",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "screenshotPath",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "updateRetryCount",
            "type": "Int32",
            "scope": "workflow",
            "defaultValue": "0"
          },
          {
            "name": "gmailSendRetryCount",
            "type": "Int32",
            "scope": "workflow",
            "defaultValue": "0"
          },
          {
            "name": "finalizedRunStatus",
            "type": "String",
            "scope": "workflow",
            "defaultValue": "Completed"
          }
        ],
        "description": "Updates the BGV26_Run Data Service record with EndTimeUtc, final RunStatus (Completed or Failed), and aggregated counters (BirthdaysFound, SentCount, SkippedCount, ErrorCount). Optionally sends a daily summary email via the Gmail Integration Service connector to ninemush@gmail.com. Inline TryCatch handles Data Service update failures and summary send failures independently so neither blocks the other."
      },
      {
        "name": "ProcessBirthday",
        "steps": [
          {
            "notes": "Attach RunId and FullNameNormalized to every subsequent log line for structured observability throughout this workflow invocation.",
            "activity": "Add structured log fields for this work item",
            "properties": {
              "Fields": {
                "type": "vb_expression",
                "value": "New Dictionary(Of String, Object) From {{\"RunId\", InRunId}, {\"FullNameNormalized\", InFullNameNormalized}, {\"CalendarEventId\", InCalendarEventId}, {\"WorkflowStep\", \"ProcessBirthday\"}}"
              }
            },
            "activityType": "AddLogFields",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "INFO-level entry log. Marks the start of processing for this specific birthday person within the outer loop.",
            "activity": "Log: Begin processing birthday work item",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[ProcessBirthday] BEGIN | RunId=\" & InRunId & \" | FullName=\" & InFullNameNormalized & \" | EventId=\" & InCalendarEventId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Reset output arguments and set greetingYear from UTC now. Safe initialization before any external call.",
            "activity": "Initialize output arguments to safe defaults",
            "properties": {
              "Assignments": {
                "type": "vb_expression",
                "value": "New List(Of Tuple(Of String, Object)) From {Tuple.Create(\"OutItemStatus\", CObj(\"Processing\")), Tuple.Create(\"OutSkipReason\", CObj(\"\")), Tuple.Create(\"OutGmailMessageId\", CObj(\"\")), Tuple.Create(\"greetingYear\", CObj(DateTime.UtcNow.Year))}"
              }
            },
            "activityType": "MultipleAssign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.ComplexScenarios.Activities"
          },
          {
            "notes": "RetryScope wraps GoogleContactsSearchContacts to handle transient Google API errors (HTTP 429, 503, network timeout). Up to 3 retries with 5-second interval. ShouldRetry child checks exception type.",
            "activity": "RetryScope: Exact-match contact lookup via Google Contacts",
            "properties": {
              "RetryInterval": {
                "type": "literal",
                "value": "00:00:05"
              },
              "NumberOfRetries": {
                "type": "literal",
                "value": "3"
              }
            },
            "activityType": "RetryScope",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Exact-match query using FullNameNormalized. Result is a DataTable of matching contacts. Throws on API error (caught by RetryScope). If partial matches are returned, contactCount filtering enforces exact name match downstream.",
            "activity": "Search Google Contacts by exact full name",
            "properties": {
              "Query": {
                "name": "InFullNameNormalized",
                "type": "variable"
              },
              "Result": {
                "name": "contactsResults",
                "type": "variable"
              }
            },
            "activityType": "GoogleContactsSearchContacts",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.GSuite.Activities"
          },
          {
            "notes": "INFO log after contact lookup. Helps trace exact-match behavior and identify cases where zero or multiple contacts are returned.",
            "activity": "Log: Contact lookup result count",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[ProcessBirthday] GoogleContacts search returned \" & (If(contactsResults IsNot Nothing, contactsResults.Rows.Count, 0)).ToString() & \" row(s) for FullName=\" & InFullNameNormalized"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Guard against null contactsResults from API. contactCount drives the zero/one/many branching below.",
            "activity": "Assign contactCount from results row count",
            "properties": {
              "To": {
                "name": "contactCount",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "If(contactsResults IsNot Nothing, contactsResults.Rows.Count, 0)"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "DECISION: If no contacts returned, no exact match exists. Assign skip outputs and return early. Log WARN for operational visibility.",
            "activity": "If: Zero contacts found — skip person",
            "properties": {
              "Condition": {
                "left": "contactCount",
                "type": "expression",
                "right": "0",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "WARN log: No exact Google Contact match. Downstream caller increments SkippedCount.",
            "activity": "Log: No contact found — skipping person",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Warn"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[ProcessBirthday] SKIP | NoContact | FullName=\" & InFullNameNormalized & \" | RunId=\" & InRunId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Set output arguments before returning from this zero-contacts branch. Main loop reads these to increment SkippedCount.",
            "activity": "Assign OutItemStatus=Skipped, OutSkipReason=NoContact (zero contacts branch)",
            "properties": {
              "Assignments": {
                "type": "vb_expression",
                "value": "New List(Of Tuple(Of String, Object)) From {Tuple.Create(\"OutItemStatus\", CObj(\"Skipped\")), Tuple.Create(\"OutSkipReason\", CObj(\"NoContact\"))}"
              }
            },
            "activityType": "MultipleAssign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.ComplexScenarios.Activities"
          },
          {
            "notes": "DECISION: More than one contact matches the exact full name — ambiguous. Set isAmbiguousContact=True and format candidate list for Action Center task. Single-contact path proceeds to email selection.",
            "activity": "If: Multiple contacts found — check for ambiguity",
            "properties": {
              "Condition": {
                "left": "contactCount",
                "type": "expression",
                "right": "1",
                "operator": ">"
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "Build formatted candidate contact string for Action Center task form. Handles missing DisplayName/Email columns defensively.",
            "activity": "Assign: Flag ambiguous contact and format candidate list",
            "properties": {
              "Assignments": {
                "type": "vb_expression",
                "value": "New List(Of Tuple(Of String, Object)) From {Tuple.Create(\"isAmbiguousContact\", CObj(True)), Tuple.Create(\"humanReviewMode\", CObj(\"ContactDisambiguation\")), Tuple.Create(\"candidateContactsFormatted\", CObj(String.Join(\"; \", (From dr As System.Data.DataRow In contactsResults.Rows Select String.Format(\"{0} | {1}\", If(dr.Table.Columns.Contains(\"DisplayName\"), dr(\"DisplayName\").ToString(), InFullNameNormalized), If(dr.Table.Columns.Contains(\"Email\"), dr(\"Email\").ToString(), \"(no email)\"))).ToArray())))}"
              }
            },
            "activityType": "MultipleAssign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.ComplexScenarios.Activities"
          },
          {
            "notes": "WARN log before escalating to Action Center. Candidates logged for audit.",
            "activity": "Log: Ambiguous contact match — will invoke HandleHumanReview",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Warn"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[ProcessBirthday] AmbiguousContact | Count=\" & contactCount.ToString() & \" | FullName=\" & InFullNameNormalized & \" | Candidates=\" & candidateContactsFormatted & \" | RunId=\" & InRunId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "DECISION: Only escalate to Action Center if the feature flag allows it. If not allowed, skip this person to prevent blocking the run.",
            "activity": "If: AllowActionCenterFallback — invoke HandleHumanReview for disambiguation",
            "properties": {
              "Condition": {
                "left": "InAllowActionCenterFallback",
                "type": "expression",
                "right": "True",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "Invoke HandleHumanReview in ContactDisambiguation mode. Passes candidateContactsFormatted. Receives humanReviewDecision and humanReviewSelectedEmail. TryCatch handles Action Center API failure — on failure log ERROR and skip this person.",
            "activity": "Invoke HandleHumanReview for ContactDisambiguation",
            "properties": {
              "Arguments": {
                "type": "vb_expression",
                "value": "New Dictionary(Of String, Object) From {{\"InRunId\", InRunId}, {\"InFullNameNormalized\", InFullNameNormalized}, {\"InReviewMode\", \"ContactDisambiguation\"}, {\"InCandidateContacts\", candidateContactsFormatted}, {\"InProposedSubject\", \"\"}, {\"InProposedBody\", \"\"}, {\"OutApprovalDecision\", humanReviewDecision}, {\"OutSelectedEmail\", humanReviewSelectedEmail}}"
              },
              "WorkflowFileName": {
                "type": "literal",
                "value": "HandleHumanReview.xaml"
              }
            },
            "activityType": "InvokeWorkflowFile",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "DECISION: If reviewer selected an email, use it. Otherwise skip this person with ReviewerRejected reason.",
            "activity": "If: HumanReview decision is SelectEmailAndContinue",
            "properties": {
              "Condition": {
                "left": "humanReviewDecision",
                "type": "expression",
                "right": "SelectEmailAndContinue",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "Human reviewer has resolved ambiguity. selectedEmail is now set; flow continues to dedup check.",
            "activity": "Assign selectedEmail from human review disambiguation result",
            "properties": {
              "To": {
                "name": "selectedEmail",
                "type": "variable"
              },
              "Value": {
                "name": "humanReviewSelectedEmail",
                "type": "variable"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "INFO log confirming disambiguation resolution. Email logged for audit trail.",
            "activity": "Log: Reviewer resolved disambiguation — using selected email",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[ProcessBirthday] DisambiguationResolved | SelectedEmail=\" & selectedEmail & \" | FullName=\" & InFullNameNormalized & \" | RunId=\" & InRunId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Reviewer chose Skip or ActionCenter fallback is disabled. Set skip outputs and return. Main loop increments SkippedCount.",
            "activity": "Assign skip outputs when disambiguation rejected or ActionCenter unavailable",
            "properties": {
              "Assignments": {
                "type": "vb_expression",
                "value": "New List(Of Tuple(Of String, Object)) From {Tuple.Create(\"OutItemStatus\", CObj(\"Skipped\")), Tuple.Create(\"OutSkipReason\", CObj(\"ReviewerRejected\"))}"
              }
            },
            "activityType": "MultipleAssign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.ComplexScenarios.Activities"
          },
          {
            "notes": "WARN log for disambiguation skip path.",
            "activity": "Log: Skip due to disambiguation rejection or AC disabled",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Warn"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[ProcessBirthday] SKIP | DisambiguationRejectedOrACDisabled | FullName=\" & InFullNameNormalized & \" | RunId=\" & InRunId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Extract the single contact DataRow. Subsequent assigns extract labeled emails.",
            "activity": "Single contact found — extract Personal and Home emails from contact row",
            "properties": {
              "To": {
                "name": "contactRow",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "contactsResults.Rows(0)"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "Safe extraction of Personal-labeled email. Column name 'PersonalEmail' matches GSuite Activities output schema. DBNull guarded.",
            "activity": "Assign personalEmail from contact row Personal label column",
            "properties": {
              "To": {
                "name": "personalEmail",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "If(contactsResults.Columns.Contains(\"PersonalEmail\"), If(contactsResults.Rows(0)(\"PersonalEmail\") Is DBNull.Value, \"\", contactsResults.Rows(0)(\"PersonalEmail\").ToString().Trim()), \"\")"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "Safe extraction of Home-labeled email. DBNull guarded.",
            "activity": "Assign homeEmail from contact row Home label column",
            "properties": {
              "To": {
                "name": "homeEmail",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "If(contactsResults.Columns.Contains(\"HomeEmail\"), If(contactsResults.Rows(0)(\"HomeEmail\") Is DBNull.Value, \"\", contactsResults.Rows(0)(\"HomeEmail\").ToString().Trim()), \"\")"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "DECISION: Personal-first email selection rule. If Personal exists, use it regardless of Home.",
            "activity": "If: Personal email available — prefer Personal",
            "properties": {
              "Condition": {
                "type": "vb_expression",
                "value": "Not String.IsNullOrWhiteSpace(personalEmail)"
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "Personal email selected. Complies with REQ-003 personal-first rule.",
            "activity": "Assign selectedEmail = personalEmail",
            "properties": {
              "To": {
                "name": "selectedEmail",
                "type": "variable"
              },
              "Value": {
                "name": "personalEmail",
                "type": "variable"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "DECISION: No Personal email — try Home. If neither exists, skip person.",
            "activity": "If: Home email available as fallback",
            "properties": {
              "Condition": {
                "type": "vb_expression",
                "value": "Not String.IsNullOrWhiteSpace(homeEmail)"
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "Home email selected as fallback. Logged below for visibility.",
            "activity": "Assign selectedEmail = homeEmail",
            "properties": {
              "To": {
                "name": "selectedEmail",
                "type": "variable"
              },
              "Value": {
                "name": "homeEmail",
                "type": "variable"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "System.Activities"
          },
          {
            "notes": "INFO log when Home email is used instead of Personal.",
            "activity": "Log: Home email selected as fallback",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[ProcessBirthday] EmailSelection | Home fallback selected | FullName=\" & InFullNameNormalized & \" | HomeEmail=\" & homeEmail & \" | RunId=\" & InRunId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Neither Personal nor Home email label found. Skip this person per REQ-003.",
            "activity": "Assign skip outputs — no Personal or Home email found",
            "properties": {
              "Assignments": {
                "type": "vb_expression",
                "value": "New List(Of Tuple(Of String, Object)) From {Tuple.Create(\"OutItemStatus\", CObj(\"Skipped\")), Tuple.Create(\"OutSkipReason\", CObj(\"NoEligibleEmail\"))}"
              }
            },
            "activityType": "MultipleAssign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.ComplexScenarios.Activities"
          },
          {
            "notes": "WARN log for no-eligible-email skip. Downstream caller increments SkippedCount.",
            "activity": "Log: No eligible email — skipping",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Warn"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[ProcessBirthday] SKIP | NoEligibleEmail | FullName=\" & InFullNameNormalized & \" | RunId=\" & InRunId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "INFO log confirming selected email before dedup check.",
            "activity": "Log: Email selected — proceeding to deduplication check",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[ProcessBirthday] EmailSelected | Email=\" & selectedEmail & \" | FullName=\" & InFullNameNormalized & \" | RunId=\" & InRunId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "RetryScope wraps Data Service QueryEntity to handle transient connectivity failures. Dedup correctness is critical — retry up to 3 times before escalating.",
            "activity": "RetryScope: Query BGV26_SentLog for deduplication",
            "properties": {
              "RetryInterval": {
                "type": "literal",
                "value": "00:00:05"
              },
              "NumberOfRetries": {
                "type": "literal",
                "value": "3"
              }
            },
            "activityType": "RetryScope",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Dedup query: FullNameNormalized + GreetingYear + Status=Sent per REQ-004. Returns DataTable; empty means not yet sent this year. Transient errors bubble to RetryScope.",
            "activity": "Query Data Service BGV26_SentLog for FullNameNormalized + GreetingYear",
            "properties": {
              "Result": {
                "name": "dedupeQueryResults",
                "type": "variable"
              },
              "EntityType": {
                "type": "literal",
                "value": "BGV26_SentLog"
              },
              "FilterExpression": {
                "type": "vb_expression",
                "value": "\"FullNameNormalized eq '\" & InFullNameNormalized & \"' and GreetingYear eq \" & greetingYear.ToString() & \" and Status eq 'Sent'\""
              }
            },
            "activityType": "QueryEntity",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.DataService.Activities"
          }
        ],
        "variables": [
          {
            "name": "contactsResults",
            "type": "DataTable",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "contactCount",
            "type": "Int32",
            "scope": "workflow",
            "defaultValue": "0"
          },
          {
            "name": "selectedEmail",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "personalEmail",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "homeEmail",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "isAmbiguousContact",
            "type": "Boolean",
            "scope": "workflow",
            "defaultValue": "False"
          },
          {
            "name": "candidateContactsFormatted",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "dedupeQueryResults",
            "type": "DataTable",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "alreadySentThisYear",
            "type": "Boolean",
            "scope": "workflow",
            "defaultValue": "False"
          },
          {
            "name": "greetingYear",
            "type": "Int32",
            "scope": "workflow",
            "defaultValue": "0"
          },
          {
            "name": "draftSubject",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "draftBody",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "draftIsValid",
            "type": "Boolean",
            "scope": "workflow",
            "defaultValue": "False"
          },
          {
            "name": "draftValidationNotes",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "finalSubject",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "finalBody",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "humanReviewDecision",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "humanReviewMode",
            "type": "String",
            "scope": "workflow",
            "defaultValue": "ContentReview"
          },
          {
            "name": "sentLogRecordId",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "gmailMessageId",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "errorScreenshotPath",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "logMessage",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "contactLookupRetryCount",
            "type": "Int32",
            "scope": "workflow",
            "defaultValue": "0"
          },
          {
            "name": "dedupeRetryCount",
            "type": "Int32",
            "scope": "workflow",
            "defaultValue": "0"
          },
          {
            "name": "sentLogCreateRetryCount",
            "type": "Int32",
            "scope": "workflow",
            "defaultValue": "0"
          },
          {
            "name": "currentException",
            "type": "Object",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "pendingSentLogEntity",
            "type": "Object",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "updatedSentLogEntity",
            "type": "Object",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "humanReviewSelectedEmail",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "shouldProceedToSend",
            "type": "Boolean",
            "scope": "workflow",
            "defaultValue": "False"
          },
          {
            "name": "sendAttemptRetryCount",
            "type": "Int32",
            "scope": "workflow",
            "defaultValue": "0"
          },
          {
            "name": "contactRow",
            "type": "Object",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "emailLabel",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "emailAddress",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          }
        ],
        "description": "Processes a single birthday work item end-to-end: (1) exact-match contact lookup via Google Contacts GSuite Activities; (2) Personal-first email selection or skip if no Personal/Home label; (3) deduplication check against BGV26_SentLog in Data Service by FullNameNormalized+GreetingYear; (4) invokes ComposeDraft for GenAI generation and validation; (5) if validation fails or contact is ambiguous, invokes HandleHumanReview; (6) sends via Gmail Integration Service connector; (7) persists BGV26_SentLog record. Inline TryCatch per external call; RetryScope on GSuite and Data Service transient errors."
      },
      {
        "name": "Main",
        "steps": [
          {
            "notes": "Attach process-level fields to every subsequent log entry. RunId will be updated after GUID generation.",
            "activity": "Add structured log fields for run-level correlation across all log entries",
            "properties": {
              "Fields": {
                "type": "vb_expression",
                "value": "New Dictionary(Of String, Object) From {{\"ProcessName\", \"BirthdayGreetingsV26\"}, {\"RunId\", runId}}"
              }
            },
            "activityType": "AddLogFields",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Capture run start timestamp in UTC for Data Service record and audit.",
            "activity": "Assign startTimeUtc to DateTime.UtcNow",
            "properties": {
              "To": {
                "name": "startTimeUtc",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "DateTime.UtcNow"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Generate a human-readable, unique RunId for this execution. Format: BGV26_YYYYMMDD_8HEXCHARS.",
            "activity": "Assign runId as a new GUID string",
            "properties": {
              "To": {
                "name": "runId",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "\"BGV26_\" & DateTime.UtcNow.ToString(\"yyyyMMdd\") & \"_\" & Guid.NewGuid().ToString(\"N\").Substring(0,8).ToUpper()"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Overwrite the placeholder RunId with the actual generated value so all subsequent logs carry the correct correlation key.",
            "activity": "Update log fields with the newly generated RunId",
            "properties": {
              "Fields": {
                "type": "vb_expression",
                "value": "New Dictionary(Of String, Object) From {{\"RunId\", runId}, {\"StartTimeUtc\", startTimeUtc.ToString(\"o\")}}"
              }
            },
            "activityType": "AddLogFields",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Structured entry-point log. Confirms job has started and logs correlation identifiers.",
            "activity": "Log Info: Main workflow started",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[Main][Init] BirthdayGreetingsV26 started. RunId=\" & runId & \" StartTimeUtc=\" & startTimeUtc.ToString(\"o\")"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: If asset is missing or Orchestrator is unreachable, log Error with asset name and rethrow — job cannot proceed without configuration. Anticipated failure: Orchestrator connectivity timeout or asset not found (404).",
            "activity": "Read Orchestrator Asset: BGV26_BirthdaysCalendarName",
            "properties": {
              "Value": {
                "name": "birthdaysCalendarName",
                "type": "variable"
              },
              "AssetName": {
                "type": "literal",
                "value": "BGV26_BirthdaysCalendarName"
              }
            },
            "activityType": "GetAsset",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: TimeZone asset missing would cause incorrect deduplication and date logic. Log Error and rethrow.",
            "activity": "Read Orchestrator Asset: BGV26_TimeZone",
            "properties": {
              "Value": {
                "name": "timeZone",
                "type": "variable"
              },
              "AssetName": {
                "type": "literal",
                "value": "BGV26_TimeZone"
              }
            },
            "activityType": "GetAsset",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: Style spec asset missing would cause GenAI to operate without guardrails. Log Error and rethrow.",
            "activity": "Read Orchestrator Asset: BGV26_EmailStyleSpec",
            "properties": {
              "Value": {
                "name": "emailStyleSpec",
                "type": "variable"
              },
              "AssetName": {
                "type": "literal",
                "value": "BGV26_EmailStyleSpec"
              }
            },
            "activityType": "GetAsset",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: Word count bounds must be present for validation logic. Log Error and rethrow. Asset returns as String; convert to Int32 after retrieval.",
            "activity": "Read Orchestrator Asset: BGV26_EmailWordCountMin",
            "properties": {
              "Value": {
                "name": "wordCountMinStr",
                "type": "variable"
              },
              "AssetName": {
                "type": "literal",
                "value": "BGV26_EmailWordCountMin"
              }
            },
            "activityType": "GetAsset",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Safe parse with fallback to default 40 if asset value is malformed. Defensive default prevents validation from blocking all sends.",
            "activity": "Assign emailWordCountMin by parsing wordCountMinStr",
            "properties": {
              "To": {
                "name": "emailWordCountMin",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "If(Integer.TryParse(wordCountMinStr, emailWordCountMin), emailWordCountMin, 40)"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: Symmetric with Min — required for validation. Log Error and rethrow.",
            "activity": "Read Orchestrator Asset: BGV26_EmailWordCountMax",
            "properties": {
              "Value": {
                "name": "wordCountMaxStr",
                "type": "variable"
              },
              "AssetName": {
                "type": "literal",
                "value": "BGV26_EmailWordCountMax"
              }
            },
            "activityType": "GetAsset",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Safe parse with fallback to default 90.",
            "activity": "Assign emailWordCountMax by parsing wordCountMaxStr",
            "properties": {
              "To": {
                "name": "emailWordCountMax",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "If(Integer.TryParse(wordCountMaxStr, emailWordCountMax), emailWordCountMax, 90)"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: If this asset is unavailable, default to True (safe) so human review fallback remains enabled. Log Warn (not Error) and continue with default.",
            "activity": "Read Orchestrator Asset: BGV26_AllowActionCenterFallback",
            "properties": {
              "Value": {
                "name": "allowFallbackStr",
                "type": "variable"
              },
              "AssetName": {
                "type": "literal",
                "value": "BGV26_AllowActionCenterFallback"
              }
            },
            "activityType": "GetAsset",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Default-safe: anything not explicitly 'false' enables Action Center fallback.",
            "activity": "Assign allowActionCenterFallback by parsing allowFallbackStr",
            "properties": {
              "To": {
                "name": "allowActionCenterFallback",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "allowFallbackStr.Trim().ToLower() <> \"false\""
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: Connection name is required to wire the Gmail Integration Service connector. Log Error and rethrow.",
            "activity": "Read Orchestrator Asset: BGV26_GmailFromConnectionName",
            "properties": {
              "Value": {
                "name": "gmailFromConnectionName",
                "type": "variable"
              },
              "AssetName": {
                "type": "literal",
                "value": "BGV26_GmailFromConnectionName"
              }
            },
            "activityType": "GetAsset",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: Dedupe scope config missing would allow duplicate sends. Log Error and rethrow.",
            "activity": "Read Orchestrator Asset: BGV26_DedupeScope",
            "properties": {
              "Value": {
                "name": "dedupeScope",
                "type": "variable"
              },
              "AssetName": {
                "type": "literal",
                "value": "BGV26_DedupeScope"
              }
            },
            "activityType": "GetAsset",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: Credential expiry or missing asset causes GSuite calls to fail. Anticipated failure: 401 Unauthorized on first GSuite call if credential is stale. Log Error with AssetName (never log credential values) and rethrow.",
            "activity": "Read Orchestrator Credential: BGV26_GSuite_ServiceAccount_Credential",
            "properties": {
              "Password": {
                "name": "gSuiteCredentialPassword",
                "type": "variable"
              },
              "Username": {
                "name": "gSuiteCredentialUsername",
                "type": "variable"
              },
              "AssetName": {
                "type": "literal",
                "value": "BGV26_GSuite_ServiceAccount_Credential"
              }
            },
            "activityType": "GetCredential",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Confirm all config values are loaded. Do NOT log credential values.",
            "activity": "Log Info: All Orchestrator assets loaded successfully",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[Main][Init] Assets loaded. CalendarName=\" & birthdaysCalendarName & \" TimeZone=\" & timeZone & \" WordCount=\" & emailWordCountMin.ToString() & \"-\" & emailWordCountMax.ToString() & \" ActionCenterFallback=\" & allowActionCenterFallback.ToString()"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "RETRY: Transient Data Service API errors (503, timeout) are retried up to 3 times with backoff. If all retries fail, catch and rethrow — run cannot proceed without an audit record (dedupe and traceability depend on it). Anticipated failure: Data Service unavailable at job start time.",
            "activity": "Create BGV26_Run record in Data Service to track this execution",
            "properties": {
              "Result": {
                "name": "runRecordId",
                "type": "variable"
              },
              "EntityType": {
                "type": "literal",
                "value": "BGV26_Run"
              },
              "EntityObject": {
                "type": "vb_expression",
                "value": "New Dictionary(Of String, Object) From {{\"RunId\", runId}, {\"StartTimeUtc\", startTimeUtc}, {\"RunStatus\", \"Started\"}, {\"BirthdaysFound\", 0}, {\"SentCount\", 0}, {\"SkippedCount\", 0}, {\"ErrorCount\", 0}, {\"OrchestratorJobKey\", orchestratorJobKey}}"
              }
            },
            "activityType": "CreateEntityRecord",
            "selectorHint": null,
            "errorHandling": "retry",
            "activityPackage": "UiPath.DataService.Activities"
          },
          {
            "notes": "Confirms Data Service record is persisted. RecordId is the Data Service entity ID for subsequent updates.",
            "activity": "Log Info: Run record created in Data Service",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[Main][Init] BGV26_Run record created. RunId=\" & runId & \" RecordId=\" & runRecordId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: GetBirthdays has internal RetryScope for transient Google API errors. If it still throws after retries (network failure, auth expiry, malformed response), catch here, log Error with RunId and exception message, take screenshot for evidence, then rethrow to trigger job-level failure handling. Anticipated failures: Google API rate limit (429), GSuite auth token expiry.",
            "activity": "Invoke GetBirthdays workflow to retrieve today's birthday work items",
            "properties": {
              "Arguments": {
                "type": "vb_expression",
                "value": "New Dictionary(Of String, Object) From {{\"in_CalendarName\", birthdaysCalendarName}, {\"in_TimeZone\", timeZone}, {\"in_GSuiteUsername\", gSuiteCredentialUsername}, {\"in_GSuitePassword\", gSuiteCredentialPassword}, {\"in_RunId\", runId}, {\"out_BirthdayWorkItems\", Nothing}}"
              },
              "WorkflowFileName": {
                "type": "literal",
                "value": "GetBirthdays.xaml"
              },
              "Out_BirthdayWorkItems": {
                "name": "birthdayWorkItems",
                "type": "variable"
              }
            },
            "activityType": "InvokeWorkflowFile",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Null-safe row count. birthdayWorkItems is Nothing only if GetBirthdays returned no events (valid zero-birthday day).",
            "activity": "Assign birthdaysFound count from returned DataTable",
            "properties": {
              "To": {
                "name": "birthdaysFound",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "If(birthdayWorkItems Is Nothing, 0, birthdayWorkItems.Rows.Count)"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Decision-point log: records how many items will enter the processing loop. 0 = clean end path.",
            "activity": "Log Info: Birthday events retrieved",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[Main][GetBirthdays] Retrieved \" & birthdaysFound.ToString() & \" birthday event(s) for today. RunId=\" & runId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Decision point: zero birthdays → skip processing loop entirely and proceed to Finalize with clean status. Log Trace on the zero-birthday branch.",
            "activity": "Check if there are any birthdays to process today",
            "properties": {
              "Condition": {
                "left": "birthdaysFound",
                "type": "expression",
                "right": "0",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Trace-level because zero birthdays is a normal, expected daily outcome. No action needed.",
            "activity": "Log Trace: No birthdays today — skipping processing loop",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Trace"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[Main][Decision] No birthday events found for today. RunId=\" & runId & \" — proceeding directly to Finalize.\""
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Iterate over each DataRow returned by GetBirthdays. Each row contains FullNameRaw, FullNameNormalized, CalendarEventId. Individual item failures are caught inside ProcessBirthday; they increment errorCount and continue the loop.",
            "activity": "ForEach birthday work item row: invoke ProcessBirthday",
            "properties": {
              "Values": {
                "name": "birthdayWorkItems",
                "type": "variable"
              },
              "TypeArgument": {
                "type": "literal",
                "value": "System.Data.DataRow"
              },
              "iteratorName": {
                "type": "literal",
                "value": "currentBirthdayRow"
              }
            },
            "activityType": "ForEach",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Per-item entry log with normalized name for traceability. Appears before ProcessBirthday invocation.",
            "activity": "Log Info: Processing birthday work item",
            "properties": {
              "Level": {
                "type": "literal",
                "value": "Info"
              },
              "Message": {
                "type": "vb_expression",
                "value": "\"[Main][Loop] Processing birthday for: \" & currentBirthdayRow(\"FullNameNormalized\").ToString() & \" RunId=\" & runId"
              }
            },
            "activityType": "LogMessage",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Reset sent outcome flag to False before each invocation to ensure clean state.",
            "activity": "Reset per-item outcome flags before invoking ProcessBirthday",
            "properties": {
              "To": {
                "name": "processBirthdayOutcomeSent",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "False"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Reset skipped outcome flag to False before each invocation.",
            "activity": "Reset per-item skipped flag before invoking ProcessBirthday",
            "properties": {
              "To": {
                "name": "processBirthdayOutcomeSkipped",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "False"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "CATCH: ProcessBirthday handles most item-level errors internally. If it rethrows (unrecoverable system exception), catch here: log Error with FullNameNormalized and exception details, take screenshot, increment errorCount, then CONTINUE loop (do not rethrow from loop body — job-level failure is reserved for init/finalize failures). Anticipated failures: Data Service unavailable mid-loop, Action Center API timeout, Integration Service send failure after retries.",
            "activity": "Invoke ProcessBirthday workflow for this birthday work item",
            "properties": {
              "Arguments": {
                "type": "vb_expression",
                "value": "New Dictionary(Of String, Object) From {{\"in_FullNameRaw\", currentBirthdayRow(\"FullNameRaw\").ToString()}, {\"in_FullNameNormalized\", currentBirthdayRow(\"FullNameNormalized\").ToString()}, {\"in_CalendarEventId\", currentBirthdayRow(\"CalendarEventId\").ToString()}, {\"in_RunId\", runId}, {\"in_EmailStyleSpec\", emailStyleSpec}, {\"in_WordCountMin\", emailWordCountMin}, {\"in_WordCountMax\", emailWordCountMax}, {\"in_AllowActionCenterFallback\", allowActionCenterFallback}, {\"in_GmailConnectionName\", gmailFromConnectionName}, {\"in_DedupeScope\", dedupeScope}, {\"in_GSuiteUsername\", gSuiteCredentialUsername}, {\"in_GSuitePassword\", gSuiteCredentialPassword}, {\"out_WasSent\", Nothing}, {\"out_WasSkipped\", Nothing}}"
              },
              "Out_WasSent": {
                "name": "processBirthdayOutcomeSent",
                "type": "variable"
              },
              "Out_WasSkipped": {
                "name": "processBirthdayOutcomeSkipped",
                "type": "variable"
              },
              "WorkflowFileName": {
                "type": "literal",
                "value": "ProcessBirthday.xaml"
              }
            },
            "activityType": "InvokeWorkflowFile",
            "selectorHint": null,
            "errorHandling": "catch",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Decision point: track sent vs skipped vs error outcomes for Finalize summary. Log Trace on each branch.",
            "activity": "Evaluate ProcessBirthday outcome: increment sentCount if sent",
            "properties": {
              "Condition": {
                "left": "processBirthdayOutcomeSent",
                "type": "expression",
                "right": "True",
                "operator": "="
              }
            },
            "activityType": "If",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          },
          {
            "notes": "Sent branch: increment sent counter.",
            "activity": "Increment sentCount after successful send",
            "properties": {
              "To": {
                "name": "sentCount",
                "type": "variable"
              },
              "Value": {
                "type": "vb_expression",
                "value": "sentCount + 1"
              }
            },
            "activityType": "Assign",
            "selectorHint": null,
            "errorHandling": "none",
            "activityPackage": "UiPath.System.Activities"
          }
        ],
        "variables": [
          {
            "name": "runId",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "runRecordId",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "startTimeUtc",
            "type": "DateTime",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "birthdaysCalendarName",
            "type": "String",
            "scope": "workflow",
            "defaultValue": "Birthdays"
          },
          {
            "name": "timeZone",
            "type": "String",
            "scope": "workflow",
            "defaultValue": "America/New_York"
          },
          {
            "name": "emailStyleSpec",
            "type": "String",
            "scope": "workflow",
            "defaultValue": "Write a warm, funny, lightly sarcastic birthday email. No emojis. Provide one short subject line and an email body of 40-90 words."
          },
          {
            "name": "emailWordCountMin",
            "type": "Int32",
            "scope": "workflow",
            "defaultValue": "40"
          },
          {
            "name": "emailWordCountMax",
            "type": "Int32",
            "scope": "workflow",
            "defaultValue": "90"
          },
          {
            "name": "allowActionCenterFallback",
            "type": "Boolean",
            "scope": "workflow",
            "defaultValue": "True"
          },
          {
            "name": "gmailFromConnectionName",
            "type": "String",
            "scope": "workflow",
            "defaultValue": "ninemush@gmail.com"
          },
          {
            "name": "dedupeScope",
            "type": "String",
            "scope": "workflow",
            "defaultValue": "FullName+SendDate"
          },
          {
            "name": "birthdayWorkItems",
            "type": "DataTable",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "currentBirthdayRow",
            "type": "Object",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "sentCount",
            "type": "Int32",
            "scope": "workflow",
            "defaultValue": "0"
          },
          {
            "name": "skippedCount",
            "type": "Int32",
            "scope": "workflow",
            "defaultValue": "0"
          },
          {
            "name": "errorCount",
            "type": "Int32",
            "scope": "workflow",
            "defaultValue": "0"
          },
          {
            "name": "birthdaysFound",
            "type": "Int32",
            "scope": "workflow",
            "defaultValue": "0"
          },
          {
            "name": "runStatus",
            "type": "String",
            "scope": "workflow",
            "defaultValue": "Started"
          },
          {
            "name": "jobLevelException",
            "type": "Object",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "processBirthdayOutcomeSent",
            "type": "Boolean",
            "scope": "workflow",
            "defaultValue": "False"
          },
          {
            "name": "processBirthdayOutcomeSkipped",
            "type": "Boolean",
            "scope": "workflow",
            "defaultValue": "False"
          },
          {
            "name": "screenshotPath",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "logMessage",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "orchestratorJobKey",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "gSuiteCredentialUsername",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "gSuiteCredentialPassword",
            "type": "String",
            "scope": "workflow",
            "defaultValue": ""
          },
          {
            "name": "wordCountMinStr",
            "type": "String",
            "scope": "workflow",
            "defaultValue": "40"
          },
          {
            "name": "wordCountMaxStr",
            "type": "String",
            "scope": "workflow",
            "defaultValue": "90"
          },
          {
            "name": "allowFallbackStr",
            "type": "String",
            "scope": "workflow",
            "defaultValue": "True"
          }
        ],
        "description": "Entry point: reads Orchestrator assets, initializes run record in Data Service, invokes GetBirthdays to retrieve today's work items, loops over each birthday invoking ProcessBirthday, then invokes Finalize. Inline TryCatch wraps the full orchestration; job-level failures update the Run record to Failed before rethrowing."
      }
    ],
    "description": "Daily unattended automation that reads today's birthdays from Google Calendar, resolves recipient emails via Google Contacts, generates personalized greetings using UiPath native GenAI, sends via Gmail Integration Service connector, and logs results to Data Service with deduplication and Action Center fallback for edge cases.",
    "projectName": "BirthdayGreetingsV26",
    "dependencies": [
      "UiPath.System.Activities",
      "UiPath.UIAutomation.Activities",
      "UiPath.DataService.Activities",
      "UiPath.GSuite.Activities",
      "UiPath.IntegrationService.Activities",
      "UiPath.Mail.Activities",
      "UiPath.Persistence.Activities"
    ]
  },
  "totalWorkflows": 6,
  "completedWorkflows": [
    "HandleHumanReview",
    "GetBirthdays",
    "ComposeDraft",
    "Finalize",
    "ProcessBirthday",
    "Main"
  ]
}
  ```

  ## Final Quality Report

  ```json
  {
  "statusReason": "Structurally invalid: 1 file(s) structurally blocked in final validation",
  "derivedStatus": "structurally_invalid",
  "enumCompliance": {
    "enumViolations": 0,
    "expressionSyntaxIssues": 3,
    "totalEnumComplianceIssues": 3,
    "catalogStructuralViolations": 0
  },
  "outcomeContext": {
    "autoRepairs": [
      {
        "file": "Main.xaml",
        "repairCode": "REPAIR_GENERIC",
        "description": "Catalog (fallback): Moved ui:GetAsset.Value from attribute to child-element in Main.xaml"
      },
      {
        "file": "Main.xaml",
        "repairCode": "REPAIR_GENERIC",
        "description": "Catalog (fallback): Moved ui:GetAsset.Value from attribute to child-element in Main.xaml"
      },
      {
        "file": "Main.xaml",
        "repairCode": "REPAIR_GENERIC",
        "description": "Catalog (fallback): Moved ui:GetAsset.Value from attribute to child-element in Main.xaml"
      },
      {
        "file": "Main.xaml",
        "repairCode": "REPAIR_GENERIC",
        "description": "Catalog (fallback): Moved ui:GetAsset.Value from attribute to child-element in Main.xaml"
      },
      {
        "file": "Main.xaml",
        "repairCode": "REPAIR_GENERIC",
        "description": "Catalog (fallback): Moved ui:GetAsset.Value from attribute to child-element in Main.xaml"
      },
      {
        "file": "Main.xaml",
        "repairCode": "REPAIR_GENERIC",
        "description": "Catalog (fallback): Moved ui:GetAsset.Value from attribute to child-element in Main.xaml"
      },
      {
        "file": "Main.xaml",
        "repairCode": "REPAIR_GENERIC",
        "description": "Catalog (fallback): Moved ui:GetAsset.Value from attribute to child-element in Main.xaml"
      },
      {
        "file": "Main.xaml",
        "repairCode": "REPAIR_GENERIC",
        "description": "Catalog (fallback): Moved ui:GetAsset.Value from attribute to child-element in Main.xaml"
      },
      {
        "file": "Main.xaml",
        "repairCode": "REPAIR_GENERIC",
        "description": "Catalog (fallback): Moved ui:GetCredential.Username from attribute to child-element in Main.xaml"
      },
      {
        "file": "Main.xaml",
        "repairCode": "REPAIR_GENERIC",
        "description": "Catalog (fallback): Moved ui:GetCredential.Password from attribute to child-element in Main.xaml"
      },
      {
        "file": "Main.xaml",
        "repairCode": "REPAIR_GENERIC",
        "description": "Catalog (fallback): Moved uds:CreateEntityRecord.EntityObject from attribute to child-element in Main.xaml"
      },
      {
        "file": "Main.xaml",
        "repairCode": "REPAIR_GENERIC",
        "description": "Catalog (fallback): Moved uds:CreateEntityRecord.Result from attribute to child-element in Main.xaml"
      },
      {
        "file": "Main.xaml",
        "repairCode": "REPAIR_GENERIC",
        "description": "Catalog (fallback): Moved ForEach.Values from attribute to child-element in Main.xaml"
      }
    ],
    "remediations": [
      {
        "file": "Finalize.xaml",
        "level": "validation-finding",
        "reason": "Line 310: ugs:GmailSendMessage is missing required property \"Body\"",
        "classifiedCheck": "MISSING_REQUIRED_ACTIVITY_PROPERTY",
        "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
        "remediationCode": "STUB_ACTIVITY_UNKNOWN",
        "estimatedEffortMinutes": 15
      },
      {
        "file": "Main.xaml",
        "level": "validation-finding",
        "reason": "Property \"To\" on Assign must be a child element, not an attribute",
        "classifiedCheck": "CATALOG_STRUCTURAL_VIOLATION",
        "developerAction": "Fix property syntax for activity in Main.xaml — move attribute to child-element or vice versa per UiPath catalog",
        "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
        "estimatedEffortMinutes": 15
      },
      {
        "file": "InitAllSettings.xaml",
        "level": "workflow",
        "reason": "Final validation: XAML well-formedness violations — replaced with stub. Details: [xml-wellformedness] XML parse error at line 76, col 186 (code: InvalidAttr): Attribute 'Settings\"]\"' has no space in starting.",
        "classifiedCheck": "xml-wellformedness",
        "developerAction": "Fix XML structure in InitAllSettings.xaml — [xml-wellformedness] XML parse error at line 76, col 186 (code: InvalidAttr): Attribute 'Settings\"]\"' has no space in starting.",
        "remediationCode": "STUB_WORKFLOW_BLOCKING",
        "estimatedEffortMinutes": 15
      },
      {
        "file": "GetBirthdays.xaml",
        "level": "workflow",
        "reason": "Final validation: XAML well-formedness violations — replaced with stub. Details: [malformed-quote] Line 122: attribute Message contains raw quote character mid-value; [malformed-quote] Line 470: attribute Message contains raw quote character mid-value; [malformed-quote] Line 510: attribute Message contains raw quote character mid-value",
        "classifiedCheck": "xml-wellformedness",
        "developerAction": "Fix XML structure in GetBirthdays.xaml — [malformed-quote] Line 122: attribute Message contains raw quote character mid-value; [malformed-quote] Line 470: attribute Message contains raw quote character mid-value; [malformed-quote] Line 510: attribute Message contains raw quote character mid-value",
        "remediationCode": "STUB_WORKFLOW_BLOCKING",
        "estimatedEffortMinutes": 15
      },
      {
        "file": "",
        "level": "activity",
        "reason": "[MISSING_REQUIRED_PROPERTY_INJECTED] ugs:GmailSendMessage.Body set to PLACEHOLDER — developer must provide actual value",
        "classifiedCheck": "post-assembly-repair",
        "developerAction": "ugs:GmailSendMessage.Body set to PLACEHOLDER — developer must provide actual value",
        "remediationCode": "POST_ASSEMBLY_REPAIR",
        "estimatedEffortMinutes": 5
      },
      {
        "file": "",
        "level": "activity",
        "reason": "[MISSING_REQUIRED_PROPERTY_INJECTED] ugs:GmailSendMessage.Body set to PLACEHOLDER — developer must provide actual value",
        "classifiedCheck": "post-assembly-repair",
        "developerAction": "ugs:GmailSendMessage.Body set to PLACEHOLDER — developer must provide actual value",
        "remediationCode": "POST_ASSEMBLY_REPAIR",
        "estimatedEffortMinutes": 5
      }
    ],
    "downgradeEvents": [],
    "qualityWarnings": [
      {
        "file": "Main.xaml",
        "check": "hardcoded-credential",
        "detail": "Potential hardcoded credential detected (pattern: password\\s*[:=]\\s*[\"'](?!\\[)[^...)",
        "severity": "warning"
      },
      {
        "file": "GetBirthdays",
        "check": "placeholder-value",
        "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
        "severity": "warning",
        "stubCategory": "handoff"
      },
      {
        "file": "ProcessBirthday",
        "check": "placeholder-value",
        "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
        "severity": "warning",
        "stubCategory": "handoff"
      },
      {
        "file": "HandleHumanReview",
        "check": "placeholder-value",
        "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
        "severity": "warning",
        "stubCategory": "handoff"
      },
      {
        "file": "orchestrator",
        "check": "undeclared-asset",
        "detail": "Asset \"{type:literal,value:BGV26_BirthdaysCalendarName}\" is referenced in XAML but not declared in orchestrator artifacts",
        "severity": "warning"
      },
      {
        "file": "orchestrator",
        "check": "undeclared-asset",
        "detail": "Asset \"{type:literal,value:BGV26_TimeZone}\" is referenced in XAML but not declared in orchestrator artifacts",
        "severity": "warning"
      },
      {
        "file": "orchestrator",
        "check": "undeclared-asset",
        "detail": "Asset \"{type:literal,value:BGV26_EmailStyleSpec}\" is referenced in XAML but not declared in orchestrator artifacts",
        "severity": "warning"
      },
      {
        "file": "orchestrator",
        "check": "undeclared-asset",
        "detail": "Asset \"{type:literal,value:BGV26_EmailWordCountMin}\" is referenced in XAML but not declared in orchestrator artifacts",
        "severity": "warning"
      },
      {
        "file": "orchestrator",
        "check": "undeclared-asset",
        "detail": "Asset \"{type:literal,value:BGV26_EmailWordCountMax}\" is referenced in XAML but not declared in orchestrator artifacts",
        "severity": "warning"
      },
      {
        "file": "orchestrator",
        "check": "undeclared-asset",
        "detail": "Asset \"{type:literal,value:BGV26_AllowActionCenterFallback}\" is referenced in XAML but not declared in orchestrator artifacts",
        "severity": "warning"
      },
      {
        "file": "orchestrator",
        "check": "undeclared-asset",
        "detail": "Asset \"{type:literal,value:BGV26_GmailFromConnectionName}\" is referenced in XAML but not declared in orchestrator artifacts",
        "severity": "warning"
      },
      {
        "file": "orchestrator",
        "check": "undeclared-asset",
        "detail": "Asset \"{type:literal,value:BGV26_DedupeScope}\" is referenced in XAML but not declared in orchestrator artifacts",
        "severity": "warning"
      },
      {
        "file": "orchestrator",
        "check": "undeclared-asset",
        "detail": "Asset \"{type:literal,value:BGV26_GSuite_ServiceAccount_Credential}\" is referenced in XAML but not declared in orchestrator artifacts",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "invalid-activity-property",
        "detail": "Line 485: property \"Arguments\" is not a known property of ui:InvokeWorkflowFile",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "invalid-activity-property",
        "detail": "Line 485: property \"Out_BirthdayWorkItems\" is not a known property of ui:InvokeWorkflowFile",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "invalid-activity-property",
        "detail": "Line 563: property \"Arguments\" is not a known property of ui:InvokeWorkflowFile",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "invalid-activity-property",
        "detail": "Line 563: property \"Out_WasSent\" is not a known property of ui:InvokeWorkflowFile",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "invalid-activity-property",
        "detail": "Line 563: property \"Out_WasSkipped\" is not a known property of ui:InvokeWorkflowFile",
        "severity": "warning"
      },
      {
        "file": "GetBirthdays.xaml",
        "check": "invalid-activity-property",
        "detail": "Line 210: property \"Condition\" is not a known property of ui:ShouldRetry",
        "severity": "warning"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "invalid-activity-property",
        "detail": "Line 203: property \"Arguments\" is not a known property of ui:InvokeWorkflowFile",
        "severity": "warning"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "unguarded-array-index",
        "detail": "Line 260: array indexing \".Rows(N)\" without a preceding row count check — may throw IndexOutOfRangeException at runtime",
        "severity": "warning"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "unguarded-array-index",
        "detail": "Line 264: array indexing \".Rows(N)\" without a preceding row count check — may throw IndexOutOfRangeException at runtime",
        "severity": "warning"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "unguarded-array-index",
        "detail": "Line 268: array indexing \".Rows(N)\" without a preceding row count check — may throw IndexOutOfRangeException at runtime",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-retry-count",
        "detail": "Line 440: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-retry-interval",
        "detail": "Line 440: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 77: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV26_BirthdaysCalendarName&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 116: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV26_TimeZone&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 155: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV26_EmailStyleSpec&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 194: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV26_EmailWordCountMin&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 237: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV26_EmailWordCountMax&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 280: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV26_AllowActionCenterFallback&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 323: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV26_GmailFromConnectionName&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 362: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV26_DedupeScope&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 401: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV26_GSuite_ServiceAccount_Credential&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "severity": "warning"
      },
      {
        "file": "GetBirthdays.xaml",
        "check": "hardcoded-retry-count",
        "detail": "Line 169: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
        "severity": "warning"
      },
      {
        "file": "GetBirthdays.xaml",
        "check": "hardcoded-retry-interval",
        "detail": "Line 126: retry interval hardcoded as \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;00:00:10&quot;}\" — consider externalizing to Config.xlsx",
        "severity": "warning"
      },
      {
        "file": "GetBirthdays.xaml",
        "check": "hardcoded-retry-interval",
        "detail": "Line 169: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
        "severity": "warning"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "hardcoded-retry-interval",
        "detail": "Line 75: retry interval hardcoded as \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;00:00:05&quot;}\" — consider externalizing to Config.xlsx",
        "severity": "warning"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "hardcoded-retry-interval",
        "detail": "Line 309: retry interval hardcoded as \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;00:00:05&quot;}\" — consider externalizing to Config.xlsx",
        "severity": "warning"
      },
      {
        "file": "HandleHumanReview.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 70: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV26_AllowActionCenterFallback&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "hardcoded-retry-count",
        "detail": "Line 86: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "hardcoded-retry-count",
        "detail": "Line 191: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "hardcoded-retry-count",
        "detail": "Line 305: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "hardcoded-retry-interval",
        "detail": "Line 86: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "hardcoded-retry-interval",
        "detail": "Line 191: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "hardcoded-retry-interval",
        "detail": "Line 305: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 100: asset name \"BGV26_GSuite_ServiceAccount_Credential\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 105: asset name \"BGV26_BirthdaysCalendarName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 114: asset name \"BGV26_TimeZone\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 123: asset name \"BGV26_EmailStyleSpec\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 132: asset name \"BGV26_EmailWordCountMin\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 141: asset name \"BGV26_EmailWordCountMax\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 150: asset name \"BGV26_AllowActionCenterFallback\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 159: asset name \"BGV26_GmailFromConnectionName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 168: asset name \"BGV26_DedupeScope\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "COMPLEX_EXPRESSION_PASSTHROUGH",
        "detail": "Line 70: Complex expression (lambdas, LINQ, nested calls, or 3+ operators) — emitting as-is to avoid regex corruption in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;BGV26...",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "EXPRESSION_SYNTAX",
        "detail": "Line 318: C# 'false' should be VB.NET 'False' in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;allowFallbac...",
        "severity": "warning"
      },
      {
        "file": "ComposeDraft.xaml",
        "check": "COMPLEX_EXPRESSION_PASSTHROUGH",
        "detail": "Line 319: Complex expression (lambdas, LINQ, nested calls, or 3+ operators) — emitting as-is to avoid regex corruption in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;validationEr...",
        "severity": "warning"
      },
      {
        "file": "ComposeDraft.xaml",
        "check": "COMPLEX_EXPRESSION_PASSTHROUGH",
        "detail": "Line 385: Complex expression (lambdas, LINQ, nested calls, or 3+ operators) — emitting as-is to avoid regex corruption in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;If(isValid, ...",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "COMPLEX_EXPRESSION_PASSTHROUGH",
        "detail": "Line 243: Complex expression (lambdas, LINQ, nested calls, or 3+ operators) — emitting as-is to avoid regex corruption in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;BGV26...",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"Settings\" for uexcel:ExcelReadRange.SheetName (expected String type) — wrapped in VB string quotes",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"Constants\" for uexcel:ExcelReadRange.SheetName (expected String type) — wrapped in VB string quotes",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_GSuite_ServiceAccount_Credential\" for ui:GetCredential.AssetName (expected String type) — wrapped in VB string quotes",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_BirthdaysCalendarName\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_TimeZone\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_EmailStyleSpec\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_EmailWordCountMin\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_EmailWordCountMax\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_AllowActionCenterFallback\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_GmailFromConnectionName\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
        "severity": "warning"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_DedupeScope\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "RETRY_INTERVAL_DEFAULTED",
        "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "RETRY_INTERVAL_DEFAULTED",
        "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "RETRY_INTERVAL_DEFAULTED",
        "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "RETRY_INTERVAL_DEFAULTED",
        "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
        "severity": "warning"
      }
    ],
    "stageHashParity": [
      {
        "postRepair": "1baf0761bfaa542b65cccc3313ef97785931e532bd0a29cb86004803a2b67ebd",
        "preArchive": "18d2e039d09c85e0002f0a3985668ec0cfaedadaadd40c4f75f3e15782ecb6dc",
        "archivedFile": "263218ef5ad391ca9c6888ffa1c830108651297f2c5daf36c7b1c7d059d60742",
        "workflowFile": "Main.xaml",
        "postGeneration": "1baf0761bfaa542b65cccc3313ef97785931e532bd0a29cb86004803a2b67ebd",
        "postNormalization": "1baf0761bfaa542b65cccc3313ef97785931e532bd0a29cb86004803a2b67ebd",
        "postFinalValidationInput": "18d2e039d09c85e0002f0a3985668ec0cfaedadaadd40c4f75f3e15782ecb6dc"
      },
      {
        "postRepair": "1a06b9c531a4339976d4ba8e25918c53a5635eeab18464ec05808ff9e16b578a",
        "preArchive": "1a17d15800724cb94b8fec2143067035e0b1248d236c41dfc0e6b8f8be43cc86",
        "archivedFile": "1a17d15800724cb94b8fec2143067035e0b1248d236c41dfc0e6b8f8be43cc86",
        "workflowFile": "GetBirthdays.xaml",
        "postGeneration": "1a06b9c531a4339976d4ba8e25918c53a5635eeab18464ec05808ff9e16b578a",
        "postNormalization": "1a06b9c531a4339976d4ba8e25918c53a5635eeab18464ec05808ff9e16b578a",
        "postFinalValidationInput": "1a17d15800724cb94b8fec2143067035e0b1248d236c41dfc0e6b8f8be43cc86"
      },
      {
        "postRepair": "f7827802f6e19d217a90476a86935c448d13da69e886458d8be6bbe485497e95",
        "preArchive": "744436b75eaa63f79bc15edb51de0a9a0c6c9ebe6b04c3651ddcdc0767a63b96",
        "archivedFile": "744436b75eaa63f79bc15edb51de0a9a0c6c9ebe6b04c3651ddcdc0767a63b96",
        "workflowFile": "ProcessBirthday.xaml",
        "postGeneration": "f7827802f6e19d217a90476a86935c448d13da69e886458d8be6bbe485497e95",
        "postNormalization": "f7827802f6e19d217a90476a86935c448d13da69e886458d8be6bbe485497e95",
        "postFinalValidationInput": "744436b75eaa63f79bc15edb51de0a9a0c6c9ebe6b04c3651ddcdc0767a63b96"
      },
      {
        "postRepair": "645efe9f6723cd346d5cd940d19fe86ce5c283b85394fa708084fe187d6c96c8",
        "preArchive": "bc77ca6704587ef53e15cfa56a08fc85e48763e3677d9028db94d7f44769b24d",
        "archivedFile": "bc77ca6704587ef53e15cfa56a08fc85e48763e3677d9028db94d7f44769b24d",
        "workflowFile": "InitAllSettings.xaml",
        "postGeneration": "645efe9f6723cd346d5cd940d19fe86ce5c283b85394fa708084fe187d6c96c8",
        "postNormalization": "645efe9f6723cd346d5cd940d19fe86ce5c283b85394fa708084fe187d6c96c8",
        "postFinalValidationInput": "bc77ca6704587ef53e15cfa56a08fc85e48763e3677d9028db94d7f44769b24d"
      },
      {
        "preArchive": "d2f41e8d32dc8221f49d6a7950004a831d90b8c12a408acc7d58b70aacb4198a",
        "workflowFile": "GetBirthdays",
        "postNormalization": "d2f41e8d32dc8221f49d6a7950004a831d90b8c12a408acc7d58b70aacb4198a",
        "postFinalValidationInput": "d2f41e8d32dc8221f49d6a7950004a831d90b8c12a408acc7d58b70aacb4198a"
      },
      {
        "preArchive": "8b31ecf5e55e17182735399e04e5f6e1ac831ef7c9b5df99944ad9f289bcf61b",
        "workflowFile": "ProcessBirthday",
        "postNormalization": "8b31ecf5e55e17182735399e04e5f6e1ac831ef7c9b5df99944ad9f289bcf61b",
        "postFinalValidationInput": "8b31ecf5e55e17182735399e04e5f6e1ac831ef7c9b5df99944ad9f289bcf61b"
      },
      {
        "preArchive": "afb09ea05f7d19421bc063aa97f9f4ea40c84d7a8661919b79e3c63236d10db5",
        "workflowFile": "HandleHumanReview",
        "postNormalization": "afb09ea05f7d19421bc063aa97f9f4ea40c84d7a8661919b79e3c63236d10db5",
        "postFinalValidationInput": "afb09ea05f7d19421bc063aa97f9f4ea40c84d7a8661919b79e3c63236d10db5"
      }
    ],
    "fullyGeneratedFiles": [],
    "invokeContractTrace": [
      {
        "callerWorkflow": "Main.xaml",
        "targetWorkflow": "GetBirthdays",
        "providedBindings": {
          "Arguments": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;New Dictionary(Of String, Object) From {{\\&quot;in_CalendarName\\&quot;, birthdaysCalendarName}, {\\&quot;in_TimeZone\\&quot;, timeZone}, {\\&quot;in_GSuiteUsername\\&quot;, gSuiteCredentialUsername}, {\\&quot;in_GSuitePassword\\&quot;, gSuiteCredentialPassword}, {\\&quot;in_RunId\\&quot;, runId}, {\\&quot;out_BirthdayWorkItems\\&quot;, Nothing}}&quot;}",
          "Out_BirthdayWorkItems": "{&quot;type&quot;:&quot;variable&quot;,&quot;name&quot;:&quot;birthdayWorkItems&quot;}"
        },
        "undeclaredSymbols": [
          "value",
          "birthdayWorkItems"
        ],
        "unknownTargetArguments": [
          "Arguments",
          "Out_BirthdayWorkItems"
        ],
        "targetDeclaredArguments": [],
        "missingRequiredArguments": []
      },
      {
        "callerWorkflow": "Main.xaml",
        "targetWorkflow": "ProcessBirthday",
        "providedBindings": {
          "Arguments": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;New Dictionary(Of String, Object) From {{\\&quot;in_FullNameRaw\\&quot;, currentBirthdayRow(\\&quot;FullNameRaw\\&quot;).ToString()}, {\\&quot;in_FullNameNormalized\\&quot;, currentBirthdayRow(\\&quot;FullNameNormalized\\&quot;).ToString()}, {\\&quot;in_CalendarEventId\\&quot;, currentBirthdayRow(\\&quot;CalendarEventId\\&quot;).ToString()}, {\\&quot;in_RunId\\&quot;, runId}, {\\&quot;in_EmailStyleSpec\\&quot;, emailStyleSpec}, {\\&quot;in_WordCountMin\\&quot;, emailWordCountMin}, {\\&quot;in_WordCountMax\\&quot;, emailWordCountMax}, {\\&quot;in_AllowActionCenterFallback\\&quot;, allowActionCenterFallback}, {\\&quot;in_GmailConnectionName\\&quot;, gmailFromConnectionName}, {\\&quot;in_DedupeScope\\&quot;, dedupeScope}, {\\&quot;in_GSuiteUsername\\&quot;, gSuiteCredentialUsername}, {\\&quot;in_GSuitePassword\\&quot;, gSuiteCredentialPassword}, {\\&quot;out_WasSent\\&quot;, Nothing}, {\\&quot;out_WasSkipped\\&quot;, Nothing}}&quot;}",
          "Out_WasSent": "{&quot;type&quot;:&quot;variable&quot;,&quot;name&quot;:&quot;processBirthdayOutcomeSent&quot;}",
          "Out_WasSkipped": "{&quot;type&quot;:&quot;variable&quot;,&quot;name&quot;:&quot;processBirthdayOutcomeSkipped&quot;}"
        },
        "undeclaredSymbols": [
          "value",
          "emailWordCountMin",
          "emailWordCountMax"
        ],
        "unknownTargetArguments": [
          "Arguments",
          "Out_WasSent",
          "Out_WasSkipped"
        ],
        "targetDeclaredArguments": [],
        "missingRequiredArguments": []
      },
      {
        "callerWorkflow": "ProcessBirthday.xaml",
        "targetWorkflow": "HandleHumanReview",
        "providedBindings": {
          "Arguments": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;New Dictionary(Of String, Object) From {{\\&quot;InRunId\\&quot;, InRunId}, {\\&quot;InFullNameNormalized\\&quot;, InFullNameNormalized}, {\\&quot;InReviewMode\\&quot;, \\&quot;ContactDisambiguation\\&quot;}, {\\&quot;InCandidateContacts\\&quot;, candidateContactsFormatted}, {\\&quot;InProposedSubject\\&quot;, \\&quot;\\&quot;}, {\\&quot;InProposedBody\\&quot;, \\&quot;\\&quot;}, {\\&quot;OutApprovalDecision\\&quot;, humanReviewDecision}, {\\&quot;OutSelectedEmail\\&quot;, humanReviewSelectedEmail}}&quot;}"
        },
        "undeclaredSymbols": [],
        "unknownTargetArguments": [
          "Arguments"
        ],
        "targetDeclaredArguments": [],
        "missingRequiredArguments": []
      }
    ],
    "studioCompatibility": [
      {
        "file": "Main.xaml",
        "level": "studio-blocked",
        "blockers": [
          "[CATALOG_STRUCTURAL_VIOLATION] Property \"To\" on Assign must be a child element, not an attribute"
        ]
      },
      {
        "file": "GetBirthdays.xaml",
        "level": "studio-blocked",
        "blockers": [
          "[XML-WELLFORMEDNESS] XML well-formedness failure in tree assembler"
        ],
        "failureSummary": "XML well-formedness failure in tree assembler",
        "failureCategory": "xml-wellformedness"
      },
      {
        "file": "ProcessBirthday.xaml",
        "level": "studio-blocked",
        "blockers": [
          "[EXPRESSION_IN_LITERAL_SLOT] Line 75: RetryInterval=\"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;00:00:05&quot;}\" contains a VB expression or variable that is not bracket-wrapped — must be hh:mm:ss literal or [expression]",
          "[EXPRESSION_IN_LITERAL_SLOT] Line 309: RetryInterval=\"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;00:00:05&quot;}\" contains a VB expression or variable that is not bracket-wrapped — must be hh:mm:ss literal or [expression]"
        ]
      },
      {
        "file": "ComposeDraft.xaml",
        "level": "studio-clean",
        "blockers": []
      },
      {
        "file": "HandleHumanReview.xaml",
        "level": "studio-clean",
        "blockers": []
      },
      {
        "file": "Finalize.xaml",
        "level": "studio-clean",
        "blockers": []
      },
      {
        "file": "InitAllSettings.xaml",
        "level": "studio-blocked",
        "blockers": [
          "[XML-WELLFORMEDNESS] XML well-formedness failure in tree assembler"
        ],
        "failureSummary": "XML well-formedness failure in tree assembler",
        "failureCategory": "xml-wellformedness"
      },
      {
        "file": "GetBirthdays",
        "level": "studio-blocked",
        "blockers": [
          "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
        ],
        "failureSummary": "Compliance or quality gate failure requiring manual remediation",
        "failureCategory": "compliance-failure"
      },
      {
        "file": "ProcessBirthday",
        "level": "studio-blocked",
        "blockers": [
          "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
        ],
        "failureSummary": "Compliance or quality gate failure requiring manual remediation",
        "failureCategory": "compliance-failure"
      },
      {
        "file": "HandleHumanReview",
        "level": "studio-blocked",
        "blockers": [
          "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
        ],
        "failureSummary": "Compliance or quality gate failure requiring manual remediation",
        "failureCategory": "compliance-failure"
      }
    ],
    "propertyRemediations": [],
    "preEmissionValidation": {
      "issueCount": 0,
      "enumCorrections": 0,
      "totalActivities": 0,
      "validActivities": 0,
      "unknownActivities": 0,
      "commentConversions": 0,
      "strippedProperties": 0,
      "missingRequiredFilled": 0
    },
    "totalEstimatedEffortMinutes": 70
  },
  "perFileResults": [
    {
      "file": "Main.xaml",
      "blockers": [],
      "errorCount": 12,
      "warningCount": 28,
      "analysisReport": {
        "violations": [
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"str_ScreenshotPath\" is declared but never used",
            "category": "usage",
            "location": "line 79",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-SEC-004",
            "message": "LogMessage may contain sensitive data (matched: \"credential\") — use SecureString or mask the value",
            "category": "security",
            "location": "line 449",
            "ruleName": "Sensitive data in log message",
            "severity": "error",
            "autoFixed": false
          }
        ],
        "totalPassed": 12,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-USG-005",
            "status": "violation",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "violation",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 2
      },
      "hasStubContent": false,
      "isStudioLoadable": true,
      "studioCompatibilityLevel": "studio-warnings"
    },
    {
      "file": "GetBirthdays.xaml",
      "blockers": [],
      "errorCount": 0,
      "warningCount": 2,
      "analysisReport": {
        "violations": [
          {
            "ruleId": "ST-DBP-025",
            "message": "Workflow does not contain an initial LogMessage activity",
            "category": "best-practice",
            "ruleName": "Workflow should have initial log",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"str_ScreenshotPath\" is declared but never used",
            "category": "usage",
            "location": "line 57",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          }
        ],
        "totalPassed": 12,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "violation",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-005",
            "status": "violation",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "passed",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 2
      },
      "hasStubContent": true,
      "isStudioLoadable": true,
      "studioCompatibilityLevel": "studio-warnings"
    },
    {
      "file": "ProcessBirthday.xaml",
      "blockers": [],
      "errorCount": 13,
      "warningCount": 8,
      "analysisReport": {
        "violations": [
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"str_ScreenshotPath\" is declared but never used",
            "category": "usage",
            "location": "line 66",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          }
        ],
        "totalPassed": 13,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-USG-005",
            "status": "violation",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "passed",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 1
      },
      "hasStubContent": false,
      "isStudioLoadable": true,
      "studioCompatibilityLevel": "studio-warnings"
    },
    {
      "file": "ComposeDraft.xaml",
      "blockers": [],
      "errorCount": 9,
      "warningCount": 2,
      "analysisReport": {
        "violations": [
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"str_ScreenshotPath\" is declared but never used",
            "category": "usage",
            "location": "line 63",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          }
        ],
        "totalPassed": 13,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-USG-005",
            "status": "violation",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "passed",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 1
      },
      "hasStubContent": false,
      "isStudioLoadable": true,
      "studioCompatibilityLevel": "studio-clean"
    },
    {
      "file": "HandleHumanReview.xaml",
      "blockers": [],
      "errorCount": 9,
      "warningCount": 2,
      "analysisReport": {
        "violations": [
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"str_ScreenshotPath\" is declared but never used",
            "category": "usage",
            "location": "line 63",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          }
        ],
        "totalPassed": 13,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-USG-005",
            "status": "violation",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "passed",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 1
      },
      "hasStubContent": false,
      "isStudioLoadable": true,
      "studioCompatibilityLevel": "studio-clean"
    },
    {
      "file": "Finalize.xaml",
      "blockers": [
        "[pseudo-xaml] Line 310: pseudo-XAML attribute Body=\"PLACEHOLDER\""
      ],
      "errorCount": 11,
      "warningCount": 10,
      "analysisReport": {
        "violations": [
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"str_ScreenshotPath\" is declared but never used",
            "category": "usage",
            "location": "line 63",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          }
        ],
        "totalPassed": 13,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-USG-005",
            "status": "violation",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "passed",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 1
      },
      "hasStubContent": false,
      "isStudioLoadable": true,
      "studioCompatibilityLevel": "studio-blocked"
    },
    {
      "file": "InitAllSettings.xaml",
      "blockers": [],
      "errorCount": 0,
      "warningCount": 0,
      "analysisReport": {
        "violations": [
          {
            "ruleId": "ST-DBP-025",
            "message": "Workflow does not contain an initial LogMessage activity",
            "category": "best-practice",
            "ruleName": "Workflow should have initial log",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"dt_Settings\" is declared but never used",
            "category": "usage",
            "location": "line 60",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"dt_Constants\" is declared but never used",
            "category": "usage",
            "location": "line 61",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"str_ConfigPath\" is declared but never used",
            "category": "usage",
            "location": "line 62",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"str_AssetValue\" is declared but never used",
            "category": "usage",
            "location": "line 63",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"str_TempUser\" is declared but never used",
            "category": "usage",
            "location": "line 64",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"sec_TempPass\" is declared but never used",
            "category": "usage",
            "location": "line 65",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"drow_RowCurrent\" is declared but never used",
            "category": "usage",
            "location": "line 66",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"dict_Config\" is declared but never used",
            "category": "usage",
            "location": "line 67",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          }
        ],
        "totalPassed": 12,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "violation",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-005",
            "status": "violation",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 8
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "passed",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 9
      },
      "hasStubContent": true,
      "isStudioLoadable": true,
      "studioCompatibilityLevel": "studio-clean"
    },
    {
      "file": "GetBirthdays",
      "blockers": [],
      "errorCount": 0,
      "warningCount": 1,
      "analysisReport": {
        "violations": [
          {
            "ruleId": "ST-DBP-025",
            "message": "Workflow does not contain an initial LogMessage activity",
            "category": "best-practice",
            "ruleName": "Workflow should have initial log",
            "severity": "warning",
            "autoFixed": false
          }
        ],
        "totalPassed": 13,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "violation",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-005",
            "status": "passed",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "passed",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 1
      },
      "hasStubContent": true,
      "isStudioLoadable": true,
      "studioCompatibilityLevel": "studio-warnings"
    },
    {
      "file": "ProcessBirthday",
      "blockers": [],
      "errorCount": 0,
      "warningCount": 1,
      "analysisReport": {
        "violations": [
          {
            "ruleId": "ST-DBP-025",
            "message": "Workflow does not contain an initial LogMessage activity",
            "category": "best-practice",
            "ruleName": "Workflow should have initial log",
            "severity": "warning",
            "autoFixed": false
          }
        ],
        "totalPassed": 13,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "violation",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-005",
            "status": "passed",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "passed",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 1
      },
      "hasStubContent": true,
      "isStudioLoadable": true,
      "studioCompatibilityLevel": "studio-warnings"
    },
    {
      "file": "HandleHumanReview",
      "blockers": [],
      "errorCount": 0,
      "warningCount": 1,
      "analysisReport": {
        "violations": [
          {
            "ruleId": "ST-DBP-025",
            "message": "Workflow does not contain an initial LogMessage activity",
            "category": "best-practice",
            "ruleName": "Workflow should have initial log",
            "severity": "warning",
            "autoFixed": false
          }
        ],
        "totalPassed": 13,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "violation",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-005",
            "status": "passed",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "passed",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 1
      },
      "hasStubContent": true,
      "isStudioLoadable": true,
      "studioCompatibilityLevel": "studio-warnings"
    }
  ],
  "aggregatedStats": {
    "totalFiles": 10,
    "totalErrors": 54,
    "totalWarnings": 55,
    "studioCleanCount": 3,
    "studioBlockedCount": 1,
    "studioWarningsCount": 6
  },
  "analysisReports": [
    {
      "report": {
        "violations": [
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"str_ScreenshotPath\" is declared but never used",
            "category": "usage",
            "location": "line 79",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-SEC-004",
            "message": "LogMessage may contain sensitive data (matched: \"credential\") — use SecureString or mask the value",
            "category": "security",
            "location": "line 449",
            "ruleName": "Sensitive data in log message",
            "severity": "error",
            "autoFixed": false
          }
        ],
        "totalPassed": 12,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-USG-005",
            "status": "violation",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "violation",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 2
      },
      "fileName": "Main.xaml"
    },
    {
      "report": {
        "violations": [
          {
            "ruleId": "ST-DBP-025",
            "message": "Workflow does not contain an initial LogMessage activity",
            "category": "best-practice",
            "ruleName": "Workflow should have initial log",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"str_ScreenshotPath\" is declared but never used",
            "category": "usage",
            "location": "line 57",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          }
        ],
        "totalPassed": 12,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "violation",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-005",
            "status": "violation",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "passed",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 2
      },
      "fileName": "GetBirthdays.xaml"
    },
    {
      "report": {
        "violations": [
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"str_ScreenshotPath\" is declared but never used",
            "category": "usage",
            "location": "line 66",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          }
        ],
        "totalPassed": 13,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-USG-005",
            "status": "violation",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "passed",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 1
      },
      "fileName": "ProcessBirthday.xaml"
    },
    {
      "report": {
        "violations": [
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"str_ScreenshotPath\" is declared but never used",
            "category": "usage",
            "location": "line 63",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          }
        ],
        "totalPassed": 13,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-USG-005",
            "status": "violation",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "passed",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 1
      },
      "fileName": "ComposeDraft.xaml"
    },
    {
      "report": {
        "violations": [
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"str_ScreenshotPath\" is declared but never used",
            "category": "usage",
            "location": "line 63",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          }
        ],
        "totalPassed": 13,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-USG-005",
            "status": "violation",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "passed",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 1
      },
      "fileName": "HandleHumanReview.xaml"
    },
    {
      "report": {
        "violations": [
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"str_ScreenshotPath\" is declared but never used",
            "category": "usage",
            "location": "line 63",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          }
        ],
        "totalPassed": 13,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-USG-005",
            "status": "violation",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "passed",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 1
      },
      "fileName": "Finalize.xaml"
    },
    {
      "report": {
        "violations": [
          {
            "ruleId": "ST-DBP-025",
            "message": "Workflow does not contain an initial LogMessage activity",
            "category": "best-practice",
            "ruleName": "Workflow should have initial log",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"dt_Settings\" is declared but never used",
            "category": "usage",
            "location": "line 60",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"dt_Constants\" is declared but never used",
            "category": "usage",
            "location": "line 61",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"str_ConfigPath\" is declared but never used",
            "category": "usage",
            "location": "line 62",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"str_AssetValue\" is declared but never used",
            "category": "usage",
            "location": "line 63",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"str_TempUser\" is declared but never used",
            "category": "usage",
            "location": "line 64",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"sec_TempPass\" is declared but never used",
            "category": "usage",
            "location": "line 65",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"drow_RowCurrent\" is declared but never used",
            "category": "usage",
            "location": "line 66",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          },
          {
            "ruleId": "ST-USG-005",
            "message": "Variable \"dict_Config\" is declared but never used",
            "category": "usage",
            "location": "line 67",
            "ruleName": "Unused variable",
            "severity": "warning",
            "autoFixed": false
          }
        ],
        "totalPassed": 12,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "violation",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-005",
            "status": "violation",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 8
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "passed",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 9
      },
      "fileName": "InitAllSettings.xaml"
    },
    {
      "report": {
        "violations": [
          {
            "ruleId": "ST-DBP-025",
            "message": "Workflow does not contain an initial LogMessage activity",
            "category": "best-practice",
            "ruleName": "Workflow should have initial log",
            "severity": "warning",
            "autoFixed": false
          }
        ],
        "totalPassed": 13,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "violation",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-005",
            "status": "passed",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "passed",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 1
      },
      "fileName": "GetBirthdays"
    },
    {
      "report": {
        "violations": [
          {
            "ruleId": "ST-DBP-025",
            "message": "Workflow does not contain an initial LogMessage activity",
            "category": "best-practice",
            "ruleName": "Workflow should have initial log",
            "severity": "warning",
            "autoFixed": false
          }
        ],
        "totalPassed": 13,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "violation",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-005",
            "status": "passed",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "passed",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 1
      },
      "fileName": "ProcessBirthday"
    },
    {
      "report": {
        "violations": [
          {
            "ruleId": "ST-DBP-025",
            "message": "Workflow does not contain an initial LogMessage activity",
            "category": "best-practice",
            "ruleName": "Workflow should have initial log",
            "severity": "warning",
            "autoFixed": false
          }
        ],
        "totalPassed": 13,
        "rulesChecked": [
          {
            "ruleId": "ST-NMG-001",
            "status": "passed",
            "category": "naming",
            "ruleName": "Variable naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-004",
            "status": "passed",
            "category": "naming",
            "ruleName": "Argument naming convention",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-NMG-009",
            "status": "passed",
            "category": "naming",
            "ruleName": "Activity must have DisplayName",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-002",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Empty Catch block",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-006",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Delay activity usage",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-020",
            "status": "passed",
            "category": "best-practice",
            "ruleName": "Hardcoded timeout",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-DBP-025",
            "status": "violation",
            "category": "best-practice",
            "ruleName": "Workflow start/end logging",
            "autoFixedCount": 0,
            "violationCount": 1
          },
          {
            "ruleId": "ST-USG-005",
            "status": "passed",
            "category": "usage",
            "ruleName": "Unused variable",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-USG-017",
            "status": "passed",
            "category": "usage",
            "ruleName": "Deeply nested If activities",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-004",
            "status": "passed",
            "category": "security",
            "ruleName": "Sensitive data in log message",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-SEC-005",
            "status": "passed",
            "category": "security",
            "ruleName": "Plaintext credential in property",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-001",
            "status": "passed",
            "category": "usage",
            "ruleName": "Invalid bare Argument tag in Catch",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-002",
            "status": "passed",
            "category": "usage",
            "ruleName": "Missing declaration for invoked argument",
            "autoFixedCount": 0,
            "violationCount": 0
          },
          {
            "ruleId": "ST-ARG-003",
            "status": "passed",
            "category": "usage",
            "ruleName": "Undeclared variable in expression",
            "autoFixedCount": 0,
            "violationCount": 0
          }
        ],
        "totalChecked": 14,
        "totalAutoFixed": 0,
        "totalRemaining": 1
      },
      "fileName": "HandleHumanReview"
    }
  ],
  "qualityGateResult": {
    "passed": false,
    "summary": {
      "totalErrors": 54,
      "totalWarnings": 55,
      "accuracyErrors": 14,
      "blockedPatterns": 1,
      "accuracyWarnings": 25,
      "completenessErrors": 0,
      "runtimeSafetyErrors": 39,
      "completenessWarnings": 5,
      "logicLocationWarnings": 22,
      "runtimeSafetyWarnings": 3
    },
    "readiness": "NEEDS_ATTENTION",
    "violations": [
      {
        "file": "Finalize.xaml",
        "check": "pseudo-xaml",
        "detail": "Line 310: pseudo-XAML attribute Body=\"PLACEHOLDER\"",
        "category": "blocked-pattern",
        "severity": "error"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-credential",
        "detail": "Potential hardcoded credential detected (pattern: password\\s*[:=]\\s*[\"'](?!\\[)[^...)",
        "category": "completeness",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "placeholder-value",
        "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
        "category": "completeness",
        "severity": "warning",
        "stubCategory": "handoff"
      },
      {
        "file": "GetBirthdays",
        "check": "placeholder-value",
        "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
        "category": "completeness",
        "severity": "warning",
        "stubCategory": "handoff"
      },
      {
        "file": "ProcessBirthday",
        "check": "placeholder-value",
        "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
        "category": "completeness",
        "severity": "warning",
        "stubCategory": "handoff"
      },
      {
        "file": "HandleHumanReview",
        "check": "placeholder-value",
        "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
        "category": "completeness",
        "severity": "warning",
        "stubCategory": "handoff"
      },
      {
        "file": "Main.xaml",
        "check": "invalid-activity-property",
        "detail": "Line 504: property \"Arguments\" is not a known property of ui:InvokeWorkflowFile",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "invalid-activity-property",
        "detail": "Line 504: property \"Out_BirthdayWorkItems\" is not a known property of ui:InvokeWorkflowFile",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "invalid-activity-property",
        "detail": "Line 582: property \"Arguments\" is not a known property of ui:InvokeWorkflowFile",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "invalid-activity-property",
        "detail": "Line 582: property \"Out_WasSent\" is not a known property of ui:InvokeWorkflowFile",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "invalid-activity-property",
        "detail": "Line 582: property \"Out_WasSkipped\" is not a known property of ui:InvokeWorkflowFile",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "invalid-activity-property",
        "detail": "Line 203: property \"Arguments\" is not a known property of ui:InvokeWorkflowFile",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "unguarded-array-index",
        "detail": "Line 260: array indexing \".Rows(N)\" without a preceding row count check — may throw IndexOutOfRangeException at runtime",
        "category": "runtime-safety",
        "severity": "warning"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "unguarded-array-index",
        "detail": "Line 264: array indexing \".Rows(N)\" without a preceding row count check — may throw IndexOutOfRangeException at runtime",
        "category": "runtime-safety",
        "severity": "warning"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "unguarded-array-index",
        "detail": "Line 268: array indexing \".Rows(N)\" without a preceding row count check — may throw IndexOutOfRangeException at runtime",
        "category": "runtime-safety",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "malformed-expression",
        "detail": "Line 92: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "Main.xaml",
        "check": "malformed-expression",
        "detail": "Line 456: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "Main.xaml",
        "check": "malformed-expression",
        "detail": "Line 500: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "Main.xaml",
        "check": "malformed-expression",
        "detail": "Line 544: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "Main.xaml",
        "check": "malformed-expression",
        "detail": "Line 557: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "Main.xaml",
        "check": "malformed-expression",
        "detail": "Line 570: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "malformed-expression",
        "detail": "Line 70: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "malformed-expression",
        "detail": "Line 155: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "malformed-expression",
        "detail": "Line 172: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "malformed-expression",
        "detail": "Line 187: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "malformed-expression",
        "detail": "Line 255: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "malformed-expression",
        "detail": "Line 257: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "malformed-expression",
        "detail": "Line 302: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "malformed-expression",
        "detail": "Line 304: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "malformed-expression",
        "detail": "Line 305: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "ComposeDraft.xaml",
        "check": "malformed-expression",
        "detail": "Line 66: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "ComposeDraft.xaml",
        "check": "malformed-expression",
        "detail": "Line 71: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "ComposeDraft.xaml",
        "check": "malformed-expression",
        "detail": "Line 111: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "ComposeDraft.xaml",
        "check": "malformed-expression",
        "detail": "Line 136: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "ComposeDraft.xaml",
        "check": "malformed-expression",
        "detail": "Line 264: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "ComposeDraft.xaml",
        "check": "malformed-expression",
        "detail": "Line 387: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "HandleHumanReview.xaml",
        "check": "malformed-expression",
        "detail": "Line 66: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "HandleHumanReview.xaml",
        "check": "malformed-expression",
        "detail": "Line 106: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "HandleHumanReview.xaml",
        "check": "malformed-expression",
        "detail": "Line 120: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "HandleHumanReview.xaml",
        "check": "malformed-expression",
        "detail": "Line 145: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "HandleHumanReview.xaml",
        "check": "malformed-expression",
        "detail": "Line 185: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "HandleHumanReview.xaml",
        "check": "malformed-expression",
        "detail": "Line 200: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "HandleHumanReview.xaml",
        "check": "malformed-expression",
        "detail": "Line 240: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "HandleHumanReview.xaml",
        "check": "malformed-expression",
        "detail": "Line 255: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "HandleHumanReview.xaml",
        "check": "malformed-expression",
        "detail": "Line 346: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "Finalize.xaml",
        "check": "malformed-expression",
        "detail": "Line 66: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "Finalize.xaml",
        "check": "malformed-expression",
        "detail": "Line 83: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "Finalize.xaml",
        "check": "malformed-expression",
        "detail": "Line 127: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "Finalize.xaml",
        "check": "malformed-expression",
        "detail": "Line 236: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "Finalize.xaml",
        "check": "malformed-expression",
        "detail": "Line 245: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "Finalize.xaml",
        "check": "malformed-expression",
        "detail": "Line 350: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "Finalize.xaml",
        "check": "malformed-expression",
        "detail": "Line 363: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "Finalize.xaml",
        "check": "malformed-expression",
        "detail": "Line 376: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "Finalize.xaml",
        "check": "malformed-expression",
        "detail": "Line 378: Message contains mixed literal/expression syntax — will produce a compile error in Studio",
        "category": "runtime-safety",
        "severity": "error"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-retry-count",
        "detail": "Line 459: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-retry-interval",
        "detail": "Line 459: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 96: asset name \"BGV26_BirthdaysCalendarName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 135: asset name \"BGV26_TimeZone\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 174: asset name \"BGV26_EmailStyleSpec\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 213: asset name \"BGV26_EmailWordCountMin\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 256: asset name \"BGV26_EmailWordCountMax\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 299: asset name \"BGV26_AllowActionCenterFallback\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 342: asset name \"BGV26_GmailFromConnectionName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 381: asset name \"BGV26_DedupeScope\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 420: asset name \"BGV26_GSuite_ServiceAccount_Credential\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "hardcoded-retry-count",
        "detail": "Line 75: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "hardcoded-retry-count",
        "detail": "Line 309: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "hardcoded-retry-interval",
        "detail": "Line 75: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "hardcoded-retry-interval",
        "detail": "Line 309: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "HandleHumanReview.xaml",
        "check": "hardcoded-asset-name",
        "detail": "Line 70: asset name \"BGV26_AllowActionCenterFallback\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "hardcoded-retry-count",
        "detail": "Line 86: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "hardcoded-retry-count",
        "detail": "Line 191: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "hardcoded-retry-count",
        "detail": "Line 305: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "hardcoded-retry-interval",
        "detail": "Line 86: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "hardcoded-retry-interval",
        "detail": "Line 191: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "hardcoded-retry-interval",
        "detail": "Line 305: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
        "category": "logic-location",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "COMPLEX_EXPRESSION_PASSTHROUGH",
        "detail": "Line 89: Complex expression (lambdas, LINQ, nested calls, or 3+ operators) — emitting as-is to avoid regex corruption in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;BGV26...",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "UNDECLARED_VARIABLE",
        "detail": "Line 251: Undeclared variable \"wordCountMinStr\" in expression: If(Integer.TryParse(wordCountMinStr, emailWordCountMin), ema... — variable is not declared in any <Variable> block in scope",
        "category": "accuracy",
        "severity": "error"
      },
      {
        "file": "Main.xaml",
        "check": "UNDECLARED_VARIABLE",
        "detail": "Line 251: Undeclared variable \"emailWordCountMin\" in expression: If(Integer.TryParse(wordCountMinStr, emailWordCountMin), ema... — variable is not declared in any <Variable> block in scope",
        "category": "accuracy",
        "severity": "error"
      },
      {
        "file": "Main.xaml",
        "check": "UNDECLARED_VARIABLE",
        "detail": "Line 294: Undeclared variable \"wordCountMaxStr\" in expression: If(Integer.TryParse(wordCountMaxStr, emailWordCountMax), ema... — variable is not declared in any <Variable> block in scope",
        "category": "accuracy",
        "severity": "error"
      },
      {
        "file": "Main.xaml",
        "check": "UNDECLARED_VARIABLE",
        "detail": "Line 294: Undeclared variable \"emailWordCountMax\" in expression: If(Integer.TryParse(wordCountMaxStr, emailWordCountMax), ema... — variable is not declared in any <Variable> block in scope",
        "category": "accuracy",
        "severity": "error"
      },
      {
        "file": "Main.xaml",
        "check": "EXPRESSION_SYNTAX",
        "detail": "Line 337: C# 'false' should be VB.NET 'False' in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;allowFallbac...",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "UNDECLARED_VARIABLE",
        "detail": "Line 542: Undeclared variable \"birthdayWorkItems\" in expression: If(birthdayWorkItems Is Nothing, 0, birthdayWorkItems.Rows.C... — variable is not declared in any <Variable> block in scope",
        "category": "accuracy",
        "severity": "error"
      },
      {
        "file": "Main.xaml",
        "check": "UNDECLARED_VARIABLE",
        "detail": "Line 632: Undeclared variable \"sentCount\" in expression: sentCount + 1 — variable is not declared in any <Variable> block in scope",
        "category": "accuracy",
        "severity": "error"
      },
      {
        "file": "GetBirthdays.xaml",
        "check": "EXPRESSION_SYNTAX",
        "detail": "Line 57: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;screenshots/error_&amp;quot; &amp;amp; DateTime.Now.ToString(&amp;quot...",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "GetBirthdays.xaml",
        "check": "EXPRESSION_SYNTAX",
        "detail": "Line 57: Double-encoded '&amp;amp;' corrected to '&amp;' in expression: &amp;quot;screenshots/error_&amp;quot; &amp;amp; DateTime.Now.ToString(&amp;quot...",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "UNDECLARED_VARIABLE",
        "detail": "Line 158: Undeclared variable \"contactsResults\" in expression: If(contactsResults IsNot Nothing, contactsResults.Rows.Count... — variable is not declared in any <Variable> block in scope",
        "category": "accuracy",
        "severity": "error"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "UNDECLARED_VARIABLE",
        "detail": "Line 260: Undeclared variable \"contactsResults\" in expression: contactsResults.Rows(0) — variable is not declared in any <Variable> block in scope",
        "category": "accuracy",
        "severity": "error"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "UNDECLARED_VARIABLE",
        "detail": "Line 270: Undeclared variable \"personalEmail\" in expression: Not String.IsNullOrWhiteSpace(personalEmail) — variable is not declared in any <Variable> block in scope",
        "category": "accuracy",
        "severity": "error"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "UNDECLARED_VARIABLE",
        "detail": "Line 286: Undeclared variable \"homeEmail\" in expression: Not String.IsNullOrWhiteSpace(homeEmail) — variable is not declared in any <Variable> block in scope",
        "category": "accuracy",
        "severity": "error"
      },
      {
        "file": "ComposeDraft.xaml",
        "check": "UNDECLARED_VARIABLE",
        "detail": "Line 262: Undeclared variable \"parsedSubject\" in expression: Not String.IsNullOrWhiteSpace(parsedSubject) AndAlso Not Str... — variable is not declared in any <Variable> block in scope",
        "category": "accuracy",
        "severity": "error"
      },
      {
        "file": "ComposeDraft.xaml",
        "check": "UNDECLARED_VARIABLE",
        "detail": "Line 262: Undeclared variable \"parsedBody\" in expression: Not String.IsNullOrWhiteSpace(parsedSubject) AndAlso Not Str... — variable is not declared in any <Variable> block in scope",
        "category": "accuracy",
        "severity": "error"
      },
      {
        "file": "ComposeDraft.xaml",
        "check": "COMPLEX_EXPRESSION_PASSTHROUGH",
        "detail": "Line 319: Complex expression (lambdas, LINQ, nested calls, or 3+ operators) — emitting as-is to avoid regex corruption in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;validationEr...",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "ComposeDraft.xaml",
        "check": "UNDECLARED_VARIABLE",
        "detail": "Line 381: Undeclared variable \"validationErrors\" in expression: String.IsNullOrEmpty(validationErrors) — variable is not declared in any <Variable> block in scope",
        "category": "accuracy",
        "severity": "error"
      },
      {
        "file": "ComposeDraft.xaml",
        "check": "COMPLEX_EXPRESSION_PASSTHROUGH",
        "detail": "Line 385: Complex expression (lambdas, LINQ, nested calls, or 3+ operators) — emitting as-is to avoid regex corruption in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;If(isValid, ...",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "UNDECLARED_VARIABLE",
        "detail": "Line 130: Undeclared variable \"queriedRunRecords\" in expression: queriedRunRecords — variable is not declared in any <Variable> block in scope",
        "category": "accuracy",
        "severity": "error"
      },
      {
        "file": "Finalize.xaml",
        "check": "COMPLEX_EXPRESSION_PASSTHROUGH",
        "detail": "Line 243: Complex expression (lambdas, LINQ, nested calls, or 3+ operators) — emitting as-is to avoid regex corruption in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;BGV26...",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_BirthdaysCalendarName\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_TimeZone\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_EmailStyleSpec\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_EmailWordCountMin\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_EmailWordCountMax\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_AllowActionCenterFallback\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_GmailFromConnectionName\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_DedupeScope\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "HandleHumanReview.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_AllowActionCenterFallback\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_Run\" for uds:QueryEntity.EntityType (expected String type) — wrapped in VB string quotes",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "Finalize.xaml",
        "check": "BARE_TOKEN_QUOTED",
        "detail": "Auto-quoted bare token \"BGV26_Run\" for uds:UpdateEntity.EntityType (expected String type) — wrapped in VB string quotes",
        "category": "accuracy",
        "severity": "warning"
      },
      {
        "file": "Main.xaml",
        "check": "transitive-dependency-missing",
        "detail": "Activity requires package \"UiPath.Database.Activities\" but it is not declared in project.json dependencies",
        "category": "accuracy",
        "severity": "warning"
      }
    ],
    "typeRepairs": [],
    "positiveEvidence": [
      {
        "file": "Main.xaml",
        "check": "xaml-valid",
        "detail": "Main.xaml found with 636 lines, valid <Activity> root element present"
      },
      {
        "file": "GetBirthdays.xaml",
        "check": "xaml-valid",
        "detail": "GetBirthdays.xaml found with 63 lines, valid <Activity> root element present"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "xaml-valid",
        "detail": "ProcessBirthday.xaml found with 391 lines, valid <Activity> root element present"
      },
      {
        "file": "ComposeDraft.xaml",
        "check": "xaml-valid",
        "detail": "ComposeDraft.xaml found with 390 lines, valid <Activity> root element present"
      },
      {
        "file": "HandleHumanReview.xaml",
        "check": "xaml-valid",
        "detail": "HandleHumanReview.xaml found with 376 lines, valid <Activity> root element present"
      },
      {
        "file": "Finalize.xaml",
        "check": "xaml-valid",
        "detail": "Finalize.xaml found with 381 lines, valid <Activity> root element present"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "xaml-valid",
        "detail": "InitAllSettings.xaml found with 73 lines, valid <Activity> root element present"
      },
      {
        "file": "GetBirthdays",
        "check": "xaml-valid",
        "detail": "GetBirthdays found with 61 lines, valid <Activity> root element present"
      },
      {
        "file": "ProcessBirthday",
        "check": "xaml-valid",
        "detail": "ProcessBirthday found with 61 lines, valid <Activity> root element present"
      },
      {
        "file": "HandleHumanReview",
        "check": "xaml-valid",
        "detail": "HandleHumanReview found with 61 lines, valid <Activity> root element present"
      },
      {
        "file": "Main.xaml",
        "check": "main-xaml-present",
        "detail": "Main.xaml entry point found in package"
      },
      {
        "file": "project.json",
        "check": "project-json-valid",
        "detail": "project.json parsed successfully with 8 dependencies declared"
      },
      {
        "file": "project.json",
        "check": "target-framework-set",
        "detail": "targetFramework is \"Windows\""
      },
      {
        "file": "project.json",
        "check": "expression-language-set",
        "detail": "expressionLanguage is \"VisualBasic\""
      },
      {
        "file": "project.json",
        "check": "entry-point-defined",
        "detail": "1 entry point(s) defined: Main.xaml"
      },
      {
        "file": "package",
        "check": "invoke-targets-resolved",
        "detail": "3/3 InvokeWorkflowFile targets resolve to existing files in the package"
      },
      {
        "file": "project.json",
        "check": "activity-packages-declared",
        "detail": "2 activity packages used, all declared in project.json dependencies"
      },
      {
        "file": "Main.xaml",
        "check": "namespaces-declared",
        "detail": "11 XML namespace(s) declared: mc, mva, s, sap, sap2010, scg, scg2, sco, ui, x, uds"
      },
      {
        "file": "GetBirthdays.xaml",
        "check": "namespaces-declared",
        "detail": "10 XML namespace(s) declared: mc, mva, s, sap, sap2010, scg, scg2, sco, ui, x"
      },
      {
        "file": "ProcessBirthday.xaml",
        "check": "namespaces-declared",
        "detail": "13 XML namespace(s) declared: mc, mva, s, sap, sap2010, scg, scg2, sco, ui, x, ucs, ugs, uds"
      },
      {
        "file": "ComposeDraft.xaml",
        "check": "namespaces-declared",
        "detail": "11 XML namespace(s) declared: mc, mva, s, sap, sap2010, scg, scg2, sco, ui, x, uweb"
      },
      {
        "file": "HandleHumanReview.xaml",
        "check": "namespaces-declared",
        "detail": "12 XML namespace(s) declared: mc, mva, s, sap, sap2010, scg, scg2, sco, ui, x, ucs, upers"
      },
      {
        "file": "Finalize.xaml",
        "check": "namespaces-declared",
        "detail": "12 XML namespace(s) declared: mc, mva, s, sap, sap2010, scg, scg2, sco, ui, x, uds, ugs"
      },
      {
        "file": "InitAllSettings.xaml",
        "check": "namespaces-declared",
        "detail": "10 XML namespace(s) declared: mc, mva, s, sap, sap2010, scg, scg2, sco, ui, x"
      },
      {
        "file": "GetBirthdays",
        "check": "namespaces-declared",
        "detail": "10 XML namespace(s) declared: mc, mva, s, sap, sap2010, scg, scg2, sco, ui, x"
      },
      {
        "file": "ProcessBirthday",
        "check": "namespaces-declared",
        "detail": "10 XML namespace(s) declared: mc, mva, s, sap, sap2010, scg, scg2, sco, ui, x"
      },
      {
        "file": "HandleHumanReview",
        "check": "namespaces-declared",
        "detail": "10 XML namespace(s) declared: mc, mva, s, sap, sap2010, scg, scg2, sco, ui, x"
      },
      {
        "file": "package",
        "check": "archive-parity-checked",
        "detail": "Archive manifest checked: 17 total files, 7 XAML files, 10 validated entries — parity confirmed"
      },
      {
        "file": "project.json",
        "check": "artifact-present",
        "detail": "project.json found in archive at \"lib/net45/project.json\""
      },
      {
        "file": "Config.xlsx",
        "check": "artifact-present",
        "detail": "Config.xlsx found in archive at \"lib/net45/Data/Config.xlsx\""
      },
      {
        "file": "DeveloperHandoffGuide.md",
        "check": "artifact-present",
        "detail": "DeveloperHandoffGuide.md found in archive at \"lib/net45/DeveloperHandoffGuide.md\""
      },
      {
        "file": "BirthdayGreetingsV26.nuspec",
        "check": "nuspec-present",
        "detail": "NuSpec package metadata found at \"BirthdayGreetingsV26.nuspec\""
      }
    ],
    "completenessLevel": "structural"
  },
  "traceabilityMetadata": {
    "downgradeCount": 0,
    "usedAIFallback": false,
    "pipelineWarningCount": 9,
    "flatStructureWarningCount": 0
  },
  "workflowGraphDefects": [
    {
      "file": "ComposeDraft.xaml",
      "notes": "Workflow is not reachable from root entry point Main.xaml",
      "severity": "handoff_required",
      "workflow": "ComposeDraft",
      "defectType": "orphan_workflow",
      "referencedFrom": null,
      "detectionMethod": "bfs_reachability",
      "referencedTarget": null
    },
    {
      "file": "Finalize.xaml",
      "notes": "Workflow is not reachable from root entry point Main.xaml",
      "severity": "handoff_required",
      "workflow": "Finalize",
      "defectType": "orphan_workflow",
      "referencedFrom": null,
      "detectionMethod": "bfs_reachability",
      "referencedTarget": null
    },
    {
      "file": "InitAllSettings.xaml",
      "notes": "Workflow matches a known decomposition pattern but is not reachable from Main.xaml",
      "severity": "handoff_required",
      "workflow": "InitAllSettings",
      "defectType": "decomposed_unwired_workflow",
      "referencedFrom": null,
      "detectionMethod": "bfs_reachability",
      "referencedTarget": null
    },
    {
      "file": "Main.xaml",
      "notes": "Workflow graph has 4 disconnected components — some workflows form isolated subgraphs",
      "severity": "handoff_required",
      "workflow": "Main",
      "defectType": "graph_discontinuity",
      "referencedFrom": null,
      "detectionMethod": "component_analysis",
      "referencedTarget": null
    }
  ],
  "workflowGraphSummary": {
    "exclusions": [
      {
        "file": "GetBirthdays",
        "reason": "non_executable_support"
      },
      {
        "file": "ProcessBirthday",
        "reason": "non_executable_support"
      },
      {
        "file": "HandleHumanReview",
        "reason": "non_executable_support"
      }
    ],
    "reachableCount": 4,
    "rootEntrypoint": {
      "file": "Main.xaml",
      "resolution": "inferred"
    },
    "unreachableCount": 3,
    "brokenReferenceCount": 0,
    "ambiguousReferenceCount": 0
  },
  "declarationValidation": {
    "unknownActivities": 0,
    "undeclaredVariables": 0,
    "invalidTypeArguments": 0,
    "undeclaredNamespaces": 0,
    "totalDeclarationIssues": 0
  },
  "executablePathDefects": [
    {
      "file": "Main.xaml",
      "severity": "execution_blocking",
      "workflow": "Main",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[Main][Init] BirthdayGreetingsV26 started. RunId=\\&quot; &amp; runId &amp; \\&quot; StartTimeUtc=\\&quot; &amp; startTimeUtc.To",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "Main.xaml",
      "severity": "execution_blocking",
      "workflow": "Main",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[Main][Init] Assets loaded. CalendarName=\\&quot; &amp; birthdaysCalendarName &amp; \\&quot; TimeZone=\\&quot; &amp; timeZone &a",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "Main.xaml",
      "severity": "execution_blocking",
      "workflow": "Main",
      "defectType": "leaked_json_expression",
      "activityType": "uds:CreateEntityRecord",
      "propertyName": "EntityObject",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;New Dictionary(Of String, Object) From {{\\&quot;RunId\\&quot;, runId}, {\\&quot;StartTimeUtc\\&quot;, startTimeUtc}, {\\&quot;RunStatus\\",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "Main.xaml",
      "severity": "execution_blocking",
      "workflow": "Main",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[Main][Init] BGV26_Run record created. RunId=\\&quot; &amp; runId &amp; \\&quot; RecordId=\\&quot; &amp; runRecordId&quot;}",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "Main.xaml",
      "severity": "execution_blocking",
      "workflow": "Main",
      "defectType": "malformed_vb_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "[&quot;[Error] Invoke GetBirthdays workflow to retrieve today&apos;s birthday work items failed (&quot; &amp; exception.GetType().Name &amp; &quot;): &quot; &amp; exception.Message]",
      "detectionMethod": "vb_linter"
    },
    {
      "file": "Main.xaml",
      "severity": "execution_blocking",
      "workflow": "Main",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[Main][GetBirthdays] Retrieved \\&quot; &amp; birthdaysFound.ToString() &amp; \\&quot; birthday event(s) for today. RunId=\\&quo",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "Main.xaml",
      "severity": "execution_blocking",
      "workflow": "Main",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[Main][Decision] No birthday events found for today. RunId=\\&quot; &amp; runId &amp; \\&quot; — proceeding directly to Finaliz",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "Main.xaml",
      "severity": "execution_blocking",
      "workflow": "Main",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[Main][Loop] Processing birthday for: \\&quot; &amp; currentBirthdayRow(\\&quot;FullNameNormalized\\&quot;).ToString() &amp; \\&q",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "Main.xaml",
      "severity": "execution_blocking",
      "workflow": "Main",
      "defectType": "leaked_json_expression",
      "activityType": "Assign",
      "propertyName": "Value",
      "offendingValue": "[{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;BGV26_\\&quot; &amp; DateTime.UtcNow.ToString(\\&quot;yyyyMMdd\\&quot;) &amp; \\&quot;_\\&quot; &amp; Guid.NewGuid().ToString(\\&q",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "Main.xaml",
      "severity": "execution_blocking",
      "workflow": "Main",
      "defectType": "leaked_json_expression",
      "activityType": "Assign",
      "propertyName": "Value",
      "offendingValue": "[{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;allowFallbackStr.Trim().ToLower() &lt;&gt; \\&quot;False\\&quot;&quot;}]",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ProcessBirthday.xaml",
      "severity": "execution_blocking",
      "workflow": "ProcessBirthday",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[ProcessBirthday] BEGIN | RunId=\\&quot; &amp; InRunId &amp; \\&quot; | FullName=\\&quot; &amp; InFullNameNormalized &amp; \\&quo",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ProcessBirthday.xaml",
      "severity": "handoff_required",
      "workflow": "ProcessBirthday",
      "defectType": "leaked_json_expression",
      "activityType": "ucs:MultipleAssign",
      "propertyName": "Assignments",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;New List(Of Tuple(Of String, Object)) From {Tuple.Create(\\&quot;OutItemStatus\\&quot;, CObj(\\&quot;Processing\\&quot;)), Tuple.Create(",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ProcessBirthday.xaml",
      "severity": "execution_blocking",
      "workflow": "ProcessBirthday",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[ProcessBirthday] GoogleContacts search returned \\&quot; &amp; (If(contactsResults IsNot Nothing, contactsResults.Rows.Count,",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ProcessBirthday.xaml",
      "severity": "execution_blocking",
      "workflow": "ProcessBirthday",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[ProcessBirthday] SKIP | NoContact | FullName=\\&quot; &amp; InFullNameNormalized &amp; \\&quot; | RunId=\\&quot; &amp; InRunId&",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ProcessBirthday.xaml",
      "severity": "handoff_required",
      "workflow": "ProcessBirthday",
      "defectType": "leaked_json_expression",
      "activityType": "ucs:MultipleAssign",
      "propertyName": "Assignments",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;New List(Of Tuple(Of String, Object)) From {Tuple.Create(\\&quot;OutItemStatus\\&quot;, CObj(\\&quot;Skipped\\&quot;)), Tuple.Create(\\&q",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ProcessBirthday.xaml",
      "severity": "handoff_required",
      "workflow": "ProcessBirthday",
      "defectType": "leaked_json_expression",
      "activityType": "ucs:MultipleAssign",
      "propertyName": "Assignments",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;New List(Of Tuple(Of String, Object)) From {Tuple.Create(\\&quot;isAmbiguousContact\\&quot;, CObj(True)), Tuple.Create(\\&quot;humanRev",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ProcessBirthday.xaml",
      "severity": "execution_blocking",
      "workflow": "ProcessBirthday",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[ProcessBirthday] AmbiguousContact | Count=\\&quot; &amp; contactCount.ToString() &amp; \\&quot; | FullName=\\&quot; &amp; InFul",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ProcessBirthday.xaml",
      "severity": "execution_blocking",
      "workflow": "ProcessBirthday",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[ProcessBirthday] DisambiguationResolved | SelectedEmail=\\&quot; &amp; selectedEmail &amp; \\&quot; | FullName=\\&quot; &amp; I",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ProcessBirthday.xaml",
      "severity": "handoff_required",
      "workflow": "ProcessBirthday",
      "defectType": "leaked_json_expression",
      "activityType": "ucs:MultipleAssign",
      "propertyName": "Assignments",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;New List(Of Tuple(Of String, Object)) From {Tuple.Create(\\&quot;OutItemStatus\\&quot;, CObj(\\&quot;Skipped\\&quot;)), Tuple.Create(\\&q",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ProcessBirthday.xaml",
      "severity": "execution_blocking",
      "workflow": "ProcessBirthday",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[ProcessBirthday] SKIP | DisambiguationRejectedOrACDisabled | FullName=\\&quot; &amp; InFullNameNormalized &amp; \\&quot; | Run",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ProcessBirthday.xaml",
      "severity": "execution_blocking",
      "workflow": "ProcessBirthday",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[ProcessBirthday] EmailSelection | Home fallback selected | FullName=\\&quot; &amp; InFullNameNormalized &amp; \\&quot; | HomeE",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ProcessBirthday.xaml",
      "severity": "handoff_required",
      "workflow": "ProcessBirthday",
      "defectType": "leaked_json_expression",
      "activityType": "ucs:MultipleAssign",
      "propertyName": "Assignments",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;New List(Of Tuple(Of String, Object)) From {Tuple.Create(\\&quot;OutItemStatus\\&quot;, CObj(\\&quot;Skipped\\&quot;)), Tuple.Create(\\&q",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ProcessBirthday.xaml",
      "severity": "execution_blocking",
      "workflow": "ProcessBirthday",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[ProcessBirthday] SKIP | NoEligibleEmail | FullName=\\&quot; &amp; InFullNameNormalized &amp; \\&quot; | RunId=\\&quot; &amp; In",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ProcessBirthday.xaml",
      "severity": "execution_blocking",
      "workflow": "ProcessBirthday",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[ProcessBirthday] EmailSelected | Email=\\&quot; &amp; selectedEmail &amp; \\&quot; | FullName=\\&quot; &amp; InFullNameNormaliz",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ProcessBirthday.xaml",
      "severity": "execution_blocking",
      "workflow": "ProcessBirthday",
      "defectType": "malformed_vb_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "[&quot;[Error] Query Data Service BGV26_SentLog for FullNameNormalized + GreetingYear failed (&quot; &amp; exception.GetType().Name &amp; &quot;): &quot; &amp; exception.Message]",
      "detectionMethod": "vb_linter"
    },
    {
      "file": "ProcessBirthday.xaml",
      "severity": "execution_blocking",
      "workflow": "ProcessBirthday",
      "defectType": "leaked_json_expression",
      "activityType": "Assign",
      "propertyName": "Value",
      "offendingValue": "[{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;If(contactsResults.Columns.Contains(\\&quot;PersonalEmail\\&quot;), If(contactsResults.Rows(0)(\\&quot;PersonalEmail\\&quot;) Is DBNull",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ProcessBirthday.xaml",
      "severity": "execution_blocking",
      "workflow": "ProcessBirthday",
      "defectType": "leaked_json_expression",
      "activityType": "Assign",
      "propertyName": "Value",
      "offendingValue": "[{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;If(contactsResults.Columns.Contains(\\&quot;HomeEmail\\&quot;), If(contactsResults.Rows(0)(\\&quot;HomeEmail\\&quot;) Is DBNull.Value, ",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ComposeDraft.xaml",
      "severity": "execution_blocking",
      "workflow": "ComposeDraft",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[ComposeDraft][START] RunId=\\&quot; &amp; InRunId &amp; \\&quot; | FullName=\\&quot; &amp; InFullName &amp; \\&quot; | WordCount",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ComposeDraft.xaml",
      "severity": "execution_blocking",
      "workflow": "ComposeDraft",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[ComposeDraft][PROMPT] RunId=\\&quot; &amp; InRunId &amp; \\&quot; | FullName=\\&quot; &amp; InFullName &amp; \\&quot; | Prompt l",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ComposeDraft.xaml",
      "severity": "execution_blocking",
      "workflow": "ComposeDraft",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[ComposeDraft][GENAI_RESPONSE] RunId=\\&quot; &amp; InRunId &amp; \\&quot; | FullName=\\&quot; &amp; InFullName &amp; \\&quot; | ",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ComposeDraft.xaml",
      "severity": "execution_blocking",
      "workflow": "ComposeDraft",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[ComposeDraft][WARN] RunId=\\&quot; &amp; InRunId &amp; \\&quot; | FullName=\\&quot; &amp; InFullName &amp; \\&quot; | GenAI retu",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ComposeDraft.xaml",
      "severity": "execution_blocking",
      "workflow": "ComposeDraft",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[ComposeDraft][JSON_PARSE] RunId=\\&quot; &amp; InRunId &amp; \\&quot; | FullName=\\&quot; &amp; InFullName &amp; \\&quot; | Pars",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ComposeDraft.xaml",
      "severity": "execution_blocking",
      "workflow": "ComposeDraft",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[ComposeDraft][VALIDATION] RunId=\\&quot; &amp; InRunId &amp; \\&quot; | FullName=\\&quot; &amp; InFullName &amp; \\&quot; | IsVa",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ComposeDraft.xaml",
      "severity": "execution_blocking",
      "workflow": "ComposeDraft",
      "defectType": "leaked_json_expression",
      "activityType": "Assign",
      "propertyName": "Value",
      "offendingValue": "[{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;InStyleSpec &amp; System.Environment.NewLine &amp; System.Environment.NewLine &amp; \\&quot;Recipient full name: \\&quot; &amp; InFul",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ComposeDraft.xaml",
      "severity": "execution_blocking",
      "workflow": "ComposeDraft",
      "defectType": "leaked_json_expression",
      "activityType": "Assign",
      "propertyName": "Value",
      "offendingValue": "[{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;If(TypeOf logMessage Is Newtonsoft.Json.Linq.JObject, CStr(DirectCast(logMessage, Newtonsoft.Json.Linq.JObject)(\\&quot;subject\\&quo",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ComposeDraft.xaml",
      "severity": "execution_blocking",
      "workflow": "ComposeDraft",
      "defectType": "leaked_json_expression",
      "activityType": "Assign",
      "propertyName": "Value",
      "offendingValue": "[{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;If(TypeOf logMessage Is Newtonsoft.Json.Linq.JObject, CStr(DirectCast(logMessage, Newtonsoft.Json.Linq.JObject)(\\&quot;body\\&quot;)",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ComposeDraft.xaml",
      "severity": "execution_blocking",
      "workflow": "ComposeDraft",
      "defectType": "leaked_json_expression",
      "activityType": "Assign",
      "propertyName": "Value",
      "offendingValue": "[{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;validationErrors &amp; If(String.IsNullOrEmpty(validationErrors), \\&quot;\\&quot;, \\&quot;; \\&quot;) &amp; \\&quot;SUBJECT_EMPTY\\&quo",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ComposeDraft.xaml",
      "severity": "execution_blocking",
      "workflow": "ComposeDraft",
      "defectType": "leaked_json_expression",
      "activityType": "Assign",
      "propertyName": "Value",
      "offendingValue": "[{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;validationErrors &amp; If(String.IsNullOrEmpty(validationErrors), \\&quot;\\&quot;, \\&quot;; \\&quot;) &amp; \\&quot;BODY_EMPTY\\&quot;&",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ComposeDraft.xaml",
      "severity": "execution_blocking",
      "workflow": "ComposeDraft",
      "defectType": "leaked_json_expression",
      "activityType": "Assign",
      "propertyName": "Value",
      "offendingValue": "[{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;If(String.IsNullOrWhiteSpace(parsedBody), 0, parsedBody.Trim().Split(New Char(){\\&quot; \\&quot;c, System.Environment.NewLine(0), Sy",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ComposeDraft.xaml",
      "severity": "execution_blocking",
      "workflow": "ComposeDraft",
      "defectType": "leaked_json_expression",
      "activityType": "Assign",
      "propertyName": "Value",
      "offendingValue": "[{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;validationErrors &amp; If(String.IsNullOrEmpty(validationErrors), \\&quot;\\&quot;, \\&quot;; \\&quot;) &amp; \\&quot;WORD_COUNT_OUT_OF_",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ComposeDraft.xaml",
      "severity": "execution_blocking",
      "workflow": "ComposeDraft",
      "defectType": "leaked_json_expression",
      "activityType": "Assign",
      "propertyName": "Value",
      "offendingValue": "[{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;System.Text.RegularExpressions.Regex.IsMatch(parsedSubject &amp; \\&quot; \\&quot; &amp; parsedBody, \\&quot;[\\\\uD83C-\\\\uDBFF\\\\uDC00-\\",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ComposeDraft.xaml",
      "severity": "execution_blocking",
      "workflow": "ComposeDraft",
      "defectType": "leaked_json_expression",
      "activityType": "Assign",
      "propertyName": "Value",
      "offendingValue": "[{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;validationErrors &amp; If(String.IsNullOrEmpty(validationErrors), \\&quot;\\&quot;, \\&quot;; \\&quot;) &amp; \\&quot;CONTAINS_EMOJI\\&qu",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "ComposeDraft.xaml",
      "severity": "execution_blocking",
      "workflow": "ComposeDraft",
      "defectType": "leaked_json_expression",
      "activityType": "Assign",
      "propertyName": "Value",
      "offendingValue": "[{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;If(isValid, \\&quot;VALIDATION_PASSED | WordCount=\\&quot; &amp; wordCount.ToString() &amp; \\&quot; | ContainsEmoji=False\\&quot;, \\&q",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "HandleHumanReview.xaml",
      "severity": "execution_blocking",
      "workflow": "HandleHumanReview",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[HandleHumanReview] START - RunId=\\&quot; &amp; InRunId &amp; \\&quot; | FullName=\\&quot; &amp; InFullName &amp; \\&quot; | Mod",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "HandleHumanReview.xaml",
      "severity": "execution_blocking",
      "workflow": "HandleHumanReview",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[HandleHumanReview] AllowActionCenterFallback=\\&quot; &amp; allowActionCenterFallback.ToString()&quot;}",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "HandleHumanReview.xaml",
      "severity": "execution_blocking",
      "workflow": "HandleHumanReview",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[HandleHumanReview] Action Center fallback disabled via asset. Returning Reject for FullName=\\&quot; &amp; InFullName &amp; \\",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "HandleHumanReview.xaml",
      "severity": "execution_blocking",
      "workflow": "HandleHumanReview",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[HandleHumanReview] Creating Action Center task. Title=\\&quot; &amp; taskTitle &amp; \\&quot; | Mode=\\&quot; &amp; InReviewMod",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "HandleHumanReview.xaml",
      "severity": "execution_blocking",
      "workflow": "HandleHumanReview",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[HandleHumanReview] CATCH CreateFormTask failed. RunId=\\&quot; &amp; InRunId &amp; \\&quot; | FullName=\\&quot; &amp; InFullNam",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "HandleHumanReview.xaml",
      "severity": "execution_blocking",
      "workflow": "HandleHumanReview",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[HandleHumanReview] Task created. Waiting for reviewer. SLA=\\&quot; &amp; slaDurationHours.ToString() &amp; \\&quot; hours | R",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "HandleHumanReview.xaml",
      "severity": "execution_blocking",
      "workflow": "HandleHumanReview",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[HandleHumanReview] CATCH WaitForFormTaskAndResume failed or timed out. Assigning Reject. RunId=\\&quot; &amp; InRunId &amp; \\",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "HandleHumanReview.xaml",
      "severity": "execution_blocking",
      "workflow": "HandleHumanReview",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[HandleHumanReview] Task completed by reviewer. Extracting form data. RunId=\\&quot; &amp; InRunId &amp; \\&quot; | FullName=\\&",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "HandleHumanReview.xaml",
      "severity": "execution_blocking",
      "workflow": "HandleHumanReview",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[HandleHumanReview] Extracted reviewer decision. Mode=\\&quot; &amp; InReviewMode &amp; \\&quot; | Decision=\\&quot; &amp; appro",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "HandleHumanReview.xaml",
      "severity": "execution_blocking",
      "workflow": "HandleHumanReview",
      "defectType": "leaked_json_expression",
      "activityType": "Assign",
      "propertyName": "Value",
      "offendingValue": "[{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[BGV26] Content Review Required - \\&quot; &amp; InFullName &amp; \\&quot; (RunId: \\&quot; &amp; InRunId &amp; \\&quot;)\\&quot;",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "HandleHumanReview.xaml",
      "severity": "execution_blocking",
      "workflow": "HandleHumanReview",
      "defectType": "leaked_json_expression",
      "activityType": "Assign",
      "propertyName": "Value",
      "offendingValue": "[{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[BGV26] Contact Disambiguation Required - \\&quot; &amp; InFullName &amp; \\&quot; (RunId: \\&quot; &amp; InRunId &amp; \\&quot;",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "Finalize.xaml",
      "severity": "execution_blocking",
      "workflow": "Finalize",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[Finalize] Starting finalization. RunId=\\&quot; &amp; InRunId &amp; \\&quot; | InRunStatus=\\&quot; &amp; InRunStatus &amp; \\&q",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "Finalize.xaml",
      "severity": "execution_blocking",
      "workflow": "Finalize",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[Finalize] Resolved finalizedRunStatus=\\&quot; &amp; finalizedRunStatus &amp; \\&quot; for RunId=\\&quot; &amp; InRunId&quot;}",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "Finalize.xaml",
      "severity": "execution_blocking",
      "workflow": "Finalize",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[Finalize] BGV26_Run query returned result for RunId=\\&quot; &amp; InRunId &amp; \\&quot;. Proceeding to extract record ID.\\&q",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "Finalize.xaml",
      "severity": "execution_blocking",
      "workflow": "Finalize",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[Finalize] BGV26_Run update outcome: dataServiceUpdateSuccess=\\&quot; &amp; dataServiceUpdateSuccess.ToString() &amp; \\&quot;",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "Finalize.xaml",
      "severity": "execution_blocking",
      "workflow": "Finalize",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[Finalize] Preparing to send daily summary email. Subject=\\&quot; &amp; summarySubject &amp; \\&quot; | To=ninemush@gmail.com ",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "Finalize.xaml",
      "severity": "execution_blocking",
      "workflow": "Finalize",
      "defectType": "placeholder",
      "activityType": "ugs:GmailSendMessage",
      "propertyName": "Body",
      "offendingValue": "PLACEHOLDER",
      "detectionMethod": "regex_pattern"
    },
    {
      "file": "Finalize.xaml",
      "severity": "execution_blocking",
      "workflow": "Finalize",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[Finalize] Summary email send outcome: summarySendSuccess=\\&quot; &amp; summarySendSuccess.ToString() &amp; \\&quot; | RunId=\\",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "Finalize.xaml",
      "severity": "execution_blocking",
      "workflow": "Finalize",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[Finalize][WARN] BGV26_Run record was NOT updated for RunId=\\&quot; &amp; InRunId &amp; \\&quot;. Data Service update failed. ",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "Finalize.xaml",
      "severity": "execution_blocking",
      "workflow": "Finalize",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[Finalize][WARN] Daily summary email was NOT sent for RunId=\\&quot; &amp; InRunId &amp; \\&quot;. Gmail send failed. Check err",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "Finalize.xaml",
      "severity": "execution_blocking",
      "workflow": "Finalize",
      "defectType": "leaked_json_expression",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[Finalize] Finalization complete. RunId=\\&quot; &amp; InRunId &amp; \\&quot; | FinalStatus=\\&quot; &amp; finalizedRunStatus &a",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "Finalize.xaml",
      "severity": "execution_blocking",
      "workflow": "Finalize",
      "defectType": "leaked_json_expression",
      "activityType": "Assign",
      "propertyName": "Value",
      "offendingValue": "[{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;[BGV26] Daily Birthday Greetings Run Summary – \\&quot; &amp; DateTime.UtcNow.ToString(\\&quot;yyyy-MM-dd\\&quot;) &amp; \\&quot",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "Finalize.xaml",
      "severity": "execution_blocking",
      "workflow": "Finalize",
      "defectType": "leaked_json_expression",
      "activityType": "Assign",
      "propertyName": "Value",
      "offendingValue": "[{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;BGV26 Daily Run Summary\\&quot; &amp; Environment.NewLine &amp; \\&quot;========================\\&quot; &amp; Environment.NewL",
      "detectionMethod": "json_structure_analysis"
    },
    {
      "file": "GetBirthdays",
      "severity": "execution_blocking",
      "workflow": "GetBirthdays",
      "defectType": "placeholder",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "[&quot;STUB: GetBirthdays — this workflow was auto-generated as a placeholder because it is referenced by InvokeWorkflowFile but was not part of the original process map. Implement the actual logic he",
      "detectionMethod": "regex_pattern"
    },
    {
      "file": "ProcessBirthday",
      "severity": "execution_blocking",
      "workflow": "ProcessBirthday",
      "defectType": "placeholder",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "[&quot;STUB: ProcessBirthday — this workflow was auto-generated as a placeholder because it is referenced by InvokeWorkflowFile but was not part of the original process map. Implement the actual logic",
      "detectionMethod": "regex_pattern"
    },
    {
      "file": "HandleHumanReview",
      "severity": "execution_blocking",
      "workflow": "HandleHumanReview",
      "defectType": "placeholder",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "[&quot;STUB: HandleHumanReview — this workflow was auto-generated as a placeholder because it is referenced by InvokeWorkflowFile but was not part of the original process map. Implement the actual log",
      "detectionMethod": "regex_pattern"
    }
  ],
  "contractIntegrityDefects": [
    {
      "file": "Main.xaml",
      "notes": "Binding \"Arguments\" does not match any declared argument in \"GetBirthdays\"",
      "severity": "execution_blocking",
      "workflow": "Main",
      "defectType": "unknown_target_argument",
      "activityType": "InvokeWorkflowFile",
      "propertyName": "Arguments",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;New Dictionary(Of String, Object) From {{\\&quot;in_CalendarName\\&quot;, birthdaysCalendarName}, {\\&quot;in_TimeZone\\&quot;, timeZone",
      "targetArgument": "Arguments",
      "targetWorkflow": "GetBirthdays",
      "detectionMethod": "contract_comparison",
      "referencedSymbol": "Arguments"
    },
    {
      "file": "Main.xaml",
      "notes": "Binding \"Out_BirthdayWorkItems\" does not match any declared argument in \"GetBirthdays\"",
      "severity": "execution_blocking",
      "workflow": "Main",
      "defectType": "unknown_target_argument",
      "activityType": "InvokeWorkflowFile",
      "propertyName": "Out_BirthdayWorkItems",
      "offendingValue": "{&quot;type&quot;:&quot;variable&quot;,&quot;name&quot;:&quot;birthdayWorkItems&quot;}",
      "targetArgument": "Out_BirthdayWorkItems",
      "targetWorkflow": "GetBirthdays",
      "detectionMethod": "contract_comparison",
      "referencedSymbol": "Out_BirthdayWorkItems"
    },
    {
      "file": "Main.xaml",
      "notes": "Binding \"Arguments\" does not match any declared argument in \"ProcessBirthday\"",
      "severity": "execution_blocking",
      "workflow": "Main",
      "defectType": "unknown_target_argument",
      "activityType": "InvokeWorkflowFile",
      "propertyName": "Arguments",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;New Dictionary(Of String, Object) From {{\\&quot;in_FullNameRaw\\&quot;, currentBirthdayRow(\\&quot;FullNameRaw\\&quot;).ToString()}, {\\",
      "targetArgument": "Arguments",
      "targetWorkflow": "ProcessBirthday",
      "detectionMethod": "contract_comparison",
      "referencedSymbol": "Arguments"
    },
    {
      "file": "Main.xaml",
      "notes": "Binding \"Out_WasSent\" does not match any declared argument in \"ProcessBirthday\"",
      "severity": "execution_blocking",
      "workflow": "Main",
      "defectType": "unknown_target_argument",
      "activityType": "InvokeWorkflowFile",
      "propertyName": "Out_WasSent",
      "offendingValue": "{&quot;type&quot;:&quot;variable&quot;,&quot;name&quot;:&quot;processBirthdayOutcomeSent&quot;}",
      "targetArgument": "Out_WasSent",
      "targetWorkflow": "ProcessBirthday",
      "detectionMethod": "contract_comparison",
      "referencedSymbol": "Out_WasSent"
    },
    {
      "file": "Main.xaml",
      "notes": "Binding \"Out_WasSkipped\" does not match any declared argument in \"ProcessBirthday\"",
      "severity": "execution_blocking",
      "workflow": "Main",
      "defectType": "unknown_target_argument",
      "activityType": "InvokeWorkflowFile",
      "propertyName": "Out_WasSkipped",
      "offendingValue": "{&quot;type&quot;:&quot;variable&quot;,&quot;name&quot;:&quot;processBirthdayOutcomeSkipped&quot;}",
      "targetArgument": "Out_WasSkipped",
      "targetWorkflow": "ProcessBirthday",
      "detectionMethod": "contract_comparison",
      "referencedSymbol": "Out_WasSkipped"
    },
    {
      "file": "ProcessBirthday.xaml",
      "notes": "Binding \"Arguments\" does not match any declared argument in \"HandleHumanReview\"",
      "severity": "execution_blocking",
      "workflow": "ProcessBirthday",
      "defectType": "unknown_target_argument",
      "activityType": "InvokeWorkflowFile",
      "propertyName": "Arguments",
      "offendingValue": "{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;New Dictionary(Of String, Object) From {{\\&quot;InRunId\\&quot;, InRunId}, {\\&quot;InFullNameNormalized\\&quot;, InFullNameNormalized}",
      "targetArgument": "Arguments",
      "targetWorkflow": "HandleHumanReview",
      "detectionMethod": "contract_comparison",
      "referencedSymbol": "Arguments"
    },
    {
      "file": "Main.xaml",
      "notes": "Variable \"literal\" is referenced but not declared in workflow \"Main\"",
      "severity": "handoff_required",
      "workflow": "Main",
      "defectType": "undeclared_variable_reference",
      "activityType": "ForEach",
      "propertyName": "TypeArguments",
      "offendingValue": "{&amp;quot;type&amp;quot;:&amp;quot;literal&amp;quot;,&amp;quot;value&amp;quot;:&amp;quot;System.Data.DataRow&amp;quot;}",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "literal"
    },
    {
      "file": "Main.xaml",
      "notes": "Variable \"value\" is referenced but not declared in workflow \"Main\"",
      "severity": "handoff_required",
      "workflow": "Main",
      "defectType": "undeclared_variable_reference",
      "activityType": "ForEach",
      "propertyName": "TypeArguments",
      "offendingValue": "{&amp;quot;type&amp;quot;:&amp;quot;literal&amp;quot;,&amp;quot;value&amp;quot;:&amp;quot;System.Data.DataRow&amp;quot;}",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "value"
    },
    {
      "file": "Main.xaml",
      "notes": "Variable \"literal\" is referenced but not declared in workflow \"Main\"",
      "severity": "handoff_required",
      "workflow": "Main",
      "defectType": "undeclared_variable_reference",
      "activityType": "ActivityAction",
      "propertyName": "TypeArguments",
      "offendingValue": "{&amp;quot;type&amp;quot;:&amp;quot;literal&amp;quot;,&amp;quot;value&amp;quot;:&amp;quot;System.Data.DataRow&amp;quot;}",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "literal"
    },
    {
      "file": "Main.xaml",
      "notes": "Variable \"value\" is referenced but not declared in workflow \"Main\"",
      "severity": "handoff_required",
      "workflow": "Main",
      "defectType": "undeclared_variable_reference",
      "activityType": "ActivityAction",
      "propertyName": "TypeArguments",
      "offendingValue": "{&amp;quot;type&amp;quot;:&amp;quot;literal&amp;quot;,&amp;quot;value&amp;quot;:&amp;quot;System.Data.DataRow&amp;quot;}",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "value"
    },
    {
      "file": "Main.xaml",
      "notes": "Variable \"literal\" is referenced but not declared in workflow \"Main\"",
      "severity": "handoff_required",
      "workflow": "Main",
      "defectType": "undeclared_variable_reference",
      "activityType": "DelegateInArgument",
      "propertyName": "TypeArguments",
      "offendingValue": "{&amp;quot;type&amp;quot;:&amp;quot;literal&amp;quot;,&amp;quot;value&amp;quot;:&amp;quot;System.Data.DataRow&amp;quot;}",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "literal"
    },
    {
      "file": "Main.xaml",
      "notes": "Variable \"value\" is referenced but not declared in workflow \"Main\"",
      "severity": "handoff_required",
      "workflow": "Main",
      "defectType": "undeclared_variable_reference",
      "activityType": "DelegateInArgument",
      "propertyName": "TypeArguments",
      "offendingValue": "{&amp;quot;type&amp;quot;:&amp;quot;literal&amp;quot;,&amp;quot;value&amp;quot;:&amp;quot;System.Data.DataRow&amp;quot;}",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "value"
    },
    {
      "file": "Main.xaml",
      "notes": "Variable \"wordCountMinStr\" is referenced but not declared in workflow \"Main\"",
      "severity": "handoff_required",
      "workflow": "Main",
      "defectType": "undeclared_variable_reference",
      "activityType": "Unknown",
      "propertyName": "Value",
      "offendingValue": "[If(Integer.TryParse(wordCountMinStr, emailWordCountMin), emailWordCountMin, 40)]",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "wordCountMinStr"
    },
    {
      "file": "Main.xaml",
      "notes": "Variable \"emailWordCountMin\" is referenced but not declared in workflow \"Main\"",
      "severity": "handoff_required",
      "workflow": "Main",
      "defectType": "undeclared_variable_reference",
      "activityType": "Unknown",
      "propertyName": "Value",
      "offendingValue": "[If(Integer.TryParse(wordCountMinStr, emailWordCountMin), emailWordCountMin, 40)]",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "emailWordCountMin"
    },
    {
      "file": "Main.xaml",
      "notes": "Variable \"wordCountMaxStr\" is referenced but not declared in workflow \"Main\"",
      "severity": "handoff_required",
      "workflow": "Main",
      "defectType": "undeclared_variable_reference",
      "activityType": "Unknown",
      "propertyName": "Value",
      "offendingValue": "[If(Integer.TryParse(wordCountMaxStr, emailWordCountMax), emailWordCountMax, 90)]",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "wordCountMaxStr"
    },
    {
      "file": "Main.xaml",
      "notes": "Variable \"emailWordCountMax\" is referenced but not declared in workflow \"Main\"",
      "severity": "handoff_required",
      "workflow": "Main",
      "defectType": "undeclared_variable_reference",
      "activityType": "Unknown",
      "propertyName": "Value",
      "offendingValue": "[If(Integer.TryParse(wordCountMaxStr, emailWordCountMax), emailWordCountMax, 90)]",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "emailWordCountMax"
    },
    {
      "file": "Main.xaml",
      "notes": "Variable \"birthdayWorkItems\" is referenced but not declared in workflow \"Main\"",
      "severity": "handoff_required",
      "workflow": "Main",
      "defectType": "undeclared_variable_reference",
      "activityType": "Unknown",
      "propertyName": "Value",
      "offendingValue": "[If(birthdayWorkItems Is Nothing, 0, birthdayWorkItems.Rows.Count)]",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "birthdayWorkItems"
    },
    {
      "file": "Main.xaml",
      "notes": "Variable \"sentCount\" is referenced but not declared in workflow \"Main\"",
      "severity": "handoff_required",
      "workflow": "Main",
      "defectType": "undeclared_variable_reference",
      "activityType": "Unknown",
      "propertyName": "Value",
      "offendingValue": "[sentCount + 1]",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "sentCount"
    },
    {
      "file": "ProcessBirthday.xaml",
      "notes": "Variable \"personalEmail\" is referenced but not declared in workflow \"ProcessBirthday\"",
      "severity": "handoff_required",
      "workflow": "ProcessBirthday",
      "defectType": "undeclared_variable_reference",
      "activityType": "If",
      "propertyName": "Condition",
      "offendingValue": "[Not String.IsNullOrWhiteSpace(personalEmail)]",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "personalEmail"
    },
    {
      "file": "ProcessBirthday.xaml",
      "notes": "Variable \"homeEmail\" is referenced but not declared in workflow \"ProcessBirthday\"",
      "severity": "handoff_required",
      "workflow": "ProcessBirthday",
      "defectType": "undeclared_variable_reference",
      "activityType": "If",
      "propertyName": "Condition",
      "offendingValue": "[Not String.IsNullOrWhiteSpace(homeEmail)]",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "homeEmail"
    },
    {
      "file": "ProcessBirthday.xaml",
      "notes": "Variable \"contactsResults\" is referenced but not declared in workflow \"ProcessBirthday\"",
      "severity": "handoff_required",
      "workflow": "ProcessBirthday",
      "defectType": "undeclared_variable_reference",
      "activityType": "Unknown",
      "propertyName": "Value",
      "offendingValue": "[If(contactsResults IsNot Nothing, contactsResults.Rows.Count, 0)]",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "contactsResults"
    },
    {
      "file": "ProcessBirthday.xaml",
      "notes": "Variable \"contactsResults\" is referenced but not declared in workflow \"ProcessBirthday\"",
      "severity": "handoff_required",
      "workflow": "ProcessBirthday",
      "defectType": "undeclared_variable_reference",
      "activityType": "Unknown",
      "propertyName": "Value",
      "offendingValue": "[contactsResults.Rows(0)]",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "contactsResults"
    },
    {
      "file": "ComposeDraft.xaml",
      "notes": "Variable \"parsedSubject\" is referenced but not declared in workflow \"ComposeDraft\"",
      "severity": "handoff_required",
      "workflow": "ComposeDraft",
      "defectType": "undeclared_variable_reference",
      "activityType": "Unknown",
      "propertyName": "Value",
      "offendingValue": "[Not String.IsNullOrWhiteSpace(parsedSubject) AndAlso Not String.IsNullOrWhiteSpace(parsedBody)]",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "parsedSubject"
    },
    {
      "file": "ComposeDraft.xaml",
      "notes": "Variable \"parsedBody\" is referenced but not declared in workflow \"ComposeDraft\"",
      "severity": "handoff_required",
      "workflow": "ComposeDraft",
      "defectType": "undeclared_variable_reference",
      "activityType": "Unknown",
      "propertyName": "Value",
      "offendingValue": "[Not String.IsNullOrWhiteSpace(parsedSubject) AndAlso Not String.IsNullOrWhiteSpace(parsedBody)]",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "parsedBody"
    },
    {
      "file": "ComposeDraft.xaml",
      "notes": "Variable \"validationErrors\" is referenced but not declared in workflow \"ComposeDraft\"",
      "severity": "handoff_required",
      "workflow": "ComposeDraft",
      "defectType": "undeclared_variable_reference",
      "activityType": "Unknown",
      "propertyName": "Value",
      "offendingValue": "[String.IsNullOrEmpty(validationErrors)]",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "validationErrors"
    },
    {
      "file": "Finalize.xaml",
      "notes": "Variable \"queriedRunRecords\" is referenced but not declared in workflow \"Finalize\"",
      "severity": "handoff_required",
      "workflow": "Finalize",
      "defectType": "undeclared_variable_reference",
      "activityType": "Unknown",
      "propertyName": "Value",
      "offendingValue": "[queriedRunRecords]",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "scope_analysis",
      "referencedSymbol": "queriedRunRecords"
    },
    {
      "file": "Finalize.xaml",
      "notes": "Property \"Body\" contains sentinel \"PLACEHOLDER\" — not executable",
      "severity": "execution_blocking",
      "workflow": "Finalize",
      "defectType": "placeholder_sentinel_in_property",
      "activityType": "ugs:GmailSendMessage",
      "propertyName": "Body",
      "offendingValue": "PLACEHOLDER",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "sentinel_scan",
      "referencedSymbol": "PLACEHOLDER"
    },
    {
      "file": "GetBirthdays",
      "notes": "Property \"Message\" contains sentinel \"placeholder\" — not executable",
      "severity": "execution_blocking",
      "workflow": "GetBirthdays",
      "defectType": "placeholder_sentinel_in_property",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "[&quot;STUB: GetBirthdays — this workflow was auto-generated as a placeholder because it is referenced by InvokeWorkflowFile but was not part of the original process map. Implement the actual logic he",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "sentinel_scan",
      "referencedSymbol": "placeholder"
    },
    {
      "file": "ProcessBirthday",
      "notes": "Property \"Message\" contains sentinel \"placeholder\" — not executable",
      "severity": "execution_blocking",
      "workflow": "ProcessBirthday",
      "defectType": "placeholder_sentinel_in_property",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "[&quot;STUB: ProcessBirthday — this workflow was auto-generated as a placeholder because it is referenced by InvokeWorkflowFile but was not part of the original process map. Implement the actual logic",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "sentinel_scan",
      "referencedSymbol": "placeholder"
    },
    {
      "file": "HandleHumanReview",
      "notes": "Property \"Message\" contains sentinel \"placeholder\" — not executable",
      "severity": "execution_blocking",
      "workflow": "HandleHumanReview",
      "defectType": "placeholder_sentinel_in_property",
      "activityType": "ui:LogMessage",
      "propertyName": "Message",
      "offendingValue": "[&quot;STUB: HandleHumanReview — this workflow was auto-generated as a placeholder because it is referenced by InvokeWorkflowFile but was not part of the original process map. Implement the actual log",
      "targetArgument": "",
      "targetWorkflow": "",
      "detectionMethod": "sentinel_scan",
      "referencedSymbol": "placeholder"
    }
  ],
  "contractIntegritySummary": "Contract integrity: 10 execution-blocking, 20 handoff-required, 6 non-contract field(s) excluded defect(s) found",
  "hasContractIntegrityIssues": true,
  "contractExtractionExclusions": [
    {
      "file": "Main.xaml",
      "workflow": "Main",
      "activityType": "InvokeWorkflowFile",
      "propertyName": "sap2010:WorkflowViewState.IdRef",
      "exclusionReason": "WF designer view-state property",
      "exclusionCategory": "view_state"
    },
    {
      "file": "Main.xaml",
      "workflow": "Main",
      "activityType": "InvokeWorkflowFile",
      "propertyName": "sap:VirtualizedContainerService.HintSize",
      "exclusionReason": "Designer virtualization layout hint",
      "exclusionCategory": "layout_hint"
    },
    {
      "file": "Main.xaml",
      "workflow": "Main",
      "activityType": "InvokeWorkflowFile",
      "propertyName": "sap2010:WorkflowViewState.IdRef",
      "exclusionReason": "WF designer view-state property",
      "exclusionCategory": "view_state"
    },
    {
      "file": "Main.xaml",
      "workflow": "Main",
      "activityType": "InvokeWorkflowFile",
      "propertyName": "sap:VirtualizedContainerService.HintSize",
      "exclusionReason": "Designer virtualization layout hint",
      "exclusionCategory": "layout_hint"
    },
    {
      "file": "ProcessBirthday.xaml",
      "workflow": "ProcessBirthday",
      "activityType": "InvokeWorkflowFile",
      "propertyName": "sap2010:WorkflowViewState.IdRef",
      "exclusionReason": "WF designer view-state property",
      "exclusionCategory": "view_state"
    },
    {
      "file": "ProcessBirthday.xaml",
      "workflow": "ProcessBirthday",
      "activityType": "InvokeWorkflowFile",
      "propertyName": "sap:VirtualizedContainerService.HintSize",
      "exclusionReason": "Designer virtualization layout hint",
      "exclusionCategory": "layout_hint"
    }
  ],
  "contractNormalizationActions": [],
  "hasExecutablePathContamination": true,
  "contractIntegritySummaryMetrics": {
    "exclusionsByCategory": {
      "annotation": 0,
      "view_state": 3,
      "layout_hint": 3,
      "idref_reference": 0,
      "designer_metadata": 0,
      "non_runtime_serialization": 0
    },
    "totalContractDefects": 30,
    "totalHandoffRequired": 20,
    "totalExecutionBlocking": 10,
    "totalUndeclaredSymbols": 20,
    "totalNormalizationActions": 0,
    "totalUnknownTargetArguments": 6,
    "totalExcludedNonContractFields": 6,
    "totalInvalidInvokeSerialization": 0
  },
  "hasWorkflowGraphIntegrityIssues": true
}
  ```
  