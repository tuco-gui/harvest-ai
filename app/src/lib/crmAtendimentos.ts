import type { SupabaseClient } from '@supabase/supabase-js';
import type { Perfil } from './supabase/server';
import { isAdmin } from './crmControleAcesso.ts';
import { normalizarTelefone } from './telefone.ts';
import { prioridadeValida, prazoTriagem, type Prioridade } from './crmEtiquetas.ts';

export const STATUS_ATENDIMENTO = ['aberto', 'pendente', 'resolvido'] as const;
export type StatusAtendimento = typeof STATUS_ATENDIMENTO[number];
export type MetaAtendimento = {
  telefone: string;
  status: StatusAtendimento;
  responsavel_id: string | null;
  etiquetas: string[];
  atualizado_em: string | null;
  prioridade: Prioridade;
  prazo_triagem_em: string | null;
  resolvido_em: string | null;
};
export type ConversaAtendimento = MetaAtendimento & {
  nome: string | null;
  ultimaMensagem: string;
  ultimaRecebida: string;
  total: number;
  leadId: number | null;
  canalId: number | null;
  funilSugeridoId: number | null;
  canaisObservados: number[];
  canalAmbiguo: boolean;
};

export function telefoneAtendimento(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 32) return null;
  const canonico = normalizarTelefone(value);
  return canonico && /^55\d{10,11}$/.test(canonico) ? canonico : null;
}

export function validarAlteracaoAtendimento(
  dados: unknown,
  admin: boolean,
): { status: StatusAtendimento; etiquetas: string[]; prioridade: Prioridade; responsavel_id: string | null } | { erro: string } {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return { erro: 'Dados inválidos.' };
  const b = dados as Record<string, unknown>;
  if (!STATUS_ATENDIMENTO.includes(b.status as StatusAtendimento)) return { erro: 'Status inválido.' };
  if (!prioridadeValida(b.prioridade)) return { erro: 'Prioridade inválida.' };
  if (!Array.isArray(b.etiquetas) || b.etiquetas.length > 8
    || b.etiquetas.some(t => typeof t !== 'string' || !t.trim() || t.trim().length > 28
      || /[<>\r\n]/.test(t))) return { erro: 'Informe até oito etiquetas válidas (máx. 28 caracteres).' };
  const etiquetas = [...new Set((b.etiquetas as string[]).map(x => x.trim().toLocaleLowerCase('pt-BR')))];
  if (b.responsavel_id !== undefined && b.responsavel_id !== null
    && (typeof b.responsavel_id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.responsavel_id))) {
    return { erro: 'Responsável inválido.' };
  }
  if (!admin && Object.prototype.hasOwnProperty.call(b, 'responsavel_id')) {
    return { erro: 'Somente administradores podem transferir atendimentos.' };
  }
  return {
    status: b.status as StatusAtendimento,
    etiquetas, prioridade: b.prioridade as Prioridade,
    responsavel_id: (b.responsavel_id as string | null) ?? null,
  };
}

/** Fonte de verdade de membros da workspace; nunca usa perfis globais de outra conta. */
export async function responsaveisDaWorkspace(admin: SupabaseClient, perfil: Perfil) {
  const [membros, perfis] = await Promise.all([
    admin.from('conta_usuarios').select('user_id').eq('conta_id', perfil.conta_id!).eq('ativo', true),
    admin.from('perfis').select('id,nome,email').eq('conta_id', perfil.conta_id!),
  ]);
  if (perfis.error) throw Error('Falha ao carregar responsáveis.');
  // Se memberships estao disponiveis, somente membros ATIVOS podem receber.
  // O fallback para perfis legados e usado apenas quando a tabela de
  // memberships nao esta acessivel.
  const ids = membros.error
    ? new Set((perfis.data ?? []).map(p => p.id))
    : new Set((membros.data ?? []).map(m => m.user_id));
  if (perfil.papel === 'super_admin') ids.add(perfil.id);
  if (!ids.size) return [];
  const { data, error } = await admin.from('perfis').select('id,nome,email').in('id', [...ids]).limit(250);
  if (error) throw Error('Falha ao carregar os membros da equipe.');
  return (data ?? []).map(p => ({ id: p.id, nome: p.nome || p.email || 'Atendente' }));
}

export function operadorPodeVerConversa(perfil: Pick<Perfil,'id'|'papel'>, meta: Pick<MetaAtendimento,'responsavel_id'> | null) {
  return isAdmin(perfil.papel) || meta?.responsavel_id === perfil.id;
}

export function montarConversas(
  raw: Array<{
    telefone: string; nome_contato: string | null; mensagem: string | null;
    recebido_em: string; lead_id: number | null;
    canal_id?: number | null; funil_id?: number | null;
  }>,
  metadados: MetaAtendimento[],
  perfil: Pick<Perfil,'id'|'papel'>,
): ConversaAtendimento[] {
  const porNumero = new Map(metadados.map(m => [m.telefone, m]));
  const conversas = new Map<string, ConversaAtendimento>();
  for (const m of raw) {
    const telefone = telefoneAtendimento(m.telefone);
    if (!telefone) continue;
    const meta = porNumero.get(telefone) ?? null;
    if (!operadorPodeVerConversa(perfil, meta)) continue;
    const atual = conversas.get(telefone);
    if (atual) {
      atual.total++;
      if (m.canal_id != null && !atual.canaisObservados.includes(m.canal_id)) {
        atual.canaisObservados.push(m.canal_id);
      }
      atual.canalAmbiguo=atual.canaisObservados.length>1;
      if(atual.canalAmbiguo){atual.canalId=null;atual.funilSugeridoId=null;}
      if (m.recebido_em > atual.ultimaRecebida) {
        atual.ultimaMensagem = m.mensagem ?? '';
        atual.ultimaRecebida = m.recebido_em;
        atual.prazo_triagem_em = prazoTriagem(m.recebido_em, atual.prioridade);
        if (m.nome_contato) atual.nome = m.nome_contato;
        if (m.lead_id) atual.leadId = m.lead_id;
        if(!atual.canalAmbiguo) {
          atual.canalId=m.canal_id??atual.canalId;
          atual.funilSugeridoId=m.funil_id??atual.funilSugeridoId;
        }
      }
    } else {
      conversas.set(telefone, {
        telefone, nome: m.nome_contato ?? null,
        ultimaMensagem: m.mensagem ?? '',
        ultimaRecebida: m.recebido_em,
        total: 1, leadId: m.lead_id ?? null,
        canalId:m.canal_id??null,funilSugeridoId:m.funil_id??null,
        canaisObservados:m.canal_id!=null?[m.canal_id]:[],canalAmbiguo:false,
        status: meta?.status ?? 'aberto', etiquetas: meta?.etiquetas ?? [],
        responsavel_id: meta?.responsavel_id ?? null,
        atualizado_em: meta?.atualizado_em ?? null,
        prioridade: meta?.prioridade ?? 'normal',
        prazo_triagem_em: prazoTriagem(m.recebido_em, meta?.prioridade ?? 'normal'),
        resolvido_em: meta?.resolvido_em ?? null,
      });
    }
  }
  return [...conversas.values()].sort((a, b) => b.ultimaRecebida.localeCompare(a.ultimaRecebida));
}

/** A chave de atendimento é (workspace, canal, telefone); 0 identifica legado. */
export function chaveAtendimento(telefone:string,canalId:number|null):string {
  return telefone+':'+(canalId??0);
}
/** Somente 0 (legado) ou IDs numéricos positivos são aceitos do navegador. */
export function validarCanalAtendimento(valor:unknown):number|null|undefined {
  if(valor===undefined||valor===null||valor===''||valor===0||valor==='0')return null;
  const n=typeof valor==='number'||typeof valor==='string'?Number(valor):NaN;
  return Number.isSafeInteger(n)&&n>0?n:undefined;
}
export type MetadadoCanal = MetaAtendimento & {canal_id?:number|null};
/**
 * A Inbox antiga agregava tudo por telefone. A nova separa por número de
 * recepção, preservando eventos legados como grupo 0, sem copiar mensagens.
 * Permissões usam sempre o responsável do grupo exato.
 */
export function montarConversasPorCanal(
 raw:Parameters<typeof montarConversas>[0],
 metadados:MetadadoCanal[],
 perfil:Pick<Perfil,'id'|'papel'>,
):ConversaAtendimento[] {
 const grupos=new Map<string,typeof raw>();
 for(const m of raw) {
   const tel=telefoneAtendimento(m.telefone);
   if(!tel)continue;
   const chave=chaveAtendimento(tel,m.canal_id??null);
   const atual=grupos.get(chave)??[];
   atual.push(m);
   grupos.set(chave,atual);
 }
 const resultado:ConversaAtendimento[]=[];
 for(const rows of grupos.values()) {
   const tel=telefoneAtendimento(rows[0].telefone)!;
   const canalId=rows[0].canal_id??null;
   const meta=metadados.find(m=>m.telefone===tel && (m.canal_id??null)===canalId);
   const lista=montarConversas(rows,meta?[meta]:[],perfil);
   if(lista.length)resultado.push({...lista[0],canalId,
     canaisObservados:canalId===null?[]:[canalId],canalAmbiguo:false});
 }
 return resultado.sort((a,b)=>b.ultimaRecebida.localeCompare(a.ultimaRecebida));
}
