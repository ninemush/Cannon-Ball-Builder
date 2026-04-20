const PREFIX_TYPE_MAP: [string, string][] = [
  ["str_", "x:String"],
  ["int_", "x:Int32"],
  ["num_", "x:Int32"],
  ["bool_", "x:Boolean"],
  ["is_", "x:Boolean"],
  ["has_", "x:Boolean"],
  ["dbl_", "x:Double"],
  ["dec_", "x:Decimal"],
  ["dt_", "scg2:DataTable"],
  ["date_", "s:DateTime"],
  ["dtm_", "s:DateTime"],
  ["dr_", "scg2:DataRow"],
  ["drow_", "scg2:DataRow"],
  ["dict_", "scg:Dictionary(x:String, x:Object)"],
  ["sec_", "s:Security.SecureString"],
  ["ts_", "s:TimeSpan"],
  ["obj_", "x:Object"],
  ["qi_", "ui:QueueItem"],
  ["arr_", "x:Array(x:String)"],
  ["list_", "scg:List(x:String)"],
];

export const VARIABLE_PREFIX_LIST = PREFIX_TYPE_MAP.map(([prefix]) => prefix);

export const ALL_PREFIXES_PATTERN = VARIABLE_PREFIX_LIST.map(p => p.replace("_", "_")).join("|");

export const VARIABLE_PREFIX_REGEX = new RegExp(
  `^(${ALL_PREFIXES_PATTERN})`,
  "i"
);

export const DEMOTION_WHITELIST_REGEX = new RegExp(
  `^(?:${ALL_PREFIXES_PATTERN}|in_|out_|io_)`,
  "i"
);

export const PREFIXED_VAR_REF_REGEX = new RegExp(
  `\\b((?:${ALL_PREFIXES_PATTERN})\\w+)\\b`,
  "g"
);

export function inferTypeFromPrefix(varName: string): string | null {
  // Task #539 (Pattern C): guarded retype for transaction-item variables.
  // When a variable's name ends with `TransactionItem` (queue-item slot) but
  // it was declared with the `obj_` prefix (System.Object), the downstream
  // `SetTransactionStatus.TransactionItem` / `SetTransactionProgress
  // .TransactionItem` binding is contractually `UiPath.Core.QueueItem`. The
  // contract is unambiguous, so coerce the inferred type to `ui:QueueItem`
  // rather than `x:Object` — eliminates the unrepairable downcast at the
  // source. Only applies when the suffix is exact (`TransactionItem` /
  // `Transaction_Item`) so the heuristic does not over-reach.
  if (/^obj_/.test(varName) && /(?:^|_)TransactionItem$/i.test(varName.slice(4))) {
    return "ui:QueueItem";
  }
  for (const [prefix, type] of PREFIX_TYPE_MAP) {
    if (varName.startsWith(prefix)) return type;
  }
  return null;
}

export function hasRecognizedPrefix(varName: string): boolean {
  return VARIABLE_PREFIX_LIST.some(p => varName.startsWith(p));
}

export const ARGUMENT_PREFIXES = ["in_", "out_", "io_"] as const;

export function isArgumentRef(varName: string): boolean {
  return ARGUMENT_PREFIXES.some(p => varName.startsWith(p));
}
