import { Workspace } from "../models/identity/workspace.model";
import { FREE_DAILY_CAP } from "../config/pricing";
import { getBalance, recordCredit } from "./credit.service";
import { logger } from "../utils/logger";

/** Today's date as YYYY-MM-DD (server local). */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Free-tier "come back tomorrow" top-up. On the first call of a new calendar day,
 * if a free workspace's balance is below the cap, top it UP TO the cap (never
 * above, so credits don't accumulate). No-op for Pro workspaces or if already done
 * today. Best-effort — never throws to the caller.
 */
export async function applyNewDayTopupIfDue(workspaceId: unknown): Promise<void> {
  try {
    const ws: any = await Workspace.findById(workspaceId);
    if (!ws || ws.plan === "pro") return;

    const day = today();
    if (ws.lastTopupDate === day) return; // already topped up today

    const balance = await getBalance(workspaceId);
    const deficit = FREE_DAILY_CAP - balance;

    // Mark the day first so concurrent requests don't double-grant.
    ws.lastTopupDate = day;
    await ws.save();

    if (deficit > 0) {
      await recordCredit(workspaceId, deficit, "daily_topup", undefined, {
        kind: "expiring",
      });
    }
  } catch (err) {
    logger.warn({ err, workspaceId }, "new-day top-up failed");
  }
}
