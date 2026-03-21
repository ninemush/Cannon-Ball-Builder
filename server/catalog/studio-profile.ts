import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const packageVersionRangeSchema = z.object({
  min: z.string(),
  max: z.string(),
  preferred: z.string(),
});

export const studioProfileSchema = z.object({
  studioLine: z.string(),
  studioVersion: z.string(),
  targetFramework: z.enum(["Windows", "Portable"]),
  projectType: z.enum(["Process", "Library", "TestAutomation"]),
  expressionLanguage: z.enum(["VisualBasic", "CSharp"]),
  allowedPackageVersionRanges: z.record(z.string(), packageVersionRangeSchema),
  minimumRequiredPackages: z.array(z.string()),
});

export type PackageVersionRange = z.infer<typeof packageVersionRangeSchema>;
export type StudioProfile = z.infer<typeof studioProfileSchema>;

export function loadStudioProfile(profilePath?: string): StudioProfile | null {
  const path = profilePath || join(process.cwd(), "catalog", "studio-profile.json");

  if (!existsSync(path)) {
    console.warn(`[Studio Profile] Profile file not found at ${path} — using hardcoded defaults`);
    return null;
  }

  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    const result = studioProfileSchema.safeParse(parsed);

    if (!result.success) {
      const errors = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
      console.warn(`[Studio Profile] Validation failed: ${errors} — using hardcoded defaults`);
      return null;
    }

    console.log(`[Studio Profile] Loaded profile: Studio ${result.data.studioVersion}, ${result.data.targetFramework}, ${result.data.projectType}`);
    return result.data;
  } catch (err: any) {
    console.warn(`[Studio Profile] Failed to load profile: ${err.message} — using hardcoded defaults`);
    return null;
  }
}

export function getPreferredVersion(profile: StudioProfile, packageName: string): string | null {
  const range = profile.allowedPackageVersionRanges[packageName];
  return range?.preferred || null;
}

export function isVersionInRange(profile: StudioProfile, packageName: string, version: string): boolean {
  const range = profile.allowedPackageVersionRanges[packageName];
  if (!range) return true;

  const parts = version.split(".").map(Number);
  const minParts = range.min.split(".").map(Number);
  const maxParts = range.max.split(".").map(Number);

  for (let i = 0; i < Math.max(parts.length, minParts.length, maxParts.length); i++) {
    const v = parts[i] || 0;
    const lo = minParts[i] || 0;
    const hi = maxParts[i] || 0;

    if (v < lo) return false;
    if (v > lo) break;
  }

  for (let i = 0; i < Math.max(parts.length, maxParts.length); i++) {
    const v = parts[i] || 0;
    const hi = maxParts[i] || 0;

    if (v > hi) return false;
    if (v < hi) break;
  }

  return true;
}

export function getMajorVersion(version: string): number {
  const major = parseInt(version.split(".")[0], 10);
  return isNaN(major) ? 0 : major;
}
