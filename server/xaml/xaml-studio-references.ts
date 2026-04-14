import type { TargetFramework } from "./xaml-compliance";

export type ExpressionLanguage = "VisualBasic" | "CSharp";

export function isCSharpLanguage(
  targetFramework: TargetFramework | undefined,
  expressionLanguage?: ExpressionLanguage,
): boolean {
  if (expressionLanguage === "CSharp") return true;
  if (expressionLanguage === "VisualBasic") return false;
  return targetFramework === "Portable";
}

export function getNamespacesForImplementation(
  targetFramework: TargetFramework | undefined,
  expressionLanguage?: ExpressionLanguage,
): string[] {
  const csharp = isCSharpLanguage(targetFramework, expressionLanguage);

  const namespaces = [
    "System",
    "System.Collections",
    "System.Collections.Generic",
    "System.Collections.ObjectModel",
    "System.Data",
    "System.Diagnostics",
    "System.Drawing",
    "System.IO",
    "System.Linq",
    "System.Net.Mail",
    "System.Windows.Markup",
    "System.Xml",
    "System.Xml.Linq",
    "UiPath.Core",
    "UiPath.Core.Activities",
    "System.Activities",
    "System.Activities.Statements",
    "System.Activities.Expressions",
    "System.Activities.Validation",
    "System.Activities.XamlIntegration",
    "System.ComponentModel",
    "GlobalVariablesNamespace",
    "GlobalConstantsNamespace",
  ];

  if (!csharp) {
    namespaces.splice(
      namespaces.indexOf("UiPath.Core.Activities") + 1,
      0,
      "Microsoft.VisualBasic",
      "Microsoft.VisualBasic.Activities",
    );
  }

  if (csharp) {
    namespaces.push("System.Text");
  }

  return namespaces;
}

export function getAssemblyReferences(
  targetFramework: TargetFramework | undefined,
  expressionLanguage?: ExpressionLanguage,
): string[] {
  const csharp = isCSharpLanguage(targetFramework, expressionLanguage);
  const isWindows = targetFramework === "Windows";

  const assemblies = [
    "System.Activities",
    "System.Activities.Core.Presentation",
    "System.ComponentModel.Composition",
    "System.ComponentModel.TypeConverter",
    "System.Data",
    "System.Data.Common",
    "System.Data.DataSetExtensions",
    "System.Drawing",
    "System.Drawing.Common",
    "System.Drawing.Primitives",
    "System.Linq",
    "System.Net.Mail",
    "System.ObjectModel",
    "System.Private.CoreLib",
    "System",
    "System.Core",
    "System.Xml",
    "System.Xml.Linq",
    "System.Xaml",
    "System.ServiceModel",
    "mscorlib",
    "UiPath.Core",
    "UiPath.Core.Activities",
    "UiPath.System.Activities",
    "UiPath.UIAutomation.Activities",
  ];

  if (!csharp) {
    assemblies.splice(
      assemblies.indexOf("System.Activities.Core.Presentation") + 1,
      0,
      "Microsoft.VisualBasic",
    );
  }

  if (csharp) {
    assemblies.push(
      "Microsoft.CSharp",
      "System.Runtime.Serialization",
      "System.ServiceModel.Activities",
    );
  }

  if (isWindows) {
    assemblies.push(
      "PresentationCore",
      "PresentationFramework",
      "WindowsBase",
    );
  }

  return assemblies;
}

export function buildNamespacesXml(
  targetFramework: TargetFramework | undefined,
  expressionLanguage?: ExpressionLanguage,
): string {
  const namespaces = getNamespacesForImplementation(targetFramework, expressionLanguage);
  const items = namespaces.map(ns => `      <x:String>${ns}</x:String>`).join("\n");
  return `<TextExpression.NamespacesForImplementation>
    <sco:Collection x:TypeArguments="x:String">
${items}
    </sco:Collection>
  </TextExpression.NamespacesForImplementation>`;
}

export function buildAssemblyRefsXml(
  targetFramework: TargetFramework | undefined,
  expressionLanguage?: ExpressionLanguage,
): string {
  const assemblies = getAssemblyReferences(targetFramework, expressionLanguage);
  const items = assemblies.map(a => `      <AssemblyReference>${a}</AssemblyReference>`).join("\n");
  return `<TextExpression.ReferencesForImplementation>
    <sco:Collection x:TypeArguments="AssemblyReference">
${items}
    </sco:Collection>
  </TextExpression.ReferencesForImplementation>`;
}

export function buildTextExpressionBlocks(
  targetFramework: TargetFramework | undefined,
  expressionLanguage?: ExpressionLanguage,
): string {
  return `
  ${buildNamespacesXml(targetFramework, expressionLanguage)}
  ${buildAssemblyRefsXml(targetFramework, expressionLanguage)}`;
}

export function buildRootActivityAttr(
  targetFramework: TargetFramework | undefined,
  expressionLanguage?: ExpressionLanguage,
): string {
  const csharp = isCSharpLanguage(targetFramework, expressionLanguage);
  if (csharp) {
    return `\n  sap2010:ExpressionActivityEditor.ExpressionActivityEditor="C#"`;
  }
  return "";
}

export function buildRootActivityChildren(
  targetFramework: TargetFramework | undefined,
  expressionLanguage?: ExpressionLanguage,
): string {
  const csharp = isCSharpLanguage(targetFramework, expressionLanguage);
  if (!csharp) {
    return `  <mva:VisualBasic.Settings>
    <x:Null />
  </mva:VisualBasic.Settings>`;
  }
  return "";
}

export function buildComplianceActivityAttr(
  targetFramework: TargetFramework | undefined,
  expressionLanguage?: ExpressionLanguage,
): string {
  const csharp = isCSharpLanguage(targetFramework, expressionLanguage);
  if (csharp) {
    return ` sap2010:ExpressionActivityEditor.ExpressionActivityEditor="C#"`;
  }
  return "";
}

export function buildComplianceChildren(
  targetFramework: TargetFramework | undefined,
  rootId: string,
  expressionLanguage?: ExpressionLanguage,
): string {
  const csharp = isCSharpLanguage(targetFramework, expressionLanguage);
  const nsXml = buildNamespacesXml(targetFramework, expressionLanguage);
  const asmXml = buildAssemblyRefsXml(targetFramework, expressionLanguage);

  if (csharp) {
    return `
  <sap2010:WorkflowViewState.IdRef>${rootId}</sap2010:WorkflowViewState.IdRef>
  ${nsXml}
  ${asmXml}`;
  }

  return `
  <mva:VisualBasic.Settings>
    <x:Null />
  </mva:VisualBasic.Settings>
  <sap2010:WorkflowViewState.IdRef>${rootId}</sap2010:WorkflowViewState.IdRef>
  ${nsXml}
  ${asmXml}`;
}
