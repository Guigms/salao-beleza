// src/app/api/patient/history/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET!;

export async function GET() {
  const token = (await cookies()).get('token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    const customerId = decoded.userId;

    const appointments = await prisma.appointment.findMany({
      where: {
        customerId,
        status: {
          in: ['AGENDADO', 'CONCLUIDO']
        }
      },
      include: {
        professional: {
          select: {
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        date: 'desc', // Mais recentes primeiro
      },
    });

    return NextResponse.json(appointments);

  } catch (error) {
    console.error("Erro ao buscar histórico de agendamentos do paciente:", error);
    return NextResponse.json({ error: 'Token inválido ou erro interno' }, { status: 401 });
  }
}