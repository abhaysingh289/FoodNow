import { prisma } from "@/lib/db";
import { ValidationError } from "@/lib/errors";

export type SimulationSettingsData = { autoMode: boolean; stepDelaySeconds: number };

const ID = "singleton";
const select = { autoMode: true, stepDelaySeconds: true } as const;

export async function getSettings(): Promise<SimulationSettingsData> {
  return prisma.simulationSettings.upsert({ where: { id: ID }, update: {}, create: { id: ID }, select });
}

export async function updateSettings(
  patch: { autoMode?: boolean; stepDelaySeconds?: number },
): Promise<SimulationSettingsData> {
  const d = patch.stepDelaySeconds;
  if (d !== undefined && (!Number.isInteger(d) || d < 1 || d > 60)) {
    throw new ValidationError("stepDelaySeconds must be an integer between 1 and 60");
  }
  const data = {
    ...(patch.autoMode !== undefined ? { autoMode: patch.autoMode } : {}),
    ...(d !== undefined ? { stepDelaySeconds: d } : {}),
  };
  return prisma.simulationSettings.upsert({ where: { id: ID }, update: data, create: { id: ID, ...data }, select });
}
