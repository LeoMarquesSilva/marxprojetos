"use server";

import { updateProjectStatus } from "@/app/actions/projects";
import type { ProjectStatus } from "@/types/briefing";

export async function setProjectStatus(id: string, status: ProjectStatus) {
  await updateProjectStatus(id, status);
}
