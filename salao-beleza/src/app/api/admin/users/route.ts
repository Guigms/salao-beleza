import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const administrator = await getAuthenticatedUser(request);
  if (!administrator) {
    return NextResponse.json({ message: 'É necessário entrar como administrador.' }, { status: 401 });
  }
  if (administrator?.role !== 'ADMIN') {
    return NextResponse.json({ message: 'Apenas administradores podem cadastrar usuários.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ message: 'Dados inválidos.' }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const contact = typeof input.contact === 'string' ? input.contact.trim() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const role = input.role;

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !contact || password.length < 10) {
    return NextResponse.json(
      { message: 'Informe nome, e-mail válido, contato e senha com pelo menos 10 caracteres.' },
      { status: 400 },
    );
  }

  if (role !== 'CLIENTE' && role !== 'PROFISSIONAL') {
    return NextResponse.json({ message: 'Tipo de usuário inválido.' }, { status: 400 });
  }

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        contact,
        password: await bcrypt.hash(password, 12),
        role,
        emailVerified: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        contact: true,
        role: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ message: 'Já existe uma conta com este e-mail.' }, { status: 409 });
    }
    console.error('Erro ao cadastrar usuário pelo painel administrativo:', error);
    return NextResponse.json({ message: 'Não foi possível cadastrar o usuário.' }, { status: 500 });
  }
}
