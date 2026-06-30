import { sendMandrillEmail } from "../config/mailer";
import {
  feedbackEmailTemplate,
  inviteEmailTemplate,
  otpEmailTemplate,
} from "../utils/emailTemplates";
import { FEEDBACK_EMAIL } from "../config/constants";

/** Send the OTP verification email. Throws if email isn't configured. */
export async function sendOtpEmail(
  to: string,
  code: string,
  expiryMinutes: number,
): Promise<void> {
  const { subject, html, text } = otpEmailTemplate({ code, expiryMinutes });

  await sendMandrillEmail({ to, subject, html, text });
}

/** Send a workspace invite email with the join link. */
export async function sendInviteEmail(
  to: string,
  params: { workspaceName: string; inviterName: string; link: string },
): Promise<void> {
  const { subject, html, text } = inviteEmailTemplate(params);
  await sendMandrillEmail({ to, subject, html, text });
}

/** Deliver an in-app feedback submission to the team inbox. */
export async function sendFeedbackEmail(params: {
  fromName: string;
  fromEmail: string;
  message: string;
  category?: string;
}): Promise<void> {
  const { subject, html, text } = feedbackEmailTemplate(params);
  await sendMandrillEmail({ to: FEEDBACK_EMAIL, subject, html, text });
}
