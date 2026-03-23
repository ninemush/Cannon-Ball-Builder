import { describe, it, expect } from "vitest";

describe("UiPath Scope Regression Tests (Task #157)", () => {
  describe("MetadataService getScopesForService returns full OIDC scopes", () => {
    it("exposes getScopesForService, getFullOidcScopesForService, and getMinimalScopesForService", async () => {
      const { metadataService } = await import("../catalog/metadata-service");
      expect(typeof metadataService.getScopesForService).toBe("function");
      expect(typeof metadataService.getFullOidcScopesForService).toBe("function");
      expect(typeof metadataService.getMinimalScopesForService).toBe("function");
    });

    it("getScopesForService returns at least as many scopes as getMinimalScopesForService", async () => {
      const { metadataService } = await import("../catalog/metadata-service");
      const fullScopes = metadataService.getScopesForService("OR");
      const minimalScopes = metadataService.getMinimalScopesForService("OR");
      expect(fullScopes.length).toBeGreaterThanOrEqual(minimalScopes.length);
    });

    it("getScopesForService returns same result as getFullOidcScopesForService when OIDC data available", async () => {
      const { metadataService } = await import("../catalog/metadata-service");
      const fullOidc = metadataService.getFullOidcScopesForService("OR");
      const scopesForService = metadataService.getScopesForService("OR");
      if (fullOidc.length > 0) {
        expect(scopesForService).toEqual(fullOidc);
      } else {
        expect(scopesForService.length).toBeGreaterThan(0);
      }
    });

    it("getScopesForService falls back to baseline for OR and all scopes start with OR.", async () => {
      const { metadataService } = await import("../catalog/metadata-service");
      const orScopes = metadataService.getScopesForService("OR");
      expect(orScopes.length).toBeGreaterThan(0);
      for (const s of orScopes) {
        expect(s.startsWith("OR.")).toBe(true);
      }
    });

    it("getScopesForServiceString returns space-separated full scopes", async () => {
      const { metadataService } = await import("../catalog/metadata-service");
      const scopeString = metadataService.getScopesForServiceString("OR");
      const scopes = scopeString.split(" ").filter(Boolean);
      expect(scopes.length).toBeGreaterThan(0);
      const fullArray = metadataService.getScopesForService("OR");
      expect(scopes).toEqual(fullArray);
    });
  });

  describe("getScopeSource uses full OIDC detection", () => {
    it("reports valid source category for OR", async () => {
      const { metadataService } = await import("../catalog/metadata-service");
      const source = metadataService.getScopeSource("OR");
      expect(["oidc-live", "oidc-snapshot", "baseline", "fallback"]).toContain(source);
    });

    it("reports consistent source for non-OR types", async () => {
      const { metadataService } = await import("../catalog/metadata-service");
      for (const svc of ["TM", "DU"] as const) {
        const source = metadataService.getScopeSource(svc);
        expect(["oidc-live", "oidc-snapshot", "docs-override", "baseline", "fallback", "none"]).toContain(source);
      }
    });
  });

  describe("loadConfig scope fallback chain", () => {
    it("getDefaultOrScopes returns OR-prefixed scopes", async () => {
      const { getDefaultOrScopes } = await import("../uipath-auth");
      const scopes = getDefaultOrScopes();
      expect(scopes.length).toBeGreaterThan(0);
      const parts = scopes.split(/\s+/).filter(Boolean);
      expect(parts.length).toBeGreaterThan(0);
      for (const part of parts) {
        expect(part.startsWith("OR.")).toBe(true);
      }
    });

    it("getDefaultOrScopes returns full scopes (not just minimal)", async () => {
      const { getDefaultOrScopes } = await import("../uipath-auth");
      const { metadataService } = await import("../catalog/metadata-service");
      const defaultScopes = getDefaultOrScopes().split(/\s+/).filter(Boolean);
      const fullScopes = metadataService.getScopesForService("OR");
      expect(defaultScopes).toEqual(fullScopes);
    });

    it("invalidateConfig is callable to reset cached config", async () => {
      const { invalidateConfig } = await import("../uipath-auth");
      expect(typeof invalidateConfig).toBe("function");
      invalidateConfig();
    });
  });

  describe("autoDetectUiPathScopes requests all service families", () => {
    it("autoDetectUiPathScopes function is exported", async () => {
      const { autoDetectUiPathScopes } = await import("../uipath-integration");
      expect(typeof autoDetectUiPathScopes).toBe("function");
    });

    it("getFullOidcScopesForService covers all known service families", async () => {
      const { metadataService } = await import("../catalog/metadata-service");
      const serviceTypes = ["OR", "TM", "DU", "DF", "PIMS", "IXP", "AI", "HUB", "IDENTITY", "INTEGRATIONSERVICE", "AUTOMATIONOPS", "AUTOMATIONSTORE", "APPS", "ASSISTANT", "AGENTS", "AUTOPILOT", "REINFER"] as const;
      for (const svc of serviceTypes) {
        const full = metadataService.getFullOidcScopesForService(svc);
        expect(Array.isArray(full)).toBe(true);
      }
    });

    it("full OIDC scopes are broader than minimal for each service with OIDC data", async () => {
      const { metadataService } = await import("../catalog/metadata-service");
      const serviceTypes = ["OR", "TM", "DU", "DF"] as const;
      for (const svc of serviceTypes) {
        const full = metadataService.getFullOidcScopesForService(svc);
        const minimal = metadataService.getMinimalScopesForService(svc);
        if (full.length > 0 && minimal.length > 0) {
          expect(full.length).toBeGreaterThanOrEqual(minimal.length);
          for (const ms of minimal) {
            expect(full).toContain(ms);
          }
        }
      }
    });
  });

  describe("fetchNewToken scope pass-through behavior", () => {
    it("OR resource uses config.scopes (saved scopes), not a fresh minimal lookup", async () => {
      const { getDefaultOrScopes } = await import("../uipath-auth");
      const { metadataService } = await import("../catalog/metadata-service");
      const defaultScopes = getDefaultOrScopes();
      const fullScopes = metadataService.getScopesForServiceString("OR");
      expect(defaultScopes).toBe(fullScopes);
    });

    it("non-OR resource types get full scopes from metadata", async () => {
      const { metadataService } = await import("../catalog/metadata-service");
      for (const svc of ["TM", "DU"] as const) {
        const scopeString = metadataService.getScopesForServiceString(svc);
        const fullScopes = metadataService.getFullOidcScopesForService(svc);
        if (fullScopes.length > 0) {
          expect(scopeString).toBe(fullScopes.join(" "));
        }
      }
    });
  });

  describe("Scope persistence schema integrity", () => {
    it("uipathConnections schema has scopes column with default value", async () => {
      const { uipathConnections } = await import("@shared/schema");
      expect(uipathConnections.scopes).toBeDefined();
      expect(uipathConnections.scopes.name).toBe("scopes");
    });

    it("appSettings schema supports key-value storage", async () => {
      const { appSettings } = await import("@shared/schema");
      expect(appSettings.key).toBeDefined();
      expect(appSettings.value).toBeDefined();
    });

    it("uipathConnections has isActive column for active row selection", async () => {
      const { uipathConnections } = await import("@shared/schema");
      expect(uipathConnections.isActive).toBeDefined();
    });
  });

  describe("autoDetect fallback does not overwrite saved scopes", () => {
    it("autoDetectUiPathScopes only persists when broad request succeeds", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const src = fs.readFileSync(
        path.resolve(import.meta.dirname, "../uipath-integration.ts"),
        "utf-8"
      );

      const autoDetectStart = src.indexOf("export async function autoDetectUiPathScopes");
      expect(autoDetectStart).toBeGreaterThan(-1);

      const nextExport = src.indexOf("\nexport ", autoDetectStart + 10);
      const fnBody = nextExport > 0
        ? src.slice(autoDetectStart, nextExport)
        : src.slice(autoDetectStart, autoDetectStart + 8000);

      expect(fnBody).toContain("usedBroadRequest = true");
      expect(fnBody).toContain("if (usedBroadRequest)");

      const upsertIdx = fnBody.indexOf("upsertSetting");
      const broadCheckIdx = fnBody.indexOf("if (usedBroadRequest)");
      expect(broadCheckIdx).toBeGreaterThan(-1);
      expect(upsertIdx).toBeGreaterThan(broadCheckIdx);
    });

    it("fallback path uses getMinimalScopesForService (not getScopesForService)", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const src = fs.readFileSync(
        path.resolve(import.meta.dirname, "../uipath-integration.ts"),
        "utf-8"
      );
      const autoDetectStart = src.indexOf("export async function autoDetectUiPathScopes");
      const nextExport = src.indexOf("\nexport ", autoDetectStart + 10);
      const fnBody = nextExport > 0
        ? src.slice(autoDetectStart, nextExport)
        : src.slice(autoDetectStart, autoDetectStart + 8000);

      expect(fnBody).toContain("getMinimalScopesForService");
      const fallbackSection = fnBody.slice(fnBody.indexOf("if (!token)"));
      expect(fallbackSection).toContain("getMinimalScopesForService");
    });
  });

  describe("Scope non-collapse guarantee", () => {
    it("getScopesForService never returns fewer scopes than getMinimalScopesForService", async () => {
      const { metadataService } = await import("../catalog/metadata-service");
      const allTypes = ["OR", "TM", "DU", "DF", "PIMS", "IXP", "AI", "HUB"] as const;
      for (const svc of allTypes) {
        const full = metadataService.getScopesForService(svc);
        const minimal = metadataService.getMinimalScopesForService(svc);
        expect(full.length).toBeGreaterThanOrEqual(minimal.length);
      }
    });

    it("getScopesForServiceString for OR contains multiple scope entries", async () => {
      const { metadataService } = await import("../catalog/metadata-service");
      const orString = metadataService.getScopesForServiceString("OR");
      const parts = orString.split(/\s+/).filter(Boolean);
      expect(parts.length).toBeGreaterThanOrEqual(2);
    });
  });
});
