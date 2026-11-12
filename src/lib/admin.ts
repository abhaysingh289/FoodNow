import { prisma } from "@/lib/db";
import { resetAndSeed } from "../../prisma/seed/seed";

export async function resetAll(): Promise<void> {
  await resetAndSeed(prisma);
}
