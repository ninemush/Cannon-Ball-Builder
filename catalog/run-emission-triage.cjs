const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, 'activity-catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

const compliancePath = path.join(__dirname, '..', 'server', 'xaml', 'xaml-compliance.ts');
const complianceTs = fs.readFileSync(compliancePath, 'utf-8');
const nsMapKeys = new Set();
const pkgPattern = /\"([\w.]+)\":\s*\{/g;
let m;
while ((m = pkgPattern.exec(complianceTs)) !== null) {
  if (m.index < complianceTs.indexOf('GUARANTEED_ACTIVITY_PREFIX_MAP')) {
    nsMapKeys.add(m[1]);
  }
}

const dllDerivedNsKeys = new Set();
for (const pkg of catalog.packages) {
  if (pkg.prefix && pkg.clrNamespace && pkg.assembly) {
    dllDerivedNsKeys.add(pkg.packageId);
  }
  if (pkg.additionalNamespaces) {
    for (const ns of pkg.additionalNamespaces) {
      if (ns.prefix && ns.clrNamespace && ns.assembly) {
        dllDerivedNsKeys.add(pkg.packageId);
      }
    }
  }
}
console.log(`Namespace sources: ${nsMapKeys.size} from compliance hardcoded, ${dllDerivedNsKeys.size} from DLL-extracted catalog data`);

const POLICY_EXCLUDED_PACKAGES = new Set([
  'UiPath.Citrix.Activities',
  'UiPath.HyperV.Activities',
  'UiPath.VMware.Activities',
]);

const triageLog = [];
let newlyApproved = 0;
let alreadyApproved = 0;
let failedActivities = 0;
const approvedByPackage = {};
const failedByReason = {};

for (const pkg of catalog.packages) {
  for (const act of pkg.activities) {
    if (act.source !== 'dll-extract' || act.propertiesComplete !== true) continue;

    if (act.emissionApproved) {
      alreadyApproved++;
      continue;
    }

    const failures = [];

    if (pkg.feedStatus === 'delisted') {
      failures.push('criterion-1: delisted package');
    }

    const hasNamespaceMapping = nsMapKeys.has(pkg.packageId) || dllDerivedNsKeys.has(pkg.packageId) || (pkg.prefix !== undefined && pkg.clrNamespace && pkg.assembly);
    if (!hasNamespaceMapping) {
      failures.push('criterion-2: no namespace mapping');
    }
    if (pkg.generationApproved !== true) {
      failures.push('criterion-2: package not generation-approved');
    }

    if (POLICY_EXCLUDED_PACKAGES.has(pkg.packageId)) {
      failures.push('criterion-3: special-runtime-context (excluded)');
    }
    if (act.isDeprecated === true) {
      failures.push('criterion-3: deprecated activity');
    }
    if (act.className.includes('`')) {
      failures.push('criterion-3: unsupported generic backtick class');
    }
    if (act.browsable === false) {
      failures.push('criterion-3: non-browsable (internal framework plumbing)');
    }

    const hasGenerationPath = pkg.generationApproved === true && hasNamespaceMapping;
    if (!hasGenerationPath) {
      failures.push('criterion-4: no generation path');
    }

    if (!pkg.version && !pkg.preferredVersion) {
      failures.push('criterion-5: no version available');
    }

    if (failures.length === 0) {
      act.emissionApproved = true;
      newlyApproved++;
      if (!approvedByPackage[pkg.packageId]) approvedByPackage[pkg.packageId] = [];
      approvedByPackage[pkg.packageId].push(act.className);
    } else {
      failedActivities++;
      for (const f of failures) {
        const key = f.split(':')[0];
        failedByReason[key] = (failedByReason[key] || 0) + 1;
      }
      triageLog.push({ pkg: pkg.packageId, activity: act.className, failures });
    }
  }
}

console.log('=== TRIAGE SUMMARY ===');
console.log('Already approved:', alreadyApproved);
console.log('Newly approved:', newlyApproved);
console.log('Failed:', failedActivities);
console.log('\n=== APPROVED BY PACKAGE ===');
for (const [pkg, acts] of Object.entries(approvedByPackage)) {
  console.log(pkg + ': ' + acts.length);
}
console.log('\n=== FAILURES BY REASON ===');
for (const [reason, count] of Object.entries(failedByReason)) {
  console.log(reason + ': ' + count);
}

if (newlyApproved > 0) {
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  console.log('\nCatalog updated with ' + newlyApproved + ' newly approved activities.');
}

fs.writeFileSync(path.join(__dirname, 'emission-triage-log.json'), JSON.stringify({
  triageDate: new Date().toISOString(),
  summary: { alreadyApproved, newlyApproved, failedActivities },
  approvedByPackage: Object.fromEntries(Object.entries(approvedByPackage).map(([k,v]) => [k, v.length])),
  failedByReason,
  failedActivities: triageLog,
}, null, 2));
console.log('Triage log written to catalog/emission-triage-log.json');
