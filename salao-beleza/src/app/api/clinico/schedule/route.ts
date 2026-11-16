import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AppointmentStatus } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth';
import { getOccupiedHourKeys } from '@/lib/schedule';

// --- TIPOS ATUALIZADOS ---
type SlotStatus = 'booked' | 'blocked' | 'completed';

type SlotDetails = {
  status: SlotStatus;
  isContinuation?: boolean;
  appointmentId?: number;
  customerId?: number;
  customer?: { name:string | null };
};
type Schedule = {
  [key: string]: SlotDetails;
};

export async function GET(request: NextRequest) {
  try {
    const account = await getAuthenticatedUser(request);
    if (!account) {
      return NextResponse.json({ message: 'É necessário entrar para consultar a agenda.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const weekStartDateStr = searchParams.get('weekStartDate');
    const userIdStr = searchParams.get('userId');

    if (!weekStartDateStr || !userIdStr) {
      return NextResponse.json({ message: 'Parâmetros weekStartDate e userId são obrigatórios' }, { status: 400 });
    }

    const userId = parseInt(userIdStr, 10);
    if (
      !Number.isInteger(userId) ||
      (account.role !== 'ADMIN' && (account.role !== 'PROFISSIONAL' || account.id !== userId))
    ) {
      return NextResponse.json({ message: 'Você não pode consultar esta agenda.' }, { status: 403 });
    }
    const weekStart = new Date(`${weekStartDateStr}T00:00:00.000Z`);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999);

    const appointments = await prisma.appointment.findMany({
      where: {
        professionalId: userId,
        status: { not: AppointmentStatus.CANCELADO },
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      include: {
        customer: {
          select: { name: true },
        },
        salonService: {
          select: { durationMinutes: true },
        },
      },
    });

    const blockedSlots = await prisma.blockedSlot.findMany({
      where: {
        professionalId: userId,
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
    });

    const schedule: Schedule = {};

    appointments.forEach(app => {
      const status: SlotStatus = app.status === AppointmentStatus.CONCLUIDO ? 'completed' : 'booked';
      const durationMinutes = app.durationMinutes ?? app.salonService?.durationMinutes ?? 60;
      const occupiedHourKeys = getOccupiedHourKeys(app.date, durationMinutes);

      occupiedHourKeys.forEach((key, index) => {
        schedule[key] = {
          status,
          isContinuation: index > 0,
          appointmentId: app.id,
          customerId: app.customerId,
          customer: { name: app.customer?.name ?? null },
        };
      });
    });

    blockedSlots.forEach(slot => {
      if (!schedule[slot.date.toISOString()]) {
        schedule[slot.date.toISOString()] = {
          status: 'blocked',
        };
      }
    });

    return NextResponse.json(schedule);

  } catch (error) {
    console.error("Erro ao buscar agenda:", error);
    return NextResponse.json({ message: 'Erro interno do servidor' }, { status: 500 });
  }
}