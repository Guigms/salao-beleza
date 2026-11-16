import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function getAuthenticatedUser(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;

  let userId: number;
  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload !== 'object' || typeof payload.userId !== 'number' || !Number.isInteger(payload.userId)) {
      return null;
    }
    userId = payload.userId;
  } catch {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
}
