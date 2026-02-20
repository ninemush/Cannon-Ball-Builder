import { db } from "./db";
import { documents, documentApprovals, type Document, type InsertDocument, type DocumentApproval, type InsertDocumentApproval } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export interface IDocumentStorage {
  getLatestDocument(ideaId: string, type: string): Promise<Document | undefined>;
  getDocument(id: number): Promise<Document | undefined>;
  getDocumentsByIdea(ideaId: string): Promise<Document[]>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(id: number, updates: Partial<InsertDocument>): Promise<Document>;
  getApproval(ideaId: string, docType: string): Promise<DocumentApproval | undefined>;
  createApproval(approval: InsertDocumentApproval): Promise<DocumentApproval>;
}

export const documentStorage: IDocumentStorage = {
  async getLatestDocument(ideaId: string, type: string) {
    const [doc] = await db.select().from(documents)
      .where(and(eq(documents.ideaId, ideaId), eq(documents.type, type)))
      .orderBy(desc(documents.version))
      .limit(1);
    return doc;
  },

  async getDocument(id: number) {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  },

  async getDocumentsByIdea(ideaId: string) {
    return db.select().from(documents)
      .where(eq(documents.ideaId, ideaId))
      .orderBy(desc(documents.createdAt));
  },

  async createDocument(doc: InsertDocument) {
    const [created] = await db.insert(documents).values(doc).returning();
    return created;
  },

  async updateDocument(id: number, updates: Partial<InsertDocument>) {
    const [updated] = await db.update(documents)
      .set(updates)
      .where(eq(documents.id, id))
      .returning();
    return updated;
  },

  async getApproval(ideaId: string, docType: string) {
    const [approval] = await db.select().from(documentApprovals)
      .where(and(eq(documentApprovals.ideaId, ideaId), eq(documentApprovals.docType, docType)));
    return approval;
  },

  async createApproval(approval: InsertDocumentApproval) {
    const [created] = await db.insert(documentApprovals).values(approval).returning();
    return created;
  },
};
