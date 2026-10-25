import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { tipoAgenteValido, promptsDoLaboratorio } from '@/lib/agentes';
import { gerarComIA, type ProvedorIA } from '@/lib/ia';

/** Laboratório sob comando humano. NUNCA executa ações, campanhas ou WhatsApp. */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (!perfil.conta_id) return NextResponse.json({ erro: 'Selecione uma workspace.' }, { status: 400 });

  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'agentes'))) {
    return NextResponse.json({ erro: 'Módulo não liberado para esta workspace.' }, { status: 403 });
  }
  if (perfil.papel === 'operador') return NextResponse.json({ erro: 'Sem permissão para testar agentes.' }, { status: 403 });

  const b = await req.json().catch(() => null);
  const mensagem = typeof b?.mensagem === 'string' ? b.mensagem.trim() : '';
  if (!tipoAgenteValido(b?.tipo) || mensagem.length < 2 || mensagem.length > 1000) {
    return NextResponse.json({ erro: 'Informe o agente e uma mensagem com até 1.000 caracteres.' }, { status: 400 });
  }

  const [agente, cred] = await Promise.all([
    admin.from('agentes_workspace')
      .select('nome,instrucao').eq('conta_id', perfil.conta_id).eq('tipo', b.tipo).maybeSingle(),
    admin.from('conta_credenciais')
      .select('ia_provedor,ia_key,ia_modelo').eq('conta_id', perfil.conta_id).maybeSingle(),
  ]);
  if (agente.error || !agente.data) {
    return NextResponse.json({ erro: 'Salve a configuração do agente antes de testar.' }, { status: 409 });
  }
  if (cred.error || !cred.data?.ia_key || !cred.data?.ia_provedor) {
    return NextResponse.json({ erro: 'Configure primeiro o provedor e a chave de IA desta workspace em Configurações.' }, { status: 409 });
  }
  const provedor = cred.data.ia_provedor;
  if (!['groq','gemini','openai','claude','ollama'].includes(provedor)) {
    return NextResponse.json({ erro: 'Provedor de IA inválido na workspace.' }, { status: 409 });
  }

  const { system, user } = promptsDoLaboratorio(agente.data, mensagem);
  try {
    const resposta = await gerarComIA(provedor as ProvedorIA, cred.data.ia_key, system, user, cred.data.ia_modelo);
    const limpa = resposta.trim().slice(0, 4000);
    if (!limpa) throw new Error('resposta vazia');
    // Não salva conversas, não envia mensagem e nunca retorna credenciais.
    return NextResponse.json({ resposta: limpa, modo: 'simulacao', enviado: false });
  } catch {
    return NextResponse.json({ erro: 'O provedor de IA não respondeu. Verifique a chave e o modelo nas configurações.' }, { status: 502 });
  }
}
