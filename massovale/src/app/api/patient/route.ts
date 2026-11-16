import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get('search');

  if (!search || search.length < 3) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const customers = await prisma.user.findMany({
      where: {
        role: 'CLIENTE',
        
        name: {
          contains: search,
        },
      },
      select: {
        id: true,
        name: true,
      },
      take: 10,
    });

    return NextResponse.json(customers);
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar clientes.' }, { status: 500 });
  }
}