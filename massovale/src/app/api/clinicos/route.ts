// src/app/api/clinicos/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const professionals = await prisma.user.findMany({
      where: { role: 'PROFISSIONAL' },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json(professionals);
  } catch (error) {
    console.error('Erro ao buscar profissionais:', error);
    return NextResponse.json({ message: 'Erro ao buscar profissionais' }, { status: 500 });
  }
}
