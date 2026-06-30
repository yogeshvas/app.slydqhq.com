import type { NextFunction, Request, Response } from "express";
import { getCurrentWorkspace } from "../services/workspace.service";
import { PLANS, type PlanDef } from "../config/pricing";
import ApiError from "../utils/appError";

type ProFeature = keyof PlanDef["features"];

/**
 * Gate a route behind the Pro plan for a specific feature (members, api,
 * emailGeneration, removeWatermark). Apply after `requireAuth`. Throws 403 with an
 * upgrade message when the current workspace's plan lacks the feature.
 *
 *   router.post("/invites", requireAuth, requirePro("members"), inviteMember);
 */
export function requirePro(feature: ProFeature) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const workspace = await getCurrentWorkspace(req.auth!.id);
      const plan = PLANS[(workspace.plan as "free" | "pro") ?? "free"] ?? PLANS.free;
      if (!plan.features[feature]) {
        throw ApiError.forbidden(
          "This feature is available on the Pro plan. Upgrade to unlock it.",
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
