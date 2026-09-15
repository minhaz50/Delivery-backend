import type { AssignmentLegType } from "../../../generated/prisma/client";

export interface IAssignCourierPayload {
  legType: AssignmentLegType;
  /** Ops/hub manager can force a specific courier instead of auto-assignment. */
  preferredCourierId?: string;
}

export interface IFailLegPayload {
  reason: string;
}
