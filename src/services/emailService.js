import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendMail = async ({ to, subject, html }) => {
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
