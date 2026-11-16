// src/app/api/clinico/reports/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AppointmentStatus, Prisma } from '@prisma/client'; // 👈 importa Prisma

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
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
