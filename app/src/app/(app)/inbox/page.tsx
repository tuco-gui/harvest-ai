import { redirect } from 'next/navigation';
import { perfilAtual } from '@/lib/supabase/server';
import { normalizarTelefone } from '@/lib/telefone';
import Inbox from '@/componentes/Inbox';
import CentralAtendimentosCrm from '@/componentes/CentralAtendimentosCrm';
import { perfilTemModulo } from '@/lib/autorizacao';
import { supabaseAdmin } from '@/lib/supabase/server';

export default async function PaginaInbox({ searchParams }: { searchParams: Promise<{ telefone?: string;conversa?:string }> }) {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (!perfil.conta_id) redirect('/');

  const parametros = await searchParams;
  const tel = typeof parametros.telefone === 'string' ? normalizarTelefone(parametros.telefone) : '';
  const conversa=typeof parametros.conversa==='string'&&/^[0-9a-f-]{36}$/i.test(parametros.conversa)?parametros.conversa:undefined;
  const admin = supabaseAdmin();
  const crmAvancado = await perfilTemModulo(admin, perfil, 'crm') &&
    await perfilTemModulo(admin, perfil, 'crm_avancado');
  return crmAvancado
    ? <CentralAtendimentosCrm telefoneInicial={tel || undefined} conversaInicial={conversa} />
    : <Inbox telefoneInicial={tel || undefined} />;
}
