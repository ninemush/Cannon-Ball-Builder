import { execSync, exec } from "child_process";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";

export type UiPathProjectType = "CrossPlatform" | "Windows" | "WindowsLegacy";

export type CliPackageFlavor = "UiPath.CLI.Linux" | "UiPath.CLI.Windows" | "UiPath.CLI.Windows.Legacy";

export type RunnerPlatform = "linux" | "windows";

export type CliValidationMode =
  | "custom_validated_only"
  | "cli_validated"
  | "cli_skipped_incompatible_agent"
  | "cli_failed";

export interface CliAnalyzerDefect {
  ruleId: string;
  severity: "Error" | "Warning" | "Info";
  file: string;
  line?: number;
  message: string;
  rawOutput?: string;
}

export interface CliAnalyzeResult {
  success: boolean;
  defects: CliAnalyzerDefect[];
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface CliPackResult {
  success: boolean;
  outputPath?: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  errors: string[];
}

export interface CliCompatibilityResult {
  projectType: UiPathProjectType;
  requiredCliFlavor: CliPackageFlavor;
  requiredRunner: RunnerPlatform;
  currentRunner: RunnerPlatform;
  isCompatible: boolean;
  reason: string;
}

export interface CliValidationResult {
  mode: CliValidationMode;
  compatibility: CliCompatibilityResult;
  analyzeResult?: CliAnalyzeResult;
  packResult?: CliPackResult;
  dotnetAvailable: boolean;
  cliAvailable: boolean;
  durationMs: number;
}

export function detectCurrentRunner(): RunnerPlatform {
  return process.platform === "win32" ? "windows" : "linux";
}

export function detectProjectType(projectJsonContent: string): UiPathProjectType {
  try {
    const pj = JSON.parse(projectJsonContent);

    const targetFramework = pj.targetFramework;
    const studioVersion = pj.studioVersion;
    const designOptions = pj.designOptions;

    if (targetFramework === "Portable") {
      return "CrossPlatform";
    }

    if (targetFramework === "Windows") {
      if (designOptions?.modernBehavior === false) {
        return "WindowsLegacy";
      }
      return "Windows";
    }

    if (targetFramework === "Legacy" || targetFramework === "Framework") {
      return "WindowsLegacy";
    }

    if (studioVersion) {
      const majorMinor = studioVersion.split(".").slice(0, 2).map(Number);
      if (majorMinor[0] < 21 || (majorMinor[0] === 21 && majorMinor[1] < 10)) {
        return "WindowsLegacy";
      }
    }

    return "Windows";
  } catch {
    return "Windows";
  }
}

export function mapProjectToCliFlavor(projectType: UiPathProjectType, runner: RunnerPlatform): CliPackageFlavor {
  switch (projectType) {
    case "CrossPlatform":
      return runner === "windows" ? "UiPath.CLI.Windows" : "UiPath.CLI.Linux";
    case "Windows":
      return "UiPath.CLI.Windows";
    case "WindowsLegacy":
      return "UiPath.CLI.Windows.Legacy";
  }
}

export function checkCliCompatibility(projectJsonContent: string): CliCompatibilityResult {
  const projectType = detectProjectType(projectJsonContent);
  const currentRunner = detectCurrentRunner();
  const requiredCliFlavor = mapProjectToCliFlavor(projectType, currentRunner);

  const isCompatible =
    projectType === "CrossPlatform" ||
    (projectType === "Windows" && currentRunner === "windows") ||
    (projectType === "WindowsLegacy" && currentRunner === "windows");

  const requiredRunner: RunnerPlatform =
    projectType === "CrossPlatform" ? currentRunner :
    "windows";

  let reason: string;
  if (isCompatible) {
    reason = `Project type "${projectType}" is compatible with current ${currentRunner} runner using ${requiredCliFlavor}`;
  } else {
    reason = `Project type "${projectType}" requires ${requiredRunner} runner (${requiredCliFlavor}), but current runner is ${currentRunner}`;
  }

  return {
    projectType,
    requiredCliFlavor,
    requiredRunner,
    currentRunner,
    isCompatible,
    reason,
  };
}

export function checkDotnet8Available(): boolean {
  try {
    const output = execSync("dotnet --list-runtimes", {
      timeout: 10000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (/8\.\d+\.\d+/.test(output)) return true;
  } catch {}
  try {
    const output = execSync("dotnet --version", {
      timeout: 10000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return /^8\.\d+\.\d+/.test(output.trim());
  } catch {
    return false;
  }
}

export function checkCliToolAvailable(): boolean {
  try {
    const output = execSync("dotnet tool list -g", {
      timeout: 10000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return /uipath\.cli/i.test(output);
  } catch {
    return false;
  }
}

function getCliExecutable(): string | null {
  try {
    const output = execSync("dotnet tool list -g", {
      timeout: 10000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (/uipath\.cli/i.test(output)) {
      return "uipcli";
    }
  } catch {}

  const possiblePaths = [
    join(process.env.HOME || "~", ".dotnet", "tools", "uipcli"),
    "/usr/local/bin/uipcli",
    "/usr/bin/uipcli",
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) return p;
  }

  return null;
}

export function parseAnalyzerOutput(stdout: string, stderr: string): CliAnalyzerDefect[] {
  const defects: CliAnalyzerDefect[] = [];
  const combined = `${stdout}\n${stderr}`;

  const jsonMatch = combined.match(/\[[\s\S]*?\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          defects.push({
            ruleId: item.ErrorCode || item.RuleId || item.ruleId || "UNKNOWN",
            severity: normalizeSeverity(item.ErrorSeverity || item.Severity || item.severity || "Warning"),
            file: item.FilePath || item.File || item.file || "",
            line: item.Line || item.line,
            message: item.Description || item.Message || item.message || "",
            rawOutput: JSON.stringify(item),
          });
        }
        return defects;
      }
    } catch {}
  }

  const linePattern = /^(?:(?:Error|Warning|Info)\s*:?\s*)?(\S+)\s*:\s*(Error|Warning|Info)?\s*(.+?)(?:\s+in\s+(.+?)(?::(\d+))?)?$/gm;
  let match;
  while ((match = linePattern.exec(combined)) !== null) {
    defects.push({
      ruleId: match[1],
      severity: normalizeSeverity(match[2] || "Warning"),
      message: match[3].trim(),
      file: match[4] || "",
      line: match[5] ? parseInt(match[5], 10) : undefined,
    });
  }

  if (defects.length === 0) {
    const simplePattern = /^(ST-\w+-\d+|SA-\w+-\d+|UI-\w+-\d+)\s*[:\-]\s*(.*)/gm;
    while ((match = simplePattern.exec(combined)) !== null) {
      defects.push({
        ruleId: match[1],
        severity: "Warning",
        file: "",
        message: match[2].trim(),
      });
    }
  }

  return defects;
}

function normalizeSeverity(s: string): "Error" | "Warning" | "Info" {
  const lower = s.toLowerCase();
  if (lower === "error" || lower === "err") return "Error";
  if (lower === "info" || lower === "information" || lower === "informational") return "Info";
  return "Warning";
}

function writeProjectToTemp(
  projectJsonContent: string,
  xamlEntries: { name: string; content: string }[],
): string {
  const tempDir = mkdtempSync(join(tmpdir(), "uipath-cli-"));
  writeFileSync(join(tempDir, "project.json"), projectJsonContent, "utf-8");

  for (const entry of xamlEntries) {
    const filePath = join(tempDir, entry.name);
    const dir = dirname(filePath);
    if (dir !== tempDir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, entry.content, "utf-8");
  }

  return tempDir;
}

function cleanupTemp(tempDir: string): void {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
  }
}

const CLI_TIMEOUT_MS = 60000;

export async function runCliAnalyze(
  projectJsonContent: string,
  xamlEntries: { name: string; content: string }[],
): Promise<CliAnalyzeResult> {
  const startTime = Date.now();
  const cliExe = getCliExecutable();

  if (!cliExe) {
    return {
      success: false,
      defects: [],
      exitCode: -1,
      stdout: "",
      stderr: "UiPath CLI executable not found",
      durationMs: Date.now() - startTime,
    };
  }

  const tempDir = writeProjectToTemp(projectJsonContent, xamlEntries);

  try {
    const cmd = `${cliExe} package analyze "${tempDir}" --type workflow 2>&1`;

    return await new Promise<CliAnalyzeResult>((resolve) => {
      exec(cmd, { timeout: CLI_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        const exitCode = error ? (error && typeof error === "object" && "code" in error ? (error as { code: number }).code : 1) : 0;
        const defects = parseAnalyzerOutput(stdout || "", stderr || "");

        resolve({
          success: exitCode === 0,
          defects,
          exitCode,
          stdout: (stdout || "").substring(0, 10000),
          stderr: (stderr || "").substring(0, 10000),
          durationMs: Date.now() - startTime,
        });
      });
    });
  } finally {
    cleanupTemp(tempDir);
  }
}

export async function runCliPack(
  projectJsonContent: string,
  xamlEntries: { name: string; content: string }[],
): Promise<CliPackResult> {
  const startTime = Date.now();
  const cliExe = getCliExecutable();

  if (!cliExe) {
    return {
      success: false,
      exitCode: -1,
      stdout: "",
      stderr: "UiPath CLI executable not found",
      durationMs: Date.now() - startTime,
      errors: ["UiPath CLI executable not found"],
    };
  }

  const tempDir = writeProjectToTemp(projectJsonContent, xamlEntries);
  const outputDir = mkdtempSync(join(tmpdir(), "uipath-pack-"));

  try {
    const cmd = `${cliExe} package pack "${tempDir}" --output "${outputDir}" 2>&1`;

    return await new Promise<CliPackResult>((resolve) => {
      exec(cmd, { timeout: CLI_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        const exitCode = error ? (error && typeof error === "object" && "code" in error ? (error as { code: number }).code : 1) : 0;
        const errors: string[] = [];
        const combined = `${stdout || ""}\n${stderr || ""}`;

        if (exitCode !== 0) {
          const errorLines = combined.split("\n").filter(l => /error|fail|exception/i.test(l));
          errors.push(...errorLines.slice(0, 20));
          if (errors.length === 0) {
            errors.push(`CLI pack failed with exit code ${exitCode}`);
          }
        }

        let outputPath: string | undefined;
        const nupkgMatch = combined.match(/([^\s"]+\.nupkg)/i);
        if (nupkgMatch) {
          outputPath = nupkgMatch[1];
        }

        resolve({
          success: exitCode === 0,
          outputPath,
          exitCode,
          stdout: (stdout || "").substring(0, 10000),
          stderr: (stderr || "").substring(0, 10000),
          durationMs: Date.now() - startTime,
          errors,
        });
      });
    });
  } finally {
    cleanupTemp(tempDir);
    cleanupTemp(outputDir);
  }
}

export async function runCliValidation(
  projectJsonContent: string,
  xamlEntries: { name: string; content: string }[],
  onProgress?: (message: string) => void,
): Promise<CliValidationResult> {
  const startTime = Date.now();

  const compatibility = checkCliCompatibility(projectJsonContent);

  if (!compatibility.isCompatible) {
    console.log(`[CLI Validator] Skipping CLI validation: ${compatibility.reason}`);
    if (onProgress) onProgress(`CLI validation skipped: incompatible agent for ${compatibility.projectType} project`);

    return {
      mode: "cli_skipped_incompatible_agent",
      compatibility,
      dotnetAvailable: false,
      cliAvailable: false,
      durationMs: Date.now() - startTime,
    };
  }

  const dotnetAvailable = checkDotnet8Available();
  if (!dotnetAvailable) {
    console.log(`[CLI Validator] .NET 8 runtime not available — falling back to custom validation only`);
    if (onProgress) onProgress("CLI validation skipped: .NET 8 runtime not available");

    return {
      mode: "custom_validated_only",
      compatibility,
      dotnetAvailable: false,
      cliAvailable: false,
      durationMs: Date.now() - startTime,
    };
  }

  const cliAvailable = checkCliToolAvailable();
  if (!cliAvailable) {
    console.log(`[CLI Validator] UiPath CLI tool not installed — falling back to custom validation only`);
    if (onProgress) onProgress("CLI validation skipped: UiPath CLI tool not installed");

    return {
      mode: "custom_validated_only",
      compatibility,
      dotnetAvailable: true,
      cliAvailable: false,
      durationMs: Date.now() - startTime,
    };
  }

  if (onProgress) onProgress("Running UiPath CLI analyzer...");
  console.log(`[CLI Validator] Running CLI analyze for ${compatibility.projectType} project on ${compatibility.currentRunner}`);

  let analyzeResult: CliAnalyzeResult;
  try {
    analyzeResult = await runCliAnalyze(projectJsonContent, xamlEntries);
    console.log(`[CLI Validator] Analyze complete: success=${analyzeResult.success}, defects=${analyzeResult.defects.length}, duration=${analyzeResult.durationMs}ms`);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[CLI Validator] Analyze failed: ${errMsg}`);
    return {
      mode: "cli_failed",
      compatibility,
      dotnetAvailable: true,
      cliAvailable: true,
      durationMs: Date.now() - startTime,
    };
  }

  if (onProgress) onProgress("Running UiPath CLI pack (build validation)...");
  console.log(`[CLI Validator] Running CLI pack for ${compatibility.projectType} project`);

  let packResult: CliPackResult;
  try {
    packResult = await runCliPack(projectJsonContent, xamlEntries);
    console.log(`[CLI Validator] Pack complete: success=${packResult.success}, duration=${packResult.durationMs}ms`);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[CLI Validator] Pack failed: ${errMsg}`);
    return {
      mode: "cli_failed",
      compatibility,
      analyzeResult,
      dotnetAvailable: true,
      cliAvailable: true,
      durationMs: Date.now() - startTime,
    };
  }

  const mode: CliValidationMode = (analyzeResult.success || analyzeResult.defects.filter(d => d.severity === "Error").length === 0) && packResult.success
    ? "cli_validated"
    : "cli_failed";

  console.log(`[CLI Validator] Validation complete: mode=${mode}, analyze_defects=${analyzeResult.defects.length}, pack_success=${packResult.success}, total_duration=${Date.now() - startTime}ms`);

  return {
    mode,
    compatibility,
    analyzeResult,
    packResult,
    dotnetAvailable: true,
    cliAvailable: true,
    durationMs: Date.now() - startTime,
  };
}

export function cliDefectsToHealingInput(defects: CliAnalyzerDefect[]): Array<{
  source: "cli_analyzer";
  ruleId: string;
  severity: string;
  file: string;
  line?: number;
  message: string;
}> {
  return defects.map(d => ({
    source: "cli_analyzer" as const,
    ruleId: d.ruleId,
    severity: d.severity,
    file: d.file,
    line: d.line,
    message: d.message,
  }));
}

export function formatCliValidationSummary(result: CliValidationResult): string {
  const lines: string[] = [];
  lines.push(`CLI Validation Mode: ${result.mode}`);
  lines.push(`Project Type: ${result.compatibility.projectType}`);
  lines.push(`Required CLI: ${result.compatibility.requiredCliFlavor}`);
  lines.push(`Current Runner: ${result.compatibility.currentRunner}`);
  lines.push(`Compatible: ${result.compatibility.isCompatible}`);
  lines.push(`.NET 8 Available: ${result.dotnetAvailable}`);
  lines.push(`CLI Available: ${result.cliAvailable}`);
  lines.push(`Duration: ${result.durationMs}ms`);

  if (result.analyzeResult) {
    lines.push(`Analyze: success=${result.analyzeResult.success}, defects=${result.analyzeResult.defects.length}, exitCode=${result.analyzeResult.exitCode}`);
    const errors = result.analyzeResult.defects.filter(d => d.severity === "Error");
    const warnings = result.analyzeResult.defects.filter(d => d.severity === "Warning");
    if (errors.length > 0) lines.push(`  Errors: ${errors.length}`);
    if (warnings.length > 0) lines.push(`  Warnings: ${warnings.length}`);
  }

  if (result.packResult) {
    lines.push(`Pack: success=${result.packResult.success}, exitCode=${result.packResult.exitCode}`);
    if (result.packResult.errors.length > 0) {
      for (const e of result.packResult.errors.slice(0, 5)) {
        lines.push(`  Error: ${e}`);
      }
    }
  }

  return lines.join("\n");
}
