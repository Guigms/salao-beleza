'use client';

import Image from 'next/image';
import { useEffect, useState, useRef } from 'react';
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay, isToday, compareAsc, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import useSWR, { mutate } from 'swr';
import { CalendarDays, Clock3, Scissors, ShieldPlus, UserRound, X } from 'lucide-react';
import AdminUserModal, { type AdminCreatedUser } from '@/components/admin-user-modal';

// --- TIPOS ---
type UserProfile = {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: 'CLIENTE' | 'PROFISSIONAL' | 'ADMIN';
};

type Professional = { id: number; name: string; avatarUrl?: string | null };
type SlotStatus = 'booked' | 'blocked' | 'available' | 'completed';

type SlotDetails = {
  status: SlotStatus;
  isContinuation?: boolean;
  appointmentId?: number;
  customerId?: number;
  customer?: { name: string; };
};
type Schedule = { [isoDate: string]: SlotDetails; };
type Customer = { id: number; name: string; };
type SalonService = { id: number; name: string; price: number; durationMinutes: number };

// --- Fetcher genérico para o SWR ---
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    throw new Error('Falha ao carregar os dados.');
  }
  return res.json();
});

export default function ProfessionalDashboard() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<SlotDetails | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [service, setService] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [notes, setNotes] = useState('');
  const [adminUserModalOpen, setAdminUserModalOpen] = useState(false);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('');
  
  const [currentWeek, setCurrentWeek] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState<Customer[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Customer | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const patientDebounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const [, setPatientLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: userData, isLoading: isLoadingUser, error: userError } = useSWR('/api/userJWT', fetcher);
  const user: UserProfile | null = userData?.user || null;
  const { data: services } = useSWR<SalonService[]>('/api/services', fetcher);
  const isAdmin = user?.role === 'ADMIN';
  const { data: professionals, isLoading: isLoadingProfessionals } = useSWR<Professional[]>(
    isAdmin ? '/api/clinicos' : null,
    fetcher,
  );
  const scheduleProfessionalId = user
    ? (isAdmin ? Number(selectedProfessionalId) || null : user.id)
    : null;

  const weekStartDate = format(currentWeek, 'yyyy-MM-dd');
  const scheduleUrl = scheduleProfessionalId
    ? `/api/clinico/schedule?weekStartDate=${weekStartDate}&userId=${scheduleProfessionalId}`
    : null;
  const { data: schedule, isLoading: isLoadingSchedule } = useSWR<Schedule>(scheduleUrl, fetcher, {
    refreshInterval: 30000,
  });

  useEffect(() => {
    if (isAdmin && !selectedProfessionalId && professionals?.length) {
      setSelectedProfessionalId(String(professionals[0].id));
    }
  }, [isAdmin, professionals, selectedProfessionalId]);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      router.push('/login');
    }
  };

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


  useEffect(() => {
    if (patientQuery.length < 3) {
      setPatientResults([]);
      setShowPatientDropdown(false);
      setSelectedPatient(null);
      return;
    }
    setPatientLoading(true);
    if (patientDebounceTimeout.current) clearTimeout(patientDebounceTimeout.current);
    patientDebounceTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/patient?search=${encodeURIComponent(patientQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setPatientResults(data);
          setShowPatientDropdown(true);
        } else { setPatientResults([]); }
      } catch (error) {
        console.error('Erro na busca de pacientes:', error);
        setPatientResults([]);
      } finally { setPatientLoading(false); }
    }, 400);
    return () => { if (patientDebounceTimeout.current) clearTimeout(patientDebounceTimeout.current); };
  }, [patientQuery]);

  const handleAgendar = async () => {
    if (!selectedDate || !selectedPatient || !scheduleProfessionalId || !selectedServiceId) {
      toast.warning('Selecione um cliente e um serviço para agendar.');
      return;
    }
    const selectedService = services?.find(item => item.id === Number(selectedServiceId));
    if (!selectedService) {
      toast.error('Serviço indisponível. Atualize a página e tente novamente.');
      return;
    }
    try {
      const res = await fetch('/api/appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate.toISOString(),
          customerId: selectedPatient.id,
          professionalId: scheduleProfessionalId,
          salonServiceId: selectedService.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) { throw new Error(data.message || 'Erro ao agendar consulta.'); }

      if (!data.notifications?.customerSent || !data.notifications?.professionalSent) {
        toast.warning('Agendamento salvo, mas uma ou mais notificações por e-mail não foram enviadas.');
      } else {
        toast.success('Agendamento realizado e notificações enviadas.');
      }
      setModalOpen(false);
      setPatientQuery('');
      setSelectedPatient(null);
      setSelectedServiceId('');
      mutate(scheduleUrl);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Ocorreu um erro inesperado.');
      }
    }
  };

  const handleSetSlotStatus = async (status: 'blocked' | 'available') => {
    if (!selectedDate || !scheduleProfessionalId) return;
    try {
      let res;
      if (status === 'blocked') {
        res = await fetch('/api/clinico/blocked-slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: selectedDate.toISOString(), professionalId: scheduleProfessionalId }),
        });
      } else {
        const params = new URLSearchParams({ date: selectedDate.toISOString(), professionalId: String(scheduleProfessionalId) });
        res = await fetch(`/api/clinico/blocked-slots?${params.toString()}`, { method: 'DELETE' });
      }
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || `Horário ${status === 'blocked' ? 'bloqueado' : 'disponibilizado'} com sucesso!`);
        setModalOpen(false);
        mutate(scheduleUrl);
      } else {
        toast.error(data.message || 'Erro ao atualizar horário.');
      }
    } catch {
      toast.error('Erro de conexão ao atualizar horário.');
    }
  };

  const handleCancelarAgendamento = async (e: React.MouseEvent, appointmentId: number) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;
    try {
      const res = await fetch(`/api/appointment?appointmentId=${appointmentId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        if (!data.notifications?.customerSent || !data.notifications?.professionalSent) {
          toast.warning('Agendamento cancelado, mas uma ou mais notificações por e-mail não foram enviadas.');
        } else {
          toast.success('Agendamento cancelado e notificações enviadas.');
        }
        mutate(scheduleUrl);
      } else {
        toast.error(data.message || 'Erro ao cancelar agendamento.');
      }
    } catch {
      toast.error('Erro de conexão ao cancelar agendamento.');
    }
  };
    
  const handleFinalizarAtendimento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment?.appointmentId) return;
    try {
      const res = await fetch('/api/clinico/complete-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: selectedAppointment.appointmentId,
          service,
          notes,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Falha ao finalizar atendimento.');
      }
      toast.success('Atendimento finalizado com sucesso!');
      setFinalizeModalOpen(false);
      setService('');
      setNotes('');
      mutate(scheduleUrl);
    } catch (error) {
      if (error instanceof Error) toast.error(error.message);
      else toast.error('Ocorreu um erro inesperado.');
    }
  };

  const handleAdminUserCreated = (createdUser: AdminCreatedUser) => {
    if (createdUser.role === 'PROFISSIONAL') {
      setSelectedProfessionalId(String(createdUser.id));
    }
    setAdminUserModalOpen(false);
  };

  const startHour = 8;
  const endHour = 18;
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(currentWeek, i));
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  if (userError) router.push('/login');
  if (isLoadingUser || !user) return <div className="text-center p-10 text-gray-500">Carregando...</div>;

  return (
    <main className="bg-[#d1d1d1] min-h-screen p-4 md:p-6 font-sans">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
        <Image src="/studio-anny-martins.png" alt="Studio Anny Martins" width={156} height={74} priority className="h-14 w-auto object-contain" />
        <div className="flex items-center gap-4 self-end md:self-center">
          {isAdmin && (
            <>
              <Link href="/clinical/services" className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-50">
                <Scissors size={18} aria-hidden="true" />
                Gerenciar serviços
              </Link>
              <button onClick={() => setAdminUserModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800">
                <ShieldPlus size={18} aria-hidden="true" />
                Novo cadastro
              </button>
            </>
          )}
          <span className="text-base md:text-lg font-medium text-gray-700 text-right md:text-left">Olá,<br className="md:hidden"/> {user.name}!</span>
          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsDropdownOpen(p => !p)} className="rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500">
              <Image src={user.avatarUrl || "/default-avatar.png"} alt="avatar" width={48} height={48} className="w-10 h-10 md:w-12 md:h-12 rounded-full shadow object-cover"/>
            </button>
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                <Link href="/clinical/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Meu Perfil</Link>
                <Link href="/clinical/consultas" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Relatórios</Link>
                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">Sair</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isAdmin && (
        <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-amber-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-amber-50 p-3 text-amber-800"><CalendarDays size={20} aria-hidden="true" /></span>
            <div>
              <h2 className="font-semibold text-stone-800">Agenda da equipe</h2>
              <p className="text-sm text-stone-500">Escolha o profissional para consultar horários e criar reservas.</p>
            </div>
          </div>
          <label className="w-full sm:max-w-sm">
            <span className="sr-only">Profissional da agenda</span>
            <select
              value={selectedProfessionalId}
              onChange={(event) => setSelectedProfessionalId(event.target.value)}
              disabled={isLoadingProfessionals || !professionals?.length}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
            >
              <option value="">{isLoadingProfessionals ? 'Carregando equipe...' : 'Selecione um profissional'}</option>
              {professionals?.map((professional) => (
                <option key={professional.id} value={professional.id}>{professional.name}</option>
              ))}
            </select>
          </label>
        </section>
      )}

      {isAdmin && !scheduleProfessionalId && !isLoadingProfessionals ? (
        <section className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center shadow-sm">
          <Scissors className="mx-auto mb-3 text-amber-700" size={32} aria-hidden="true" />
          <h2 className="text-xl font-semibold text-stone-800">Cadastre um profissional para começar</h2>
          <p className="mx-auto mt-2 max-w-lg text-stone-500">Depois do cadastro, selecione a pessoa na lista para abrir a agenda e reservar horários para os clientes.</p>
          <button onClick={() => setAdminUserModalOpen(true)} className="mt-5 rounded-xl bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800">
            Cadastrar funcionário
          </button>
        </section>
      ) : isLoadingSchedule ? <div className="text-center p-10 text-gray-500">Carregando agenda...</div> : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <section className="col-span-1 xl:col-span-3 bg-white p-4 md:p-6 rounded-2xl shadow">
              <div className="flex justify-between items-center mb-4">
                <button onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))} className="text-sm font-medium text-amber-800 hover:underline">← Semana</button>
                <h2 className="text-lg md:text-xl font-semibold text-stone-800 text-center">Semana de {format(currentWeek, 'dd/MM')}</h2>
                <button onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))} className="text-sm font-medium text-amber-800 hover:underline">Próxima →</button>
              </div>
              <div className="overflow-x-auto rounded-xl">
                <table className="min-w-full overflow-hidden rounded-xl border border-stone-200">
                  <thead className="bg-stone-50">
                    <tr>
                      <th className="border px-3 py-2 text-left text-sm text-stone-500">Hora</th>
                      {weekDays.map((day) => (
                        <th key={day.toISOString()} className={`border px-3 py-2 text-center text-sm transition-colors ${isToday(day) ? 'bg-amber-50' : ''}`}>
                          <div className={`font-semibold ${isToday(day) ? 'text-amber-900' : 'text-stone-700'}`}>{format(day, 'EEEE', { locale: ptBR })}</div>
                          <div className={`${isToday(day) ? 'text-amber-700' : 'text-stone-500'}`}>{format(day, 'dd/MM')}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hours.map((hour) => (
                      <tr key={hour} className="bg-white transition hover:bg-amber-50/40">
                        <td className="border px-3 py-2 text-sm font-semibold text-stone-700">{`${hour.toString().padStart(2, '0')}:00`}</td>
                        {weekDays.map((day) => {
                          const slotDate = new Date(day);
                          slotDate.setHours(hour, 0, 0, 0);
                          const slotDetails = schedule ? schedule[slotDate.toISOString()] : undefined;
                          
                          let content;
                          if (slotDetails?.isContinuation) {
                            content = (
                              <div className={`rounded-xl px-2 py-1 text-xs font-medium ${slotDetails.status === 'completed' ? 'bg-stone-100 text-stone-500' : 'bg-amber-50 text-amber-800'}`}>
                                {slotDetails.status === 'completed' ? 'Concluído' : 'Em atendimento'}
                              </div>
                            );
                          } else if (slotDetails?.status === 'completed') {
                            content = (
                                <div className="flex flex-col items-center justify-center p-1">
                                    <div className="bg-gray-200 text-gray-600 text-xs rounded-xl px-2 py-1 font-medium whitespace-nowrap">{slotDetails.customer?.name}</div>
                                    <Link href={`/clinical/patient-history/${slotDetails.customerId}`} className="text-xs text-gray-500 hover:underline mt-1">(Ver histórico)</Link>
                                </div>
                            );
                          } else if (slotDetails?.status === 'booked') {
                            content = (
                                <div className="flex flex-col items-center justify-center gap-1 p-1">
                                    <div className="rounded-xl bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 md:text-sm">{slotDetails.customer?.name}</div>
                                    <div className="flex items-center flex-wrap justify-center gap-x-2 gap-y-1 mt-1">
                                        <Link href={`/clinical/patient-history/${slotDetails.customerId}`} className="text-xs text-amber-800 hover:underline">Ver histórico</Link>
                                        <button onClick={(e) => { e.stopPropagation(); setSelectedAppointment(slotDetails); setFinalizeModalOpen(true); }} className="text-xs text-green-600 hover:underline" disabled={!isPast(slotDate) && !isToday(slotDate)}>Finalizar</button>
                                        <button onClick={(e) => handleCancelarAgendamento(e, slotDetails.appointmentId!)} className="text-xs text-red-600 hover:underline">Cancelar</button>
                                    </div>
                                </div>
                            );
                          }
                          else if (slotDetails?.status === 'blocked') content = <div className="rounded-xl bg-red-100 px-2 py-1 text-xs font-medium text-red-800 md:text-sm">Bloqueado</div>;
                          else content = <div className="rounded-xl bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 md:text-sm">Disponível</div>;
                          
                          return (
                            <td key={slotDate.toISOString()} className={`border px-1 py-2 text-center transition-all md:px-2 ${slotDetails?.status === 'completed' ? 'bg-stone-50' : 'cursor-pointer hover:bg-amber-50'} ${isToday(day) && slotDetails?.status !== 'completed' ? 'bg-amber-50/60' : ''}`}
                              onClick={() => {
                                if (slotDetails?.status === 'completed' || slotDetails?.status === 'booked') return;
                                setSelectedDate(slotDate);
                                setModalOpen(true);
                                setPatientQuery('');
                                setSelectedPatient(null);
                              }}>{content}</td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            
            <section className="bg-white p-4 md:p-6 rounded-2xl shadow h-fit xl:col-span-1">
              <h2 className="mb-4 text-xl font-semibold text-stone-800 md:text-2xl">Próximos clientes (hoje)</h2>
              {(() => {
                const todayAppointments = schedule ? Object.entries(schedule).filter(([isoDate, details]) => details.status === 'booked' && !details.isContinuation && isSameDay(new Date(isoDate), new Date())).map(([isoDate, details]) => ({ id: details.appointmentId!, date: isoDate, customerName: details.customer!.name })).sort((a, b) => compareAsc(new Date(a.date), new Date(b.date))) : [];
                return (
                  <ul className="space-y-3">
                    {todayAppointments.length > 0 ? todayAppointments.map((a) => (
                      <li key={a.id} className="flex items-center gap-3">
                        <span className="w-14 text-sm font-bold text-amber-800">{format(new Date(a.date), 'HH:mm')}</span>
                        <div className="rounded-xl bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">{a.customerName}</div>
                      </li>
                    )) : <li className="text-sm text-gray-500">Nenhum cliente agendado para hoje.</li>}
                  </ul>
                );
              })()}
            </section>
          </div>
        </>
      )}

      {modalOpen && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="booking-modal-title" className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between bg-gradient-to-r from-stone-900 to-stone-700 px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                <span className="rounded-2xl bg-white/10 p-3"><CalendarDays size={22} aria-hidden="true" /></span>
                <div>
                  <h2 id="booking-modal-title" className="text-xl font-semibold">Novo agendamento</h2>
                  <p className="mt-1 text-sm text-stone-200">{format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })} às {format(selectedDate, 'HH:mm')}</p>
                </div>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Fechar" className="rounded-full p-2 text-stone-200 transition hover:bg-white/10 hover:text-white">
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={(event) => { event.preventDefault(); void handleAgendar(); }} className="space-y-5 p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-2xl bg-stone-50 p-4">
                  <UserRound className="shrink-0 text-amber-800" size={20} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Profissional</p>
                    <p className="truncate font-semibold text-stone-800">{isAdmin ? professionals?.find((person) => person.id === scheduleProfessionalId)?.name : user.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-stone-50 p-4">
                  <Clock3 className="shrink-0 text-amber-800" size={20} aria-hidden="true" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Horário</p>
                    <p className="font-semibold text-stone-800">{format(selectedDate, 'HH:mm')}</p>
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">Cliente</span>
                <div className="relative">
                  <input
                    type="search"
                    value={patientQuery}
                    onChange={(event) => { setPatientQuery(event.target.value); setSelectedPatient(null); }}
                    onFocus={() => { if (patientResults.length > 0) setShowPatientDropdown(true); }}
                    onBlur={() => { setTimeout(() => setShowPatientDropdown(false), 150); }}
                    placeholder="Digite ao menos 3 letras para buscar"
                    autoComplete="off"
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                  {showPatientDropdown && patientResults.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white p-1 shadow-xl">
                      {patientResults.map((customer) => (
                        <li key={customer.id}>
                          <button type="button" onMouseDown={() => { setSelectedPatient(customer); setPatientQuery(customer.name); setShowPatientDropdown(false); }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-stone-700 hover:bg-amber-50">
                            {customer.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {patientQuery.length >= 3 && !patientResults.length && !selectedPatient && (
                    <p className="mt-2 text-xs text-stone-500">Nenhum cliente encontrado. O cadastro de clientes é feito pelo administrador.</p>
                  )}
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">Serviço</span>
                <span className="relative block">
                  <Scissors className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} aria-hidden="true" />
                  <select value={selectedServiceId} onChange={(event) => setSelectedServiceId(event.target.value)} required className="w-full appearance-none rounded-xl border border-stone-200 bg-white py-3 pl-10 pr-3 text-stone-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
                    <option value="">Selecione um serviço</option>
                    {services?.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.durationMinutes} min · R$ {Number(item.price).toFixed(2)}</option>)}
                  </select>
                </span>
              </label>

              <div className="flex flex-col-reverse gap-3 border-t border-stone-100 pt-5 sm:flex-row sm:justify-between">
                <div className="flex gap-2">
                  <button type="button" onClick={() => void handleSetSlotStatus('blocked')} className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700">
                    Bloquear horário
                  </button>
                  <button type="button" onClick={() => void handleSetSlotStatus('available')} className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-600 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800">
                    Liberar
                  </button>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl px-4 py-3 font-medium text-stone-500 transition hover:bg-stone-50">Cancelar</button>
                  <button type="submit" disabled={!selectedPatient || !selectedServiceId} className="rounded-xl bg-amber-700 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50">
                    Confirmar agendamento
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}

      {finalizeModalOpen && selectedAppointment && (
          <div className="fixed inset-0 bg-black bg-opacity-20 flex justify-center items-center z-50 p-4">
              <form onSubmit={handleFinalizarAtendimento} className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-lg">
                  <h2 className="text-black text-xl font-semibold mb-2">Finalizar Atendimento</h2>
                  <p className="text-gray-600 mb-4">Cliente: {selectedAppointment.customer?.name}</p>
                  <div className="space-y-4">
                      <div>
                          <label htmlFor="service" className="block text-sm font-medium text-gray-700">Serviço realizado</label>
                          <input type="text" id="service" value={service} onChange={(e) => setService(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-black" placeholder="Ex.: Corte feminino"/>
                      </div>
                      <div>
                          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Observações do atendimento</label>
                          <textarea id="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-black" placeholder="Descreva observações..."/>
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                           <button type="button" onClick={() => { setFinalizeModalOpen(false); setService(''); setNotes(''); }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancelar</button>
                          <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">Salvar e Finalizar</button>
                      </div>
                  </div>
              </form>
          </div>
      )}
      <AdminUserModal open={adminUserModalOpen && isAdmin} onClose={() => setAdminUserModalOpen(false)} onCreated={handleAdminUserCreated} />
    </main>
  );
}