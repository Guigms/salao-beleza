import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { sendAppointmentConfirmationEmail, sendAppointmentCancellationEmail } from '@/lib/email';
import { endOfDay, startOfDay } from 'date-fns';

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  process.env.TZ = 'UTC';
  const { date, customerId, professionalId, salonServiceId } = await req.json();

  if (!date || !customerId || !professionalId) {
    return NextResponse.json({ message: 'Dados incompletos para o agendamento.' }, { status: 400 });
  }

  const appointmentDate = new Date(date);
  const now = new Date();

  if (appointmentDate < now) {
    return NextResponse.json({ message: 'Não é possível realizar agendamentos em datas ou horários passados.' }, { status: 400 });
  }

  try {
    const service = salonServiceId
      ? await prisma.salonService.findFirst({
          where: { id: Number(salonServiceId), isActive: true },
        })
      : null;

    if (salonServiceId && !service) {
      return NextResponse.json({ message: 'Serviço indisponível.' }, { status: 400 });
    }

    const requestedEnd = appointmentDate.getTime() + (service?.durationMinutes ?? 60) * 60_000;
    const blockedSlot = await prisma.blockedSlot.findFirst({
      where: {
        professionalId: Number(professionalId),
        date: {
          gte: appointmentDate,
          lt: new Date(requestedEnd),
        },
      },
    });

    if (blockedSlot) {
      return NextResponse.json({ message: 'Este horário não está disponível.' }, { status: 409 });
    }

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        professionalId: Number(professionalId),
        date: { gte: startOfDay(appointmentDate), lte: endOfDay(appointmentDate) },
        status: { not: 'CANCELADO' },
      },
      select: {
        date: true,
        durationMinutes: true,
        salonService: { select: { durationMinutes: true } },
      },
    });

    const overlaps = existingAppointments.some(existing => {
      const existingEnd = existing.date.getTime() + (existing.durationMinutes ?? existing.salonService?.durationMinutes ?? 60) * 60_000;
      return existing.date.getTime() < requestedEnd && appointmentDate.getTime() < existingEnd;
    });

    if (overlaps) {
      return NextResponse.json({ message: 'O profissional já tem um agendamento nesse período.' }, { status: 409 });
    }

    const appointment = await prisma.appointment.create({
      data: {
        date: new Date(date),
        customerId: Number(customerId),
        professionalId: Number(professionalId),
        salonServiceId: service?.id,
        service: service?.name,
        servicePrice: service?.price,
        durationMinutes: service?.durationMinutes,
      },
    });

    const appointmentDetails = await prisma.appointment.findUnique({
      where: { id: appointment.id },
      include: {
        customer: true,
        professional: true,
      },
    });

    if (appointmentDetails) {
      sendAppointmentConfirmationEmail(appointmentDetails).catch(console.error);
    }

    return NextResponse.json(appointment, { status: 201 });

  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ message: 'Este horário acabou de ser agendado por outra pessoa.' }, { status: 409 });
    }
    
    console.error("Erro ao criar agendamento:", error);
    return NextResponse.json({ message: 'Erro interno ao agendar.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  process.env.TZ = 'UTC';
  try {
    const { searchParams } = new URL(request.url);
    const appointmentIdStr = searchParams.get('appointmentId');

    if (!appointmentIdStr) {
      return NextResponse.json({ message: 'O ID do agendamento é obrigatório' }, { status: 400 });
    }

    const appointmentId = parseInt(appointmentIdStr, 10);

    const appointmentDetails = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        customer: true,
        professional: true,
      },
    });

    if (!appointmentDetails) {
      return NextResponse.json({ message: 'Agendamento não encontrado' }, { status: 404 });
    }

    await prisma.appointment.delete({
      where: { id: appointmentId },
    });

    sendAppointmentCancellationEmail(appointmentDetails).catch(console.error);

    return NextResponse.json({ message: 'Agendamento cancelado com sucesso!' });

  } catch (error) {
    console.error("Erro ao cancelar agendamento:", error);
    return NextResponse.json({ message: 'Erro interno do servidor' }, { status: 500 });
  }
}