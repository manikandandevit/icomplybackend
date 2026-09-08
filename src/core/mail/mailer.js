import nodemailer from "nodemailer";
import { config } from "../../config/index.js";

let transporter = null;

const isConfigured = () => Boolean(config.smtp.host && config.smtp.email && config.smtp.password);

const getTransporter = () => {
  if (!isConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: Number(config.smtp.port) === 465,
      requireTLS: Number(config.smtp.port) === 587,
      auth: {
        user: config.smtp.email,
        pass: config.smtp.password,
      },
    });
  }
  return transporter;
};

export const sendMail = async ({ to, subject, html, text, attachments = [], fromName }) => {
  const mailer = getTransporter();
  if (!mailer) {
    console.warn("SMTP is not configured; skip email", subject);
    return false;
  }
  const recipients = (Array.isArray(to) ? to : String(to || "").split(","))
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(recipients)];
  if (!unique.length) return false;

  await mailer.sendMail({
    from: `"${fromName || config.smtp.fromName}" <${config.smtp.email}>`,
    to: unique.join(", "),
    subject,
    html,
    text,
    attachments,
  });
  return true;
};
