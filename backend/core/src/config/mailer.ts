import { env } from "./env";
import ApiError from "../utils/appError";
import { logger } from "../utils/logger";

const MANDRILL_SEND_URL = "https://mandrillapp.com/api/1.0/messages/send.json";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send a transactional email via the Mandrill (Mailchimp Transactional) API.
 * Throws a clear ApiError if mail isn't configured or the send is rejected, so
 * callers don't have to interpret Mandrill's response shape.
 */
export async function sendMandrillEmail(message: MailMessage): Promise<void> {
  if (!env.MAILCHIMP_TRANSACTIONAL_KEY || !env.MAILCHIMP_FROM_EMAIL) {
    throw ApiError.serviceUnavailable(
      "Email service is not configured (set MAILCHIMP_TRANSACTIONAL_KEY and MAILCHIMP_FROM_EMAIL).",
    );
  }

  const resp = await fetch(MANDRILL_SEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: env.MAILCHIMP_TRANSACTIONAL_KEY,
      message: {
        from_email: env.MAILCHIMP_FROM_EMAIL,
        from_name: env.MAILCHIMP_FROM_NAME,
        to: [{ email: message.to, type: "to" }],
        subject: message.subject,
        html: message.html,
        text: message.text,
      },
    }),
  });

  const body: any = await resp.json().catch(() => null);

  // API-level failure (bad key, etc.) → Mandrill returns an object with
  // status:"error" and a non-2xx code.
  if (!resp.ok || (body && !Array.isArray(body) && body.status === "error")) {
    logger.error(
      { httpStatus: resp.status, response: body },
      "Mandrill API request failed",
    );
    throw ApiError.serviceUnavailable("Failed to send email. Please try again.");
  }

  // On success Mandrill returns an array of per-recipient results.
  const result = Array.isArray(body) ? body[0] : null;
  if (!result || result.status === "rejected" || result.status === "invalid") {
    logger.error({ response: body }, "Mandrill rejected the email");
    throw ApiError.serviceUnavailable("Failed to send email. Please try again.");
  }

  logger.info(
    { to: message.to, status: result.status, id: result._id },
    "Email sent via Mandrill",
  );
}
