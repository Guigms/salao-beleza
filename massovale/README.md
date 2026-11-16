# Salão Beleza

Sistema de agendamentos para salão de beleza, baseado em Next.js, Prisma e MySQL.
O repositório remoto configurado é [Guigms/salao-beleza](https://github.com/Guigms/salao-beleza).

## Desenvolvimento local

```powershell
npm install
npm run dev
```

O schema Prisma está em `prisma/schema.prisma`. Ele define clientes, profissionais,
serviços, agendamentos, horários bloqueados e os papéis de acesso. O cadastro público
cria contas de cliente; contas de profissional precisam ser configuradas separadamente.

## Banco de dados

O banco de teste foi inicializado com o schema Prisma e um catálogo de serviços de
exemplo. Para preparar outro banco, configure `DATABASE_URL` localmente (não coloque
credenciais no código) e execute:

```powershell
npx prisma validate
npx prisma db push
npm run db:seed
```

`db push` altera o banco indicado por `DATABASE_URL`; confirme o ambiente antes de
executá-lo. O seed adiciona serviços de exemplo sem substituir serviços de mesmo nome.
Os preços e durações são ilustrativos e devem ser revisados antes de uso real.

## Comandos

- `npm run dev`: inicia o servidor de desenvolvimento.
- `npm run build`: gera o cliente Prisma e compila a aplicação.
- `npm run lint`: executa o ESLint.
- `npm run db:seed`: grava os serviços iniciais no banco configurado.
