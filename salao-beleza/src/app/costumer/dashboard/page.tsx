'use client';

import Image from 'next/image';
import { useEffect, useState, useRef } from 'react';
import { format, addDays, startOfWeek, addWeeks, subWeeks, isToday, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { toast } from 'sonner';


// --- TIPOS ---
type UserProfile = {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
};

// ✅ TIPO ATUALIZADO
type Professional = {
  id: number; 
  name: string; 
  avatarUrl?: string | null;
};

type AvailabilitySlot = { date: string; status: 'free' | 'booked' | 'blocked'; };
type SalonService = {
  id: number;
  name: string;
  price: number;
  durationMinutes: number;
};
type MyAppointment = {
  id: number;
  date: string;
  professional: { name: string; };
  service: string | null;
};

// --- Fetcher para o SWR ---
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    throw new Error('Falha ao buscar os dados.');
  }
  return res.json();
});

export default function PacienteDashboard() {
  const router = useRouter();
  
  // --- Estados do Componente ---
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [currentWeek, setCurrentWeek] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);


  // --- Gerenciamento de dados com SWR ---
  const { data: userData, error: userError } = useSWR<{user: UserProfile}>('/api/userJWT', fetcher);
  const { data: professionals, error: professionalsError } = useSWR<Professional[]>('/api/clinicos', fetcher);
  const { data: myAppointments, error: appointmentsError } = useSWR<MyAppointment[]>('/api/patient/myAppointment', fetcher);
  const { data: services, error: servicesError } = useSWR<SalonService[]>('/api/services', fetcher);
  
  const availabilityUrl = selectedProfessional && selectedServiceId
    ? `/api/availability?professionalId=${selectedProfessional.id}&serviceId=${selectedServiceId}&startDate=${format(currentWeek, 'yyyy-MM-dd')}`
    : null;
  const { data: availability, isLoading: isLoadingAvailability } = useSWR<AvailabilitySlot[]>(availabilityUrl, fetcher);

  const user = userData?.user;

  // Efeito para lidar com erro de autenticação
  useEffect(() => {
    if (userError) {
      router.push('/login');
    }
  }, [userError, router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      router.push('/login');
    }
  };

  // Efeito para fechar o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);



  const handleAgendar = async (slot: AvailabilitySlot) => {
    if (!user || !selectedProfessional || !selectedServiceId) return;
    const selectedService = services?.find(service => service.id === Number(selectedServiceId));
    if (!selectedService) {
      toast.error('Selecione um serviço disponível.');
      return;
    }
    if (!confirm(`Confirmar ${selectedService.name} com ${selectedProfessional.name} em ${format(new Date(slot.date), 'dd/MM/yyyy \'às\' HH:mm')}?`)) return;

    if (isPast(new Date(slot.date))) {
    toast.error('Não é possível agendar em um horário que já passou.');
    return;
  }

    const dateInISOString = new Date(slot.date).toISOString();

    try {
      const response = await fetch('/api/appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateInISOString,
          customerId: user.id,
          professionalId: selectedProfessional.id,
          salonServiceId: selectedService.id,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Não foi possível realizar o agendamento.');
      if (!data.notifications?.customerSent || !data.notifications?.professionalSent) {
        toast.warning('Agendamento salvo, mas uma ou mais notificações por e-mail não foram enviadas.');
      } else {
        toast.success('Agendamento realizado e notificações enviadas.');
      }
      mutate('/api/patient/myAppointment');
      mutate(availabilityUrl);
    } catch (error) {
      if(error instanceof Error) toast.error(error.message);
    }
  };

  const handleCancelar = async (appointmentId: number) => {
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;
    try {
      const response = await fetch(`/api/appointment?appointmentId=${appointmentId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Não foi possível cancelar o agendamento.');
      if (!data.notifications?.customerSent || !data.notifications?.professionalSent) {
        toast.warning('Agendamento cancelado, mas uma ou mais notificações por e-mail não foram enviadas.');
      } else {
        toast.success('Agendamento cancelado e notificações enviadas.');
      }
      mutate('/api/patient/myAppointment');
      mutate(availabilityUrl);
    } catch (error) {
      if(error instanceof Error) toast.error(error.message);
      else toast.error('Ocorreu um erro inesperado ao cancelar o agendamento.');
    }
  };

  // --- Constantes de Renderização ---
  const hours = Array.from({ length: 11 }, (_, i) => 8 + i);
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(currentWeek, i));

  // --- Tela para seleção do profissional e serviço ---
  if (!selectedProfessional) {
    return (
      <main className="bg-[#d1d1d1] min-h-screen flex flex-col items-center justify-center p-6 font-sans">
        <div className="text-center">
            <Image src="/studio-anny-martins.png" alt="Studio Anny Martins" width={180} height={86} priority className="mb-4 h-16 w-auto object-contain" />
            <h1 className="text-2xl font-bold text-zinc-800 mt-4">Bem-vindo(a), {user?.name}!</h1>
            <p className="text-zinc-600 mb-8">Escolha um serviço e profissional para ver os horários.</p>
        </div>
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg w-full max-w-sm space-y-3">
          <label htmlFor="salon-service" className="block text-sm font-medium text-zinc-700">Serviço</label>
          <select
            id="salon-service"
            value={selectedServiceId}
            onChange={(event) => setSelectedServiceId(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white p-3 text-zinc-800"
          >
            <option value="">Selecione um serviço</option>
            {services?.map(service => (
              <option key={service.id} value={service.id}>
                {service.name} · R$ {Number(service.price).toFixed(2)} · {service.durationMinutes} min
              </option>
            ))}
          </select>
          {servicesError && <p className="text-sm text-red-600">Não foi possível carregar os serviços.</p>}
          {services?.length === 0 && <p className="text-sm text-amber-700">Nenhum serviço cadastrado no catálogo.</p>}
          {!professionals && !professionalsError && <p className="text-center text-zinc-500">Carregando profissionais...</p>}
          {professionalsError && <p className="text-center text-red-600">Não foi possível carregar os profissionais.</p>}
          {professionals?.map(professional => (
            <button 
                key={professional.id}
                onClick={() => setSelectedProfessional(professional)}
                disabled={!selectedServiceId}
                className="w-full text-left p-4 rounded-lg bg-gray-100 hover:bg-blue-100 transition-colors flex items-center gap-4"
            >
              <Image 
                src={professional.avatarUrl || '/default-avatar.png'}
                alt={`Foto de ${professional.name}`}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <p className="font-bold text-zinc-800">{professional.name}</p>
                <p className="text-sm text-zinc-500">Profissional do salão</p>
              </div>
            </button>
          ))}
        </div>
        <button onClick={handleLogout} className="text-sm font-semibold text-red-600 hover:text-red-800 mt-8">Sair</button>
      </main>
    );
  }

  // --- Renderização do Dashboard Principal do Paciente ---
  return (
    <main className="bg-[#d1d1d1] min-h-screen p-4 md:p-6 font-sans">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
        <Image src="/studio-anny-martins.png" alt="Studio Anny Martins" width={156} height={74} priority className="h-14 w-auto object-contain" />
        <div className="flex items-center gap-4 self-end md:self-center">
          <span className="text-base md:text-lg font-medium text-zinc-700 text-right md:text-left">Bem-vindo(a),<br className="md:hidden"/> {user?.name}!</span>
           <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsDropdownOpen(prev => !prev)} className="rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              <Image
                src={user?.avatarUrl || "/default-avatar.png"}
                alt="avatar"
                width={48}
                height={48}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full shadow object-cover"
              />
            </button>
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                <Link href="/costumer/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  Meu Perfil
                </Link>
                <Link href="/costumer/history" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Meu Histórico</Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <section className="col-span-1 xl:col-span-3 bg-white p-4 md:p-6 rounded-2xl shadow">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-2 mb-4">
            <button onClick={() => setSelectedProfessional(null)} className="text-sm text-blue-600 font-medium hover:underline self-start">← Trocar de profissional</button>
            <h2 className="text-lg md:text-xl font-semibold text-gray-700 order-first md:order-none">Agenda de {selectedProfessional.name}</h2>
            <div className="flex items-center gap-2 self-end md:self-center">
              <button onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))} className="text-sm text-blue-600 font-medium hover:underline">← Anterior</button>
              <button onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))} className="text-sm text-blue-600 font-medium hover:underline">Próxima →</button>
            </div>
          </div>
          
          <div className="overflow-x-auto rounded-xl">
             {isLoadingAvailability ? (<div className="text-center p-10 text-zinc-500">Carregando agenda...</div>) : (
                <table className="min-w-full border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="p-1 md:p-2"></th>
                    {weekDays.map(day => (
                      <th key={day.toISOString()} className={`p-2 rounded-lg transition-colors ${isToday(day) ? 'bg-blue-100' : 'bg-gray-50'}`}>
                        <p className={`font-semibold text-xs md:text-sm ${isToday(day) ? 'text-blue-700' : 'text-gray-700'}`}>{format(day, 'EEE', { locale: ptBR })}</p>
                        <p className={`font-normal text-xs ${isToday(day) ? 'text-blue-500' : 'text-gray-500'}`}>{format(day, 'dd/MM')}</p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hours.map(hour => (
                    <tr key={hour}>
                      <td className="p-1 md:p-2 text-center text-xs font-semibold text-gray-500">{`${hour}:00`}</td>
                      {weekDays.map(day => {
                        const slotDate = `${format(day, 'yyyy-MM-dd')}T${String(hour).padStart(2, '0')}:00`;
                        const slot = availability?.find(s => s.date.startsWith(slotDate));
                        
                        return (
                          <td key={day.toISOString() + hour} className="p-1">
                            {slot ? (
                              <button
                                onClick={() => handleAgendar(slot)}
                                disabled={slot.status !== 'free'}
                                className={`w-full p-2 rounded-md text-xs font-semibold text-center transition-all ${
                                  slot.status === 'free' ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-700 cursor-not-allowed'
                                }`}
                              >
                                {slot.status === 'free' ? 'Agendar' : 'Ocupado'}
                              </button>
                            ) : (
                              <div className="w-full p-2 rounded-md bg-gray-100 h-9"></div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
             )}
          </div>
        </section>

        <aside className="bg-white p-4 md:p-6 rounded-2xl shadow h-fit">
          <h2 className="text-xl font-semibold mb-4 text-zinc-800">Meus Agendamentos</h2>
          <div className="space-y-3">
            {!myAppointments && !appointmentsError && <div className="text-sm text-center text-zinc-500 py-4">Carregando...</div>}
            {appointmentsError && <div className="text-sm text-center text-red-500 py-4">Falha ao carregar.</div>}
            {myAppointments && myAppointments.length > 0 ? (
              myAppointments.map(app => (
                <div key={app.id} className="p-3 rounded-lg bg-gray-50 border">
                  <p className="font-bold text-zinc-700">{format(new Date(app.date), "eeee, dd 'de' MMMM", { locale: ptBR })}</p>
                  <p className="text-zinc-600">às {format(new Date(app.date), 'HH:mm')} · {app.service || 'Serviço não informado'} com {app.professional.name}</p>
                  <button onClick={() => handleCancelar(app.id)} className="text-xs text-red-500 hover:underline mt-2">Cancelar agendamento</button>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500 text-center py-4">Você não possui agendamentos futuros.</p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}