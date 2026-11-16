// src/app/api/register/route.ts (CÓDIGO CORRIGIDO)

import { prisma } from '@/lib/prisma'; // ✅ USA A CONEXÃO CORRETA
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { createEmailTransporter, escapeHtml } from '@/lib/email';

export async function POST(req: NextRequest) {
  const { name, email, password, contact } = await req.json();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'E-mail já cadastrado.' }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

  await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      contact,
      role: 'CLIENTE',
      emailVerificationToken: token,
      emailVerificationExpires: expires,
    },
  });

  const transporter = createEmailTransporter();
  const salonName = process.env.SALON_NAME || 'Studio Anny Martins';
  const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const safeName = escapeHtml(name);
  const safeSalonName = escapeHtml(salonName);

  await transporter.sendMail({
    from: `${salonName} <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Verifique seu e-mail',
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f6f6f6; padding: 40px 20px;">
      <div style="max-width: 500px; margin: auto; background-color: #d1d1d1; border-radius: 8px; text-align: center; padding: 30px;">
        <img src="${baseUrl}/studio-anny-martins.png" alt="${safeSalonName}" style="width: 180px; margin-bottom: 20px;" />
        <h2 style="color: #333333; margin: 0 0 10px;">Confirme seu e-mail</h2>
        <p style="font-size: 16px; color: #555555; margin: 0 0 20px;">
          Olá, <strong>${safeName}</strong>,<br />
          Para ativar sua conta, clique no botão abaixo:
        </p>
        <a href="${baseUrl}/api/verify?token=${encodeURIComponent(token)}" style="display: inline-block; margin: 20px 0; background-color: #787f7e; color: white; text-decoration: none; padding: 14px 28px; border-radius: 24px; font-weight: bold;">
          Verificar e-mail
        </a>
        <p style="font-size: 14px; color: #999999; margin-top: 30px;">
          Se você não solicitou este cadastro, ignore este e-mail.
        </p>
      </div>
      <div style="text-align: center; color: #cccccc; font-size: 12px; margin-top: 20px;">
        <img src="${baseUrl}/studio-anny-martins.png" alt="${safeSalonName}" style="width: 140px; opacity: 0.6;" />
      </div>
    </div>
    `
  });


  return NextResponse.json({ message: 'Cadastro realizado. Verifique seu e-mail.' });
}