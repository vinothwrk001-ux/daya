/**
 * Email & SMS Notification Utility
 * Handles sending emails and SMS messages for password reset OTPs
 * Can be extended later with Nodemailer, SendGrid, or Twilio
 */

const { logger } = require("./logger");

let cachedTransport;
let cachedTransportKey;

/**
 * Build (and cache) a Nodemailer SMTP transport from environment config.
 * Returns null when SMTP is not configured.
 */
function getMailTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const key = `${host}:${port}:${secure}:${user}`;

  if (cachedTransport && cachedTransportKey === key) {
    return cachedTransport;
  }

  const nodemailer = require("nodemailer");
  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  cachedTransportKey = key;
  return cachedTransport;
}

/**
 * Send email notification via SMTP (Nodemailer). Logs only if SMTP unconfigured.
 */
async function sendEmail(payload = {}) {
  const { to, subject, template, data = {} } = payload;

  if (!to) {
    throw new Error("Email recipient (to) is required");
  }

  // Build email content based on template
  let htmlContent = "";
  let textContent = "";

  if (template === "passwordResetOTP") {
    htmlContent = buildPasswordResetEmailHTML(data);
    textContent = buildPasswordResetEmailText(data);
  }

  const transport = getMailTransport();
  if (!transport) {
    logger.warn("SMTP not configured; email not dispatched (logged only)", {
      to: maskEmail(to),
      subject,
      template,
    });
    return { sent: false, to: maskEmail(to), subject, template };
  }

  const from =
    process.env.SMTP_FROM ||
    process.env.SUPPORT_EMAIL ||
    process.env.SMTP_USER;

  try {
    const result = await transport.sendMail({
      from,
      to,
      subject,
      text: textContent,
      html: htmlContent || undefined,
    });
    logger.info("Email sent via SMTP", { to: maskEmail(to), subject, messageId: result?.messageId });
    return { sent: true, to: maskEmail(to), subject, template, messageId: result?.messageId };
  } catch (error) {
    logger.error("SMTP email send failed", { to: maskEmail(to), subject, error: error.message });
    throw error;
  }
}

/**
 * Send SMS notification
 * TODO: Implement with Twilio or similar SMS provider
 */
async function sendSMS(payload = {}) {
  const { to, template, data = {} } = payload;

  if (!to) {
    throw new Error("SMS recipient (to) is required");
  }

  logger.info("SMS notification queued", {
    to: maskPhone(to),
    template,
  });

  let messageContent = "";

  if (template === "passwordResetOTP") {
    messageContent = buildPasswordResetSMS(data);
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const smsFrom = process.env.TWILIO_SMS_NUMBER;

  // 1) Preferred: real Twilio SMS when an SMS-capable number is configured.
  if (accountSid && authToken && smsFrom) {
    try {
      const twilio = require("twilio");
      const client = twilio(accountSid, authToken);
      const result = await client.messages.create({
        from: smsFrom,
        to: formatSmsRecipient(to),
        body: messageContent,
      });
      logger.info("SMS sent via Twilio", { to: maskPhone(to), sid: result?.sid });
      return { sent: true, to: maskPhone(to), template, channel: "sms", sid: result?.sid };
    } catch (error) {
      logger.error("Twilio SMS send failed", { to: maskPhone(to), error: error.message });
      throw error;
    }
  }

  // 2) Fallback: deliver via Twilio WhatsApp (works with the sandbox setup).
  if (accountSid && authToken && process.env.TWILIO_WHATSAPP_NUMBER) {
    try {
      const { sendWhatsAppMessage } = require("../services/whatsapp.service");
      const result = await sendWhatsAppMessage(to, messageContent);
      logger.info("OTP delivered via WhatsApp fallback", { to: maskPhone(to), sid: result?.sid });
      return { sent: true, to: maskPhone(to), template, channel: "whatsapp", sid: result?.sid };
    } catch (error) {
      logger.error("WhatsApp OTP fallback failed", { to: maskPhone(to), error: error.message });
      throw error;
    }
  }

  logger.warn("No SMS/WhatsApp sender configured; OTP not dispatched (logged only)", {
    to: maskPhone(to),
    template,
  });

  return {
    sent: false,
    to: maskPhone(to),
    template,
  };
}

/**
 * Format a phone number for Twilio SMS (E.164). Defaults to India (+91) for
 * locally-stored 10-digit mobile numbers.
 */
function formatSmsRecipient(phone) {
  const normalized = String(phone || "").replace(/\D/g, "").trim();
  const countryCode = String(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "91").replace(/\D/g, "") || "91";
  if (!normalized) return "";
  if (normalized.length === 10) return `+${countryCode}${normalized}`;
  if (normalized.startsWith(countryCode) && normalized.length === countryCode.length + 10) {
    return `+${normalized}`;
  }
  return `+${normalized}`;
}

/**
 * Build HTML email for password reset OTP
 */
function buildPasswordResetEmailHTML(data = {}) {
  const { name, otp, expiryMinutes = 10, supportEmail = "support@example.com" } = data;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f8f9fa; padding: 20px; border-radius: 5px; }
    .otp-box { background: #e8f4f8; padding: 20px; border-left: 4px solid #007bff; margin: 20px 0; }
    .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 3px; color: #007bff; font-family: monospace; }
    .footer { font-size: 12px; color: #666; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset Request</h1>
    </div>
    
    <p>Hello ${name},</p>
    
    <p>You requested a password reset for your account. Your one-time password (OTP) is:</p>
    
    <div class="otp-box">
      <div class="otp-code">${otp}</div>
    </div>
    
    <p>This OTP expires in <strong>${expiryMinutes} minutes</strong>.</p>
    
    <p style="background: #fff3cd; padding: 10px; border-radius: 3px; border-left: 4px solid #ffc107;">
      <strong>⚠️ Security Notice:</strong> If you did not request this password reset, please ignore this message and ensure your account is secure.
    </p>
    
    <p>
      <strong>Do not share this OTP with anyone.</strong> Our team will never ask you for your password or OTP.
    </p>
    
    <div class="footer">
      <p>Questions? Contact us at <a href="mailto:${supportEmail}">${supportEmail}</a></p>
      <p>© 2026 UChooseMe. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Build plain text email for password reset OTP
 */
function buildPasswordResetEmailText(data = {}) {
  const { name, otp, expiryMinutes = 10, supportEmail = "support@example.com" } = data;

  return `
Password Reset Request

Hello ${name},

You requested a password reset for your account. Your one-time password (OTP) is:

${otp}

This OTP expires in ${expiryMinutes} minutes.

SECURITY NOTICE: If you did not request this password reset, please ignore this message and ensure your account is secure.

Do not share this OTP with anyone. Our team will never ask you for your password or OTP.

Questions? Contact us at ${supportEmail}

© 2026 UChooseMe. All rights reserved.
  `.trim();
}

/**
 * Build SMS message for password reset OTP
 */
function buildPasswordResetSMS(data = {}) {
  const { otp } = data;
  return `Your password reset OTP is ${otp}. Expires in 10 minutes. Do not share with anyone.`;
}

/**
 * Mask email for logging
 */
function maskEmail(email) {
  if (!email) return "***";
  const [local, domain] = email.split("@");
  return `${local.substring(0, 1)}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

/**
 * Mask phone for logging
 */
function maskPhone(phone) {
  if (!phone) return "***";
  return `****${phone.slice(-4)}`;
}

module.exports = {
  sendEmail,
  sendSMS,
  buildPasswordResetEmailHTML,
  buildPasswordResetEmailText,
  buildPasswordResetSMS,
};
