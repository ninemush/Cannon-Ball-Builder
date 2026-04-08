import { escapeXml } from "../lib/xml-utils";
import { randomBytes } from "crypto";

export function _uuid(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function _escapeXmlAttr(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = typeof val === "string" ? val : String(val);
  return escapeXml(s);
}

export function _hs(width: number = 250, height: number = 100): string {
  return `${width},${height}`;
}

export function _selectorXml(selector?: string): string {
  if (!selector) return "";
  return ` Selector="${_escapeXmlAttr(selector)}"`;
}

export function _viewstateBlock(idRef: string, width: number = 250, height: number = 100): string {
  return `<sap2010:WorkflowViewState.IdRef>${_escapeXmlAttr(idRef)}</sap2010:WorkflowViewState.IdRef>`;
}

export interface GeneratorArgs {
  displayName: string;
  [key: string]: string | number | boolean | Record<string, unknown> | undefined;
}

export type GeneratorFn = (args: GeneratorArgs, children?: string) => string;

function _prop(args: GeneratorArgs, ...keys: string[]): string {
  for (const k of keys) {
    const v = args[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return "";
}

function _propOr(args: GeneratorArgs, fallback: string, ...keys: string[]): string {
  const v = _prop(args, ...keys);
  return v || fallback;
}

function _boolProp(args: GeneratorArgs, ...keys: string[]): boolean {
  for (const k of keys) {
    if (args[k] === true || args[k] === "True" || args[k] === "true") return true;
  }
  return false;
}

export function gen_nclick(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Click");
  const selector = _prop(args, "selector", "Selector");
  const clickType = _propOr(args, "CLICK_SINGLE", "clickType", "ClickType");
  const mouseButton = _propOr(args, "BTN_LEFT", "mouseButton", "MouseButton");
  const timeoutMs = _propOr(args, "30000", "timeoutMs", "TimeoutMs", "TimeoutMS");
  const delayAfter = _propOr(args, "300", "delayAfter", "DelayAfter");
  const delayBefore = _propOr(args, "200", "delayBefore", "DelayBefore");
  const continueOnError = _boolProp(args, "continueOnError", "ContinueOnError") ? "True" : "False";

  let targetBlock = "";
  if (selector) {
    targetBlock = `
      <ui:NClick.Target>
        <ui:Target Selector="${_escapeXmlAttr(selector)}" WaitForReady="INTERACTIVE" TimeoutMS="${timeoutMs}" />
      </ui:NClick.Target>`;
  }

  return `<ui:NClick ClickType="${clickType}" MouseButton="${mouseButton}" DelayAfter="${delayAfter}" DelayBefore="${delayBefore}" ContinueOnError="${continueOnError}" DisplayName="${dn}">${targetBlock}
    </ui:NClick>`;
}

export function gen_ntype_into(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Type Into");
  const text = _prop(args, "text", "Text");
  const selector = _prop(args, "selector", "Selector");
  const clickBeforeTyping = _boolProp(args, "clickBeforeTyping", "ClickBeforeTyping") ? "True" : "False";
  const emptyField = _boolProp(args, "emptyField", "EmptyField") ? "True" : "False";
  const timeoutMs = _propOr(args, "30000", "timeoutMs", "TimeoutMs", "TimeoutMS");
  const delayAfter = _propOr(args, "300", "delayAfter", "DelayAfter");
  const delayBefore = _propOr(args, "200", "delayBefore", "DelayBefore");
  const continueOnError = _boolProp(args, "continueOnError", "ContinueOnError") ? "True" : "False";

  let targetBlock = "";
  if (selector) {
    targetBlock = `
      <ui:NTypeInto.Target>
        <ui:Target Selector="${_escapeXmlAttr(selector)}" WaitForReady="INTERACTIVE" TimeoutMS="${timeoutMs}" />
      </ui:NTypeInto.Target>`;
  }

  return `<ui:NTypeInto Text="${_escapeXmlAttr(text)}" ClickBeforeTyping="${clickBeforeTyping}" EmptyField="${emptyField}" DelayAfter="${delayAfter}" DelayBefore="${delayBefore}" ContinueOnError="${continueOnError}" DisplayName="${dn}">${targetBlock}
    </ui:NTypeInto>`;
}

export function gen_nget_text(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Get Text");
  const selector = _prop(args, "selector", "Selector");
  const outputVar = _propOr(args, "str_ExtractedText", "outputVar", "Value", "value");
  const timeoutMs = _propOr(args, "30000", "timeoutMs", "TimeoutMs", "TimeoutMS");
  const continueOnError = _boolProp(args, "continueOnError", "ContinueOnError") ? "True" : "False";

  let targetBlock = "";
  if (selector) {
    targetBlock = `
      <ui:NGetText.Target>
        <ui:Target Selector="${_escapeXmlAttr(selector)}" WaitForReady="INTERACTIVE" TimeoutMS="${timeoutMs}" />
      </ui:NGetText.Target>`;
  }

  return `<ui:NGetText ContinueOnError="${continueOnError}" DisplayName="${dn}">
      <ui:NGetText.Value>
        <OutArgument x:TypeArguments="x:String">[${_escapeXmlAttr(outputVar)}]</OutArgument>
      </ui:NGetText.Value>${targetBlock}
    </ui:NGetText>`;
}

export function gen_napplication_card(args: GeneratorArgs, children?: string): string {
  const dn = _escapeXmlAttr(args.displayName || "Use Application/Browser");
  const url = args.url || args.Url || "";
  const browserType = args.browserType || args.BrowserType || "Chrome";
  const selector = args.selector || "";

  const urlAttr = url ? ` Url="${_escapeXmlAttr(url)}"` : "";
  const selectorAttr = selector ? ` Selector="${_escapeXmlAttr(selector)}"` : "";

  return `<ui:NApplicationCard BrowserType="${browserType}"${urlAttr}${selectorAttr} DisplayName="${dn}">
      <ui:NApplicationCard.Body>
        <ActivityAction x:TypeArguments="x:Object">
          <ActivityAction.Handler>
            <Sequence DisplayName="${dn} Body">
              ${children || ""}
            </Sequence>
          </ActivityAction.Handler>
        </ActivityAction>
      </ui:NApplicationCard.Body>
    </ui:NApplicationCard>`;
}

export function gen_nselect_item(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Select Item");
  const item = _prop(args, "item", "Item");
  const selector = _prop(args, "selector", "Selector");
  const timeoutMs = _propOr(args, "30000", "timeoutMs", "TimeoutMs", "TimeoutMS");

  let targetBlock = "";
  if (selector) {
    targetBlock = `
      <ui:NSelectItem.Target>
        <ui:Target Selector="${_escapeXmlAttr(selector)}" WaitForReady="INTERACTIVE" TimeoutMS="${timeoutMs}" />
      </ui:NSelectItem.Target>`;
  }

  return `<ui:NSelectItem Item="${_escapeXmlAttr(item)}" DisplayName="${dn}">${targetBlock}
    </ui:NSelectItem>`;
}

export function gen_ncheck_state(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Check State");
  const selector = _prop(args, "selector", "Selector");
  const outputVar = _propOr(args, "bool_CheckResult", "outputVar", "Result", "result");
  const timeoutMs = _propOr(args, "30000", "timeoutMs", "TimeoutMs", "TimeoutMS");

  let targetBlock = "";
  if (selector) {
    targetBlock = `
      <ui:NCheckState.Target>
        <ui:Target Selector="${_escapeXmlAttr(selector)}" WaitForReady="INTERACTIVE" TimeoutMS="${timeoutMs}" />
      </ui:NCheckState.Target>`;
  }

  return `<ui:NCheckState DisplayName="${dn}">
      <ui:NCheckState.Result>
        <OutArgument x:TypeArguments="x:Boolean">[${_escapeXmlAttr(outputVar)}]</OutArgument>
      </ui:NCheckState.Result>${targetBlock}
    </ui:NCheckState>`;
}

export function gen_log_message(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Log Message");
  const level = args.level || args.Level || "Info";
  const message = args.message || args.Message || "";

  return `<ui:LogMessage Level="${_escapeXmlAttr(level)}" Message="${_escapeXmlAttr(message)}" DisplayName="${dn}" />`;
}

export function gen_comment(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Comment");
  const text = args.text || args.Text || "";

  return `<ui:Comment Text="${_escapeXmlAttr(text)}" DisplayName="${dn}" />`;
}

export function gen_assign(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Assign");
  const toVariable = args.toVariable || args.To || "";
  const toType = args.toType || args.valueType || "x:Object";
  const valueExpression = args.valueExpression || args.Value || "";

  return `<Assign DisplayName="${dn}">
      <Assign.To>
        <OutArgument x:TypeArguments="${_escapeXmlAttr(toType)}">[${_escapeXmlAttr(toVariable)}]</OutArgument>
      </Assign.To>
      <Assign.Value>
        <InArgument x:TypeArguments="${_escapeXmlAttr(toType)}">${_escapeXmlAttr(valueExpression)}</InArgument>
      </Assign.Value>
    </Assign>`;
}

export function gen_delay(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Delay");
  const duration = args.duration || args.Duration || "00:00:05";

  return `<Delay Duration="${_escapeXmlAttr(duration)}" DisplayName="${dn}" />`;
}

export function gen_invoke_workflow_file(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Invoke Workflow");
  const fileName = args.workflowFileName || args.WorkflowFileName || "";
  const wfArguments = args.arguments || args.Arguments;

  let argsBlock = "";
  if (wfArguments && typeof wfArguments === "object") {
    const argEntries = Object.entries(wfArguments);
    if (argEntries.length > 0) {
      const argLines = argEntries.map(([key, val]: [string, Record<string, unknown>]) => {
        const dir = String(val.direction || "InArgument");
        const type = String(val.type || "x:String");
        const value = String(val.value || "");
        return `        <${dir} x:TypeArguments="${type}" x:Key="${_escapeXmlAttr(key)}">${_escapeXmlAttr(value)}</${dir}>`;
      });
      argsBlock = `
      <ui:InvokeWorkflowFile.Arguments>
${argLines.join("\n")}
      </ui:InvokeWorkflowFile.Arguments>`;
    }
  }

  if (argsBlock) {
    return `<ui:InvokeWorkflowFile WorkflowFileName="${_escapeXmlAttr(fileName)}" DisplayName="${dn}">${argsBlock}
    </ui:InvokeWorkflowFile>`;
  }
  return `<ui:InvokeWorkflowFile WorkflowFileName="${_escapeXmlAttr(fileName)}" DisplayName="${dn}" />`;
}

export function gen_take_screenshot(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Take Screenshot");
  return `<ui:TakeScreenshot DisplayName="${dn}" />`;
}

export function gen_get_credential(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Get Credential");
  const assetName = _prop(args, "assetName", "AssetName");
  const username = _prop(args, "username", "Username", "outputVar");
  const password = _prop(args, "password", "Password");

  if (!username) {
    console.warn(`[Deterministic Generator] gen_get_credential "${dn}": no Username output variable specified`);
  }
  if (!password) {
    console.warn(`[Deterministic Generator] gen_get_credential "${dn}": no Password output variable specified`);
  }

  const usernameVar = username || "str_Username";
  const passwordVar = password || "sec_Password";

  return `<ui:GetCredential AssetName="${_escapeXmlAttr(assetName)}" DisplayName="${dn}">
      <ui:GetCredential.Username>
        <OutArgument x:TypeArguments="x:String">[${_escapeXmlAttr(usernameVar)}]</OutArgument>
      </ui:GetCredential.Username>
      <ui:GetCredential.Password>
        <OutArgument x:TypeArguments="ss:SecureString">[${_escapeXmlAttr(passwordVar)}]</OutArgument>
      </ui:GetCredential.Password>
    </ui:GetCredential>`;
}

export function gen_get_asset(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Get Asset");
  const assetName = _prop(args, "assetName", "AssetName");
  const outputVar = _propOr(args, "str_AssetValue", "outputVar", "Value", "value");

  return `<ui:GetAsset AssetName="${_escapeXmlAttr(assetName)}" DisplayName="${dn}">
      <ui:GetAsset.AssetValue>
        <OutArgument x:TypeArguments="x:String">[${_escapeXmlAttr(outputVar)}]</OutArgument>
      </ui:GetAsset.AssetValue>
    </ui:GetAsset>`;
}

export function gen_add_queue_item(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Add Queue Item");
  const queueName = args.queueName || args.QueueName || "";
  const reference = args.reference || args.Reference || "";
  const priority = args.priority || args.Priority || "Normal";

  let refAttr = "";
  if (reference) {
    refAttr = ` Reference="${_escapeXmlAttr(reference)}"`;
  }

  return `<ui:AddQueueItem QueueName="${_escapeXmlAttr(queueName)}" Priority="${_escapeXmlAttr(priority)}"${refAttr} DisplayName="${dn}" />`;
}

export function gen_get_transaction_item(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Get Transaction Item");
  const queueName = args.queueName || args.QueueName || "";
  const outputVar = args.outputVar || args.TransactionItem || "qi_TransactionItem";

  return `<ui:GetTransactionItem QueueName="${_escapeXmlAttr(queueName)}" DisplayName="${dn}">
      <ui:GetTransactionItem.TransactionItem>
        <OutArgument x:TypeArguments="ui:QueueItem">[${_escapeXmlAttr(outputVar)}]</OutArgument>
      </ui:GetTransactionItem.TransactionItem>
    </ui:GetTransactionItem>`;
}

export function gen_set_transaction_status(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Set Transaction Status");
  const transactionItem = args.transactionItem || args.TransactionItem || "qi_TransactionItem";
  const status = args.status || args.Status || "Successful";
  const errorType = args.errorType || args.ErrorType || "";
  const reason = args.reason || args.Reason || "";

  let errorAttrs = "";
  if (errorType) errorAttrs += ` ErrorType="${_escapeXmlAttr(errorType)}"`;
  if (reason) errorAttrs += ` Reason="${_escapeXmlAttr(reason)}"`;

  return `<ui:SetTransactionStatus TransactionItem="[${_escapeXmlAttr(transactionItem)}]" Status="${_escapeXmlAttr(status)}"${errorAttrs} DisplayName="${dn}" />`;
}

export function gen_read_text_file(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Read Text File");
  const fileName = args.fileName || args.FileName || "";
  const outputVar = args.outputVar || args.Content || "str_FileContent";

  return `<ui:ReadTextFile FileName="${_escapeXmlAttr(fileName)}" DisplayName="${dn}">
      <ui:ReadTextFile.Content>
        <OutArgument x:TypeArguments="x:String">[${_escapeXmlAttr(outputVar)}]</OutArgument>
      </ui:ReadTextFile.Content>
    </ui:ReadTextFile>`;
}

export function gen_write_text_file(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Write Text File");
  const fileName = args.fileName || args.FileName || "";
  const text = args.text || args.Text || args.Content || "";

  return `<ui:WriteTextFile FileName="${_escapeXmlAttr(fileName)}" Text="${_escapeXmlAttr(text)}" DisplayName="${dn}" />`;
}

export function gen_path_exists(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Path Exists");
  const path = args.path || args.Path || "";
  const pathType = args.pathType || args.PathType || "File";
  const outputVar = args.outputVar || args.Result || "bool_PathExists";

  return `<ui:PathExists Path="${_escapeXmlAttr(path)}" PathType="${_escapeXmlAttr(pathType)}" DisplayName="${dn}">
      <ui:PathExists.Result>
        <OutArgument x:TypeArguments="x:Boolean">[${_escapeXmlAttr(outputVar)}]</OutArgument>
      </ui:PathExists.Result>
    </ui:PathExists>`;
}

export function gen_http_client(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "HTTP Request");
  const endpoint = args.endpoint || args.EndPoint || args.Endpoint || args.Url || "";
  const method = args.method || args.Method || "GET";
  const acceptFormat = args.acceptFormat || args.AcceptFormat || "JSON";
  const body = args.body || args.Body || "";
  const bodyFormat = args.bodyFormat || args.BodyFormat || "application/json";
  const outputVar = args.outputVar || args.ResponseContent || "str_ResponseContent";
  const statusVar = args.statusVar || args.ResponseStatus || "";

  let bodyAttr = "";
  if (body && method !== "GET") {
    bodyAttr = ` Body="${_escapeXmlAttr(body)}" BodyFormat="${_escapeXmlAttr(bodyFormat)}"`;
  }

  let statusBlock = "";
  if (statusVar) {
    statusBlock = `
      <ui:HttpClient.ResponseStatus>
        <OutArgument x:TypeArguments="x:Int32">[${_escapeXmlAttr(statusVar)}]</OutArgument>
      </ui:HttpClient.ResponseStatus>`;
  }

  return `<ui:HttpClient EndPoint="${_escapeXmlAttr(endpoint)}" Method="${_escapeXmlAttr(method)}" AcceptFormat="${_escapeXmlAttr(acceptFormat)}"${bodyAttr} DisplayName="${dn}">
      <ui:HttpClient.ResponseContent>
        <OutArgument x:TypeArguments="x:String">[${_escapeXmlAttr(outputVar)}]</OutArgument>
      </ui:HttpClient.ResponseContent>${statusBlock}
    </ui:HttpClient>`;
}

export function gen_deserialize_json(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Deserialize JSON");
  const jsonString = args.jsonString || args.JsonString || "";
  const outputVar = args.outputVar || args.JsonObject || "obj_JsonResult";

  return `<uweb:DeserializeJson DisplayName="${dn}">
      <uweb:DeserializeJson.JsonString>
        <InArgument x:TypeArguments="x:String">${_escapeXmlAttr(jsonString)}</InArgument>
      </uweb:DeserializeJson.JsonString>
      <uweb:DeserializeJson.JsonObject>
        <OutArgument x:TypeArguments="x:Object">[${_escapeXmlAttr(outputVar)}]</OutArgument>
      </uweb:DeserializeJson.JsonObject>
    </uweb:DeserializeJson>`;
}

export function gen_serialize_json(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Serialize JSON");
  const jsonObject = args.jsonObject || args.JsonObject || "";
  const outputVar = args.outputVar || args.JsonString || "str_JsonOutput";

  return `<uweb:SerializeJson DisplayName="${dn}">
      <uweb:SerializeJson.JsonObject>
        <InArgument x:TypeArguments="x:Object">[${_escapeXmlAttr(jsonObject)}]</InArgument>
      </uweb:SerializeJson.JsonObject>
      <uweb:SerializeJson.JsonString>
        <OutArgument x:TypeArguments="x:String">[${_escapeXmlAttr(outputVar)}]</OutArgument>
      </uweb:SerializeJson.JsonString>
    </uweb:SerializeJson>`;
}

export function gen_throw(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Throw");
  const exception = args.exception || args.Exception || 'New System.Exception("Error")';

  return `<Throw DisplayName="${dn}">
      <Throw.Exception>
        <InArgument x:TypeArguments="s:Exception">[${_escapeXmlAttr(exception)}]</InArgument>
      </Throw.Exception>
    </Throw>`;
}

export function gen_rethrow(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Rethrow");
  return `<Rethrow DisplayName="${dn}" />`;
}

export function gen_kill_process(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Kill Process");
  const processName = args.processName || args.ProcessName || "";

  return `<ui:KillProcess ProcessName="${_escapeXmlAttr(processName)}" DisplayName="${dn}" />`;
}

export function gen_add_log_fields(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Add Log Fields");
  return `<ui:AddLogFields DisplayName="${dn}" />`;
}

export function gen_retry_scope(args: GeneratorArgs, children?: string): string {
  const dn = _escapeXmlAttr(args.displayName || "Retry Scope");
  const numberOfRetries = args.numberOfRetries || args.NumberOfRetries || "3";
  const retryInterval = args.retryInterval || args.RetryInterval || "00:00:05";

  return `<ui:RetryScope NumberOfRetries="${numberOfRetries}" RetryInterval="${_escapeXmlAttr(retryInterval)}" DisplayName="${dn}">
      <ui:RetryScope.Condition>
        <ui:ShouldRetry />
      </ui:RetryScope.Condition>
      <Sequence DisplayName="Retry Body">
        ${children || ""}
      </Sequence>
    </ui:RetryScope>`;
}

export function gen_element_exists(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Element Exists");
  const selector = _prop(args, "selector", "Selector");
  const outputVar = _propOr(args, "bool_ElementExists", "outputVar", "Result", "result");
  const timeoutMs = _propOr(args, "3000", "timeoutMs", "TimeoutMs", "TimeoutMS");

  return `<ui:ElementExists TimeoutMS="${timeoutMs}" DisplayName="${dn}"${_selectorXml(selector)}>
      <ui:ElementExists.Result>
        <OutArgument x:TypeArguments="x:Boolean">[${_escapeXmlAttr(outputVar)}]</OutArgument>
      </ui:ElementExists.Result>
    </ui:ElementExists>`;
}

export function gen_navigate_to(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Navigate To");
  const url = args.url || args.Url || "";

  return `<ui:NavigateTo Url="${_escapeXmlAttr(url)}" DisplayName="${dn}" />`;
}

export function gen_close_application(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Close Application");
  return `<ui:CloseApplication DisplayName="${dn}" />`;
}

export function gen_excel_application_scope(args: GeneratorArgs, children?: string): string {
  const dn = _escapeXmlAttr(args.displayName || "Excel Application Scope");
  const workbookPath = args.workbookPath || args.WorkbookPath || "";

  return `<ui:ExcelApplicationScope WorkbookPath="${_escapeXmlAttr(workbookPath)}" DisplayName="${dn}">
      <ui:ExcelApplicationScope.Body>
        <ActivityAction x:TypeArguments="x:Object">
          <ActivityAction.Handler>
            <Sequence DisplayName="Excel Actions">
              ${children || ""}
            </Sequence>
          </ActivityAction.Handler>
        </ActivityAction>
      </ui:ExcelApplicationScope.Body>
    </ui:ExcelApplicationScope>`;
}

export function gen_excel_read_range(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Read Range");
  const sheetName = args.sheetName || args.SheetName || "Sheet1";
  const range = args.range || args.Range || "";
  const outputVar = args.outputVar || args.DataTable || "dt_ExcelData";

  let rangeAttr = "";
  if (range) rangeAttr = ` Range="${_escapeXmlAttr(range)}"`;

  return `<ui:ExcelReadRange SheetName="${_escapeXmlAttr(sheetName)}"${rangeAttr} DataTable="[${_escapeXmlAttr(outputVar)}]" DisplayName="${dn}" />`;
}

export function gen_excel_write_range(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Write Range");
  const sheetName = args.sheetName || args.SheetName || "Sheet1";
  const startingCell = args.startingCell || args.StartingCell || "A1";
  const dataTable = args.dataTable || args.DataTable || "dt_ExcelData";

  return `<ui:ExcelWriteRange SheetName="${_escapeXmlAttr(sheetName)}" StartingCell="${_escapeXmlAttr(startingCell)}" DataTable="[${_escapeXmlAttr(dataTable)}]" DisplayName="${dn}" />`;
}

export function gen_send_smtp_mail(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Send SMTP Mail");
  const to = args.to || args.To || "";
  const subject = args.subject || args.Subject || "";
  const body = args.body || args.Body || "";
  const isHtml = args.isBodyHtml === true || args.isBodyHtml === "True" || args.IsBodyHtml === "True" ? "True" : "False";

  return `<umail:SendSmtpMailMessage To="${_escapeXmlAttr(to)}" Subject="${_escapeXmlAttr(subject)}" Body="${_escapeXmlAttr(body)}" IsBodyHtml="${isHtml}" DisplayName="${dn}" />`;
}

export function gen_send_outlook_mail(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Send Outlook Mail");
  const to = args.to || args.To || "";
  const subject = args.subject || args.Subject || "";
  const body = args.body || args.Body || "";
  const isHtml = args.isBodyHtml === true || args.isBodyHtml === "True" || args.IsBodyHtml === "True" ? "True" : "False";

  return `<umail:SendOutlookMailMessage To="${_escapeXmlAttr(to)}" Subject="${_escapeXmlAttr(subject)}" Body="${_escapeXmlAttr(body)}" IsBodyHtml="${isHtml}" DisplayName="${dn}" />`;
}

export function gen_execute_query(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Execute Query");
  const connectionString = args.connectionString || args.ConnectionString || "";
  const providerName = args.providerName || args.ProviderName || "System.Data.SqlClient";
  const sql = args.sql || args.Sql || "";
  const outputVar = args.outputVar || args.DataTable || "dt_QueryResult";

  return `<udb:ExecuteQuery ConnectionString="${_escapeXmlAttr(connectionString)}" ProviderName="${_escapeXmlAttr(providerName)}" Sql="${_escapeXmlAttr(sql)}" DisplayName="${dn}">
      <udb:ExecuteQuery.DataTable>
        <OutArgument x:TypeArguments="scg2:DataTable">[${_escapeXmlAttr(outputVar)}]</OutArgument>
      </udb:ExecuteQuery.DataTable>
    </udb:ExecuteQuery>`;
}

export function gen_execute_non_query(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Execute Non Query");
  const connectionString = args.connectionString || args.ConnectionString || "";
  const providerName = args.providerName || args.ProviderName || "System.Data.SqlClient";
  const sql = args.sql || args.Sql || "";
  const outputVar = args.outputVar || args.AffectedRecords || "int_AffectedRecords";

  return `<udb:ExecuteNonQuery ConnectionString="${_escapeXmlAttr(connectionString)}" ProviderName="${_escapeXmlAttr(providerName)}" Sql="${_escapeXmlAttr(sql)}" DisplayName="${dn}">
      <udb:ExecuteNonQuery.AffectedRecords>
        <OutArgument x:TypeArguments="x:Int32">[${_escapeXmlAttr(outputVar)}]</OutArgument>
      </udb:ExecuteNonQuery.AffectedRecords>
    </udb:ExecuteNonQuery>`;
}

export function gen_build_data_table(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Build Data Table");
  const outputVar = args.outputVar || args.DataTable || "dt_Result";

  return `<ucs:BuildDataTable DisplayName="${dn}">
      <ucs:BuildDataTable.DataTable>
        <OutArgument x:TypeArguments="scg2:DataTable">[${_escapeXmlAttr(outputVar)}]</OutArgument>
      </ucs:BuildDataTable.DataTable>
    </ucs:BuildDataTable>`;
}

export function gen_add_data_row(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Add Data Row");
  const dataTable = args.dataTable || args.DataTable || "dt_Result";

  return `<ucs:AddDataRow DataTable="[${_escapeXmlAttr(dataTable)}]" DisplayName="${dn}" />`;
}

export function gen_filter_data_table(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Filter Data Table");
  const dataTable = args.dataTable || args.DataTable || "dt_Input";
  const outputVar = args.outputVar || args.OutputDataTable || "dt_Filtered";

  return `<ucs:FilterDataTable DataTable="[${_escapeXmlAttr(dataTable)}]" DisplayName="${dn}">
      <ucs:FilterDataTable.OutputDataTable>
        <OutArgument x:TypeArguments="scg2:DataTable">[${_escapeXmlAttr(outputVar)}]</OutArgument>
      </ucs:FilterDataTable.OutputDataTable>
    </ucs:FilterDataTable>`;
}

export function gen_output_data_table(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Output Data Table");
  const dataTable = args.dataTable || args.DataTable || "dt_Input";
  const outputVar = args.outputVar || args.Text || "str_DataTableText";

  return `<ucs:OutputDataTable DataTable="[${_escapeXmlAttr(dataTable)}]" DisplayName="${dn}">
      <ucs:OutputDataTable.Text>
        <OutArgument x:TypeArguments="x:String">[${_escapeXmlAttr(outputVar)}]</OutArgument>
      </ucs:OutputDataTable.Text>
    </ucs:OutputDataTable>`;
}

export function gen_create_form_task(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Create Form Task");
  const taskTitle = args.taskTitle || args.TaskTitle || "";
  const taskCatalog = args.taskCatalog || args.TaskCatalog || "";

  return `<upers:CreateFormTask TaskTitle="${_escapeXmlAttr(taskTitle)}" TaskCatalog="${_escapeXmlAttr(taskCatalog)}" DisplayName="${dn}" />`;
}

export function gen_read_pdf_text(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Read PDF Text");
  const fileName = args.fileName || args.FileName || "";
  const outputVar = args.outputVar || args.Text || "str_PdfText";

  return `<updf:ReadPDFText FileName="${_escapeXmlAttr(fileName)}" DisplayName="${dn}">
      <updf:ReadPDFText.Text>
        <OutArgument x:TypeArguments="x:String">[${_escapeXmlAttr(outputVar)}]</OutArgument>
      </updf:ReadPDFText.Text>
    </updf:ReadPDFText>`;
}

export function gen_use_excel(args: GeneratorArgs, children?: string): string {
  const dn = _escapeXmlAttr(args.displayName || "Use Excel File");
  const excelFile = args.excelFile || args.ExcelFile || args.WorkbookPath || "";

  return `<ui:UseExcel ExcelFile="${_escapeXmlAttr(excelFile)}" DisplayName="${dn}">
      <ui:UseExcel.Body>
        <Sequence DisplayName="${dn} Body">
          ${children || ""}
        </Sequence>
      </ui:UseExcel.Body>
    </ui:UseExcel>`;
}

export function gen_read_range(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Read Range");
  const sheetName = args.sheetName || args.SheetName || "Sheet1";
  const outputVar = args.outputVar || args.DataTable || "dt_ExcelData";

  return `<ui:ReadRange SheetName="${_escapeXmlAttr(sheetName)}" DataTable="[${_escapeXmlAttr(outputVar)}]" DisplayName="${dn}" />`;
}

export function gen_write_range(args: GeneratorArgs): string {
  const dn = _escapeXmlAttr(args.displayName || "Write Range");
  const sheetName = args.sheetName || args.SheetName || "Sheet1";
  const startingCell = args.startingCell || args.StartingCell || "A1";
  const dataTable = args.dataTable || args.DataTable || "dt_ExcelData";

  return `<ui:WriteRange SheetName="${_escapeXmlAttr(sheetName)}" StartingCell="${_escapeXmlAttr(startingCell)}" DataTable="[${_escapeXmlAttr(dataTable)}]" DisplayName="${dn}" />`;
}

export function gen_for_each(args: GeneratorArgs, children?: string): string {
  const dn = _escapeXmlAttr(args.displayName || "For Each");
  const itemType = args.itemType || "x:Object";
  const valuesExpression = args.valuesExpression || args.Values || "";
  const iteratorName = args.iteratorName || "item";

  return `<ForEach x:TypeArguments="${_escapeXmlAttr(itemType)}" DisplayName="${dn}" Values="${_escapeXmlAttr(valuesExpression)}">
      <ActivityAction x:TypeArguments="${_escapeXmlAttr(itemType)}">
        <ActivityAction.Argument>
          <DelegateInArgument x:TypeArguments="${_escapeXmlAttr(itemType)}" Name="${_escapeXmlAttr(iteratorName)}" />
        </ActivityAction.Argument>
        <Sequence DisplayName="Body">
          ${children || ""}
        </Sequence>
      </ActivityAction>
    </ForEach>`;
}

export function gen_while(args: GeneratorArgs, children?: string): string {
  const dn = _escapeXmlAttr(args.displayName || "While");
  const condition = args.condition || "True";

  return `<While Condition="${_escapeXmlAttr(condition)}" DisplayName="${dn}">
      <Sequence DisplayName="While Body">
        ${children || ""}
      </Sequence>
    </While>`;
}

export function gen_if(args: GeneratorArgs, thenChildren?: string, elseChildren?: string): string {
  const dn = _escapeXmlAttr(args.displayName || "If");
  const condition = args.condition || "[True]";

  let elseBlock = "";
  if (elseChildren) {
    elseBlock = `
      <If.Else>
        <Sequence DisplayName="Else">
          ${elseChildren}
        </Sequence>
      </If.Else>`;
  }

  return `<If Condition="${_escapeXmlAttr(condition)}" DisplayName="${dn}">
      <If.Then>
        <Sequence DisplayName="Then">
          ${thenChildren || ""}
        </Sequence>
      </If.Then>${elseBlock}
    </If>`;
}

export function gen_try_catch(args: GeneratorArgs, tryChildren?: string, catchChildren?: string, finallyChildren?: string): string {
  const dn = _escapeXmlAttr(args.displayName || "Try Catch");
  const catchVarName = args.catchVariableName || "exception";

  let catchBlock = `
      <TryCatch.Catches>
        <Catch x:TypeArguments="s:Exception">
          <ActivityAction x:TypeArguments="s:Exception">
            <ActivityAction.Argument>
              <DelegateInArgument x:TypeArguments="s:Exception" Name="${_escapeXmlAttr(catchVarName)}" />
            </ActivityAction.Argument>
            <Sequence DisplayName="Catch Handler">
              ${catchChildren || `<ui:LogMessage Level="Error" Message="[&quot;Error: &quot; &amp; ${_escapeXmlAttr(catchVarName)}.Message]" DisplayName="Log Exception" />`}
            </Sequence>
          </ActivityAction>
        </Catch>
      </TryCatch.Catches>`;

  let finallyBlock = "";
  if (finallyChildren) {
    finallyBlock = `
      <TryCatch.Finally>
        <Sequence DisplayName="Finally">
          ${finallyChildren}
        </Sequence>
      </TryCatch.Finally>`;
  }

  return `<TryCatch DisplayName="${dn}">
      <TryCatch.Try>
        <Sequence DisplayName="Try">
          ${tryChildren || ""}
        </Sequence>
      </TryCatch.Try>${catchBlock}${finallyBlock}
    </TryCatch>`;
}

export function gen_sequence(args: GeneratorArgs, children?: string): string {
  const dn = _escapeXmlAttr(args.displayName || "Sequence");

  return `<Sequence DisplayName="${dn}">
      ${children || ""}
    </Sequence>`;
}

export const NET6_NAMESPACE_DECLARATIONS = `xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:mva="clr-namespace:Microsoft.VisualBasic.Activities;assembly=System.Activities"
  xmlns:s="clr-namespace:System;assembly=System.Private.CoreLib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=System.Private.CoreLib"
  xmlns:scg2="clr-namespace:System.Data;assembly=System.Data"
  xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=System.Private.CoreLib"
  xmlns:sd="clr-namespace:System.Drawing;assembly=System.Drawing.Common"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:uix="http://schemas.uipath.com/workflow/activities/uix"
  xmlns:ucs="http://schemas.uipath.com/workflow/activities/collection"
  xmlns:udb="http://schemas.uipath.com/workflow/activities/database"
  xmlns:umail="http://schemas.uipath.com/workflow/activities/mail"
  xmlns:updf="http://schemas.uipath.com/workflow/activities/pdf"
  xmlns:upers="http://schemas.uipath.com/workflow/activities/persistence"
  xmlns:uweb="http://schemas.uipath.com/workflow/activities/web"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:ss="clr-namespace:System.Security;assembly=System.Private.CoreLib"`;

export const NET6_NAMESPACES_FOR_IMPLEMENTATION = `<TextExpression.NamespacesForImplementation>
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
      <x:String>System.ComponentModel</x:String>
    </sco:Collection>
  </TextExpression.NamespacesForImplementation>`;

export const NET6_REFERENCES_FOR_IMPLEMENTATION = `<TextExpression.ReferencesForImplementation>
    <sco:Collection x:TypeArguments="AssemblyReference">
      <AssemblyReference>System.Activities</AssemblyReference>
      <AssemblyReference>System.Activities.Core.Presentation</AssemblyReference>
      <AssemblyReference>Microsoft.VisualBasic</AssemblyReference>
      <AssemblyReference>System.Private.CoreLib</AssemblyReference>
      <AssemblyReference>System.Data</AssemblyReference>
      <AssemblyReference>System</AssemblyReference>
      <AssemblyReference>System.Core</AssemblyReference>
      <AssemblyReference>System.Xml</AssemblyReference>
      <AssemblyReference>System.Xml.Linq</AssemblyReference>
      <AssemblyReference>UiPath.Core</AssemblyReference>
      <AssemblyReference>UiPath.Core.Activities</AssemblyReference>
      <AssemblyReference>UiPath.System.Activities</AssemblyReference>
      <AssemblyReference>UiPath.UIAutomation.Activities</AssemblyReference>
      <AssemblyReference>System.ServiceModel</AssemblyReference>
      <AssemblyReference>System.ComponentModel.Composition</AssemblyReference>
    </sco:Collection>
  </TextExpression.ReferencesForImplementation>`;
