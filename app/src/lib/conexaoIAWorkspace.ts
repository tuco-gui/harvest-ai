import type { SupabaseClient } from '@supabase/supabase-js';
import { PROVEDORES, type ProvedorIA } from './ia';

/**
 * Uma unica fonte de configuracao das LLMs: Configuracoes > Inteligencia Artificial
 * (conta_credenciais). Os agentes herdam exatamente a conexao da workspace ativa.
 * NAO le credenciais de outra conta, nem duplica tokens no cadastro de agentes.
 */
export type ConexaoIAWorkspace = {
  provedor: ProvedorIA;
  chave: string;
  modelo: string | null;
};

export type EstadoConexaoIA = {
  configurada: boolean;
  provedor: ProvedorIA | null;
  modelo: string | null;
};

type CamposIA = {
  ia_provedor?: unknown;
  ia_key?: unknown;
  ia_modelo?: unknown;
};

export function resolverConexaoIA(dados: CamposIA | null | undefined): ConexaoIAWorkspace | null {
  const chave = typeof dados?.ia_key === 'string' ? dados.ia_key.trim() : '';
  if (!chave) return null;

  // Compatibilidade: campanhas e o teste atual do Harvest usam openai quando
  // ha chave mas o campo de provedor no cadastro antigo esta vazio.
  const bruta = dados?.ia_provedor ?? 'openai';
  if (typeof bruta !== 'string') return null;
  const provedor = bruta.trim() || 'openai';
  if (!PROVEDORES.some(p => p.valor === provedor)) return null;

  const modelo = typeof dados?.ia_modelo === 'string' ? dados.ia_modelo.trim() || null : null;
  return { provedor: provedor as ProvedorIA, chave, modelo };
}

export function estadoConexaoIA(dados: CamposIA | null | undefined): EstadoConexaoIA {
  const c = resolverConexaoIA(dados);
  return {
    configurada: !!c,
    provedor: c?.provedor ?? null,
    modelo: c?.modelo ?? null,
  };
}

/** Carregamento EXCLUSIVAMENTE no servidor, com conta_id derivada da sessao. */
export async function carregarConexaoIA(
  admin: SupabaseClient,
  contaId: string,
): Promise<{ conexao: ConexaoIAWorkspace | null; estado: EstadoConexaoIA }> {
  const { data, error } = await admin.from('conta_credenciais')
    .select('ia_provedor,ia_key,ia_modelo').eq('conta_id', contaId).maybeSingle();

  if (error) throw new Error('Não foi possível consultar a conexão de IA da workspace.');
  return { conexao: resolverConexaoIA(data), estado: estadoConexaoIA(data) };
}
