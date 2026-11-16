import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const services = [
  {
    name: 'Corte e finalização',
    description: 'Corte personalizado com finalização profissional.',
    price: 80,
    durationMinutes: 60,
  },
  {
    name: 'Escova',
    description: 'Escova com acabamento e movimento.',
    price: 55,
    durationMinutes: 45,
  },
  {
    name: 'Coloração',
    description: 'Coloração personalizada; valor final pode variar conforme avaliação.',
    price: 220,
    durationMinutes: 180,
  },
  {
    name: 'Manicure',
    description: 'Cuidados e esmaltação das unhas.',
    price: 45,
    durationMinutes: 50,
  },
];

async function main() {
  for (const service of services) {
    await prisma.salonService.upsert({
      where: { name: service.name },
      update: {},
      create: service,
    });
  }
}

main()
  .catch((error) => {
    console.error('Falha ao carregar o catálogo inicial do salão:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
