// CannonBall — Codepath Sequence Diagram renderer.
// Produces codebase-flow-map.svg + .png (high-DPI) + .pdf
// Run: node docs/architecture/render-flow-map.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import PDFDocument from "pdfkit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ───────────────────────────────────────────── Lifelines
const LIFELINES = [
  { id: "User",  label: "User",                                       sub: "" },
  { id: "UI",    label: "Workspace UI",                               sub: "workspace.tsx · ProcessMapPanel · ArtifactHub · Chat" },
  { id: "Chat",  label: "POST /api/chat (SSE)",                       sub: "server/replit_integrations/chat/routes.ts" },
  { id: "PM",    label: "Process-map / UiPath routes",                sub: "process-map-routes.ts · uipath-routes.ts" },
  { id: "RM",    label: "Run Manager",                                sub: "uipath-run-manager.ts · executeRun + sseListeners" },
  { id: "PIPE",  label: "Build Pipeline",                             sub: "uipath-pipeline.ts · runBuildPipeline → 9 stages" },
  { id: "LLM",   label: "LLM Service",                                sub: "server/lib/llm.ts · Claude / OpenAI / Gemini" },
  { id: "DB",    label: "Storage",                                    sub: "document-storage · process-map-storage · chat/storage · runs" },
  { id: "DEP",   label: "Deploy / Provisioner",                       sub: "orchestrator/artifact-provisioner.ts + uipath-auth.ts" },
  { id: "ORCH",  label: "UiPath Orchestrator",                        sub: "external · OData · Identity · Jobs" },
];

const LANE_W   = 240;
const LANE_GAP = 0;
const HEAD_H   = 96;
const TOP      = 110;
const ROW_H    = 32;

const W = LANE_W * LIFELINES.length + 80; // 2480
let totalRows = 0; // recomputed after building rows

// ───────────────────────────────────────────── Traces
// Each row is one of:
//   { kind: "msg",  from, to, text, style: "solid"|"dashed"|"return"|"sse" }
//   { kind: "self", on, text }
//   { kind: "note", from, to, text, color }
//   { kind: "group",label, color, children:[rows] }   (rendered as colored block)
//   { kind: "loop", label, children:[rows] }
//   { kind: "alt",  label, branches:[{label, rows}] }
//   { kind: "gap",  h }

function msg(from, to, text, style = "solid") { return { kind: "msg", from, to, text, style }; }
function self(on, text) { return { kind: "self", on, text }; }
function note(from, to, text, color = "#fef9c3") { return { kind: "note", from, to, text, color }; }

const TRACE_A = {
  kind: "group",
  label: "TRACE A — Chat-driven build & deploy",
  color: "#eff6ff",
  border: "#93c5fd",
  children: [
    msg("User", "UI",   "types message, clicks Send"),
    msg("UI",   "Chat", "handleSubmit() → fetch POST /api/chat  { ideaId, message, attachments }"),
    msg("Chat", "DB",   "chatStorage.createMessage(user)"),
    msg("Chat", "LLM",  "classifyIntentWithLLM(message, history)"),
    msg("LLM",  "Chat", "{ intent: PDD | SDD | PROCESS_MAP | UIPATH_GEN | DEPLOY | CHAT }", "return"),
    msg("Chat", "UI",   "SSE  intentClassified + liveStatus", "sse"),
    {
      kind: "alt",
      label: "branch on intent",
      branches: [
        {
          label: "intent ∈ { PDD, SDD, PROCESS_MAP }  →  document generation",
          rows: [
            msg("Chat", "LLM", "generateDocumentStreaming(prompt)"),
            msg("LLM",  "Chat", "streamed tokens", "return"),
            msg("Chat", "DB",   "documentStorage.createDocument(...)"),
            msg("Chat", "UI",   "SSE  token + docTrigger", "sse"),
          ],
        },
        {
          label: "intent = UIPATH_GEN  →  trigger build pipeline",
          rows: [
            msg("Chat", "UI", "SSE  triggerUiPathGen", "sse"),
            msg("UI",   "PM", "startUiPathGeneration() → POST /api/ideas/:id/uipath-runs"),
            msg("PM",   "RM", "executeRun(ideaId, runId)"),
            msg("RM",   "PIPE", "runBuildPipeline(spec, pipelineProgressCallback)"),
            self("PIPE", "1 · classifyComplexity()              [LLM]"),
            self("PIPE", "2 · generateDecomposedSpec()          [LLM]"),
            self("PIPE", "3 · runAiEnrichment()                 [LLM]"),
            self("PIPE", "4 · generateXamlFromSpec()            [deterministic]"),
            self("PIPE", "5 · analyzeAndFix() — workflow-analyzer.ts"),
            self("PIPE", "6 · runMetaValidation() — repair ladder [LLM]"),
            self("PIPE", "7 · generateDhg()"),
            self("PIPE", "8 · buildNuGetPackage() — uipath-cli pack"),
            msg("PIPE", "RM", "{ nupkgBuffer, dhg, traceability }", "return"),
            {
              kind: "loop",
              label: "for every stage",
              children: [
                msg("PIPE", "RM", "pipelineProgressCallback(stageEvent)", "dashed"),
                msg("RM",   "UI", "SSE stage event via /api/ideas/:id/uipath-runs/:runId/stream", "sse"),
                self("UI",  "UiPathProgressPanel renders live status"),
              ],
            },
            msg("RM",   "DB", "persist run + artifacts (storage.uipathRuns)"),
          ],
        },
        {
          label: "intent = DEPLOY  →  ask for confirmation",
          rows: [
            msg("Chat", "UI", "SSE  deployStatus → user confirms in ArtifactHub", "sse"),
          ],
        },
      ],
    },
  ],
};

const TRACE_B = {
  kind: "group",
  label: "TRACE B — Process-map approval auto-trigger (To-Be approved)",
  color: "#f0fdf4",
  border: "#86efac",
  children: [
    msg("User", "UI", "clicks  \"Approve To-Be\"  in ProcessMapPanel"),
    msg("UI",   "PM", "useMutation → POST /api/ideas/:id/process-map/approve"),
    msg("PM",   "DB", "processMapStorage.approve(ideaId)"),
    self("PM",  "evaluateTransition(ideaId)  +  cascadeInvalidateAndTransition()"),
    msg("PM",   "UI", "SSE  stageChange  (idea moves to Build)", "sse"),
    note("PM", "RM", "If gating allows, this handler enqueues a UIPATH_GEN run\n→ continues at TRACE A · step 14 (executeRun → runBuildPipeline)", "#fef3c7"),
  ],
};

const TRACE_C = {
  kind: "group",
  label: "TRACE C — Direct deploy from Artifact Hub",
  color: "#fef2f2",
  border: "#fca5a5",
  children: [
    msg("User", "UI",  "clicks  \"Deploy\"  on a generated .nupkg"),
    msg("UI",   "PM",  "POST /api/uipath/deploy  { runId, folderId, releaseName }"),
    msg("PM",   "DEP", "deployAllArtifacts(runId, target)"),
    self("DEP", "getAccessToken() — uipath-auth.ts"),
    msg("DEP",  "ORCH", "provisionQueues / provisionAssets   (POST /odata/...)"),
    msg("DEP",  "ORCH", "uploadPackage(.nupkg → Orchestrator Storage Bucket)"),
    msg("DEP",  "ORCH", "createOrUpdateRelease(folder, packageVersion)"),
    msg("DEP",  "ORCH", "startJob(release, robot)"),
    msg("ORCH", "DEP",  "{ jobId, status }", "return"),
    msg("DEP",  "PM",   "{ releaseKey, jobId }", "return"),
    msg("PM",   "UI",   "200 OK → ArtifactHub shows \"Deployed\"", "return"),
  ],
};

const TRACES = [TRACE_A, TRACE_B, TRACE_C];

// ───────────────────────────────────────────── Layout pass
// Walk traces, assign each row a y-row index. Group/alt/loop rows add header & footer space.
const LIFE_X = {};
LIFELINES.forEach((l, i) => { LIFE_X[l.id] = 40 + LANE_W * i + LANE_W / 2; });

let y = 0;
const layout = []; // flat list of {y, render}

function pushRow(row, indent = 0, group = null) {
  if (row.kind === "group") {
    const startY = y;
    y += 14; // top padding inside group header
    const headerY = y;
    y += 26; // header label height
    const childrenStart = y;
    for (const c of row.children) pushRow(c, indent + 1, row);
    const endY = y + 10;
    layout.push({ kind: "group", x1: 20, x2: W - 20, y1: startY, y2: endY, headerY, label: row.label, color: row.color, border: row.border, render: "group" });
    y = endY + 10;
  } else if (row.kind === "alt") {
    const startY = y;
    y += 8;
    layout.push({ kind: "altHeader", y, label: `alt — ${row.label}`, indent });
    y += 22;
    row.branches.forEach((br, bi) => {
      layout.push({ kind: "altBranch", y, label: br.label, indent });
      y += 20;
      for (const r of br.rows) pushRow(r, indent + 1);
      if (bi < row.branches.length - 1) {
        layout.push({ kind: "altDivider", y, indent });
        y += 10;
      }
    });
    layout.push({ kind: "altEnd", y, indent });
    y += 8;
    layout[layout.findIndex(l => l.kind === "altHeader" && l.y === startY + 8)] = { kind: "altHeader", y: startY + 8, label: `alt — ${row.label}`, indent, endY: y };
  } else if (row.kind === "loop") {
    const startY = y;
    y += 6;
    layout.push({ kind: "loopHeader", y, label: `loop — ${row.label}`, indent });
    y += 22;
    for (const r of row.children) pushRow(r, indent + 1);
    const endY = y + 4;
    layout.push({ kind: "loopEnd", y: endY, indent, startY, endY });
    y = endY + 6;
  } else if (row.kind === "msg") {
    layout.push({ kind: "msg", y, ...row });
    y += ROW_H;
  } else if (row.kind === "self") {
    layout.push({ kind: "self", y, ...row });
    y += ROW_H;
  } else if (row.kind === "note") {
    const lines = row.text.split("\n").length;
    layout.push({ kind: "note", y, ...row, h: 24 + 14 * lines });
    y += 24 + 14 * lines + 8;
  }
}

for (const t of TRACES) pushRow(t);

const H = TOP + HEAD_H + y + 80;

// ───────────────────────────────────────────── SVG render
function escapeXml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const STYLE = {
  bg: "#ffffff",
  lifeline: "#94a3b8",
  lane: "#f8fafc",
  laneStroke: "#e2e8f0",
  text: "#0f172a",
  sub: "#475569",
  msgSolid: "#1e293b",
  msgDashed: "#64748b",
  msgReturn: "#0f766e",
  msgSse:    "#9333ea",
};

function renderSvg() {
  const out = [];
  out.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif" font-size="13">`);
  out.push(`<rect width="100%" height="100%" fill="${STYLE.bg}"/>`);

  // Title
  out.push(`<text x="${W/2}" y="40" text-anchor="middle" font-size="26" font-weight="700" fill="${STYLE.text}">CannonBall — Codepath Flow</text>`);
  out.push(`<text x="${W/2}" y="64" text-anchor="middle" font-size="14" fill="${STYLE.sub}">User input → routes → pipeline stages → Orchestrator deployment  ·  three real transactions traced step-by-step</text>`);
  out.push(`<text x="${W/2}" y="84" text-anchor="middle" font-size="11" fill="${STYLE.sub}">Source: docs/architecture/codebase-flow-map.mmd  ·  Re-render: node docs/architecture/render-flow-map.mjs</text>`);

  // Arrowheads
  out.push(`<defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${STYLE.msgSolid}"/>
    </marker>
    <marker id="arrDashed" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${STYLE.msgDashed}"/>
    </marker>
    <marker id="arrReturn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${STYLE.msgReturn}"/>
    </marker>
    <marker id="arrSse" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${STYLE.msgSse}"/>
    </marker>
  </defs>`);

  // Lifeline lanes (full-height bands)
  LIFELINES.forEach((l, i) => {
    const x = 40 + i * LANE_W;
    out.push(`<rect x="${x}" y="${TOP + HEAD_H}" width="${LANE_W}" height="${y + 30}" fill="${i % 2 === 0 ? STYLE.lane : "#ffffff"}" />`);
  });

  // Lifeline header boxes
  LIFELINES.forEach((l, i) => {
    const cx = LIFE_X[l.id];
    const x = 40 + i * LANE_W + 12;
    out.push(`<rect x="${x}" y="${TOP}" width="${LANE_W - 24}" height="${HEAD_H - 12}" rx="10" ry="10" fill="#0f172a" stroke="#0f172a"/>`);
    out.push(`<text x="${cx}" y="${TOP + 28}" text-anchor="middle" font-size="14" font-weight="700" fill="#f8fafc">${escapeXml(l.label)}</text>`);
    if (l.sub) {
      const subLines = wrapLines(l.sub, 32);
      subLines.slice(0, 3).forEach((ln, k) => {
        out.push(`<text x="${cx}" y="${TOP + 50 + k * 14}" text-anchor="middle" font-size="10.5" fill="#cbd5e1">${escapeXml(ln)}</text>`);
      });
    }
  });

  // Vertical lifelines
  LIFELINES.forEach((l) => {
    const cx = LIFE_X[l.id];
    out.push(`<line x1="${cx}" y1="${TOP + HEAD_H}" x2="${cx}" y2="${TOP + HEAD_H + y + 20}" stroke="${STYLE.lifeline}" stroke-width="1" stroke-dasharray="4,5"/>`);
  });

  const Y0 = TOP + HEAD_H;

  // Render layout items
  let stepNum = 0;
  for (const item of layout) {
    if (item.render === "group") {
      out.push(`<rect x="${item.x1}" y="${Y0 + item.y1}" width="${item.x2 - item.x1}" height="${item.y2 - item.y1}" rx="8" fill="${item.color}" stroke="${item.border}" stroke-width="1.5" opacity="0.55"/>`);
      out.push(`<rect x="${item.x1}" y="${Y0 + item.y1}" width="${item.x2 - item.x1}" height="28" rx="8" fill="${item.border}" opacity="0.85"/>`);
      out.push(`<text x="${item.x1 + 14}" y="${Y0 + item.y1 + 19}" font-size="13" font-weight="700" fill="#0f172a">${escapeXml(item.label)}</text>`);
      continue;
    }
    if (item.kind === "altHeader") {
      out.push(`<rect x="${LIFE_X.User - LANE_W/2 + 8}" y="${Y0 + item.y - 4}" width="${W - 80 - 16}" height="20" fill="#fde68a" opacity="0.55" rx="4"/>`);
      out.push(`<text x="${LIFE_X.User - LANE_W/2 + 18}" y="${Y0 + item.y + 11}" font-size="12" font-weight="700" fill="#78350f">${escapeXml(item.label)}</text>`);
      continue;
    }
    if (item.kind === "altBranch") {
      out.push(`<text x="${LIFE_X.User - LANE_W/2 + 22}" y="${Y0 + item.y + 14}" font-size="12" font-style="italic" fill="#854d0e">[ ${escapeXml(item.label)} ]</text>`);
      continue;
    }
    if (item.kind === "altDivider") {
      out.push(`<line x1="${60}" y1="${Y0 + item.y}" x2="${W - 40}" y2="${Y0 + item.y}" stroke="#fbbf24" stroke-width="1" stroke-dasharray="6,5"/>`);
      continue;
    }
    if (item.kind === "altEnd") continue;
    if (item.kind === "loopHeader") {
      out.push(`<rect x="${LIFE_X.PIPE - LANE_W/2 + 8}" y="${Y0 + item.y - 4}" width="${LANE_W * 2 - 16}" height="20" fill="#bae6fd" opacity="0.7" rx="4"/>`);
      out.push(`<text x="${LIFE_X.PIPE - LANE_W/2 + 18}" y="${Y0 + item.y + 11}" font-size="12" font-weight="700" fill="#075985">${escapeXml(item.label)}</text>`);
      continue;
    }
    if (item.kind === "loopEnd") continue;

    if (item.kind === "msg") {
      stepNum++;
      const x1 = LIFE_X[item.from];
      const x2 = LIFE_X[item.to];
      const yy = Y0 + item.y + 18;
      let stroke = STYLE.msgSolid, marker = "url(#arr)", dash = "";
      if (item.style === "dashed") { stroke = STYLE.msgDashed; marker = "url(#arrDashed)"; dash = "5,4"; }
      if (item.style === "return") { stroke = STYLE.msgReturn; marker = "url(#arrReturn)"; dash = "6,3"; }
      if (item.style === "sse")    { stroke = STYLE.msgSse;    marker = "url(#arrSse)";    dash = "2,3"; }
      out.push(`<line x1="${x1}" y1="${yy}" x2="${x2}" y2="${yy}" stroke="${stroke}" stroke-width="1.8" stroke-dasharray="${dash}" marker-end="${marker}"/>`);
      const midX = (x1 + x2) / 2;
      const text = `${stepNum}. ${item.text}`;
      const textW = text.length * 6.4 + 12;
      out.push(`<rect x="${midX - textW/2}" y="${yy - 18}" width="${textW}" height="16" rx="3" fill="#ffffff" opacity="0.92"/>`);
      out.push(`<text x="${midX}" y="${yy - 6}" text-anchor="middle" font-size="11.5" fill="${STYLE.text}">${escapeXml(text)}</text>`);
      continue;
    }

    if (item.kind === "self") {
      stepNum++;
      const cx = LIFE_X[item.on];
      const yy = Y0 + item.y + 6;
      const w = 28;
      out.push(`<path d="M ${cx} ${yy} h ${w} v 14 h -${w}" fill="none" stroke="${STYLE.msgSolid}" stroke-width="1.4" marker-end="url(#arr)"/>`);
      const text = `${stepNum}. ${item.text}`;
      out.push(`<text x="${cx + w + 8}" y="${yy + 12}" font-size="11.5" fill="${STYLE.text}">${escapeXml(text)}</text>`);
      continue;
    }

    if (item.kind === "note") {
      const x1 = Math.min(LIFE_X[item.from], LIFE_X[item.to]) - 30;
      const x2 = Math.max(LIFE_X[item.from], LIFE_X[item.to]) + 30;
      const yy = Y0 + item.y;
      const lines = item.text.split("\n");
      out.push(`<rect x="${x1}" y="${yy}" width="${x2 - x1}" height="${item.h - 4}" rx="4" fill="${item.color}" stroke="#a16207" stroke-width="1"/>`);
      lines.forEach((ln, k) => {
        out.push(`<text x="${(x1 + x2)/2}" y="${yy + 18 + k * 14}" text-anchor="middle" font-size="11.5" fill="#3f2d09">${escapeXml(ln)}</text>`);
      });
      continue;
    }
  }

  // Legend
  const lx = 40, ly = H - 70;
  out.push(`<rect x="${lx}" y="${ly}" width="${W - 80}" height="50" fill="#ffffff" stroke="#cbd5e1" rx="6"/>`);
  out.push(`<text x="${lx + 14}" y="${ly + 20}" font-size="13" font-weight="700" fill="${STYLE.text}">Arrow legend</text>`);
  const items = [
    ["solid",  "function call / HTTP request",            STYLE.msgSolid, ""],
    ["dashed", "internal callback / dataflow",            STYLE.msgDashed, "5,4"],
    ["return", "return value / response",                  STYLE.msgReturn, "6,3"],
    ["sse",    "Server-Sent Event back to UI",             STYLE.msgSse,    "2,3"],
  ];
  items.forEach((it, i) => {
    const xx = lx + 130 + i * 360;
    const yy = ly + 28;
    out.push(`<line x1="${xx}" y1="${yy}" x2="${xx + 60}" y2="${yy}" stroke="${it[2]}" stroke-width="1.8" stroke-dasharray="${it[3]}" marker-end="url(#arr)"/>`);
    out.push(`<text x="${xx + 70}" y="${yy + 4}" font-size="12" fill="${STYLE.text}">${escapeXml(it[1])}</text>`);
  });

  out.push(`</svg>`);
  return out.join("\n");
}

function wrapLines(text, maxChars) {
  const lines = [];
  for (const part of String(text).split("\n")) {
    let line = "";
    for (const w of part.split(" ")) {
      if ((line + " " + w).trim().length > maxChars) {
        lines.push(line);
        line = w;
      } else {
        line = (line ? line + " " : "") + w;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

const svg = renderSvg();
const svgPath = path.join(__dirname, "codebase-flow-map.svg");
fs.writeFileSync(svgPath, svg);
console.log("SVG written:", svgPath, "size", svg.length, "viewBox", W, "x", H);

const pngPath = path.join(__dirname, "codebase-flow-map.png");
const pdfPath = path.join(__dirname, "codebase-flow-map.pdf");

await sharp(Buffer.from(svg), { density: 200 })
  .resize({ width: W * 2 })
  .png({ compressionLevel: 9 })
  .toFile(pngPath);
console.log("PNG written:", pngPath);

await new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: [W, H], margin: 0, info: { Title: "CannonBall Codepath Flow" } });
  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);
  doc.image(pngPath, 0, 0, { width: W, height: H });
  doc.end();
  stream.on("finish", resolve);
  stream.on("error", reject);
});
console.log("PDF written:", pdfPath);
