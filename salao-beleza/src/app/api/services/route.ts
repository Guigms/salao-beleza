import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const services = await prisma.salonService.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        durationMinutes: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(services);
  } catch (error) {
    console.error('Erro ao buscar serviços do salão:', error);
    return NextResponse.json({ message: 'Erro ao buscar serviços.' }, { status: 500 });
  }
}
