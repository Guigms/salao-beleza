
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addDays, startOfDay, endOfDay, format } from 'date-fns';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const professionalId = Number(searchParams.get('professionalId'));
  const serviceId = Number(searchParams.get('serviceId'));
  const startDateParam = searchParams.get('startDate');

  if (!professionalId || !serviceId || !startDateParam) {
    return NextResponse.json({ message: 'Profissional, serviço e data de início são obrigatórios.' }, { status: 400 });
  }

  // ✅ AQUI ESTÁ A CORREÇÃO DEFINITIVA
  const weekStart = startOfDay(new Date(`${startDateParam}T00:00:00`));
  const weekEnd = endOfDay(addDays(weekStart, 4));

  try {
    const [bookedAppointments, blockedSlots, selectedService] = await Promise.all([
      prisma.appointment.findMany({
        where: { professionalId, date: { gte: weekStart, lte: weekEnd } },
        include: {
          customer: { select: { name: true } },
          salonService: { select: { durationMinutes: true } },
        },
      }),
      prisma.blockedSlot.findMany({
        where: { professionalId, date: { gte: weekStart, lte: weekEnd } },
      }),
      prisma.salonService.findFirst({
        where: { id: serviceId, isActive: true },
        select: { durationMinutes: true },
      }),
    ]);

    if (!selectedService) {
      return NextResponse.json({ message: 'Serviço indisponível.' }, { status: 404 });
    }

    const blockedTimestamps = new Set(blockedSlots.map(b => b.date.getTime()));

    const allPossibleSlots = [];
    const workingHours = Array.from({ length: 11 }, (_, i) => 8 + i);

    for (let i = 0; i < 5; i++) {
      const currentDay = addDays(weekStart, i);
      for (const hour of workingHours) {
        const slotDate = new Date(currentDay);
        slotDate.setUTCHours(hour + 3, 0, 0, 0);
        allPossibleSlots.push(slotDate);
      }
    }

    const finalCalendar = allPossibleSlots.map(slotDate => {
      const timestamp = slotDate.getTime();
      let status: 'free' | 'booked' | 'blocked' = 'free';
      let appointmentDetails: { customerName: string } | null = null;

      if ([...blockedTimestamps].some(blockedTime => blockedTime >= timestamp && blockedTime < timestamp + selectedService.durationMinutes * 60_000)) {
        status = 'blocked';
      } else if (bookedAppointments.some(appointment => {
        const appointmentStart = appointment.date.getTime();
        const appointmentEnd = appointmentStart + (appointment.durationMinutes ?? appointment.salonService?.durationMinutes ?? 60) * 60_000;
        const requestedEnd = timestamp + selectedService.durationMinutes * 60_000;
        return appointmentStart < requestedEnd && timestamp < appointmentEnd;
      })) {
        status = 'booked';
        const appointment = bookedAppointments.find(a => {
          const appointmentStart = a.date.getTime();
          const appointmentEnd = appointmentStart + (a.durationMinutes ?? a.salonService?.durationMinutes ?? 60) * 60_000;
          const requestedEnd = timestamp + selectedService.durationMinutes * 60_000;
          return appointmentStart < requestedEnd && timestamp < appointmentEnd;
        });
        appointmentDetails = { customerName: appointment?.customer.name || 'Desconhecido' };
      }

      return {
        date: `${format(slotDate, 'yyyy-MM-dd')}T${String(slotDate.getUTCHours() - 3).padStart(2, '0')}:00`,
        status,
        appointmentDetails,
      };
    });

    return NextResponse.json(finalCalendar);

  } catch (error) {
    console.error("Erro ao calcular disponibilidade:", error);
    return NextResponse.json({ message: "Erro interno no servidor." }, { status: 500 });
  }
}