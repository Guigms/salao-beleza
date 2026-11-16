import { Suspense } from 'react';
import Image from 'next/image';
import LoginForm from './login-form'; // Importa o novo componente cliente

export default function SignInPage() {
  return (
    <main className="flex min-h-screen w-full">
      {/* Coluna da esquerda que agora usa Suspense para carregar o formulário */}
      <div className="flex flex-1 flex-col justify-center bg-[#dcdcdc] p-8 sm:p-12 md:p-16 lg:w-1/2">
        <Suspense fallback={<div className="text-center">Carregando...</div>}>
          <LoginForm />
        </Suspense>
      </div>

      <div className="hidden flex-1 items-center justify-center bg-[#bcbcbc] lg:flex">
        <div className="text-center text-stone-900">
          <Image src="/studio-anny-martins.png" alt="Studio Anny Martins" width={300} height={144} className="mx-auto h-32 w-auto object-contain" />
          <p className="mt-3 text-lg">Seu próximo atendimento começa aqui.</p>
        </div>
      </div>
    </main>
  );
}
