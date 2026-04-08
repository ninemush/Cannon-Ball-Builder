import type { GeneratorFn, GeneratorArgs } from "./deterministic-generators";
import * as gen from "./deterministic-generators";

export const LEGACY_TO_MODERN_ALIAS_MAP: Record<string, string> = {
  "Click": "NClick",
  "ui:Click": "NClick",
  "TypeInto": "NTypeInto",
  "ui:TypeInto": "NTypeInto",
  "GetText": "NGetText",
  "ui:GetText": "NGetText",
  "SelectItem": "NSelectItem",
  "ui:SelectItem": "NSelectItem",
  "CheckState": "NCheckState",
  "ui:CheckState": "NCheckState",
  "UseApplicationBrowser": "NApplicationCard",
  "ui:UseApplicationBrowser": "NApplicationCard",
  "UseBrowser": "NApplicationCard",
  "ui:UseBrowser": "NApplicationCard",
  "UseApplication": "NApplicationCard",
  "ui:UseApplication": "NApplicationCard",
  "OpenBrowser": "NApplicationCard",
  "ui:OpenBrowser": "NApplicationCard",
  "AttachBrowser": "NApplicationCard",
  "ui:AttachBrowser": "NApplicationCard",
  "AttachWindow": "NApplicationCard",
  "ui:AttachWindow": "NApplicationCard",
};

export type GeneratorEntry = {
  fn: GeneratorFn;
  hasChildren?: boolean;
};

const GENERATOR_REGISTRY: Record<string, GeneratorEntry> = {
  "NClick": { fn: gen.gen_nclick },
  "NTypeInto": { fn: gen.gen_ntype_into },
  "NGetText": { fn: gen.gen_nget_text },
  "NApplicationCard": { fn: gen.gen_napplication_card, hasChildren: true },
  "NSelectItem": { fn: gen.gen_nselect_item },
  "NCheckState": { fn: gen.gen_ncheck_state },
  "LogMessage": { fn: gen.gen_log_message },
  "Comment": { fn: gen.gen_comment },
  "Assign": { fn: gen.gen_assign },
  "Delay": { fn: gen.gen_delay },
  "InvokeWorkflowFile": { fn: gen.gen_invoke_workflow_file },
  "TakeScreenshot": { fn: gen.gen_take_screenshot },
  "GetCredential": { fn: gen.gen_get_credential },
  "GetAsset": { fn: gen.gen_get_asset },
  "AddQueueItem": { fn: gen.gen_add_queue_item },
  "GetTransactionItem": { fn: gen.gen_get_transaction_item },
  "SetTransactionStatus": { fn: gen.gen_set_transaction_status },
  "ReadTextFile": { fn: gen.gen_read_text_file },
  "WriteTextFile": { fn: gen.gen_write_text_file },
  "PathExists": { fn: gen.gen_path_exists },
  "HttpClient": { fn: gen.gen_http_client },
  "DeserializeJson": { fn: gen.gen_deserialize_json },
  "DeserializeJSON": { fn: gen.gen_deserialize_json },
  "SerializeJson": { fn: gen.gen_serialize_json },
  "Throw": { fn: gen.gen_throw },
  "Rethrow": { fn: gen.gen_rethrow },
  "KillProcess": { fn: gen.gen_kill_process },
  "AddLogFields": { fn: gen.gen_add_log_fields },
  "RetryScope": { fn: gen.gen_retry_scope, hasChildren: true },
  "ElementExists": { fn: gen.gen_element_exists },
  "NavigateTo": { fn: gen.gen_navigate_to },
  "CloseApplication": { fn: gen.gen_close_application },
  "ExcelApplicationScope": { fn: gen.gen_excel_application_scope, hasChildren: true },
  "ExcelReadRange": { fn: gen.gen_excel_read_range },
  "ExcelWriteRange": { fn: gen.gen_excel_write_range },
  "SendSmtpMailMessage": { fn: gen.gen_send_smtp_mail },
  "SendOutlookMailMessage": { fn: gen.gen_send_outlook_mail },
  "ExecuteQuery": { fn: gen.gen_execute_query },
  "ExecuteNonQuery": { fn: gen.gen_execute_non_query },
  "BuildDataTable": { fn: gen.gen_build_data_table },
  "AddDataRow": { fn: gen.gen_add_data_row },
  "FilterDataTable": { fn: gen.gen_filter_data_table },
  "OutputDataTable": { fn: gen.gen_output_data_table },
  "CreateFormTask": { fn: gen.gen_create_form_task },
  "ReadPDFText": { fn: gen.gen_read_pdf_text },
  "UseExcel": { fn: gen.gen_use_excel, hasChildren: true },
  "ReadRange": { fn: gen.gen_read_range },
  "WriteRange": { fn: gen.gen_write_range },

  "Sequence": { fn: gen.gen_sequence, hasChildren: true },
  "If": { fn: gen.gen_if, hasChildren: true },
  "While": { fn: gen.gen_while, hasChildren: true },
  "ForEach": { fn: gen.gen_for_each, hasChildren: true },
  "TryCatch": { fn: gen.gen_try_catch, hasChildren: true },

  "Click": { fn: gen.gen_nclick },
  "TypeInto": { fn: gen.gen_ntype_into },
  "GetText": { fn: gen.gen_nget_text },
  "SelectItem": { fn: gen.gen_nselect_item },
  "CheckState": { fn: gen.gen_ncheck_state },
  "UseApplicationBrowser": { fn: gen.gen_napplication_card, hasChildren: true },
  "UseBrowser": { fn: gen.gen_napplication_card, hasChildren: true },
  "UseApplication": { fn: gen.gen_napplication_card, hasChildren: true },
  "OpenBrowser": { fn: gen.gen_napplication_card, hasChildren: true },
  "AttachBrowser": { fn: gen.gen_napplication_card, hasChildren: true },
  "AttachWindow": { fn: gen.gen_napplication_card, hasChildren: true },
};

export function resolveTemplateName(template: string): string {
  const stripped = template.includes(":") ? template.split(":").pop()! : template;
  return LEGACY_TO_MODERN_ALIAS_MAP[template] || LEGACY_TO_MODERN_ALIAS_MAP[stripped] || stripped;
}

export function getGenerator(templateName: string): GeneratorEntry | null {
  const resolved = resolveTemplateName(templateName);

  if (GENERATOR_REGISTRY[resolved]) {
    return GENERATOR_REGISTRY[resolved];
  }

  if (GENERATOR_REGISTRY[templateName]) {
    return GENERATOR_REGISTRY[templateName];
  }

  const stripped = templateName.includes(":") ? templateName.split(":").pop()! : templateName;
  if (GENERATOR_REGISTRY[stripped]) {
    return GENERATOR_REGISTRY[stripped];
  }

  return null;
}

export function hasGenerator(templateName: string): boolean {
  return getGenerator(templateName) !== null;
}

export function getRegisteredTemplateNames(): string[] {
  return Object.keys(GENERATOR_REGISTRY);
}

export function dispatchGenerator(templateName: string, args: GeneratorArgs, children?: string): string | null {
  const entry = getGenerator(templateName);
  if (!entry) return null;

  if (entry.hasChildren) {
    return entry.fn(args, children);
  }
  return entry.fn(args);
}
