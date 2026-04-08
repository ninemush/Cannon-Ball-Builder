import { storage } from "./storage";
import { log } from "./index";

const DEMO_USERS = [
  {
    email: "sme@cannonball.demo",
    password: "CannonBall2026!",
    displayName: "Sam Martinez",
    role: "Process SME" as const,
  },
  {
    email: "coe@cannonball.demo",
    password: "CannonBall2026!",
    displayName: "Casey Owens",
    role: "CoE" as const,
  },
  {
    email: "admin@cannonball.demo",
    password: "CannonBall2026!",
    displayName: "Alex Nguyen",
    role: "Admin" as const,
  },
];

const DEMO_IDEAS = [
  {
    title: "Invoice Processing Automation",
    description: "Automate the end-to-end invoice processing workflow to reduce manual data entry and speed up approvals.",
    owner: "Sam Martinez",
    ownerEmail: "sme@cannonball.demo",
    stage: "Design",
    tag: "Finance",
  },
  {
    title: "Employee Onboarding Workflow",
    description: "Streamline the employee onboarding process with automated task assignments and document collection.",
    owner: "Sam Martinez",
    ownerEmail: "sme@cannonball.demo",
    stage: "Feasibility Assessment",
    tag: "HR",
  },
];

export async function seedDemoUsers() {
  for (const user of DEMO_USERS) {
    const existing = await storage.getUserByEmail(user.email);
    if (!existing) {
      await storage.createUser(user);
      log(`Created demo user: ${user.email} (${user.role})`);
    }
  }
  log("Demo user seeding complete");
}

export async function seedDemoIdeas() {
  const allIdeas = await storage.getAllIdeas();
  if (allIdeas.length === 0) {
    for (const idea of DEMO_IDEAS) {
      await storage.createIdea(idea);
      log(`Created demo idea: ${idea.title} (${idea.stage})`);
    }
    log("Demo idea seeding complete");
  }
}
