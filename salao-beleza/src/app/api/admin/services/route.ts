import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type ServiceInput = {
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseServiceInput(value: unknown): ServiceInput | null {
  if (!isRecord(value)) return null;

  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const description = typeof value.description === 'string' ? value.description.trim() : '';
  const price = typeof value.price === 'number' ? value.price : Number(value.price);
  const durationMinutes = typeof value.durationMinutes === 'number'
    ? value.durationMinutes
    : Number(value.durationMinutes);
  if (
    !name ||
    name.length > 191 ||
    !description ||
    description.length > 65535 ||
    !Number.isFinite(price) ||
    price <= 0 ||
    price > 99_999_999.99 ||
    Math.abs(price * 100 - Math.round(price * 100)) > 1e-8 ||
    !Number.isSafeInteger(durationMinutes) ||
    durationMinutes <= 0 ||
    durationMinutes > 2_147_483_647
  ) return null;

  return { name, description, price, durationMinutes };
}

function invalidServiceInputResponse() {
  return NextResponse.json(
    { message: 'Informe nome, descrição, valor com até duas casas decimais e duração inteira em minutos.' },
    { status: 400 },
  );
}

async function getAdministrator(request: NextRequest) {
  const administrator = await getAuthenticatedUser(request);
  if (!administrator) {
    return NextResponse.json({ message: 'É necessário entrar como administrador.' }, { status: 401 });
  }
  if (administrator.role !== 'ADMIN') {
    return NextResponse.json({ message: 'Apenas administradores podem gerenciar serviços.' }, { status: 403 });
  }
  return null;
}

async function readServiceInput(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: NextResponse.json({ message: 'Corpo da requisição inválido.' }, { status: 400 }) };
  }

  const serviceInput = parseServiceInput(body);
  if (!serviceInput) {
    return { response: invalidServiceInputResponse() };
  }
  return { serviceInput };
}

export async function POST(request: NextRequest) {
  const authorizationError = await getAdministrator(request);
  if (authorizationError) return authorizationError;

  const parsed = await readServiceInput(request);
  if ('response' in parsed) return parsed.response;

  try {
    const service = await prisma.salonService.create({
      data: {
        ...parsed.serviceInput,
        price: new Prisma.Decimal(parsed.serviceInput.price.toFixed(2)),
      },
      select: {
        id: true,
        name: true,
        price: true,
        durationMinutes: true,
      },
    });

    return NextResponse.json({ service }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ message: 'Já existe um serviço com este nome.' }, { status: 409 });
    }
    console.error('Erro ao cadastrar serviço pelo painel administrativo:', error);
    return NextResponse.json({ message: 'Não foi possível cadastrar o serviço.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authorizationError = await getAdministrator(request);
  if (authorizationError) return authorizationError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Corpo da requisição inválido.' }, { status: 400 });
  }
  if (!isRecord(body)) {
    return NextResponse.json({ message: 'Dados inválidos.' }, { status: 400 });
  }

  const serviceId = Number(body.id);
  const serviceInput = parseServiceInput(body);
  if (!serviceInput) return invalidServiceInputResponse();
  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    return NextResponse.json({ message: 'Serviço inválido.' }, { status: 400 });
  }

  try {
    const service = await prisma.salonService.update({
      where: { id: serviceId },
      data: {
        ...serviceInput,
        price: new Prisma.Decimal(serviceInput.price.toFixed(2)),
      },
      select: {
        id: true,
        name: true,
        price: true,
        durationMinutes: true,
      },
    });

    return NextResponse.json({ service });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ message: 'Já existe um serviço com este nome.' }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ message: 'Serviço não encontrado.' }, { status: 404 });
    }
    console.error('Erro ao atualizar serviço pelo painel administrativo:', error);
    return NextResponse.json({ message: 'Não foi possível atualizar o serviço.' }, { status: 500 });
  }
}
