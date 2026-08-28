import nodemailer from "nodemailer";

const isEmailConfigured = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
);

// If SMTP isn't set up (or the host is unreachable, e.g. blocked by a free
// hosting tier), donations/accounts must still work — emails are a nice-to-have,
// never a requirement for the core flow. Short timeouts keep a stuck connection
// from lingering, and every send is expected to be called without awaiting it
// on the request path (see call sites), so a slow mail server never delays a response.
const transporter = isEmailConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
    })
  : null;

if (!isEmailConfigured) {
  console.warn(
    "Email is not configured (missing SMTP_HOST/SMTP_USER/SMTP_PASS) — " +
      "donation receipts and set-password emails will be skipped, not sent."
  );
}

export const sendMail = async ({ to, subject, html }) => {
  if (!transporter) {
    console.warn(`Skipped sending email to ${to} ("${subject}") — SMTP is not configured.`);
    return;
  }

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    html,
  });
};

export const sendDonationReceiptEmail = async ({ to, name, amount, currency, campaign }) => {
  await sendMail({
    to,
    subject: "Thank you for your donation to USWA",
    html: `
      <p>Dear ${name},</p>
      <p>Thank you for your generous donation of <strong>${currency} ${amount}</strong> to <strong>${campaign}</strong>.</p>
      <p>Your support helps us deliver health, education, and relief programs to communities who need it most.</p>
      <p>— USWA Charity</p>
    `,
  });
};

export const sendBankTransferNotificationEmail = async ({ to, name, amount, currency, campaign }) => {
  await sendMail({
    to,
    subject: "We've received your bank transfer notification",
    html: `
      <p>Dear ${name},</p>
      <p>Thank you for letting us know about your bank transfer of <strong>${currency} ${amount}</strong> to <strong>${campaign}</strong>.</p>
      <p>Your donation is marked as <strong>pending</strong> until we confirm the funds have arrived in our account. We'll follow up once it's confirmed.</p>
      <p>— USWA Charity</p>
    `,
  });
};

export const sendWiseTransferNotificationEmail = async ({
  to,
  name,
  amount,
  currency,
  campaign,
  transferReference,
}) => {
  await sendMail({
    to,
    subject: "We've received your Wise transfer notification",
    html: `
      <p>Dear ${name},</p>
      <p>Thank you for letting us know about your Wise transfer of <strong>${currency} ${amount}</strong> to <strong>${campaign}</strong>.</p>
      <p>Please make sure your transfer uses the payment reference <strong>${transferReference}</strong> so we can match it automatically.</p>
      <p>Your donation is marked as <strong>pending</strong> until we confirm the funds have arrived. We'll follow up once it's confirmed.</p>
      <p>— USWA Charity</p>
    `,
  });
};

export const sendSetPasswordEmail = async ({ to, name, setPasswordUrl }) => {
  await sendMail({
    to,
    subject: "Set your password for your new USWA account",
    html: `
      <p>Dear ${name},</p>
      <p>Thank you for donating to USWA. We've created an account for you so you can track your donation history.</p>
      <p><a href="${setPasswordUrl}">Click here to set your password</a> (this link expires in 24 hours).</p>
      <p>If you did not expect this email, you can safely ignore it.</p>
      <p>— USWA Charity</p>
    `,
  });
};
