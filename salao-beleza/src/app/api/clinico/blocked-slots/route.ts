import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth';


export async function POST(request: NextRequest) {
  try {
    const account = await getAuthenticatedUser(request);
    if (!account) {
      return NextResponse.json({ message: 'É necessário entrar para gerenciar horários.' }, { status: 401 });
    }

    const body = await request.json();
    const { date, professionalId } = body;

    if (!date || !professionalId) {
      return NextResponse.json(
        { message: 'Parâmetros date e professionalId são obrigatórios' },
        { status: 400 }
      );
    }

    const targetProfessionalId = Number(professionalId);
    if (
      !Number.isInteger(targetProfessionalId) ||
      (account.role !== 'ADMIN' && (account.role !== 'PROFISSIONAL' || account.id !== targetProfessionalId))
    ) {
      return NextResponse.json({ message: 'Você não pode alterar a agenda deste profissional.' }, { status: 403 });
    }

    const slotDate = new Date(date);
    if (Number.isNaN(slotDate.getTime())) {
      return NextResponse.json({ message: 'Data inválida.' }, { status: 400 });
    }

    const professional = await prisma.user.findUnique({
      where: { id: targetProfessionalId },
      select: { role: true },
    });
    if (professional?.role !== 'PROFISSIONAL') {
      return NextResponse.json({ message: 'Profissional não encontrado.' }, { status: 404 });
    }

    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        date: slotDate,
        professionalId: targetProfessionalId,
      },
    });

    if (existingAppointment) {
      return NextResponse.json(
        { message: 'Este horário já está agendado e não pode ser bloqueado.' },
        { status: 409 }
      );
    }

    const newBlockedSlot = await prisma.blockedSlot.create({
      data: {
        date: slotDate,
        professionalId: targetProfessionalId,
      },
    });

    return NextResponse.json(newBlockedSlot, { status: 201 });

  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { message: 'Este horário já está bloqueado.' },
        { status: 409 }
      );
    }

    console.error("Erro ao bloquear horário:", error);
    return NextResponse.json(
      { message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}


export async function DELETE(request: NextRequest) {
  try {
    const account = await getAuthenticatedUser(request);
    if (!account) {
      return NextResponse.json({ message: 'É necessário entrar para gerenciar horários.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const professionalIdStr = searchParams.get('professionalId');

    if (!date || !professionalIdStr) {
      return NextResponse.json(
        { message: 'Parâmetros date e professionalId são obrigatórios na URL' },
        { status: 400 }
      );
    }

    const professionalId = parseInt(professionalIdStr, 10);
    if (
      !Number.isInteger(professionalId) ||
      (account.role !== 'ADMIN' && (account.role !== 'PROFISSIONAL' || account.id !== professionalId))
    ) {
      return NextResponse.json({ message: 'Você não pode alterar a agenda deste profissional.' }, { status: 403 });
    }

    await prisma.blockedSlot.deleteMany({
      where: {
        date: new Date(date),
        professionalId,
      },
    });

    return NextResponse.json(
      { message: 'Horário disponibilizado com sucesso.' },
      { status: 200 }
    );

  } catch (error) {
    console.error("Erro ao disponibilizar horário:", error);
    return NextResponse.json(
      { message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
