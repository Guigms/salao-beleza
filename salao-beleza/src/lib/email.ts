// src/lib/email.ts (CÓDIGO CORRIGIDO)

import nodemailer, { type SendMailOptions } from 'nodemailer';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { User, Appointment } from '@prisma/client';

// Tipagem para os detalhes do agendamento
export type AppointmentDetails = Appointment & {
  customer: User;
  professional: User;
};

export type AppointmentNotificationResult = {
  customerSent: boolean;
  professionalSent: boolean;
};

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

function salonLogo() {
  const salonName = escapeHtml(process.env.SALON_NAME || 'Studio Anny Martins');
  const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `<img src="${escapeHtml(`${baseUrl}/studio-anny-martins.png`)}" alt="${salonName}" style="width: 180px; margin-bottom: 20px;" />`;
}

export function createEmailTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error('SMTP_USER e SMTP_PASS precisam estar configurados para enviar e-mails.');
  }

  const port = Number(process.env.SMTP_PORT || 465);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT inválida.');
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.titan.email',
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: { user, pass },
  });
}

function senderAddress() {
  const user = process.env.SMTP_USER;
  if (!user) throw new Error('SMTP_USER precisa estar configurado para enviar e-mails.');
  return `${process.env.SALON_NAME || 'Studio Anny Martins'} <${user}>`;
}

async function sendToBothRecipients(
  transporter: ReturnType<typeof createEmailTransporter>,
  customerMessage: SendMailOptions,
  professionalMessage: SendMailOptions,
  eventName: string,
): Promise<AppointmentNotificationResult> {
  const [customerResult, professionalResult] = await Promise.allSettled([
    transporter.sendMail(customerMessage),
    transporter.sendMail(professionalMessage),
  ]);
  const result = {
    customerSent: customerResult.status === 'fulfilled',
    professionalSent: professionalResult.status === 'fulfilled',
  };

  if (!result.customerSent) {
    console.error(`Falha no e-mail de ${eventName} para o cliente:`, customerResult.status === 'rejected' ? customerResult.reason : undefined);
  }
  if (!result.professionalSent) {
    console.error(`Falha no e-mail de ${eventName} para o profissional:`, professionalResult.status === 'rejected' ? professionalResult.reason : undefined);
  }

  return result;
}

export async function sendAppointmentConfirmationEmail(details: AppointmentDetails) {
  const transporter = createEmailTransporter();
  const appointmentDate = new Date(details.date);
  const formattedDate = format(appointmentDate, "eeee, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const formattedTime = format(appointmentDate, 'HH:mm');
  const from = senderAddress();

  return sendToBothRecipients(
    transporter,
    {
      from,
      to: details.customer.email,
      subject: 'Agendamento confirmado!',
      html: `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
        ${salonLogo()}
        <h2>Olá, ${escapeHtml(details.customer.name)}!</h2>
        <p>Seu agendamento foi confirmado com sucesso.</p>
        <div style="margin: 20px 0; padding: 15px; background-color: #f2f2f2; border-radius: 8px; display: inline-block;">
          <p><strong>Profissional:</strong> ${escapeHtml(details.professional.name)}</p>
          <p><strong>Serviço:</strong> ${escapeHtml(details.service || 'A confirmar')}</p>
          <p><strong>Data:</strong> ${formattedDate}</p>
          <p><strong>Horário:</strong> ${formattedTime}</p>
        </div>
        <p>Até breve!</p>
      </div>
    `,
    },
    {
      from,
      to: details.professional.email,
      subject: 'Novo agendamento recebido!',
      html: `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
        ${salonLogo()}
        <h2>Olá, ${escapeHtml(details.professional.name)}!</h2>
        <p>Você tem um novo agendamento.</p>
        <div style="margin: 20px 0; padding: 15px; background-color: #f2f2f2; border-radius: 8px; display: inline-block;">
          <p><strong>Cliente:</strong> ${escapeHtml(details.customer.name)}</p>
          <p><strong>Serviço:</strong> ${escapeHtml(details.service || 'A confirmar')}</p>
          <p><strong>Data:</strong> ${formattedDate}</p>
          <p><strong>Horário:</strong> ${formattedTime}</p>
        </div>
      </div>
    `,
    },
    'confirmação',
  );
}

export async function sendAppointmentCancellationEmail(details: AppointmentDetails) {
  const transporter = createEmailTransporter();
  const appointmentDate = new Date(details.date);
  const formattedDate = format(appointmentDate, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  const from = senderAddress();

  return sendToBothRecipients(
    transporter,
    {
      from,
      to: details.customer.email,
      subject: 'Agendamento cancelado',
      html: `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
        ${salonLogo()}
        <h2>Olá, ${escapeHtml(details.customer.name)},</h2>
        <p>Seu agendamento para o dia ${formattedDate} com <strong>${escapeHtml(details.professional.name)}</strong> foi cancelado.</p>
        <p>Se você não solicitou o cancelamento, por favor entre em contato.</p>
      </div>
    `,
    },
    {
      from,
      to: details.professional.email,
      subject: 'Um agendamento foi cancelado',
      html: `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
        ${salonLogo()}
        <h2>Atenção, ${escapeHtml(details.professional.name)},</h2>
        <p>O agendamento com <strong>${escapeHtml(details.customer.name)}</strong> para o dia ${formattedDate} foi cancelado.</p>
        <p>Este horário está novamente disponível em sua agenda.</p>
      </div>
    `,
    },
    'cancelamento',
  );
}

export async function sendPasswordResetEmail(user: User, token: string) {
  const transporter = createEmailTransporter();
  const resetLink = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: senderAddress(),
    to: user.email,
    subject: 'Redefinição de Senha',
    html: `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 40px 20px;">
        <h2>Olá, ${user.name},</h2>
        <p>Você solicitou a redefinição de senha. Clique no link abaixo para criar uma nova:</p>
        <a href="${resetLink}" style="display: inline-block; margin: 20px 0; background-color: #787f7e; color: white; text-decoration: none; padding: 14px 28px; border-radius: 24px; font-weight: bold;">
          Redefinir Senha
        </a>
        <p style="font-size: 14px; color: #999999; margin-top: 30px;">
          Este link é válido por 1 hora. Se você não solicitou isso, ignore este e-mail.
        </p>
      </div>
    `,
  });
}