import { describe, it, expect } from "vitest";
import {
  gen_nclick,
  gen_ntype_into,
  gen_nget_text,
  gen_napplication_card,
  gen_log_message,
  gen_assign,
  gen_invoke_workflow_file,
  gen_delay,
  gen_comment,
  gen_get_credential,
  gen_get_asset,
  gen_add_queue_item,
  gen_get_transaction_item,
  gen_set_transaction_status,
  gen_http_client,
  gen_deserialize_json,
  gen_throw,
  gen_rethrow,
  gen_element_exists,
  gen_if,
  gen_try_catch,
  gen_sequence,
  gen_for_each,
  gen_while,
  gen_nselect_item,
  gen_ncheck_state,
  gen_serialize_json,
  gen_execute_query,
  gen_build_data_table,
  gen_read_pdf_text,
  gen_send_smtp_mail,
  gen_create_form_task,
  NET6_NAMESPACE_DECLARATIONS,
  NET6_REFERENCES_FOR_IMPLEMENTATION,
  _uuid,
} from "../xaml/deterministic-generators";
import { dispatchGenerator, hasGenerator, resolveTemplateName, getRegisteredTemplateNames, LEGACY_TO_MODERN_ALIAS_MAP } from "../xaml/generator-registry";
import { assembleWorkflowFromSpec } from "../workflow-tree-assembler";

describe("Deterministic XAML Generators", () => {
  describe("Modern Design Activities", () => {
    it("gen_nclick produces valid NClick XAML", () => {
      const xml = gen_nclick({ displayName: "Click Login Button", selector: '<html tag="BUTTON" name="Login" />' });
      expect(xml).toContain("<ui:NClick");
      expect(xml).toContain('DisplayName="Click Login Button"');
      expect(xml).toContain("<ui:NClick.Target>");
      expect(xml).toContain("WaitForReady=");
    });

    it("gen_ntype_into produces valid NTypeInto XAML", () => {
      const xml = gen_ntype_into({ displayName: "Type Username", text: "admin@example.com", selector: '<html tag="INPUT" />' });
      expect(xml).toContain("<ui:NTypeInto");
      expect(xml).toContain('Text="admin@example.com"');
      expect(xml).toContain("<ui:NTypeInto.Target>");
    });

    it("gen_nget_text produces valid NGetText XAML with output variable", () => {
      const xml = gen_nget_text({ displayName: "Get Invoice Number", selector: '<html tag="SPAN" />', outputVar: "str_InvoiceNo" });
      expect(xml).toContain("<ui:NGetText");
      expect(xml).toContain("<OutArgument");
      expect(xml).toContain("[str_InvoiceNo]");
    });

    it("gen_napplication_card wraps children in body", () => {
      const children = '<ui:NClick DisplayName="Click" />';
      const xml = gen_napplication_card({ displayName: "Use Chrome", url: "https://example.com", browserType: "Chrome" }, children);
      expect(xml).toContain("<ui:NApplicationCard");
      expect(xml).toContain('Url="https://example.com"');
      expect(xml).toContain('BrowserType="Chrome"');
      expect(xml).toContain("<ui:NApplicationCard.Body>");
      expect(xml).toContain(children);
    });

    it("gen_nselect_item produces valid NSelectItem XAML", () => {
      const xml = gen_nselect_item({ displayName: "Select Country", item: "United States", selector: '<html tag="SELECT" />' });
      expect(xml).toContain("<ui:NSelectItem");
      expect(xml).toContain('Item="United States"');
    });

    it("gen_ncheck_state produces valid NCheckState XAML", () => {
      const xml = gen_ncheck_state({ displayName: "Check Checkbox", outputVar: "bool_IsChecked" });
      expect(xml).toContain("<ui:NCheckState");
      expect(xml).toContain("[bool_IsChecked]");
    });
  });

  describe("Core Activities", () => {
    it("gen_log_message produces self-closing element", () => {
      const xml = gen_log_message({ displayName: "Log Start", level: "Info", message: "[&quot;Starting process&quot;]" });
      expect(xml).toContain("<ui:LogMessage");
      expect(xml).toContain('Level="Info"');
      expect(xml).toContain("/>");
    });

    it("gen_assign produces valid Assign with To/Value", () => {
      const xml = gen_assign({ displayName: "Set Counter", toVariable: "int_Counter", toType: "x:Int32", valueExpression: "0" });
      expect(xml).toContain("<Assign");
      expect(xml).toContain("<Assign.To>");
      expect(xml).toContain("<Assign.Value>");
      expect(xml).toContain("[int_Counter]");
    });

    it("gen_delay produces valid Delay element", () => {
      const xml = gen_delay({ displayName: "Wait 5s", duration: "00:00:05" });
      expect(xml).toContain("<Delay");
      expect(xml).toContain('Duration="00:00:05"');
    });

    it("gen_comment produces valid Comment", () => {
      const xml = gen_comment({ displayName: "Step Note", text: "This is a comment" });
      expect(xml).toContain("<ui:Comment");
      expect(xml).toContain('Text="This is a comment"');
    });

    it("gen_invoke_workflow_file produces valid invocation", () => {
      const xml = gen_invoke_workflow_file({ displayName: "Invoke Init", workflowFileName: "Init.xaml" });
      expect(xml).toContain("<ui:InvokeWorkflowFile");
      expect(xml).toContain('WorkflowFileName="Init.xaml"');
    });

    it("gen_throw produces valid Throw with exception", () => {
      const xml = gen_throw({ displayName: "Throw Error", exception: 'New System.Exception("Failed")' });
      expect(xml).toContain("<Throw");
      expect(xml).toContain("<Throw.Exception>");
    });

    it("gen_rethrow produces valid self-closing Rethrow", () => {
      const xml = gen_rethrow({ displayName: "Rethrow" });
      expect(xml).toContain("<Rethrow");
      expect(xml).toContain("/>");
    });
  });

  describe("Orchestrator Activities", () => {
    it("gen_get_credential produces valid GetCredential with SecureString password", () => {
      const xml = gen_get_credential({ displayName: "Get SAP Creds", assetName: "SAP_Credential", username: "str_User", password: "sec_Pass" });
      expect(xml).toContain("<ui:GetCredential");
      expect(xml).toContain('AssetName="SAP_Credential"');
      expect(xml).toContain("<ui:GetCredential.Username>");
      expect(xml).toContain("[str_User]");
      expect(xml).toContain('x:TypeArguments="ss:SecureString"');
      expect(xml).toContain("[sec_Pass]");
    });

    it("gen_get_asset produces valid GetAsset", () => {
      const xml = gen_get_asset({ displayName: "Get Config Path", assetName: "ConfigPath", outputVar: "str_Path" });
      expect(xml).toContain("<ui:GetAsset");
      expect(xml).toContain("[str_Path]");
    });

    it("gen_add_queue_item produces valid AddQueueItem", () => {
      const xml = gen_add_queue_item({ displayName: "Add to Queue", queueName: "InvoiceQueue", priority: "High" });
      expect(xml).toContain("<ui:AddQueueItem");
      expect(xml).toContain('QueueName="InvoiceQueue"');
      expect(xml).toContain('Priority="High"');
    });

    it("gen_get_transaction_item produces valid output binding", () => {
      const xml = gen_get_transaction_item({ displayName: "Get Next Item", queueName: "WorkQueue", outputVar: "qi_Item" });
      expect(xml).toContain("<ui:GetTransactionItem");
      expect(xml).toContain("[qi_Item]");
    });

    it("gen_set_transaction_status produces valid status set", () => {
      const xml = gen_set_transaction_status({ displayName: "Mark Success", transactionItem: "qi_Item", status: "Successful" });
      expect(xml).toContain("<ui:SetTransactionStatus");
      expect(xml).toContain('Status="Successful"');
    });
  });

  describe("Web Activities", () => {
    it("gen_http_client produces valid HTTP request", () => {
      const xml = gen_http_client({ displayName: "Call API", endpoint: "https://api.example.com/data", method: "GET", outputVar: "str_Response" });
      expect(xml).toContain("<ui:HttpClient");
      expect(xml).toContain('Method="GET"');
      expect(xml).toContain("[str_Response]");
    });

    it("gen_deserialize_json produces valid deserialization", () => {
      const xml = gen_deserialize_json({ displayName: "Parse JSON", jsonString: "[str_Response]", outputVar: "obj_Data" });
      expect(xml).toContain("<uweb:DeserializeJson");
      expect(xml).toContain("[obj_Data]");
    });

    it("gen_element_exists produces valid element check", () => {
      const xml = gen_element_exists({ displayName: "Check Button", selector: '<html tag="BUTTON" />', outputVar: "bool_Exists" });
      expect(xml).toContain("<ui:ElementExists");
      expect(xml).toContain("[bool_Exists]");
    });
  });

  describe("Control Flow Generators", () => {
    it("gen_if produces valid If with Then and Else", () => {
      const xml = gen_if(
        { displayName: "Check Flag", condition: "[bool_Flag]" },
        '<ui:LogMessage Level="Info" Message="[&quot;True&quot;]" DisplayName="Log True" />',
        '<ui:LogMessage Level="Info" Message="[&quot;False&quot;]" DisplayName="Log False" />'
      );
      expect(xml).toContain("<If");
      expect(xml).toContain("<If.Then>");
      expect(xml).toContain("<If.Else>");
    });

    it("gen_try_catch produces valid TryCatch", () => {
      const xml = gen_try_catch(
        { displayName: "Safe Operation", catchVariableName: "ex" },
        '<ui:LogMessage Level="Info" Message="[&quot;Try&quot;]" DisplayName="Log" />'
      );
      expect(xml).toContain("<TryCatch");
      expect(xml).toContain("<TryCatch.Try>");
      expect(xml).toContain("<TryCatch.Catches>");
      expect(xml).toContain('Name="ex"');
    });

    it("gen_sequence wraps children", () => {
      const xml = gen_sequence(
        { displayName: "Main Sequence" },
        '<ui:LogMessage Level="Info" Message="[&quot;Hi&quot;]" DisplayName="Log" />'
      );
      expect(xml).toContain("<Sequence");
      expect(xml).toContain('DisplayName="Main Sequence"');
    });

    it("gen_for_each produces valid ForEach", () => {
      const xml = gen_for_each(
        { displayName: "Loop Items", itemType: "x:String", valuesExpression: "[arr_Items]", iteratorName: "item" },
        '<ui:LogMessage Level="Info" Message="[item]" DisplayName="Log Item" />'
      );
      expect(xml).toContain("<ForEach");
      expect(xml).toContain('x:TypeArguments="x:String"');
      expect(xml).toContain('<DelegateInArgument');
      expect(xml).toContain('Name="item"');
    });

    it("gen_while produces valid While loop", () => {
      const xml = gen_while(
        { displayName: "Keep Going", condition: "[int_Counter < 10]" },
        '<ui:LogMessage Level="Info" Message="[int_Counter.ToString]" DisplayName="Log Counter" />'
      );
      expect(xml).toContain("<While");
      expect(xml).toContain("Condition=");
    });
  });

  describe(".NET 6 Namespace Constants", () => {
    it("NET6_NAMESPACE_DECLARATIONS uses System.Private.CoreLib", () => {
      expect(NET6_NAMESPACE_DECLARATIONS).toContain("assembly=System.Private.CoreLib");
      expect(NET6_NAMESPACE_DECLARATIONS).not.toContain("assembly=mscorlib");
    });

    it("NET6_NAMESPACE_DECLARATIONS includes uix prefix", () => {
      expect(NET6_NAMESPACE_DECLARATIONS).toContain("xmlns:uix=");
    });

    it("NET6_REFERENCES_FOR_IMPLEMENTATION uses System.Private.CoreLib", () => {
      expect(NET6_REFERENCES_FOR_IMPLEMENTATION).toContain("System.Private.CoreLib");
      expect(NET6_REFERENCES_FOR_IMPLEMENTATION).not.toContain("mscorlib");
    });
  });

  describe("UUID generator", () => {
    it("produces valid UUID v4 format", () => {
      const id = _uuid();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it("produces unique values", () => {
      const ids = new Set(Array.from({ length: 100 }, () => _uuid()));
      expect(ids.size).toBe(100);
    });
  });

  describe("XML escaping", () => {
    it("escapes special characters in activity display names", () => {
      const xml = gen_log_message({ displayName: 'Log "Test" & <Value>', message: "test" });
      expect(xml).not.toContain('DisplayName="Log "Test"');
      expect(xml).toContain("&amp;");
    });
  });
});

describe("Generator Registry", () => {
  it("resolves legacy Click to NClick", () => {
    expect(resolveTemplateName("Click")).toBe("NClick");
    expect(resolveTemplateName("ui:Click")).toBe("NClick");
  });

  it("resolves legacy TypeInto to NTypeInto", () => {
    expect(resolveTemplateName("TypeInto")).toBe("NTypeInto");
  });

  it("resolves legacy OpenBrowser to NApplicationCard", () => {
    expect(resolveTemplateName("OpenBrowser")).toBe("NApplicationCard");
    expect(resolveTemplateName("UseBrowser")).toBe("NApplicationCard");
    expect(resolveTemplateName("AttachBrowser")).toBe("NApplicationCard");
  });

  it("passes through modern names unchanged", () => {
    expect(resolveTemplateName("NClick")).toBe("NClick");
    expect(resolveTemplateName("LogMessage")).toBe("LogMessage");
    expect(resolveTemplateName("Assign")).toBe("Assign");
  });

  it("hasGenerator returns true for known templates", () => {
    expect(hasGenerator("NClick")).toBe(true);
    expect(hasGenerator("LogMessage")).toBe(true);
    expect(hasGenerator("Click")).toBe(true);
    expect(hasGenerator("Assign")).toBe(true);
    expect(hasGenerator("HttpClient")).toBe(true);
  });

  it("hasGenerator returns false for unknown templates", () => {
    expect(hasGenerator("UnknownActivity")).toBe(false);
    expect(hasGenerator("FakeTemplate")).toBe(false);
  });

  it("dispatchGenerator produces XAML for known templates", () => {
    const xml = dispatchGenerator("LogMessage", { displayName: "Log Test", level: "Info", message: "Hello" });
    expect(xml).not.toBeNull();
    expect(xml).toContain("<ui:LogMessage");
  });

  it("dispatchGenerator returns null for unknown templates", () => {
    const xml = dispatchGenerator("UnknownTemplate", { displayName: "Test" });
    expect(xml).toBeNull();
  });

  it("dispatchGenerator handles legacy-to-modern aliases", () => {
    const xml = dispatchGenerator("Click", { displayName: "Click Button" });
    expect(xml).not.toBeNull();
    expect(xml).toContain("<ui:NClick");
  });

  it("registry has substantial coverage", () => {
    const names = getRegisteredTemplateNames();
    expect(names.length).toBeGreaterThan(30);
  });

  it("LEGACY_TO_MODERN_ALIAS_MAP covers all legacy activities", () => {
    expect(LEGACY_TO_MODERN_ALIAS_MAP["Click"]).toBe("NClick");
    expect(LEGACY_TO_MODERN_ALIAS_MAP["TypeInto"]).toBe("NTypeInto");
    expect(LEGACY_TO_MODERN_ALIAS_MAP["GetText"]).toBe("NGetText");
    expect(LEGACY_TO_MODERN_ALIAS_MAP["OpenBrowser"]).toBe("NApplicationCard");
  });

  it("registry includes control flow generators", () => {
    expect(hasGenerator("Sequence")).toBe(true);
    expect(hasGenerator("If")).toBe(true);
    expect(hasGenerator("While")).toBe(true);
    expect(hasGenerator("ForEach")).toBe(true);
    expect(hasGenerator("TryCatch")).toBe(true);
  });

  it("dispatchGenerator passes children to container activities", () => {
    const childXml = '<ui:LogMessage Level="Info" Message="inner" DisplayName="Inner" />';
    const xml = dispatchGenerator("Sequence", { displayName: "Wrapper" }, childXml);
    expect(xml).not.toBeNull();
    expect(xml).toContain("<Sequence");
    expect(xml).toContain(childXml);
  });
});

describe("Golden XAML Snapshot Tests", () => {
  it("NClick produces Studio-compatible structure", () => {
    const xml = gen_nclick({ displayName: "Click Submit", selector: '<html tag="BUTTON" aaname="Submit" />' });
    expect(xml).toMatchInlineSnapshot(`
      "<ui:NClick ClickType="CLICK_SINGLE" MouseButton="BTN_LEFT" DelayAfter="300" DelayBefore="200" ContinueOnError="False" DisplayName="Click Submit">
            <ui:NClick.Target>
              <ui:Target Selector="&lt;html tag=&quot;BUTTON&quot; aaname=&quot;Submit&quot; /&gt;" WaitForReady="INTERACTIVE" TimeoutMS="30000" />
            </ui:NClick.Target>
          </ui:NClick>"
    `);
  });

  it("LogMessage produces exact self-closing element", () => {
    const xml = gen_log_message({ displayName: "Log Start", level: "Info", message: '[&quot;Starting&quot;]' });
    expect(xml).toMatchInlineSnapshot(`"<ui:LogMessage Level="Info" Message="[&amp;quot;Starting&amp;quot;]" DisplayName="Log Start" />"`);
  });

  it("Assign produces proper To/Value child elements", () => {
    const xml = gen_assign({ displayName: "Set Counter", toVariable: "int_Counter", toType: "x:Int32", valueExpression: "0" });
    expect(xml).toContain('<OutArgument x:TypeArguments="x:Int32">[int_Counter]</OutArgument>');
    expect(xml).toContain('<InArgument x:TypeArguments="x:Int32">0</InArgument>');
  });

  it("InvokeWorkflowFile produces exact invocation structure", () => {
    const xml = gen_invoke_workflow_file({ displayName: "Invoke Process", workflowFileName: "Process.xaml" });
    expect(xml).toContain('WorkflowFileName="Process.xaml"');
    expect(xml).not.toContain("[");
    expect(xml).not.toContain("&quot;");
  });

  it("GetCredential produces proper OutArgument bindings", () => {
    const xml = gen_get_credential({ displayName: "Get SAP Creds", assetName: "SAP_Credential", username: "str_User", password: "sec_Pass" });
    expect(xml).toContain('AssetName="SAP_Credential"');
    expect(xml).toContain('<OutArgument x:TypeArguments="x:String">[str_User]</OutArgument>');
    expect(xml).toContain("ui:GetCredential.Username");
    expect(xml).toContain("ui:GetCredential.Password");
  });

  it("HttpClient produces proper method and output structure", () => {
    const xml = gen_http_client({ displayName: "Call API", endpoint: "https://api.example.com", method: "POST", outputVar: "str_Response" });
    expect(xml).toContain('<ui:HttpClient');
    expect(xml).toContain('Method="POST"');
    expect(xml).toContain('EndPoint="https://api.example.com"');
    expect(xml).toContain('[str_Response]');
    expect(xml).toContain('ui:HttpClient.ResponseContent');
  });

  it("TryCatch produces Studio-compatible catch structure", () => {
    const tryBody = '<ui:LogMessage Level="Info" Message="try" DisplayName="Try" />';
    const xml = gen_try_catch({ displayName: "Safe Op", catchVariableName: "ex" }, tryBody);
    expect(xml).toContain('<TryCatch DisplayName="Safe Op">');
    expect(xml).toContain("<TryCatch.Try>");
    expect(xml).toContain("<TryCatch.Catches>");
    expect(xml).toContain('x:TypeArguments="s:Exception"');
    expect(xml).toContain('<DelegateInArgument x:TypeArguments="s:Exception" Name="ex"');
    expect(xml).toContain(tryBody);
  });

  it("ForEach produces correct type arguments and iterator binding", () => {
    const body = '<ui:LogMessage Level="Info" Message="[item]" DisplayName="Log" />';
    const xml = gen_for_each({ displayName: "Loop", itemType: "x:String", valuesExpression: "[arr_Items]", iteratorName: "item" }, body);
    expect(xml).toContain('x:TypeArguments="x:String"');
    expect(xml).toContain('<DelegateInArgument x:TypeArguments="x:String" Name="item"');
    expect(xml).toContain(body);
  });

  it("While produces proper condition and body", () => {
    const body = '<ui:LogMessage Level="Trace" Message="loop" DisplayName="Log" />';
    const xml = gen_while({ displayName: "Retry Loop", condition: "[int_Count &lt; 10]" }, body);
    expect(xml).toContain('Condition=');
    expect(xml).toContain('DisplayName="Retry Loop"');
    expect(xml).toContain(body);
    expect(xml).toContain('<Sequence DisplayName="While Body">');
  });

  it("If produces Then and optional Else branches", () => {
    const thenBody = '<ui:LogMessage Level="Info" Message="yes" DisplayName="Yes" />';
    const elseBody = '<ui:LogMessage Level="Info" Message="no" DisplayName="No" />';
    const xml = gen_if({ displayName: "Check", condition: "[bool_Flag]" }, thenBody, elseBody);
    expect(xml).toContain('<If Condition="[bool_Flag]"');
    expect(xml).toContain('<If.Then>');
    expect(xml).toContain('<If.Else>');
    expect(xml).toContain(thenBody);
    expect(xml).toContain(elseBody);
  });
});

describe("Namespace completeness for deterministic generators", () => {
  const DECLARED_PREFIXES = new Set([
    "ui", "uix", "ucs", "udb", "umail", "updf", "upers", "uweb",
    "x", "s", "ss", "scg", "scg2", "sco", "sap", "sap2010", "mc", "mva", "sd",
  ]);

  const generatorTests: Array<{ name: string; fn: () => string }> = [
    { name: "gen_nclick", fn: () => gen_nclick({ displayName: "T", selector: "s" }) },
    { name: "gen_ntype_into", fn: () => gen_ntype_into({ displayName: "T", text: "x", selector: "s" }) },
    { name: "gen_log_message", fn: () => gen_log_message({ displayName: "T", level: "Info", message: "m" }) },
    { name: "gen_http_client", fn: () => gen_http_client({ displayName: "T", endpoint: "http://e" }) },
    { name: "gen_deserialize_json", fn: () => gen_deserialize_json({ displayName: "T" }) },
    { name: "gen_serialize_json", fn: () => gen_serialize_json({ displayName: "T" }) },
    { name: "gen_invoke_workflow_file", fn: () => gen_invoke_workflow_file({ displayName: "T", workflowFileName: "f" }) },
    { name: "gen_get_credential", fn: () => gen_get_credential({ displayName: "T", assetName: "a" }) },
    { name: "gen_get_asset", fn: () => gen_get_asset({ displayName: "T", assetName: "a" }) },
    { name: "gen_add_queue_item", fn: () => gen_add_queue_item({ displayName: "T", queueName: "q" }) },
    { name: "gen_assign", fn: () => gen_assign({ displayName: "T", toVariable: "v", valueExpression: "1" }) },
    { name: "gen_execute_query", fn: () => gen_execute_query({ displayName: "T", sql: "SELECT 1" }) },
    { name: "gen_build_data_table", fn: () => gen_build_data_table({ displayName: "T" }) },
    { name: "gen_read_pdf_text", fn: () => gen_read_pdf_text({ displayName: "T", fileName: "f" }) },
    { name: "gen_send_smtp_mail", fn: () => gen_send_smtp_mail({ displayName: "T", to: "a@b", subject: "s", body: "b" }) },
    { name: "gen_create_form_task", fn: () => gen_create_form_task({ displayName: "T", taskTitle: "t" }) },
  ];

  for (const { name, fn } of generatorTests) {
    it(`${name} uses only declared namespace prefixes`, () => {
      const xml = fn();
      const prefixMatches = xml.matchAll(/<([a-zA-Z][a-zA-Z0-9]*):(?=[A-Z])/g);
      for (const match of prefixMatches) {
        const prefix = match[1];
        expect(DECLARED_PREFIXES.has(prefix)).toBe(true);
      }
    });
  }
});

describe("Integration: assembleWorkflowFromSpec with deterministic dispatch", () => {

  it("dispatches LogMessage through deterministic generator", () => {
    const spec = {
      name: "DetGenTest",
      variables: [],
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main",
        children: [
          {
            kind: "activity" as const,
            template: "LogMessage",
            displayName: "Log Start",
            properties: { Level: "Info", Message: '"Process started"' },
            errorHandling: "none" as const,
          },
        ],
      },
    };
    const result = assembleWorkflowFromSpec(spec);
    expect(result.xaml).toContain('<ui:LogMessage');
    expect(result.xaml).toContain('Level="Info"');
    expect(result.xaml).toContain("Process started");
    expect(result.xaml).toContain("System.Private.CoreLib");
    expect(result.xaml).not.toContain("mscorlib");
  });

  it("dispatches GetAsset through deterministic generator with outputVar", () => {
    const spec = {
      name: "GetAssetTest",
      variables: [],
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main",
        children: [
          {
            kind: "activity" as const,
            template: "GetAsset",
            displayName: "Get Config",
            properties: { AssetName: "ConfigPath" },
            outputVar: "str_Path",
            errorHandling: "none" as const,
          },
        ],
      },
    };
    const result = assembleWorkflowFromSpec(spec);
    expect(result.xaml).toContain("<ui:GetAsset");
    expect(result.xaml).toContain("[str_Path]");
    expect(result.xaml).toContain("AssetValue");
  });

  it("dispatches InvokeWorkflowFile deterministically with structured arguments", () => {
    const spec = {
      name: "InvokeArgsTest",
      variables: [],
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main",
        children: [
          {
            kind: "activity" as const,
            template: "InvokeWorkflowFile",
            displayName: "Invoke Process",
            properties: {
              WorkflowFileName: "Process.xaml",
              Arguments: {
                in_TransactionItem: { direction: "InArgument", type: "ui:QueueItem", value: "[in_TransactionItem]" },
              },
            },
            errorHandling: "none" as const,
          },
        ],
      },
    };
    const result = assembleWorkflowFromSpec(spec);
    expect(result.xaml).toContain("InvokeWorkflowFile");
    expect(result.xaml).toContain("Process.xaml");
    expect(result.xaml).not.toContain("[object Object]");
    expect(result.xaml).toContain("InvokeWorkflowFile.Arguments");
    expect(result.xaml).toContain("in_TransactionItem");
  });

  it("dispatches InvokeWorkflowFile without arguments", () => {
    const spec = {
      name: "InvokeNoArgsTest",
      variables: [],
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main",
        children: [
          {
            kind: "activity" as const,
            template: "InvokeWorkflowFile",
            displayName: "Invoke Simple",
            properties: { WorkflowFileName: "Simple.xaml" },
            errorHandling: "none" as const,
          },
        ],
      },
    };
    const result = assembleWorkflowFromSpec(spec);
    expect(result.xaml).toContain("InvokeWorkflowFile");
    expect(result.xaml).toContain("Simple.xaml");
    expect(result.xaml).not.toContain("[object Object]");
  });

  it("falls back to legacy template for Assign (requires type inference)", () => {
    const spec = {
      name: "AssignDetTest",
      variables: [{ name: "str_Val", type: "String" }],
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main",
        children: [
          {
            kind: "activity" as const,
            template: "Assign",
            displayName: "Set Val",
            properties: { To: "str_Val", Value: '"hello"' },
            errorHandling: "none" as const,
          },
        ],
      },
    };
    const result = assembleWorkflowFromSpec(spec);
    expect(result.xaml).toContain("str_Val");
    expect(result.xaml).toContain("Assign");
    expect(result.xaml).not.toContain("[object Object]");
  });

  it("resolves ValueIntent objects in deterministic dispatch", () => {
    const spec = {
      name: "ValueIntentTest",
      variables: [{ name: "str_Name", type: "String" }],
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main",
        children: [
          {
            kind: "activity" as const,
            template: "LogMessage",
            displayName: "Log Name",
            properties: {
              Level: { type: "literal" as const, value: "Info" },
              Message: { type: "variable" as const, name: "str_Name" },
            },
            errorHandling: "none" as const,
          },
        ],
      },
    };
    const result = assembleWorkflowFromSpec(spec);
    expect(result.xaml).toContain("<ui:LogMessage");
    expect(result.xaml).toContain("[str_Name]");
    expect(result.xaml).not.toContain("[object Object]");
    expect(result.xaml).not.toContain('"type"');
  });

  it("resolves legacy Click alias to Modern NClick through dispatch", () => {
    const spec = {
      name: "LegacyAliasTest",
      variables: [],
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main",
        children: [
          {
            kind: "activity" as const,
            template: "Click",
            displayName: "Click Button",
            properties: { selector: '<html tag="BUTTON" />' },
            errorHandling: "none" as const,
          },
        ],
      },
    };
    const result = assembleWorkflowFromSpec(spec);
    expect(result.xaml).toContain("<ui:NClick");
    expect(result.xaml).not.toContain("<ui:Click");
  });

  it("emits all activity-package xmlns declarations in workflow headers", () => {
    const spec = {
      name: "XmlnsHeaderTest",
      variables: [],
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main",
        children: [
          {
            kind: "activity" as const,
            template: "LogMessage",
            displayName: "Log",
            properties: { Level: "Info", Message: '"test"' },
            errorHandling: "none" as const,
          },
        ],
      },
    };
    const result = assembleWorkflowFromSpec(spec);
    expect(result.xaml).toContain('xmlns:ucs=');
    expect(result.xaml).toContain('xmlns:udb=');
    expect(result.xaml).toContain('xmlns:umail=');
    expect(result.xaml).toContain('xmlns:updf=');
    expect(result.xaml).toContain('xmlns:upers=');
    expect(result.xaml).toContain('xmlns:uweb=');
    expect(result.xaml).toContain('xmlns:ss=');
    expect(result.xaml).toContain('xmlns:uix=');
  });

  it("emits .NET 6 namespace declarations in generated XAML", () => {
    const spec = {
      name: "NamespaceTest",
      variables: [],
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main",
        children: [
          {
            kind: "activity" as const,
            template: "LogMessage",
            displayName: "Log",
            properties: { Level: "Info", Message: '"test"' },
            errorHandling: "none" as const,
          },
        ],
      },
    };
    const result = assembleWorkflowFromSpec(spec);
    expect(result.xaml).toContain('assembly=System.Private.CoreLib');
    expect(result.xaml).not.toContain('assembly=mscorlib');
    expect(result.xaml).toContain('xmlns:uix=');
  });
});
