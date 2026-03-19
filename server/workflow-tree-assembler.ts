import type {
  WorkflowNode,
  WorkflowSpec,
  VariableDeclaration,
  ActivityNode,
  SequenceNode,
  TryCatchNode,
  IfNode,
  WhileNode,
  ForEachNode,
  RetryScopeNode,
} from "./workflow-spec-types";
import { catalogService } from "./catalog/catalog-service";
import { buildTemplateBlock } from "./catalog/xaml-template-builder";
import type { ProcessType } from "./catalog/catalog-service";
import { escapeXml } from "./lib/xml-utils";

function mapClrType(type: string): string {
  const lower = type.toLowerCase();
  if (lower === "string" || lower === "system.string" || lower === "x:string") return "x:String";
  if (lower === "int32" || lower === "integer" || lower === "int" || lower === "system.int32" || lower === "x:int32") return "x:Int32";
  if (lower === "int64" || lower === "long" || lower === "system.int64" || lower === "x:int64") return "x:Int64";
  if (lower === "boolean" || lower === "bool" || lower === "system.boolean" || lower === "x:boolean") return "x:Boolean";
  if (lower === "double" || lower === "system.double" || lower === "x:double") return "x:Double";
  if (lower === "decimal" || lower === "system.decimal" || lower === "x:decimal") return "x:Decimal";
  if (lower === "datetime" || lower === "system.datetime" || lower === "s:datetime") return "s:DateTime";
  if (lower === "timespan" || lower === "system.timespan" || lower === "s:timespan") return "s:TimeSpan";
  if (lower === "object" || lower === "system.object" || lower === "x:object") return "x:Object";
  if (lower.includes("datatable")) return "scg2:DataTable";
  if (lower.includes("datarow")) return "scg2:DataRow";
  if (lower.includes("securestring")) return "s:Security.SecureString";
  return "x:Object";
}

function inferAssignType(varName: string, variables: VariableDeclaration[]): string {
  const decl = variables.find(v => v.name === varName);
  if (decl) return mapClrType(decl.type);
  if (varName.startsWith("str_")) return "x:String";
  if (varName.startsWith("int_")) return "x:Int32";
  if (varName.startsWith("bool_")) return "x:Boolean";
  if (varName.startsWith("dbl_")) return "x:Double";
  if (varName.startsWith("dec_")) return "x:Decimal";
  if (varName.startsWith("dt_")) return "scg2:DataTable";
  if (varName.startsWith("drow_")) return "scg2:DataRow";
  if (varName.startsWith("ts_")) return "s:TimeSpan";
  if (varName.startsWith("obj_")) return "x:Object";
  return "x:Object";
}

function indent(xml: string, level: number): string {
  const spaces = "  ".repeat(level);
  return xml.split("\n").map(line => line.trim() ? spaces + line : line).join("\n");
}

function ensureBracketWrapped(expr: string): string {
  const trimmed = expr.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed;
  if (trimmed.startsWith("\"") || trimmed.startsWith("'")) return trimmed;
  if (/^\d+$/.test(trimmed)) return trimmed;
  if (trimmed === "True" || trimmed === "False") return trimmed;
  return `[${trimmed}]`;
}

function looksLikeVariableRef(expr: string): boolean {
  const trimmed = expr.trim();
  if (!trimmed) return false;
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) return true;
  if (/^[a-zA-Z_][a-zA-Z0-9_.]+$/.test(trimmed)) return true;
  return false;
}

function smartBracketWrap(val: string): string {
  const trimmed = val.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed;
  if (trimmed.startsWith("<InArgument") || trimmed.startsWith("<OutArgument")) return trimmed;
  if (/^".*"$/.test(trimmed)) return trimmed;
  if (/^'.*'$/.test(trimmed)) return trimmed;
  if (/^&quot;.*&quot;$/.test(trimmed)) return trimmed;
  if (trimmed === "True" || trimmed === "False" || trimmed === "Nothing" || trimmed === "null") return trimmed;
  if (/^[0-9]+$/.test(trimmed)) return trimmed;
  return `[${trimmed}]`;
}

export function resolveActivityTemplate(
  node: ActivityNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType = "general"
): string {
  const templateName = node.template;
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);

  if (templateName === "Assign") {
    return resolveAssignTemplate(node, allVariables);
  }

  if (templateName === "LogMessage") {
    const level = props.Level || props.level || "Info";
    const message = props.Message || props.message || `"${displayName}"`;
    return `<ui:LogMessage Level="${escapeXml(level)}" Message="${escapeXml(message)}" DisplayName="${displayName}" />`;
  }

  if (templateName === "Delay") {
    const duration = props.Duration || props.duration || "00:00:05";
    return `<Delay Duration="${escapeXml(duration)}" DisplayName="${displayName}" />`;
  }

  if (templateName === "Rethrow") {
    return `<ui:Rethrow DisplayName="${displayName}" />`;
  }

  if (templateName === "InvokeWorkflowFile") {
    const fileName = props.WorkflowFileName || props.workflowFileName || "Workflow.xaml";
    return `<ui:InvokeWorkflowFile WorkflowFileName="${escapeXml(fileName)}" DisplayName="${displayName}">\n` +
      `  <ui:InvokeWorkflowFile.Arguments>\n` +
      `  </ui:InvokeWorkflowFile.Arguments>\n` +
      `</ui:InvokeWorkflowFile>`;
  }

  if (templateName === "GetAsset") {
    return resolveGetAssetTemplate(node);
  }

  if (templateName === "GetCredential") {
    return resolveGetCredentialTemplate(node);
  }

  if (templateName === "SendSmtpMailMessage") {
    return resolveSendSmtpMailMessageTemplate(node);
  }

  if (templateName === "HttpClient") {
    return resolveHttpClientTemplate(node);
  }

  if (templateName === "DeserializeJson") {
    const input = props.JsonString || props.jsonString || props.Input || "";
    const outputVar = node.outputVar || "obj_Result";
    return `<ui:DeserializeJson DisplayName="${displayName}" JsonString="${escapeXml(input)}">\n` +
      `  <ui:DeserializeJson.Result>\n` +
      `    <OutArgument x:TypeArguments="x:Object">${ensureBracketWrapped(outputVar)}</OutArgument>\n` +
      `  </ui:DeserializeJson.Result>\n` +
      `</ui:DeserializeJson>`;
  }

  if (templateName === "Comment") {
    const text = props.Text || props.text || "";
    return `<ui:Comment Text="${escapeXml(text)}" DisplayName="${displayName}" />`;
  }

  if (catalogService.isLoaded()) {
    const schema = catalogService.getActivitySchema(templateName);
    if (!schema) {
      console.warn(`[Tree Assembler] Unknown template "${templateName}" — not in catalog, emitting comment placeholder`);
      return `<!-- UNKNOWN TEMPLATE: ${escapeXml(templateName)} — "${escapeXml(node.displayName)}" -->
<ui:Comment Text="Unknown activity template: ${escapeXml(templateName)}. Manual implementation required." DisplayName="${escapeXml(node.displayName)} (stub)" />`;
    }
  }

  return resolveDynamicTemplate(node, processType);
}

function resolveAssignTemplate(node: ActivityNode, allVariables: VariableDeclaration[]): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const toVar = props.To || props.to || node.outputVar || "obj_Result";
  const value = props.Value || props.value || '""';
  const typeArg = inferAssignType(toVar, allVariables);
  const wrappedTo = ensureBracketWrapped(toVar);
  const wrappedVal = smartBracketWrap(value);

  return `<Assign DisplayName="${displayName}">\n` +
    `  <Assign.To>\n` +
    `    <OutArgument x:TypeArguments="${typeArg}">${wrappedTo}</OutArgument>\n` +
    `  </Assign.To>\n` +
    `  <Assign.Value>\n` +
    `    <InArgument x:TypeArguments="${typeArg}">${wrappedVal}</InArgument>\n` +
    `  </Assign.Value>\n` +
    `</Assign>`;
}

function resolveGetAssetTemplate(node: ActivityNode): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const assetName = props.AssetName || props.assetName || "PLACEHOLDER_AssetName";
  const outputVar = node.outputVar || props.AssetValue || props.Value || "str_AssetValue";

  return `<ui:GetAsset DisplayName="${displayName}" AssetName="${escapeXml(assetName)}">\n` +
    `  <ui:GetAsset.AssetValue>\n` +
    `    <OutArgument x:TypeArguments="x:String">${ensureBracketWrapped(outputVar)}</OutArgument>\n` +
    `  </ui:GetAsset.AssetValue>\n` +
    `</ui:GetAsset>`;
}

function resolveGetCredentialTemplate(node: ActivityNode): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const assetName = props.AssetName || props.assetName || "PLACEHOLDER_CredentialName";
  const usernameVar = props.Username || props.username || "str_Username";
  const passwordVar = props.Password || props.password || "sec_Password";

  return `<ui:GetCredential DisplayName="${displayName}" AssetName="${escapeXml(assetName)}">\n` +
    `  <ui:GetCredential.Username>\n` +
    `    <OutArgument x:TypeArguments="x:String">${ensureBracketWrapped(usernameVar)}</OutArgument>\n` +
    `  </ui:GetCredential.Username>\n` +
    `  <ui:GetCredential.Password>\n` +
    `    <OutArgument x:TypeArguments="s:Security.SecureString">${ensureBracketWrapped(passwordVar)}</OutArgument>\n` +
    `  </ui:GetCredential.Password>\n` +
    `</ui:GetCredential>`;
}

function wrapSmtpPropValue(val: string): string {
  if (!val) return val;
  return smartBracketWrap(val);
}

function resolveSendSmtpMailMessageTemplate(node: ActivityNode): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const to = props.To || props.to || "PLACEHOLDER_To";
  const from = props.From || props.from || "";
  const subject = props.Subject || props.subject || "PLACEHOLDER_Subject";
  const body = props.Body || props.body || "PLACEHOLDER_Body";
  const server = props.Server || props.server || "PLACEHOLDER_SmtpServer";
  const port = props.Port || props.port || "587";
  const email = props.Email || props.email || "";
  const password = props.Password || props.password || "";
  const username = props.Username || props.username || "";
  const isBodyHtml = props.IsBodyHtml || props.isBodyHtml || "False";

  const wrappedTo = wrapSmtpPropValue(to);
  const wrappedSubject = wrapSmtpPropValue(subject);
  const wrappedBody = wrapSmtpPropValue(body);

  let attrs = `DisplayName="${displayName}" To="${escapeXml(wrappedTo)}" Subject="${escapeXml(wrappedSubject)}" Body="${escapeXml(wrappedBody)}"`;
  attrs += ` IsBodyHtml="${escapeXml(isBodyHtml)}"`;
  attrs += ` Server="${escapeXml(server)}" Port="${escapeXml(port)}"`;
  if (from) attrs += ` From="${escapeXml(wrapSmtpPropValue(from))}"`;
  if (email) attrs += ` Email="${escapeXml(wrapSmtpPropValue(email))}"`;
  if (username) attrs += ` Username="${escapeXml(wrapSmtpPropValue(username))}"`;
  if (password) attrs += ` Password="${escapeXml(wrapSmtpPropValue(password))}"`;

  return `<ui:SendSmtpMailMessage ${attrs} />`;
}

function resolveHttpClientTemplate(node: ActivityNode): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const endpoint = props.Endpoint || props.endpoint || props.URL || props.url || "PLACEHOLDER_URL";
  const method = props.Method || props.method || "GET";
  const outputVar = node.outputVar || "str_ResponseBody";

  let xml = `<ui:HttpClient DisplayName="${displayName}" Endpoint="${escapeXml(endpoint)}" Method="${escapeXml(method)}"`;

  if (props.Headers || props.headers) {
    xml += ` Headers="${escapeXml(props.Headers || props.headers)}"`;
  }
  if (props.Body || props.body) {
    xml += ` Body="${escapeXml(props.Body || props.body)}"`;
  }

  xml += `>\n`;
  xml += `  <ui:HttpClient.Result>\n`;
  xml += `    <OutArgument x:TypeArguments="x:String">${ensureBracketWrapped(outputVar)}</OutArgument>\n`;
  xml += `  </ui:HttpClient.Result>\n`;
  xml += `</ui:HttpClient>`;

  return xml;
}

function resolveDynamicTemplate(node: ActivityNode, processType: ProcessType): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const templateName = node.template;

  const needsUiPrefix = !["Assign", "If", "TryCatch", "Sequence", "Delay", "Rethrow", "Throw", "While", "DoWhile", "ForEach"].includes(templateName);
  const tag = needsUiPrefix ? `ui:${templateName}` : templateName;

  const attrParts: string[] = [`DisplayName="${displayName}"`];
  const childParts: string[] = [];

  let schema: any = null;
  if (catalogService.isLoaded()) {
    schema = catalogService.getActivitySchema(templateName);
  }

  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith("_") || key === "displayName") continue;

    let isChildElement = false;
    if (schema) {
      const propDef = schema.activity.properties.find((p: any) => p.name === key);
      if (propDef && propDef.xamlSyntax === "child-element") {
        isChildElement = true;
        const wrapper = propDef.argumentWrapper || "InArgument";
        const typeArg = propDef.typeArguments ? ` x:TypeArguments="${propDef.typeArguments}"` : "";
        const wrappedValue = smartBracketWrap(value);
        childParts.push(
          `  <${tag}.${key}>\n` +
          `    <${wrapper}${typeArg}>${wrappedValue}</${wrapper}>\n` +
          `  </${tag}.${key}>`
        );
      }
    }

    if (!isChildElement) {
      attrParts.push(`${key}="${escapeXml(value)}"`);
    }
  }

  if (node.outputVar) {
    const outputType = node.outputType || "x:Object";
    childParts.push(
      `  <${tag}.Result>\n` +
      `    <OutArgument x:TypeArguments="${mapClrType(outputType)}">${ensureBracketWrapped(node.outputVar)}</OutArgument>\n` +
      `  </${tag}.Result>`
    );
  }

  if (childParts.length === 0) {
    return `<${tag} ${attrParts.join(" ")} />`;
  }

  return `<${tag} ${attrParts.join(" ")}>\n${childParts.join("\n")}\n</${tag}>`;
}

function wrapInTryCatch(innerXml: string, displayName: string): string {
  return `<TryCatch DisplayName="Try: ${escapeXml(displayName)}">
  <TryCatch.Try>
    <Sequence DisplayName="Try Block">
      ${innerXml}
    </Sequence>
  </TryCatch.Try>
  <TryCatch.Catches>
    <Catch x:TypeArguments="s:Exception">
      <ActivityAction x:TypeArguments="s:Exception">
        <ActivityAction.Argument>
          <DelegateInArgument x:TypeArguments="s:Exception" Name="exception" />
        </ActivityAction.Argument>
        <Sequence DisplayName="Handle Exception">
          <ui:LogMessage Level="Error" Message="[&quot;Error in ${escapeXml(displayName)}: &quot; &amp; exception.Message]" DisplayName="Log Exception" />
          <ui:Rethrow DisplayName="Rethrow Exception" />
        </Sequence>
      </ActivityAction>
    </Catch>
  </TryCatch.Catches>
</TryCatch>`;
}

function wrapInRetryScope(innerXml: string, displayName: string, retries: number = 3, interval: string = "00:00:05"): string {
  return `<ui:RetryScope NumberOfRetries="${retries}" RetryInterval="${interval}" DisplayName="Retry: ${escapeXml(displayName)}">
  <ui:RetryScope.Body>
    <Sequence DisplayName="Retry Body">
      ${innerXml}
    </Sequence>
  </ui:RetryScope.Body>
  <ui:RetryScope.Condition>
    <ui:ShouldRetry />
  </ui:RetryScope.Condition>
</ui:RetryScope>`;
}

export function assembleNode(
  node: WorkflowNode,
  allVariables: VariableDeclaration[] = [],
  processType: ProcessType = "general",
  depthLevel: number = 0,
): string {
  switch (node.kind) {
    case "activity":
      return assembleActivityNode(node, allVariables, processType);
    case "sequence":
      return assembleSequenceNode(node, allVariables, processType, depthLevel);
    case "tryCatch":
      return assembleTryCatchNode(node, allVariables, processType, depthLevel);
    case "if":
      return assembleIfNode(node, allVariables, processType, depthLevel);
    case "while":
      return assembleWhileNode(node, allVariables, processType, depthLevel);
    case "forEach":
      return assembleForEachNode(node, allVariables, processType, depthLevel);
    case "retryScope":
      return assembleRetryScopeNode(node, allVariables, processType, depthLevel);
    default:
      return `<!-- Unknown node kind -->`;
  }
}

function assembleActivityNode(
  node: ActivityNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
): string {
  let xml = resolveActivityTemplate(node, allVariables, processType);

  if (node.errorHandling === "catch" || node.errorHandling === "escalate") {
    xml = wrapInTryCatch(xml, node.displayName);
  } else if (node.errorHandling === "retry") {
    xml = wrapInRetryScope(xml, node.displayName);
  }

  return xml;
}

function assembleSequenceNode(
  node: SequenceNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  depthLevel: number,
): string {
  const displayName = escapeXml(node.displayName);
  const childrenXml = node.children
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1))
    .join("\n");

  let varsBlock = "";
  if (node.variables && node.variables.length > 0) {
    varsBlock = "  <Sequence.Variables>\n";
    for (const v of node.variables) {
      const typeAttr = mapClrType(v.type);
      if (v.default) {
        varsBlock += `    <Variable x:TypeArguments="${typeAttr}" Name="${escapeXml(v.name)}" Default="${escapeXml(v.default)}" />\n`;
      } else {
        varsBlock += `    <Variable x:TypeArguments="${typeAttr}" Name="${escapeXml(v.name)}" />\n`;
      }
    }
    varsBlock += "  </Sequence.Variables>\n";
  }

  return `<Sequence DisplayName="${displayName}">\n${varsBlock}  ${childrenXml}\n</Sequence>`;
}

function assembleTryCatchNode(
  node: TryCatchNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  depthLevel: number,
): string {
  const displayName = escapeXml(node.displayName);
  const tryXml = node.tryChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1))
    .join("\n");

  const catchXml = node.catchChildren.length > 0
    ? node.catchChildren
        .map(child => assembleNode(child, allVariables, processType, depthLevel + 1))
        .join("\n")
    : `<ui:LogMessage Level="Error" Message="[&quot;Error: &quot; &amp; exception.Message]" DisplayName="Log Exception" />\n<ui:Rethrow DisplayName="Rethrow Exception" />`;

  const finallyXml = node.finallyChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1))
    .join("\n");

  let xml = `<TryCatch DisplayName="${displayName}">\n`;
  xml += `  <TryCatch.Try>\n`;
  xml += `    <Sequence DisplayName="Try Block">\n`;
  xml += `      ${tryXml}\n`;
  xml += `    </Sequence>\n`;
  xml += `  </TryCatch.Try>\n`;
  xml += `  <TryCatch.Catches>\n`;
  xml += `    <Catch x:TypeArguments="s:Exception">\n`;
  xml += `      <ActivityAction x:TypeArguments="s:Exception">\n`;
  xml += `        <ActivityAction.Argument>\n`;
  xml += `          <DelegateInArgument x:TypeArguments="s:Exception" Name="exception" />\n`;
  xml += `        </ActivityAction.Argument>\n`;
  xml += `        <Sequence DisplayName="Handle Exception">\n`;
  xml += `          ${catchXml}\n`;
  xml += `        </Sequence>\n`;
  xml += `      </ActivityAction>\n`;
  xml += `    </Catch>\n`;
  xml += `  </TryCatch.Catches>\n`;
  if (finallyXml.trim()) {
    xml += `  <TryCatch.Finally>\n`;
    xml += `    <Sequence DisplayName="Finally Block">\n`;
    xml += `      ${finallyXml}\n`;
    xml += `    </Sequence>\n`;
    xml += `  </TryCatch.Finally>\n`;
  }
  xml += `</TryCatch>`;

  return xml;
}

function assembleIfNode(
  node: IfNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  depthLevel: number,
): string {
  const displayName = escapeXml(node.displayName);
  const condition = escapeXml(node.condition);

  const thenXml = node.thenChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1))
    .join("\n");

  const elseXml = node.elseChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1))
    .join("\n");

  let xml = `<If Condition="${condition}" DisplayName="${displayName}">\n`;
  xml += `  <If.Then>\n`;
  xml += `    <Sequence DisplayName="Then">\n`;
  xml += `      ${thenXml}\n`;
  xml += `    </Sequence>\n`;
  xml += `  </If.Then>\n`;
  if (elseXml.trim()) {
    xml += `  <If.Else>\n`;
    xml += `    <Sequence DisplayName="Else">\n`;
    xml += `      ${elseXml}\n`;
    xml += `    </Sequence>\n`;
    xml += `  </If.Else>\n`;
  }
  xml += `</If>`;

  return xml;
}

function assembleWhileNode(
  node: WhileNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  depthLevel: number,
): string {
  const displayName = escapeXml(node.displayName);
  const condition = escapeXml(node.condition);

  const bodyXml = node.bodyChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1))
    .join("\n");

  return `<While Condition="${condition}" DisplayName="${displayName}">\n` +
    `  <While.Body>\n` +
    `    <Sequence DisplayName="While Body">\n` +
    `      ${bodyXml}\n` +
    `    </Sequence>\n` +
    `  </While.Body>\n` +
    `</While>`;
}

function assembleForEachNode(
  node: ForEachNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  depthLevel: number,
): string {
  const displayName = escapeXml(node.displayName);
  const itemType = node.itemType || "x:Object";

  const bodyXml = node.bodyChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1))
    .join("\n");

  return `<ForEach x:TypeArguments="${itemType}" Values="${escapeXml(node.valuesExpression)}" DisplayName="${displayName}">\n` +
    `  <ActivityAction x:TypeArguments="${itemType}">\n` +
    `    <ActivityAction.Argument>\n` +
    `      <DelegateInArgument x:TypeArguments="${itemType}" Name="${escapeXml(node.iteratorName)}" />\n` +
    `    </ActivityAction.Argument>\n` +
    `    <Sequence DisplayName="Body">\n` +
    `      ${bodyXml}\n` +
    `    </Sequence>\n` +
    `  </ActivityAction>\n` +
    `</ForEach>`;
}

function assembleRetryScopeNode(
  node: RetryScopeNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  depthLevel: number,
): string {
  const displayName = escapeXml(node.displayName);

  const bodyXml = node.bodyChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1))
    .join("\n");

  return `<ui:RetryScope NumberOfRetries="${node.numberOfRetries}" RetryInterval="${node.retryInterval}" DisplayName="${displayName}">\n` +
    `  <ui:RetryScope.Body>\n` +
    `    <Sequence DisplayName="Retry Body">\n` +
    `      ${bodyXml}\n` +
    `    </Sequence>\n` +
    `  </ui:RetryScope.Body>\n` +
    `  <ui:RetryScope.Condition>\n` +
    `    <ui:ShouldRetry />\n` +
    `  </ui:RetryScope.Condition>\n` +
    `</ui:RetryScope>`;
}

function buildVariablesBlock(variables: VariableDeclaration[]): string {
  if (variables.length === 0) return "";
  let xml = "<Sequence.Variables>\n";
  const seen = new Set<string>();
  for (const v of variables) {
    if (seen.has(v.name)) continue;
    seen.add(v.name);
    const typeAttr = mapClrType(v.type);
    if (v.default) {
      xml += `      <Variable x:TypeArguments="${typeAttr}" Name="${escapeXml(v.name)}" Default="${escapeXml(v.default)}" />\n`;
    } else {
      xml += `      <Variable x:TypeArguments="${typeAttr}" Name="${escapeXml(v.name)}" />\n`;
    }
  }
  xml += "    </Sequence.Variables>";
  return xml;
}

function buildXMembersBlock(
  args: Array<{ name: string; direction: string; type: string }>
): string {
  if (!args || args.length === 0) return "";
  const lines: string[] = [];
  lines.push("  <x:Members>");
  for (const arg of args) {
    const clrType = mapClrType(arg.type);
    const dir = arg.direction || "InArgument";
    lines.push(`    <x:Property Name="${escapeXml(arg.name)}" Type="${dir}(${clrType})" />`);
  }
  lines.push("  </x:Members>");
  return lines.join("\n") + "\n";
}

export function assembleWorkflowFromSpec(
  spec: WorkflowSpec,
  processType: ProcessType = "general",
): { xaml: string; variables: VariableDeclaration[] } {
  const workflowName = (spec.name || "Workflow").replace(/\s+/g, "_");
  const allVariables = [...(spec.variables || [])];

  if (spec.rootSequence.variables) {
    for (const v of spec.rootSequence.variables) {
      if (!allVariables.find(av => av.name === v.name)) {
        allVariables.push(v);
      }
    }
  }

  if (!allVariables.find(v => v.name === "str_ScreenshotPath")) {
    allVariables.push({
      name: "str_ScreenshotPath",
      type: "String",
      default: '"screenshots/error_" & DateTime.Now.ToString("yyyyMMdd_HHmmss") & ".png"',
    });
  }

  const activitiesXml = spec.rootSequence.children
    .map(child => assembleNode(child, allVariables, processType))
    .join("\n    ");

  const variablesBlock = buildVariablesBlock(allVariables);
  const xMembersBlock = buildXMembersBlock(spec.arguments || []);

  const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="${escapeXml(workflowName)}"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=mscorlib"
  xmlns:scg2="clr-namespace:System.Data;assembly=System.Data"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
${xMembersBlock}  <Sequence DisplayName="${escapeXml(workflowName)}">
    ${variablesBlock}
    ${activitiesXml}
  </Sequence>
</Activity>`;

  return { xaml, variables: allVariables };
}
