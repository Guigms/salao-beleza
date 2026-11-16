// src/app/api/clinico/reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AppointmentStatus, Prisma } from '@prisma/client'; // 👈 importa Prisma
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const account = await getAuthenticatedUser(request);
    if (!account) {
      return NextResponse.json({ message: 'É necessário entrar para consultar os relatórios.' }, { status: 401 });
    }
    if (account.role !== 'ADMIN' && account.role !== 'PROFISSIONAL') {
      return NextResponse.json({ message: 'Apenas a equipe pode consultar relatórios.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const professionalId = searchParams.get('professionalId');
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!professionalId) {
      return NextResponse.json(
        { message: 'O ID do profissional é obrigatório.' },
        { status: 400 }
      );
    }
    if (account.role === 'PROFISSIONAL' && Number(professionalId) !== account.id) {
      return NextResponse.json({ message: 'Você não pode consultar relatórios de outro profissional.' }, { status: 403 });
    }

    // Tipagem correta
    const whereClause: Prisma.AppointmentWhereInput = {
      professionalId: parseInt(professionalId),
      status: AppointmentStatus.CONCLUIDO,
    };

    if (customerId) {
      whereClause.customerId = parseInt(customerId);
    }

    if (startDate && endDate) {
      const start = new Date (`${startDate}T00:00:00`);

      const end = new Date(`${endDate}T23:59:59`);
      end.setHours(23, 59, 59, 999);

      whereClause.date = {
        gte: start,
        lte: end,
      };
    }

    const completedAppointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        customer: {
          select: { name: true },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    return NextResponse.json(completedAppointments);
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    return NextResponse.json(
      { message: 'Erro interno do servidor ao buscar relatório.' },
      { status: 500 }
    );
  }
}
