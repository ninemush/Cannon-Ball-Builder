import { describe, it, expect } from "vitest";
import { selectSystemActivity } from "../deterministic-scaffold";

describe("selectSystemActivity – existing matchers (unchanged)", () => {
  it("matches API/REST systems", () => {
    const result = selectSystemActivity("REST API", "");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("HttpClient");
  });

  it("matches Excel systems", () => {
    const result = selectSystemActivity("Excel", "");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("ExcelApplicationScope");
  });

  it("matches Email/Outlook systems", () => {
    const result = selectSystemActivity("Outlook", "");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("SendOutlookMailMessage");
  });

  it("matches SAP systems", () => {
    const result = selectSystemActivity("SAP ECC", "");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("TypeInto");
  });

  it("matches Browser/Web systems", () => {
    const result = selectSystemActivity("Chrome Browser", "");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("OpenBrowser");
  });

  it("matches Database/SQL systems", () => {
    const result = selectSystemActivity("SQL Server Database", "");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("ExecuteQuery");
  });

  it("matches click/type descriptions", () => {
    const result = selectSystemActivity("", "click the submit button");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("TypeInto");
  });

  it("matches download/export descriptions", () => {
    const result = selectSystemActivity("", "download the report");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("MoveFile");
  });

  it("matches Orchestrator queue – add", () => {
    const result = selectSystemActivity("Orchestrator", "add item");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("AddQueueItem");
  });

  it("matches Orchestrator queue – get transaction", () => {
    const result = selectSystemActivity("Queue", "get transaction item");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("GetTransactionItem");
  });
});

describe("selectSystemActivity – ServiceNow", () => {
  it("matches system keyword 'ServiceNow'", () => {
    const result = selectSystemActivity("ServiceNow", "create incident");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("HttpClient");
    expect(result!.displayName).toContain("ServiceNow");
    expect(result!.properties.Endpoint).toContain("service-now.com");
  });

  it("matches system keyword 'SNOW'", () => {
    const result = selectSystemActivity("SNOW", "update record");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("HttpClient");
    expect(result!.displayName).toContain("ServiceNow");
  });

  it("matches description keyword 'incident ticket'", () => {
    const result = selectSystemActivity("IT System", "create incident ticket");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("HttpClient");
    expect(result!.displayName).toContain("ServiceNow");
  });

  it("matches description keyword 'snow record'", () => {
    const result = selectSystemActivity("System", "update snow record");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("HttpClient");
    expect(result!.displayName).toContain("ServiceNow");
  });
});

describe("selectSystemActivity – Salesforce", () => {
  it("matches system keyword 'Salesforce'", () => {
    const result = selectSystemActivity("Salesforce", "query contacts");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("HttpClient");
    expect(result!.displayName).toContain("Salesforce");
    expect(result!.properties.Endpoint).toContain("salesforce.com");
  });

  it("matches system keyword 'SFDC'", () => {
    const result = selectSystemActivity("SFDC CRM", "update lead");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("HttpClient");
    expect(result!.displayName).toContain("Salesforce");
  });

  it("matches description keyword 'sfdc'", () => {
    const result = selectSystemActivity("CRM", "push data to sfdc");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("HttpClient");
    expect(result!.displayName).toContain("Salesforce");
  });
});

describe("selectSystemActivity – Workday", () => {
  it("matches system keyword 'Workday'", () => {
    const result = selectSystemActivity("Workday", "fetch employee data");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("HttpClient");
    expect(result!.displayName).toContain("Workday");
    expect(result!.properties.Endpoint).toContain("workday.com");
  });

  it("matches description keyword 'hcm system'", () => {
    const result = selectSystemActivity("HR System", "update hcm system records");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("HttpClient");
    expect(result!.displayName).toContain("Workday");
  });
});

describe("selectSystemActivity – Coupa / ERP / Procurement", () => {
  it("matches system keyword 'Coupa'", () => {
    const result = selectSystemActivity("Coupa", "create purchase order");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("HttpClient");
    expect(result!.displayName).toContain("ERP/Procurement");
    expect(result!.properties.Endpoint).toContain("coupahost.com");
  });

  it("matches system keyword 'ERP'", () => {
    const result = selectSystemActivity("ERP System", "update vendor");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("HttpClient");
    expect(result!.displayName).toContain("ERP/Procurement");
  });

  it("matches description keyword 'procurement'", () => {
    const result = selectSystemActivity("Finance System", "run procurement workflow");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("HttpClient");
    expect(result!.displayName).toContain("ERP/Procurement");
  });

  it("matches description keyword 'purchase order'", () => {
    const result = selectSystemActivity("System", "create purchase order");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("HttpClient");
    expect(result!.displayName).toContain("ERP/Procurement");
  });
});

describe("selectSystemActivity – PDF processing", () => {
  it("matches system keyword 'PDF'", () => {
    const result = selectSystemActivity("PDF Processor", "process documents");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("ReadPdfText");
    expect(result!.displayName).toContain("PDF");
    expect(result!.properties.FileName).toContain(".pdf");
  });

  it("matches description keyword 'read pdf'", () => {
    const result = selectSystemActivity("Document System", "read pdf and gather data");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("ReadPdfText");
  });

  it("matches description keyword 'extract pdf'", () => {
    const result = selectSystemActivity("System", "extract pdf content");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("ReadPdfText");
  });
});

describe("selectSystemActivity – OCR / Document Understanding", () => {
  it("matches system keyword 'OCR'", () => {
    const result = selectSystemActivity("OCR Engine", "process invoice");
    expect(result).not.toBeNull();
    expect(result!.displayName).toContain("Document Understanding");
  });

  it("matches system keyword 'Document Understanding'", () => {
    const result = selectSystemActivity("Document Understanding", "process invoice");
    expect(result).not.toBeNull();
    expect(result!.displayName).toContain("Document Understanding");
  });

  it("matches description keyword 'digitize'", () => {
    const result = selectSystemActivity("System", "digitize scanned document");
    expect(result).not.toBeNull();
    expect(result!.displayName).toContain("Document Understanding");
  });

  it("matches description keyword 'classify document'", () => {
    const result = selectSystemActivity("System", "classify document for processing");
    expect(result).not.toBeNull();
    expect(result!.displayName).toContain("Document Understanding");
  });

  it("matches description keyword 'extract data from document'", () => {
    const result = selectSystemActivity("System", "extract data from document fields");
    expect(result).not.toBeNull();
    expect(result!.displayName).toContain("Document Understanding");
  });

  it("matches combined keyword 'intelligent ocr'", () => {
    const result = selectSystemActivity("System", "use intelligent ocr to read");
    expect(result).not.toBeNull();
    expect(result!.displayName).toContain("Document Understanding");
  });
});

describe("selectSystemActivity – Orchestrator queue operations", () => {
  it("matches system keyword 'Queue' and defaults to GetTransactionItem", () => {
    const result = selectSystemActivity("Queue", "process items");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("GetTransactionItem");
    expect(result!.properties.QueueName).toBeDefined();
  });

  it("matches system keyword 'Orchestrator' and returns AddQueueItem for 'add'", () => {
    const result = selectSystemActivity("Orchestrator", "add work item");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("AddQueueItem");
  });

  it("matches description 'queue item' with create", () => {
    const result = selectSystemActivity("System", "create queue item for processing");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("AddQueueItem");
  });

  it("matches description 'transaction item'", () => {
    const result = selectSystemActivity("System", "get transaction item from queue");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("GetTransactionItem");
  });
});

describe("selectSystemActivity – Desktop / Citrix application interaction", () => {
  it("matches system keyword 'Desktop'", () => {
    const result = selectSystemActivity("Desktop App", "launch application");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("UseApplication");
    expect(result!.displayName).toContain("Desktop App");
    expect(result!.properties.Selector).toBeDefined();
  });

  it("matches system keyword 'Citrix'", () => {
    const result = selectSystemActivity("Citrix Environment", "process records");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("UseApplication");
  });

  it("matches system keyword 'Mainframe'", () => {
    const result = selectSystemActivity("Mainframe", "navigate screens");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("UseApplication");
  });

  it("matches system keyword 'Terminal'", () => {
    const result = selectSystemActivity("Terminal Emulator", "navigate screens");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("UseApplication");
  });

  it("matches description keyword 'citrix'", () => {
    const result = selectSystemActivity("Remote System", "connect via citrix and process");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("UseApplication");
  });

  it("matches description keyword 'desktop app'", () => {
    const result = selectSystemActivity("System", "launch desktop app and process records");
    expect(result).not.toBeNull();
    expect(result!.template).toBe("UseApplication");
  });
});

describe("selectSystemActivity – returns null for unknown systems", () => {
  it("returns null for completely unrecognized system and description", () => {
    const result = selectSystemActivity("Unknown System XYZ", "do something");
    expect(result).toBeNull();
  });
});
