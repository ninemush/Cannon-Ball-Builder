import { storage } from "./storage";
import { db } from "./db";
import { chatMessages, processNodes, processApprovals, documents, documentApprovals, PIPELINE_STAGES, type PipelineStage } from "@shared/schema";
import { eq, and, count } from "drizzle-orm";

export interface TransitionResult {
  transitioned: boolean;
  fromStage?: string;
  toStage?: string;
  reason?: string;
}

async function getMessageCount(ideaId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(chatMessages)
    .where(eq(chatMessages.ideaId, ideaId));
  return result?.count || 0;
}

async function getNodeCount(ideaId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(processNodes)
    .where(and(eq(processNodes.ideaId, ideaId), eq(processNodes.viewType, "as-is")));
  return result?.count || 0;
}

async function hasMapApproval(ideaId: string, viewType: string): Promise<boolean> {
  const [result] = await db
    .select({ count: count() })
    .from(processApprovals)
    .where(and(eq(processApprovals.ideaId, ideaId), eq(processApprovals.viewType, viewType)));
  return (result?.count || 0) > 0;
}

async function hasDocApproval(ideaId: string, docType: string): Promise<boolean> {
  const [result] = await db
    .select({ count: count() })
    .from(documentApprovals)
    .where(and(eq(documentApprovals.ideaId, ideaId), eq(documentApprovals.docType, docType)));
  return (result?.count || 0) > 0;
}

async function hasDocument(ideaId: string, docType: string): Promise<boolean> {
  const [result] = await db
    .select({ count: count() })
    .from(documents)
    .where(and(eq(documents.ideaId, ideaId), eq(documents.type, docType)));
  return (result?.count || 0) > 0;
}

async function evaluateNextStage(ideaId: string, currentStage: PipelineStage): Promise<{ nextStage: PipelineStage; reason: string } | null> {
  switch (currentStage) {
    case "Idea": {
      const nodeCount = await getNodeCount(ideaId);
      const msgCount = await getMessageCount(ideaId);
      if (nodeCount >= 3 && msgCount >= 4) {
        return { nextStage: "Feasibility Assessment", reason: `${nodeCount} process steps mapped, ${msgCount} chat messages exchanged` };
      }
      return null;
    }

    case "Feasibility Assessment": {
      const nodeCount = await getNodeCount(ideaId);
      const msgCount = await getMessageCount(ideaId);
      if (nodeCount >= 5 && msgCount >= 8) {
        return { nextStage: "Validated Backlog", reason: "Feasibility assessment criteria met" };
      }
      return null;
    }

    case "Validated Backlog":
      return { nextStage: "Design", reason: "Idea validated and added to backlog" };

    case "Design": {
      const asIsApproved = await hasMapApproval(ideaId, "as-is");
      const hasPdd = await hasDocument(ideaId, "PDD");
      if (asIsApproved && hasPdd) {
        return { nextStage: "Build", reason: "As-Is map approved and PDD generated" };
      }
      return null;
    }

    case "Build": {
      const sddExists = await hasDocument(ideaId, "SDD");
      const sddApproved = await hasDocApproval(ideaId, "SDD");
      if (sddExists && sddApproved) {
        return { nextStage: "Test", reason: "SDD approved and UiPath package generated" };
      }
      return null;
    }

    case "Test":
      return { nextStage: "Governance / Security Scan", reason: "Testing phase complete" };

    case "Governance / Security Scan":
      return { nextStage: "CoE Approval", reason: "Governance scan passed" };

    case "CoE Approval":
      return { nextStage: "Deploy", reason: "CoE approval granted" };

    case "Deploy":
      return { nextStage: "Maintenance", reason: "Deployment complete" };

    default:
      return null;
  }
}

export async function evaluateTransition(
  ideaId: string,
  userId?: string,
  userName?: string,
  userRole?: string
): Promise<TransitionResult> {
  const idea = await storage.getIdea(ideaId);
  if (!idea) return { transitioned: false, reason: "Idea not found" };

  let currentStage = idea.stage as PipelineStage;
  if (PIPELINE_STAGES.indexOf(currentStage) === -1) return { transitioned: false, reason: "Unknown stage" };

  let firstFrom: string | undefined;
  let lastTo: string | undefined;
  let allReasons: string[] = [];
  let didTransition = false;

  const maxChain = 10;
  for (let i = 0; i < maxChain; i++) {
    const result = await evaluateNextStage(ideaId, currentStage);
    if (!result) break;

    if (!firstFrom) firstFrom = currentStage;
    lastTo = result.nextStage;
    allReasons.push(`${currentStage} → ${result.nextStage}: ${result.reason}`);
    didTransition = true;

    await storage.updateIdeaStage(ideaId, result.nextStage);

    await storage.createAuditLog({
      ideaId,
      userId: userId || null,
      userName: userName || "System",
      userRole: userRole || "System",
      action: "stage_transition",
      fromStage: currentStage,
      toStage: result.nextStage,
      details: result.reason,
    });

    currentStage = result.nextStage;
  }

  if (!didTransition) {
    return { transitioned: false, reason: "Transition conditions not yet met" };
  }

  return {
    transitioned: true,
    fromStage: firstFrom,
    toStage: lastTo,
    reason: allReasons.join("; "),
  };
}
