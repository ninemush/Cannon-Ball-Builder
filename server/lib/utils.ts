import crypto from "crypto";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function computePackageFingerprint(
  pkg: { projectName?: string; description?: string; workflows?: any[]; dependencies?: any[] },
  sddContent: string,
  processNodes: any[],
  processEdges: any[],
  orchestratorArtifacts: any,
  aliasMap?: Record<string, string>
): string {
  const payload = JSON.stringify({
    p: pkg.projectName || "",
    d: pkg.description || "",
    w: pkg.workflows || [],
    dep: pkg.dependencies || [],
    sdd: crypto.createHash("md5").update(sddContent || "").digest("hex"),
    n: processNodes
      .map((n: any) => ({ id: n.id, name: n.name, nodeType: n.nodeType || n.type, description: n.description, role: n.role, system: n.system, isPainPoint: n.isPainPoint, orderIndex: n.orderIndex }))
      .sort((a: any, b: any) => a.id - b.id),
    e: processEdges
      .map((e: any) => ({ s: e.sourceNodeId, t: e.targetNodeId, label: e.label }))
      .sort((a: any, b: any) => a.s - b.s || a.t - b.t),
    a: orchestratorArtifacts || null,
    aliasMap: aliasMap || null,
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}
