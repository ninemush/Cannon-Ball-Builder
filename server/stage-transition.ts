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

export async function evaluateTransition(
  ideaId: string,
  userId?: string,
  userName?: string,
  userRole?: string
): Promise<TransitionResult> {
  const idea = await storage.getIdea(ideaId);
  if (!idea) return { transitioned: false, reason: "Idea not found" };

  const currentStage = idea.stage as PipelineStage;
  const currentIndex = PIPELINE_STAGES.indexOf(currentStage);
  if (currentIndex === -1) return { transitioned: false, reason: "Unknown stage" };

  let nextStage: PipelineStage | null = null;
  let reason = "";

  switch (currentStage) {
    case "Idea": {
      const nodeCount = await getNodeCount(ideaId);
      const msgCount = await getMessageCount(ideaId);
      if (nodeCount >= 3 && msgCount >= 4) {
        nextStage = "Feasibility Assessment";
        reason = `${nodeCount} process steps mapped, ${msgCount} chat messages exchanged`;
      }
      break;
    }

    case "Feasibility Assessment": {
      const nodeCount = await getNodeCount(ideaId);
      const msgCount = await getMessageCount(ideaId);
      if (nodeCount >= 5 && msgCount >= 8) {
        nextStage = "Validated Backlog";
        reason = "Feasibility assessment criteria met";
      }
      break;
    }

    case "Validated Backlog": {
      nextStage = "Design";
      reason = "Idea validated and added to backlog";
      break;
    }

    case "Design": {
      const asIsApproved = await hasMapApproval(ideaId, "as-is");
      const hasPdd = await hasDocument(ideaId, "PDD");
      if (asIsApproved && hasPdd) {
        nextStage = "Build";
        reason = "As-Is map approved and PDD generated";
      }
      break;
    }

    case "Build": {
      const sddExists = await hasDocument(ideaId, "SDD");
      const sddApproved = await hasDocApproval(ideaId, "SDD");
      if (sddExists && sddApproved) {
        nextStage = "Test";
        reason = "SDD approved and UiPath package generated";
      }
      break;
    }

    case "Test": {
      nextStage = "Governance / Security Scan";
      reason = "Testing phase complete";
      break;
    }

    case "Governance / Security Scan": {
      nextStage = "CoE Approval";
      reason = "Governance scan passed";
      break;
    }

    case "CoE Approval": {
      nextStage = "Deploy";
      reason = "CoE approval granted";
      break;
    }

    case "Deploy": {
      nextStage = "Maintenance";
      reason = "Deployment complete";
      break;
    }

    default:
      return { transitioned: false, reason: "Already at final stage" };
  }

  if (!nextStage) {
    return { transitioned: false, reason: "Transition conditions not yet met" };
  }

  await storage.updateIdeaStage(ideaId, nextStage);

  await storage.createAuditLog({
    ideaId,
    userId: userId || null,
    userName: userName || "System",
    userRole: userRole || "System",
    action: "stage_transition",
    fromStage: currentStage,
    toStage: nextStage,
    details: reason,
  });

  return {
    transitioned: true,
    fromStage: currentStage,
    toStage: nextStage,
    reason,
  };
}
