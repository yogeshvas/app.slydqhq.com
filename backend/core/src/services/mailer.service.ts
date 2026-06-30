import { sendMandrillEmail } from "../config/mailer";
import { otpEmailTemplate } from "../utils/emailTemplates";

/** Send the OTP verification email. Throws if email isn't configured. */
export async function sendOtpEmail(
  to: string,
  code: string,
  expiryMinutes: number,
): Promise<void> {
  const { subject, html, text } = otpEmailTemplate({ code, expiryMinutes });

  await sendMandrillEmail({ to, subject, html, text });
}
