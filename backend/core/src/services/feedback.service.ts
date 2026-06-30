import { User } from "../models/identity/user.model";
import ApiError from "../utils/appError";
import { logger } from "../utils/logger";
import { sendFeedbackEmail } from "./mailer.service";

/** Send an in-app feedback/support message to the team inbox, from the signed-in user. */
export async function submitFeedback(
  userId: string,
  message: string,
  category?: string,
) {
  const user = (await User.findById(userId).select("userName email").lean()) as any;
  if (!user) throw ApiError.unauthorized("User not found.");

  try {
    await sendFeedbackEmail({
      fromName: user.userName ?? "A user",
      fromEmail: user.email,
      message: message.trim(),
      category,
    });
  } catch (err) {
    logger.error({ err, userId }, "feedback email failed");
    throw ApiError.serviceUnavailable(
      "Couldn't send your message right now. Please try again.",
    );
  }

  logger.info({ userId, category }, "feedback submitted");
  return { sent: true };
}
