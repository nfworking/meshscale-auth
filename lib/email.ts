import { Resend } from "resend";

type OtpType = "sign-in" | "email-verification" | "forget-password" | "change-email";

const subjects: Record<OtpType, string> = {
  "sign-in": "Your Meshscale sign-in code",
  "email-verification": "Verify your email for Meshscale",
  "forget-password": "Your Meshscale reset code",
  "change-email": "Confirm your new email for Meshscale",
};

let resend: Resend | undefined;

function client() {
  if (!process.env.RESEND_API_KEY) return null;
  resend ??= new Resend(process.env.RESEND_API_KEY);
  return resend;
}

function html(otp: string, type: OtpType) {
  const lead = type === "sign-in" ? "Use this code to sign in to Meshscale." : "Use this code to continue.";
  return `<!doctype html><html><body style="margin:0;background:#fbfaf8;font-family:Inter,Segoe UI,Arial,sans-serif;color:#181614">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:40px 16px">
    <table role="presentation" width="440" cellspacing="0" cellpadding="0" style="max-width:440px;background:#ffffff;border:1px solid #e8e3dc;border-radius:12px">
      <tr><td style="padding:32px">
        <div style="font-size:17px;font-weight:600;letter-spacing:-.03em">meshscale</div>
        <p style="margin:24px 0 8px;font-size:15px;line-height:1.5">${lead}</p>
        <div style="margin:20px 0;padding:18px;border-radius:10px;background:#f4f1ed;text-align:center;font:600 30px ui-monospace,Consolas,monospace;letter-spacing:8px">${otp}</div>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#6a655e">The code expires in 5 minutes. If you did not ask for it, you can ignore this email.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

/**
 * Sends a one-time code. Better Auth recommends not awaiting this call (it can leak timing),
 * so failures are logged here instead of thrown.
 *
 * Without RESEND_API_KEY the code is printed to the server log in development only,
 * so the full sign-in flow can be tested without sending real email.
 */
export async function sendOtpEmail({ to, otp, type }: { to: string; otp: string; type: OtpType }) {
  const resendClient = client();
  if (!resendClient) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[auth] ${type} code for ${to}: ${otp}`);
      return;
    }
    console.error("[auth] RESEND_API_KEY is not set, so the sign-in code could not be sent.");
    return;
  }
  const { error } = await resendClient.emails.send({
    from: process.env.EMAIL_FROM ?? "Meshscale <onboarding@resend.dev>",
    to,
    subject: subjects[type],
    html: html(otp, type),
    text: `${subjects[type]}\n\nYour code is ${otp}. It expires in 5 minutes.`,
  });
  if (error) console.error("[auth] Resend could not send the code:", error.message);
}
