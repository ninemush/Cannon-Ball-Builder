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
