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

interface FeedbackEmailParams {
  fromName: string;
  fromEmail: string;
  message: string;
  category?: string;
  appName?: string;
}

/** Internal feedback/support email (sent to the team inbox). */
export function feedbackEmailTemplate({
  fromName,
  fromEmail,
  message,
  category,
  appName = "Slyde HQ",
}: FeedbackEmailParams): RenderedEmail {
  const label = category ? `[${category}] ` : "";
  const subject = `${label}Feedback from ${fromName} · ${appName}`;

  const text = [
    `New ${appName} feedback`,
    category ? `Category: ${category}` : "",
    `From: ${fromName} <${fromEmail}>`,
    ``,
    message,
  ]
    .filter(Boolean)
    .join("\n");

  const safe = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#18181b">
    <h1 style="font-size:18px;font-weight:600;margin:0 0 8px">${appName} feedback</h1>
    ${category ? `<p style="font-size:12px;color:#6366f1;margin:0 0 4px;text-transform:uppercase;letter-spacing:.04em">${category}</p>` : ""}
    <p style="font-size:13px;color:#52525b;margin:0 0 16px">
      From <strong>${fromName}</strong> &lt;<a href="mailto:${fromEmail}" style="color:#4F46E5">${fromEmail}</a>&gt;
    </p>
    <div style="font-size:14px;line-height:1.6;white-space:pre-wrap;padding:16px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px">${safe}</div>
  </div>`.trim();

  return { subject, text, html };
}

interface InviteEmailParams {
  workspaceName: string;
  inviterName: string;
  link: string;
  appName?: string;
}

/** Workspace invite email (plain + HTML). */
export function inviteEmailTemplate({
  workspaceName,
  inviterName,
  link,
  appName = "Slyde HQ",
}: InviteEmailParams): RenderedEmail {
  const subject = `${inviterName} invited you to ${workspaceName} on ${appName}`;

  const text = [
    `${inviterName} invited you to collaborate in "${workspaceName}" on ${appName}.`,
    ``,
    `Accept the invite: ${link}`,
    ``,
    `If you didn't expect this, you can safely ignore this email.`,
  ].join("\n");

  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#18181b">
    <h1 style="font-size:18px;font-weight:600;margin:0 0 8px">${appName}</h1>
    <p style="font-size:14px;color:#52525b;margin:0 0 24px">
      <strong>${inviterName}</strong> invited you to collaborate in
      <strong>${workspaceName}</strong>.
    </p>
    <a href="${link}" style="display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px">
      Accept invite
    </a>
    <p style="font-size:13px;color:#71717a;margin:24px 0 0">
      Or paste this link into your browser:<br />
      <span style="color:#4F46E5;word-break:break-all">${link}</span>
    </p>
    <p style="font-size:12px;color:#a1a1aa;margin:16px 0 0">
      If you didn't expect this, you can ignore this email.
    </p>
  </div>`.trim();

  return { subject, text, html };
}
