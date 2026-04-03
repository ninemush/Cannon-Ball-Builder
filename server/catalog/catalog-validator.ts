export interface CatalogValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const VALID_DIRECTIONS = new Set(["In", "Out", "InOut", "None"]);
const VALID_XAML_SYNTAX = new Set(["child-element", "attribute"]);
const VALID_ARGUMENT_WRAPPERS = new Set(["InArgument", "OutArgument", "InOutArgument"]);
const VALID_FEED_STATUSES = new Set(["verified", "unverified", "delisted"]);
const VALID_PROCESS_TYPES = new Set(["api-integration", "document-processing", "attended-ui", "unattended-ui", "orchestration", "general"]);

function isIso8601(s: string): boolean {
  const d = new Date(s);
  return !isNaN(d.getTime());
}

function isSemver(s: string): boolean {
  return /^\d+\.\d+\.\d+/.test(s);
}

export function validateCatalog(catalog: any): CatalogValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!catalog || typeof catalog !== "object") {
    return { valid: false, errors: ["Catalog is not a valid object"], warnings };
  }

  if (!catalog.catalogVersion || typeof catalog.catalogVersion !== "string") {
    errors.push("Missing or invalid catalogVersion");
  } else if (!isSemver(catalog.catalogVersion)) {
    errors.push(`catalogVersion "${catalog.catalogVersion}" is not valid semver`);
  }

  if (!catalog.generatedAt || typeof catalog.generatedAt !== "string") {
    errors.push("Missing or invalid generatedAt");
  } else if (!isIso8601(catalog.generatedAt)) {
    errors.push(`generatedAt "${catalog.generatedAt}" is not a valid ISO 8601 timestamp`);
  } else {
    const age = Date.now() - new Date(catalog.generatedAt).getTime();
    const fortyEightHours = 48 * 60 * 60 * 1000;
    if (age > fortyEightHours) {
      warnings.push(`Catalog generatedAt is older than 48 hours — consider regenerating`);
    }
  }

  if (catalog.lastVerifiedAt) {
    if (typeof catalog.lastVerifiedAt !== "string") {
      errors.push("lastVerifiedAt must be a string");
    } else if (!isIso8601(catalog.lastVerifiedAt)) {
      errors.push(`lastVerifiedAt "${catalog.lastVerifiedAt}" is not a valid ISO 8601 timestamp`);
    }
  }

  if (!catalog.studioVersion || typeof catalog.studioVersion !== "string") {
    errors.push("Missing or invalid studioVersion");
  } else if (!isSemver(catalog.studioVersion)) {
    errors.push(`studioVersion "${catalog.studioVersion}" is not valid semver`);
  }

  if (!Array.isArray(catalog.packages) || catalog.packages.length === 0) {
    errors.push("packages must be a non-empty array");
    return { valid: errors.length === 0, errors, warnings };
  }

  const seenPackageIds = new Set<string>();

  for (let pi = 0; pi < catalog.packages.length; pi++) {
    const pkg = catalog.packages[pi];
    const pkgLabel = `packages[${pi}] (${pkg?.packageId || "unknown"})`;

    if (!pkg || typeof pkg !== "object") {
      errors.push(`${pkgLabel}: not a valid object`);
      continue;
    }

    if (typeof pkg.packageId !== "string") {
      errors.push(`${pkgLabel}: missing packageId`);
    } else if (pkg.packageId === "") {
      errors.push(`${pkgLabel}: packageId must not be empty`);
    } else {
      if (seenPackageIds.has(pkg.packageId)) {
        warnings.push(`${pkgLabel}: duplicate packageId "${pkg.packageId}" — later entry will be merged`);
      }
      seenPackageIds.add(pkg.packageId);
    }

    if (pkg.version !== undefined) {
      if (typeof pkg.version !== "string" || pkg.version === "") {
        errors.push(`${pkgLabel}: version if present must be a non-empty string`);
      } else if (!isSemver(pkg.version)) {
        errors.push(`${pkgLabel}: invalid version format "${pkg.version}"`);
      }
    }

    if (pkg.feedStatus !== undefined) {
      if (!VALID_FEED_STATUSES.has(pkg.feedStatus)) {
        warnings.push(`${pkgLabel}: feedStatus "${pkg.feedStatus}" is not "verified" or "unverified"`);
      }
    }

    if (pkg.preferredVersion !== undefined) {
      if (typeof pkg.preferredVersion !== "string" || pkg.preferredVersion === "") {
        errors.push(`${pkgLabel}: preferredVersion if present must be a non-empty string`);
      } else if (!isSemver(pkg.preferredVersion)) {
        errors.push(`${pkgLabel}: preferredVersion "${pkg.preferredVersion}" is not valid semver`);
      }
    }

    if (!Array.isArray(pkg.activities) || pkg.activities.length === 0) {
      errors.push(`${pkgLabel}: activities must be a non-empty array`);
      continue;
    }

    const seenClassNames = new Set<string>();

    for (let ai = 0; ai < pkg.activities.length; ai++) {
      const act = pkg.activities[ai];
      const actLabel = `${pkgLabel}.activities[${ai}]`;

      if (!act || typeof act !== "object") {
        errors.push(`${actLabel}: not a valid object`);
        continue;
      }

      if (!act.className || typeof act.className !== "string") {
        errors.push(`${actLabel}: missing className`);
      } else {
        if (seenClassNames.has(act.className)) {
          warnings.push(`${actLabel}: duplicate className "${act.className}" in package`);
        }
        seenClassNames.add(act.className);
      }

      if (!act.displayName || typeof act.displayName !== "string") {
        errors.push(`${actLabel}: missing displayName`);
      }
      if (typeof act.browsable !== "boolean") {
        errors.push(`${actLabel}: browsable must be boolean`);
      }

      if (!Array.isArray(act.processTypes) || act.processTypes.length === 0) {
        warnings.push(`${actLabel}: processTypes should be a non-empty array`);
      } else {
        for (const pt of act.processTypes) {
          if (!VALID_PROCESS_TYPES.has(pt)) {
            warnings.push(`${actLabel}: processType "${pt}" is not a valid ProcessType (valid: ${Array.from(VALID_PROCESS_TYPES).join(", ")})`);
          }
        }
      }

      if (!Array.isArray(act.properties)) {
        errors.push(`${actLabel}: properties must be an array`);
        continue;
      }

      for (let propI = 0; propI < act.properties.length; propI++) {
        const prop = act.properties[propI];
        const propLabel = `${actLabel}.properties[${propI}] (${prop?.name || "unknown"})`;

        if (!prop || typeof prop !== "object") {
          errors.push(`${propLabel}: not a valid object`);
          continue;
        }

        if (!prop.name || typeof prop.name !== "string") {
          errors.push(`${propLabel}: missing name`);
        }

        if (!VALID_DIRECTIONS.has(prop.direction)) {
          errors.push(`${propLabel}: direction must be one of In/Out/InOut/None, got "${prop.direction}"`);
        }

        if (!VALID_XAML_SYNTAX.has(prop.xamlSyntax)) {
          errors.push(`${propLabel}: xamlSyntax must be "child-element" or "attribute", got "${prop.xamlSyntax}"`);
        }

        if (prop.argumentWrapper !== null) {
          if (!VALID_ARGUMENT_WRAPPERS.has(prop.argumentWrapper)) {
            errors.push(`${propLabel}: argumentWrapper must be InArgument/OutArgument/InOutArgument or null, got "${prop.argumentWrapper}"`);
          }

          if (prop.argumentWrapper === "OutArgument" && prop.direction !== "Out" && prop.direction !== "InOut") {
            errors.push(`${propLabel}: OutArgument wrapper requires direction Out or InOut, got "${prop.direction}"`);
          }

          if (prop.argumentWrapper === "InArgument" && prop.direction === "Out") {
            errors.push(`${propLabel}: InArgument wrapper is incompatible with direction Out`);
          }

          if (prop.argumentWrapper === "InOutArgument" && prop.direction !== "InOut") {
            warnings.push(`${propLabel}: InOutArgument wrapper but direction is "${prop.direction}"`);
          }
        }

        if (prop.xamlSyntax === "attribute" && prop.argumentWrapper !== null) {
          errors.push(`${propLabel}: attribute syntax requires argumentWrapper to be null, got "${prop.argumentWrapper}"`);
        }

        if (prop.xamlSyntax === "child-element" && prop.argumentWrapper === null) {
          warnings.push(`${propLabel}: child-element syntax usually requires an argumentWrapper`);
        }

        if (typeof prop.required !== "boolean") {
          errors.push(`${propLabel}: required must be boolean`);
        }

        if (!prop.clrType || typeof prop.clrType !== "string") {
          errors.push(`${propLabel}: missing clrType`);
        }

        if (prop.validValues !== undefined) {
          if (!Array.isArray(prop.validValues)) {
            errors.push(`${propLabel}: validValues must be an array`);
          } else {
            for (const v of prop.validValues) {
              if (typeof v !== "string") {
                errors.push(`${propLabel}: validValues entries must be strings`);
                break;
              }
            }
          }
        }

        if (prop.addedInVersion !== undefined) {
          if (typeof prop.addedInVersion !== "string") {
            errors.push(`${propLabel}: addedInVersion must be a string`);
          } else if (!isSemver(prop.addedInVersion)) {
            errors.push(`${propLabel}: addedInVersion "${prop.addedInVersion}" is not valid semver`);
          }
        }

        if (prop.removedInVersion !== undefined) {
          if (typeof prop.removedInVersion !== "string") {
            errors.push(`${propLabel}: removedInVersion must be a string`);
          } else if (!isSemver(prop.removedInVersion)) {
            errors.push(`${propLabel}: removedInVersion "${prop.removedInVersion}" is not valid semver`);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
