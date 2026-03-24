export type ApprovalReadiness = "approvable" | "blocked";

export function getApprovalReadiness(
  docType: string,
  artifactsValid: boolean | null | undefined
): ApprovalReadiness {
  if (docType !== "SDD") return "approvable";
  if (artifactsValid === false) return "blocked";
  return "approvable";
}
