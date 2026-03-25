import { classifyComplexity, estimateComplexityFromContext, WORKFLOW_BUDGET_BY_TIER, type ComplexityTier } from "../complexity-classifier";

describe("estimateComplexityFromContext", () => {
  it("classifies simple SDD content with no advanced features", () => {
    const sdd = "Read an Excel file, filter rows by status column, and write filtered results to a new Excel file.";
    const result = estimateComplexityFromContext(sdd);
    expect(result.tier).toBe("simple");
    expect(result.budget.min).toBe(2);
    expect(result.budget.max).toBe(3);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("classifies SDD with moderate signals as moderate", () => {
    const sdd = "Log into a web portal using Integration Service connector, scrape order data. Use a Queue named OrderQueue to process items. An Asset called EmailServer stores the SMTP connection. A Credential for portal login is required. Validate against an Excel master list and email a summary report.";
    const result = estimateComplexityFromContext(sdd);
    expect(["moderate", "complex"]).toContain(result.tier);
    expect(result.budget.min).toBeGreaterThanOrEqual(3);
  });

  it("classifies SDD with DU and Action Center as complex", () => {
    const sdd = "Process invoices using Document Understanding to classify and extract data. Route exceptions to Action Center for human review. Use a Queue for dispatcher/performer pattern.";
    const result = estimateComplexityFromContext(sdd);
    expect(result.tier).toBe("complex");
    expect(result.budget.min).toBe(5);
    expect(result.budget.max).toBe(8);
  });

  it("classifies with process nodes only (no SDD)", () => {
    const nodes = [
      { name: "Start", description: "", system: "", nodeType: "start" },
      { name: "Read File", description: "Read input", system: "Excel", nodeType: "action" },
      { name: "End", description: "", system: "", nodeType: "end" },
    ];
    const result = estimateComplexityFromContext(undefined, nodes);
    expect(result.tier).toBe("simple");
    expect(result.budget).toEqual(WORKFLOW_BUDGET_BY_TIER.simple);
  });

  it("classifies with SDD + process nodes combined signals", () => {
    const sdd = "Uses Integration Service connector for SAP.";
    const nodes = Array.from({ length: 18 }, (_, i) => ({
      name: `Step ${i}`,
      description: `Process step ${i}`,
      system: "SAP",
      nodeType: "action",
    }));
    const result = estimateComplexityFromContext(sdd, nodes);
    expect(["moderate", "complex"]).toContain(result.tier);
    expect(result.score).toBeGreaterThan(2);
  });

  it("classifies agentic processes as complex", () => {
    const sdd = "This process uses agentic capabilities with an agent-loop pattern for intelligent document routing. It leverages Action Center for human task review and uses a Queue for processing.";
    const result = estimateComplexityFromContext(sdd);
    expect(result.tier).toBe("complex");
  });

  it("returns budget matching the tier", () => {
    const simpleSdd = "Read a CSV and write to Excel.";
    const simpleResult = estimateComplexityFromContext(simpleSdd);
    expect(simpleResult.budget).toEqual(WORKFLOW_BUDGET_BY_TIER[simpleResult.tier]);

    const complexSdd = "Document Understanding classify document extract data. Action Center human task. Queue dispatcher performer. Agentic automation.";
    const complexResult = estimateComplexityFromContext(complexSdd);
    expect(complexResult.budget).toEqual(WORKFLOW_BUDGET_BY_TIER[complexResult.tier]);
  });
});

describe("WORKFLOW_BUDGET_BY_TIER", () => {
  it("has correct ranges for each tier", () => {
    expect(WORKFLOW_BUDGET_BY_TIER.simple).toEqual(expect.objectContaining({ min: 2, max: 3 }));
    expect(WORKFLOW_BUDGET_BY_TIER.moderate).toEqual(expect.objectContaining({ min: 3, max: 5 }));
    expect(WORKFLOW_BUDGET_BY_TIER.complex).toEqual(expect.objectContaining({ min: 5, max: 8 }));
  });

  it("each tier has guidance text", () => {
    for (const tier of ["simple", "moderate", "complex"] as const) {
      expect(WORKFLOW_BUDGET_BY_TIER[tier].guidance.length).toBeGreaterThan(0);
      expect(WORKFLOW_BUDGET_BY_TIER[tier].guidance).toContain("TryCatch");
      expect(WORKFLOW_BUDGET_BY_TIER[tier].guidance).toContain("inline");
    }
  });
});

describe("classifyComplexity", () => {
  const makeSpec = (workflows: Array<{ steps?: number; description?: string }> = []) => ({
    projectName: "Test",
    description: "",
    dependencies: [],
    workflows: workflows.map((w, i) => ({
      name: `Workflow${i}`,
      description: w.description || "",
      variables: [],
      steps: Array.from({ length: w.steps || 0 }, (_, j) => ({
        activity: `Step${j}`,
        activityType: "ui:Comment",
        activityPackage: "UiPath.System.Activities",
        properties: {},
        selectorHint: null,
        errorHandling: "none" as const,
        notes: "",
      })),
    })),
  });

  it("classifies a minimal process as simple", () => {
    const result = classifyComplexity(makeSpec([{ steps: 3 }]));
    expect(result.tier).toBe("simple");
    expect(result.streamlined).toBe(true);
    expect(result.score).toBeLessThanOrEqual(2);
  });

  it("classifies a process with 2 workflows and few steps as simple", () => {
    const result = classifyComplexity(makeSpec([{ steps: 4 }, { steps: 3 }]));
    expect(result.tier).toBe("simple");
    expect(result.streamlined).toBe(true);
  });

  it("classifies a process with many workflows as moderate or complex", () => {
    const result = classifyComplexity(makeSpec([
      { steps: 5 }, { steps: 5 }, { steps: 5 }, { steps: 5 },
    ]));
    expect(["moderate", "complex"]).toContain(result.tier);
    expect(result.streamlined).toBe(false);
  });

  it("classifies a process with advanced capabilities as moderate or complex", () => {
    const result = classifyComplexity(
      makeSpec([{ steps: 3 }]),
      "This process uses Document Understanding to classify documents and extract data from invoices.",
    );
    expect(["moderate", "complex"]).toContain(result.tier);
    expect(result.streamlined).toBe(false);
  });

  it("classifies agent-based processes as complex", () => {
    const nodes = [
      { name: "Agent Loop", description: "Agentic task handler", system: "AI", nodeType: "agent-loop" },
    ];
    const result = classifyComplexity(
      makeSpec([{ steps: 5 }, { steps: 5 }, { steps: 5 }]),
      "This process uses agentic capabilities for intelligent automation.",
      nodes,
    );
    expect(result.tier).toBe("complex");
    expect(result.streamlined).toBe(false);
  });

  it("detects orchestrator artifact signals from SDD text", () => {
    const sdd = "The process uses a Queue named InvoiceQueue. An Asset called EmailServer stores the connection. A Credential called SAP_Login is required.";
    const result = classifyComplexity(makeSpec([{ steps: 3 }]), sdd);
    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons.some(r => r.includes("orchestrator artifact"))).toBe(true);
  });

  it("simple tier with no SDD and few nodes", () => {
    const nodes = [
      { name: "Start", description: "", system: "", nodeType: "start" },
      { name: "Read Excel", description: "Read input file", system: "Excel", nodeType: "action" },
      { name: "End", description: "", system: "", nodeType: "end" },
    ];
    const result = classifyComplexity(makeSpec([{ steps: 2 }]), undefined, nodes);
    expect(result.tier).toBe("simple");
    expect(result.streamlined).toBe(true);
  });

  it("complex tier with many nodes and advanced activities", () => {
    const nodes = Array.from({ length: 20 }, (_, i) => ({
      name: `Step ${i}`,
      description: `Action Center human task for step ${i}`,
      system: "SAP",
      nodeType: "action",
    }));
    const result = classifyComplexity(
      makeSpec([{ steps: 10 }, { steps: 10 }, { steps: 10 }, { steps: 10 }, { steps: 10 }, { steps: 10 }]),
      "Uses Integration Service connector and Data Fabric data entity storage.",
      nodes,
    );
    expect(result.tier).toBe("complex");
    expect(result.streamlined).toBe(false);
  });

  it("returns reasons array explaining the classification", () => {
    const result = classifyComplexity(makeSpec([{ steps: 2 }]));
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons.some(r => r.includes("workflow count"))).toBe(true);
  });
});
