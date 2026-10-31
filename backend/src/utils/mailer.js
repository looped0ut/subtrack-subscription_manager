import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : null;

export async function sendMail({ to, subject, text }) {
  if (!transporter) {
    console.log('\n[DEV EMAIL - no SMTP configured]');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text);
    console.log('');
    return;
  }
  await transporter.sendMail({ from: env.smtp.from, to, subject, text });
}