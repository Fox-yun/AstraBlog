import { createHash } from "node:crypto";
import { Resend } from "resend";
import { siteConfig } from "@/config/site";

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM || `${siteConfig.name} <noreply@example.com>`;
const devEmailMode = process.env.DEV_EMAIL_MODE === "console" || !resendApiKey;

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

function createEmailIdempotencyKey(kind: "verification" | "password-reset", email: string, url: string) {
  const digest = createHash("sha256").update(`${kind}:${email}:${url}`).digest("hex");
  return `${kind}/${digest}`;
}

export async function sendVerificationEmail(email: string, url: string) {
  if (devEmailMode) {
    console.log("\n==============================================");
    console.log(`✉️  [DEV EMAIL MODE] Verification Email to: ${email}`);
    console.log(`👉 Verification URL: ${url}`);
    console.log("==============================================\n");
    return;
  }

  if (!resend) {
    throw new Error("Resend is not configured.");
  }

  const { error } = await resend.emails.send(
    {
      from: emailFrom,
      to: email,
      subject: `Verify your email - ${siteConfig.name}`,
      text: `Hello,\n\nPlease verify your email address by clicking on the link below:\n\n${url}\n\nThanks,\n${siteConfig.name}`,
    },
    { idempotencyKey: createEmailIdempotencyKey("verification", email, url) },
  );

  if (error) {
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
}

export async function sendResetPasswordEmail(email: string, url: string) {
  if (devEmailMode) {
    console.log("\n==============================================");
    console.log(`✉️  [DEV EMAIL MODE] Password Reset Email to: ${email}`);
    console.log(`👉 Reset URL: ${url}`);
    console.log("==============================================\n");
    return;
  }

  if (!resend) {
    throw new Error("Resend is not configured.");
  }

  const { error } = await resend.emails.send(
    {
      from: emailFrom,
      to: email,
      subject: `Reset your password - ${siteConfig.name}`,
      text: `Hello,\n\nYou requested a password reset. Please click on the link below to set a new password:\n\n${url}\n\nIf you did not request this, please ignore this email.\n\nThanks,\n${siteConfig.name}`,
    },
    { idempotencyKey: createEmailIdempotencyKey("password-reset", email, url) },
  );

  if (error) {
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
}
