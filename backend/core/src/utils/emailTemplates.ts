interface OtpEmailParams {
  code: string;
  expiryMinutes: number;
  appName?: string;
}

interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/** The OTP verification email (plain + HTML). Keep brand styling minimal. */
export function otpEmailTemplate({
  code,
  expiryMinutes,
  appName = "Slyde HQ",
}: OtpEmailParams): RenderedEmail {
  const subject = `${code} is your ${appName} verification code`;

  const text = [
    `Your ${appName} verification code is: ${code}`,
    ``,
    `It expires in ${expiryMinutes} minutes.`,
    `If you didn't request this, you can safely ignore this email.`,
  ].join("\n");

  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#18181b">
    <h1 style="font-size:18px;font-weight:600;margin:0 0 8px">${appName}</h1>
    <p style="font-size:14px;color:#52525b;margin:0 0 24px">Use this code to sign in.</p>
    <div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 0;background:#fafafa;text-align:center;border:1px solid #e4e4e7">
      ${code}
    </div>
    <p style="font-size:13px;color:#71717a;margin:24px 0 0">
      This code expires in ${expiryMinutes} minutes. If you didn't request it, you can ignore this email.
    </p>
  </div>`.trim();

  return { subject, text, html };
}
