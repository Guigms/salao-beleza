'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { Clock3, Pencil, Plus, Scissors } from 'lucide-react';
import { toast } from 'sonner';

type SalonService = {
  id: number;
  name: string;
  description: string;
  price: number | string;
  durationMinutes: number;
};

type UserProfile = {
  name: string;
  role: 'CLIENTE' | 'PROFISSIONAL' | 'ADMIN';
};

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || 'Não foi possível carregar os dados.');
  }
  return data;
};

function isSalonService(value: unknown): value is SalonService {
  if (!value || typeof value !== 'object') return false;
  const service = value as Record<string, unknown>;
  return typeof service.id === 'number'
    && Number.isInteger(service.id)
    && typeof service.name === 'string'
    && typeof service.description === 'string'
    && (typeof service.price === 'number' || typeof service.price === 'string')
    && typeof service.durationMinutes === 'number'
    && Number.isInteger(service.durationMinutes);
}

function formatPrice(price: number | string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(price));
}

export default function ServicesPage() {
  const router = useRouter();
  const { data: userData, error: userError, isLoading: isLoadingUser } = useSWR<{ user: UserProfile }>('/api/userJWT', fetcher);
  const isAdmin = userData?.user.role === 'ADMIN';
  const {
    data: services,
    error: servicesError,
    isLoading: isLoadingServices,
  } = useSWR<SalonService[]>(isAdmin ? '/api/services' : null, fetcher);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (userError) {
      router.replace('/login');
    } else if (userData && userData.user.role !== 'ADMIN') {
      router.replace('/clinical/dashboard');
    }
  }, [router, userData, userError]);

  function resetForm() {
    setEditingId(null);
    setName('');
    setDescription('');
    setPrice('');
    setDurationMinutes('60');
  }

  function editService(service: SalonService) {
    setEditingId(service.id);
    setName(service.name);
    setDescription(service.description);
    setPrice(Number(service.price).toFixed(2));
    setDurationMinutes(String(service.durationMinutes));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/services', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          name,
          description,
          price: Number(price),
          durationMinutes: Number(durationMinutes),
        }),
      });
      const data: { message?: string; service?: unknown } = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Não foi possível salvar o serviço.');
      }
      if (!isSalonService(data.service)) {
        throw new Error('A resposta do servidor não contém os dados esperados do serviço.');
      }

      await mutate('/api/services');
      toast.success(editingId ? 'Serviço atualizado.' : 'Serviço cadastrado.');
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar o serviço.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingUser || !isAdmin) {
    return <main className="flex min-h-screen items-center justify-center bg-[#d1d1d1] p-6 text-stone-600">Carregando...</main>;
  }

  return (
    <main className="min-h-screen bg-[#d1d1d1] p-4 font-sans md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 rounded-2xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <Image src="/studio-anny-martins.png" alt="Studio Anny Martins" width={156} height={74} priority className="h-14 w-auto object-contain" />
            <div className="border-l border-stone-200 pl-5">
              <h1 className="text-xl font-semibold text-stone-900 md:text-2xl">Cadastro de serviços</h1>
              <p className="mt-1 text-sm text-stone-500">Defina os valores e a duração usados nos agendamentos.</p>
            </div>
          </div>
          <Link href="/clinical/dashboard" className="inline-flex items-center justify-center rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50">
            Voltar à agenda
          </Link>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="bg-gradient-to-r from-stone-900 to-stone-700 px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                <span className="rounded-2xl bg-white/10 p-3"><Scissors size={22} aria-hidden="true" /></span>
                <div>
                  <h2 className="text-lg font-semibold">{editingId ? 'Editar serviço' : 'Novo serviço'}</h2>
                  <p className="mt-1 text-sm text-stone-200">O tempo é informado em minutos.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">Nome do serviço</span>
                <input required maxLength={191} value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-stone-200 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100" placeholder="Ex.: Coloração completa" />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">Descrição</span>
                <textarea required maxLength={2000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} className="w-full resize-y rounded-xl border border-stone-200 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100" placeholder="Descreva o que está incluído no atendimento." />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-stone-700">Valor (R$)</span>
                  <input required type="number" min="0.01" max="99999999.99" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className="w-full rounded-xl border border-stone-200 px-4 py-3 text-stone-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100" placeholder="0,00" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-stone-700">Duração (minutos)</span>
                  <span className="relative block">
                    <Clock3 className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} aria-hidden="true" />
                    <input required type="number" min="1" step="1" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} className="w-full rounded-xl border border-stone-200 py-3 pl-10 pr-4 text-stone-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100" placeholder="60" />
                  </span>
                  <span className="mt-1 block text-xs text-stone-500">Exemplo: 180 minutos reservam 3 horas.</span>
                </label>
              </div>

              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                A duração e o valor serão carregados ao escolher o serviço no agendamento. Reservas existentes mantêm os dados registrados quando foram criadas.
              </p>

              <div className="flex flex-col-reverse gap-3 border-t border-stone-100 pt-5 sm:flex-row sm:justify-end">
                {editingId && (
                  <button type="button" onClick={resetForm} disabled={isSubmitting} className="rounded-xl border border-stone-200 px-5 py-3 font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50">
                    Cancelar edição
                  </button>
                )}
                <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-700 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60">
                  {editingId ? <Pencil size={17} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
                  {isSubmitting ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar serviço'}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-stone-900">Serviços cadastrados</h2>
                <p className="mt-1 text-sm text-stone-500">Estes serviços ficam disponíveis na agenda da equipe.</p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-900">{services?.length ?? 0}</span>
            </div>

            {servicesError && (
              <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
                Não foi possível carregar os serviços. Atualize a página e tente novamente.
              </div>
            )}
            {isLoadingServices && <p className="py-8 text-center text-sm text-stone-500">Carregando serviços...</p>}
            {!isLoadingServices && !servicesError && services?.length === 0 && (
              <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center">
                <Scissors className="mx-auto mb-3 text-amber-700" size={28} aria-hidden="true" />
                <p className="font-medium text-stone-800">Nenhum serviço cadastrado.</p>
                <p className="mt-1 text-sm text-stone-500">Use o formulário para incluir o primeiro serviço.</p>
              </div>
            )}
            <ul className="space-y-3">
              {services?.map((service) => (
                <li key={service.id} className={`rounded-2xl border p-4 transition ${editingId === service.id ? 'border-amber-300 bg-amber-50/60' : 'border-stone-200 bg-white'}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-stone-900">{service.name}</h3>
                      <p className="mt-1 text-sm text-stone-500">{service.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">{formatPrice(service.price)}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-sm font-medium text-stone-700">
                          <Clock3 size={14} aria-hidden="true" />
                          {service.durationMinutes} min
                        </span>
                      </div>
                    </div>
                    <button type="button" onClick={() => editService(service)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-900">
                      <Pencil size={15} aria-hidden="true" />
                      Editar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
