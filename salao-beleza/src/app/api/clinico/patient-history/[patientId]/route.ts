// src/app/api/clinico/patient-history/[patientId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';

// Garante que a rota seja dinâmica e sempre busque os dados mais recentes
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  // A tipagem de 'params' agora é uma Promise
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const account = await getAuthenticatedUser(request);
    if (!account) {
      return NextResponse.json({ message: 'É necessário entrar para consultar históricos.' }, { status: 401 });
    }
    if (account.role !== 'ADMIN' && account.role !== 'PROFISSIONAL') {
      return NextResponse.json({ message: 'Apenas a equipe pode consultar históricos.' }, { status: 403 });
    }

    // Corrigido: Usamos 'await' para obter o valor de 'params'
    const { patientId: patientIdStr } = await params;
    const patientId = parseInt(patientIdStr, 10);

    if (isNaN(patientId)) {
      return NextResponse.json({ message: 'ID do cliente inválido.' }, { status: 400 });
    }

    // Busca o cliente e seus agendamentos, do mais recente para o mais antigo.
    const patientHistory = await prisma.user.findUnique({
      where: {
        id: patientId,
        role: 'CLIENTE',
        ...(account.role === 'PROFISSIONAL' && {
          customerAppointments: { some: { professionalId: account.id } },
        }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        contact: true,
        avatarUrl: true,
        customerAppointments: {
          orderBy: {
            date: 'desc', // O mais recente primeiro
          },
          select: {
            id: true,
            date: true,
            status: true,
            service: true,
            notes: true,
          },
        },
      },
    });

    if (!patientHistory) {
      return NextResponse.json({ message: 'Cliente não encontrado.' }, { status: 404 });
    }

    return NextResponse.json(patientHistory);

  } catch (error) {
    console.error('Erro ao buscar histórico do cliente:', error);
    return NextResponse.json(
      { message: 'Erro interno do servidor ao buscar histórico.' },
      { status: 500 }
    );
  }
}