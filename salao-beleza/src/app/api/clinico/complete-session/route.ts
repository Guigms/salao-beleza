// src/app/api/clinico/complete-session/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const account = await getAuthenticatedUser(req);
  if (!account) {
    return NextResponse.json({ message: 'É necessário entrar para finalizar atendimentos.' }, { status: 401 });
  }
  if (account.role !== 'ADMIN' && account.role !== 'PROFISSIONAL') {
    return NextResponse.json({ message: 'Apenas a equipe pode finalizar atendimentos.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Dados inválidos para finalizar o atendimento.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ message: 'Dados inválidos para finalizar o atendimento.' }, { status: 400 });
  }

  const { appointmentId, service, notes } = body as {
    appointmentId?: number;
    service?: string;
    notes?: string;
  };

  if (!appointmentId) {
    return NextResponse.json({ message: 'ID do agendamento é obrigatório.' }, { status: 400 });
  }

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: Number(appointmentId) },
      select: { professionalId: true },
    });
    if (!appointment) {
      return NextResponse.json({ message: 'Agendamento não encontrado.' }, { status: 404 });
    }
    if (account.role === 'PROFISSIONAL' && appointment.professionalId !== account.id) {
      return NextResponse.json({ message: 'Você não pode finalizar atendimento de outro profissional.' }, { status: 403 });
    }

    const updatedAppointment = await prisma.appointment.update({
      where: {
        id: Number(appointmentId),
      },
      data: {
        service,
        notes,
        status: 'CONCLUIDO',
      },
    });

    return NextResponse.json(updatedAppointment, { status: 200 });

  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ message: 'Agendamento não encontrado.' }, { status: 404 });
    }
    console.error("Erro ao finalizar atendimento:", error);
    return NextResponse.json({ message: 'Erro interno ao finalizar atendimento.' }, { status: 500 });
  }
}