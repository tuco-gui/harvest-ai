import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { PROVEDORES } from '@/lib/ia';

/**
 * Configura somente a LLM da workspace ativa.
 * Este endpoint NAO modifica campanha, intervalos, WhatsApp ou outros segredos.
 * O agente e a prospeccao compartilham os mesmos campos em conta_credenciais.
 */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel === 'operador') return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 });
  if (!perfil.conta_id) return NextResponse.json({ erro: 'Selecione uma workspace.' }, { status: 400 });

  const entrada = await req.json().catch(() => null);
  const provedor = typeof entrada?.ia_provedor === 'string' ? entrada.ia_provedor.trim() : '';
  const modelo = typeof entrada?.ia_modelo === 'string' ? entrada.ia_modelo.trim() : '';
  const chave = typeof entrada?.ia_key === 'string' ? entrada.ia_key.trim() : '';

  if (!PROVEDORES.some(p => p.valor === provedor)) {
    return NextResponse.json({ erro: 'Selecione um provedor de IA válido.' }, { status: 400 });
  }
  if (modelo.length > 160 || chave.length > 4096) {
    return NextResponse.json({ erro: 'Modelo ou chave ultrapassou o limite permitido.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: existente, error: erroLeitura } = await admin
    .from('conta_credenciais').select('ia_provedor,ia_key')
    .eq('conta_id', perfil.conta_id).maybeSingle();
  if (erroLeitura) {
    return NextResponse.json({ erro: 'Não foi possível consultar a conexão de IA.' }, { status: 503 });
  }
  if (!chave && (!existente?.ia_key || (existente.ia_provedor && existente.ia_provedor !== provedor))) {
    return NextResponse.json({
      erro: 'Informe a chave de IA para esta workspace e o provedor selecionado.',
    }, { status: 400 });
  }

  const atualizacao: Record<string, string | null> = {
    conta_id: perfil.conta_id,
    ia_provedor: provedor,
    ia_modelo: modelo || null,
    atualizado_em: new Date().toISOString(),
  };
  if (chave) atualizacao.ia_key = chave;

  // Credenciais sao escritas somente no registro da workspace derivada da sessao.
  const { error } = await admin.from('conta_credenciais').upsert(
    atualizacao, { onConflict: 'conta_id' },
  );
  if (error) return NextResponse.json({ erro: 'Não foi possível salvar a conexão de IA.' }, { status: 500 });

  return NextResponse.json({
    ok: true,
    conexaoIa: { configurada: true, provedor, modelo: modelo || null },
    aviso: 'Conexão de IA salva somente nesta workspace, sem alterar os envios.',
  });
}
