// src/app/api/patient/[id]/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Mantemos esta linha, ela é essencial
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // ✅ aguardamos o params
    const patientId = parseInt(id, 10);

    if (isNaN(patientId)) {
      return NextResponse.json({ message: 'ID do paciente inválido.' }, { status: 400 });
    }

    const customer = await prisma.user.findUnique({
      where: {
        id: patientId,
        role: 'CLIENTE',
      },
      select: {
        id: true,
        name: true,
        email: true,
        contact: true,
        avatarUrl: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ message: 'Cliente não encontrado.' }, { status: 404 });
    }

    return NextResponse.json(customer);

  } catch (error) {
    console.error('Erro ao buscar detalhes do cliente:', error);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}
