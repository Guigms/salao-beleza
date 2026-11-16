'use client';

import { FormEvent, useState } from 'react';
import { Scissors, UserRound, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { mutate } from 'swr';

export type AdminCreatedUser = {
  id: number;
  name: string;
  email: string;
  role: 'CLIENTE' | 'PROFISSIONAL';
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (user: AdminCreatedUser) => void;
};

function isAdminCreatedUser(value: unknown): value is AdminCreatedUser {
  if (!value || typeof value !== 'object') return false;
  const user = value as Record<string, unknown>;
  return typeof user.id === 'number'
    && Number.isInteger(user.id)
    && typeof user.name === 'string'
    && typeof user.email === 'string'
    && (user.role === 'CLIENTE' || user.role === 'PROFISSIONAL');
}

export default function AdminUserModal({ open, onClose, onCreated }: Props) {
  const [role, setRole] = useState<AdminCreatedUser['role']>('PROFISSIONAL');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, name, email, contact, password }),
      });
      const data: { message?: string; user?: unknown } = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Não foi possível cadastrar o usuário.');
      }
      if (!isAdminCreatedUser(data.user) || data.user.role !== role) {
        throw new Error('A resposta do servidor não contém os dados esperados do usuário.');
      }

      await mutate('/api/clinicos');
      toast.success(`${role === 'PROFISSIONAL' ? 'Funcionário' : 'Cliente'} cadastrado com sucesso.`);
      onCreated(data.user);
      setName('');
      setEmail('');
      setContact('');
      setPassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao cadastrar o usuário.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-user-title"
        className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between bg-gradient-to-r from-stone-900 to-stone-700 px-6 py-5 text-white">
          <div className="flex gap-3">
            <span className="rounded-2xl bg-white/10 p-3">
              <UserPlus size={22} aria-hidden="true" />
            </span>
            <div>
              <h2 id="admin-user-title" className="text-xl font-semibold">Novo cadastro</h2>
              <p className="mt-1 text-sm text-stone-200">Crie um acesso para funcionário ou cliente.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} aria-label="Fechar" className="rounded-full p-2 text-stone-200 transition hover:bg-white/10 hover:text-white">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-stone-700">Tipo de conta</span>
            <span className="relative block">
              {role === 'PROFISSIONAL' ? (
                <Scissors className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} aria-hidden="true" />
              ) : (
                <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} aria-hidden="true" />
              )}
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as AdminCreatedUser['role'])}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 py-3 pl-10 pr-3 text-stone-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              >
                <option value="PROFISSIONAL">Funcionário / profissional</option>
                <option value="CLIENTE">Cliente</option>
              </select>
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-medium text-stone-700">Nome completo</span>
              <input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="w-full rounded-xl border border-stone-200 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100" placeholder="Nome da pessoa" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-stone-700">E-mail de acesso</span>
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="w-full rounded-xl border border-stone-200 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100" placeholder="nome@email.com" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-stone-700">Telefone</span>
              <input required type="tel" value={contact} onChange={(event) => setContact(event.target.value)} autoComplete="tel" className="w-full rounded-xl border border-stone-200 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100" placeholder="(00) 00000-0000" />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-medium text-stone-700">Senha inicial</span>
              <input required type="password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="w-full rounded-xl border border-stone-200 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100" placeholder="Mínimo de 10 caracteres" />
              <span className="mt-1 block text-xs text-stone-500">A conta será ativada imediatamente. Informe a senha inicial à pessoa com segurança.</span>
            </label>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-stone-100 pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-xl border border-stone-200 px-5 py-3 font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50">
              Voltar
            </button>
            <button type="submit" disabled={isSubmitting} className="rounded-xl bg-amber-700 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? 'Salvando...' : 'Criar acesso'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
