import Link from 'next/link';
import Image from 'next/image';
import { Scissors } from 'lucide-react';

interface Service {
  name: string;
  description: string;
  price: string;
  duration: string;
}

const services: Service[] = [
  {
    name: 'Corte e finalização',
    description: 'Um corte pensado para valorizar seu estilo, com finalização profissional.',
    price: 'R$ 80,00',
    duration: '60 min',
  },
  {
    name: 'Escova',
    description: 'Cabelos alinhados, com movimento e acabamento para a ocasião.',
    price: 'R$ 55,00',
    duration: '45 min',
  },
  {
    name: 'Coloração',
    description: 'Renove a cor dos fios com um atendimento personalizado.',
    price: 'A partir de R$ 220,00',
    duration: '180 min',
  },
  {
    name: 'Manicure',
    description: 'Cuidados para as unhas com atenção aos detalhes.',
    price: 'R$ 45,00',
    duration: '50 min',
  },
];

export default function Home() {
  return (
    <div className="bg-[#d1d1d1] text-stone-800">
      <header className="fixed top-0 left-0 right-0 bg-[#d1d1d1]/90 backdrop-blur-sm shadow-md z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2" aria-label="Studio Anny Martins - início">
            <Image src="/studio-anny-martins.png" alt="Studio Anny Martins" width={156} height={74} priority className="h-12 w-auto object-contain" />
          </Link>
          <Link
            href="/login"
            className="bg-black text-white font-bold py-2 px-6 rounded-full hover:bg-stone-800 transition-colors duration-300 shadow-sm"
          >
            Agendar um horário
          </Link>
        </div>
      </header>

      <main className="pt-20">
        <section id="home" className="pb-20">
          <div className="bg-white">
            <div className="container mx-auto px-6 text-center py-16 md:py-20">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-stone-500 mb-4">Seu momento, seu estilo</p>
              <h1 className="text-4xl md:text-5xl font-bold text-black mb-4">
                Beleza e cuidado em cada detalhe
              </h1>
              <p className="text-lg md:text-xl text-stone-700 mb-8 max-w-2xl mx-auto">
                Encontre seu próximo horário e escolha o serviço ideal para você.
              </p>
              <Link
                href="/login"
                className="inline-block bg-transparent text-black font-bold py-3 px-8 rounded-full hover:bg-black hover:text-white transition-colors duration-300 border-2 border-black"
              >
                Agende seu horário
              </Link>
            </div>
          </div>
        </section>

        <section id="sobre" className="py-16 bg-white">
          <div className="container mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
            <div className="flex justify-center">
              <div className="w-64 h-64 md:w-80 md:h-80 rounded-full bg-[#d1d1d1] flex items-center justify-center shadow-xl">
                <Scissors className="w-24 h-24 text-stone-700" strokeWidth={1} aria-hidden="true" />
              </div>
            </div>
            <div>
              <h2 className="text-4xl font-bold text-black mb-4">Sobre o salão</h2>
              <p className="text-lg text-stone-600 leading-relaxed">
                Um espaço para cuidar de você com tranquilidade. Consulte os serviços, escolha um profissional
                e encontre um horário de forma simples — seus agendamentos ficam reunidos em um só lugar.
              </p>
            </div>
          </div>
        </section>

        <section id="servicos" className="py-20 bg-[#d1d1d1]">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-black">Serviços em destaque</h2>
              <p className="text-lg text-stone-700 mt-2">Consulte o catálogo completo e escolha seu próximo atendimento.</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {services.map((service) => (
                <article key={service.name} className="bg-white rounded-lg p-6 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300 flex flex-col">
                  <h3 className="text-xl font-bold text-black mb-2">{service.name}</h3>
                  <p className="text-stone-600 flex-grow mb-4">{service.description}</p>
                  <div className="mt-auto border-t border-stone-200 pt-4">
                    <p className="text-sm text-stone-500">{service.duration}</p>
                    <p className="text-xl font-semibold text-stone-900">{service.price}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white text-stone-700 py-10">
        <div className="container mx-auto px-6 text-center">
          <Image src="/studio-anny-martins.png" alt="Studio Anny Martins" width={180} height={86} className="mx-auto mb-4 h-16 w-auto object-contain" />
          <p className="mb-6 text-stone-500">Entre em contato e agende seu próximo atendimento.</p>
          <p className="mt-8 text-sm text-stone-500">
            © {new Date().getFullYear()} Studio Anny Martins. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
