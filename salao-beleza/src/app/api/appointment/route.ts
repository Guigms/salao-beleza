import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  sendAppointmentConfirmationEmail,
  sendAppointmentCancellationEmail,
  type AppointmentDetails,
  type AppointmentNotificationResult,
} from '@/lib/email';
import { endOfDay, startOfDay } from 'date-fns';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = "nodejs";

const unavailableNotifications: AppointmentNotificationResult = {
  customerSent: false,
  professionalSent: false,
};

async function notifyAfterAppointment(
  sender: (details: AppointmentDetails) => Promise<AppointmentNotificationResult>,
  details: AppointmentDetails,
): Promise<AppointmentNotificationResult> {
  try {
    return await sender(details);
  } catch (error) {
    console.error('Agendamento salvo, mas não foi possível configurar o envio de notificações:', error);
    return unavailableNotifications;
  }
}

export async function POST(req: NextRequest) {
  process.env.TZ = 'UTC';
  const account = await getAuthenticatedUser(req);
  if (!account) {
    return NextResponse.json({ message: 'É necessário entrar para realizar um agendamento.' }, { status: 401 });
  }
  if (account.role !== 'CLIENTE' && account.role !== 'PROFISSIONAL' && account.role !== 'ADMIN') {
    return NextResponse.json({ message: 'Este perfil não pode realizar agendamentos.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Dados inválidos para o agendamento.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ message: 'Dados incompletos para o agendamento.' }, { status: 400 });
  }

  const { date, customerId, professionalId, salonServiceId } = body as {
    date?: string;
    customerId?: number;
    professionalId?: number;
    salonServiceId?: number;
  };
  if (!date || !customerId || !professionalId || !salonServiceId) {
    return NextResponse.json({ message: 'Dados incompletos para o agendamento.' }, { status: 400 });
  }

  const targetCustomerId = account.role === 'CLIENTE' ? account.id : Number(customerId);
  const targetProfessionalId = account.role === 'PROFISSIONAL' ? account.id : Number(professionalId);
  if (!Number.isInteger(targetCustomerId) || !Number.isInteger(targetProfessionalId)) {
    return NextResponse.json({ message: 'Cliente ou profissional inválido.' }, { status: 400 });
  }
  const serviceId = Number(salonServiceId);
  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    return NextResponse.json({ message: 'Selecione um serviço válido.' }, { status: 400 });
  }

  const appointmentDate = new Date(date);
  const now = new Date();

  if (Number.isNaN(appointmentDate.getTime()) || appointmentDate < now) {
    return NextResponse.json({ message: 'Não é possível realizar agendamentos em datas ou horários passados.' }, { status: 400 });
  }

  try {
    const [customer, professional] = await Promise.all([
      prisma.user.findUnique({ where: { id: targetCustomerId }, select: { role: true } }),
      prisma.user.findUnique({ where: { id: targetProfessionalId }, select: { role: true } }),
    ]);

    if (customer?.role !== 'CLIENTE' || professional?.role !== 'PROFISSIONAL') {
      return NextResponse.json({ message: 'Cliente ou profissional não encontrado.' }, { status: 404 });
    }

    const service = await prisma.salonService.findFirst({
      where: { id: serviceId, isActive: true },
    });
    if (!service) {
      return NextResponse.json({ message: 'Serviço indisponível.' }, { status: 400 });
    }

    const requestedEnd = appointmentDate.getTime() + service.durationMinutes * 60_000;
    const blockedSlot = await prisma.blockedSlot.findFirst({
      where: {
        professionalId: targetProfessionalId,
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
        professionalId: targetProfessionalId,
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
        customerId: targetCustomerId,
        professionalId: targetProfessionalId,
        salonServiceId: service.id,
        service: service.name,
        servicePrice: service.price,
        durationMinutes: service.durationMinutes,
      },
    });

    const appointmentDetails = await prisma.appointment.findUnique({
      where: { id: appointment.id },
      include: {
        customer: true,
        professional: true,
      },
    });

    const notifications = appointmentDetails
      ? await notifyAfterAppointment(sendAppointmentConfirmationEmail, appointmentDetails)
      : unavailableNotifications;

    return NextResponse.json({ appointment, notifications }, { status: 201 });

  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ message: 'Este horário acabou de ser agendado por outra pessoa.' }, { status: 409 });
    }

    console.error("Erro ao criar agendamento:", error);
    return NextResponse.json({ message: 'Erro interno ao agendar.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  process.env.TZ = 'UTC';
  try {
    const account = await getAuthenticatedUser(request);
    if (!account) {
      return NextResponse.json({ message: 'É necessário entrar para cancelar um agendamento.' }, { status: 401 });
    }

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

    if (
      (account.role === 'CLIENTE' && appointmentDetails.customerId !== account.id) ||
      (account.role === 'PROFISSIONAL' && appointmentDetails.professionalId !== account.id) ||
      (account.role !== 'CLIENTE' && account.role !== 'PROFISSIONAL' && account.role !== 'ADMIN')
    ) {
      return NextResponse.json({ message: 'Você não tem permissão para cancelar este agendamento.' }, { status: 403 });
    }

    await prisma.appointment.delete({
      where: { id: appointmentId },
    });

    const notifications = await notifyAfterAppointment(sendAppointmentCancellationEmail, appointmentDetails);

    return NextResponse.json({ message: 'Agendamento cancelado com sucesso!', notifications });

  } catch (error) {
    console.error("Erro ao cancelar agendamento:", error);
    return NextResponse.json({ message: 'Erro interno do servidor' }, { status: 500 });
  }
}