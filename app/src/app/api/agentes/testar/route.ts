import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { tipoAgenteValido, promptsDoLaboratorio, validarHistoricoLaboratorio } from '@/lib/agentes';
import { gerarComIA } from '@/lib/ia';
import { carregarConexaoIA } from '@/lib/conexaoIAWorkspace';

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

  const historico = validarHistoricoLaboratorio(b.historico);
  if (!historico.ok) {
    return NextResponse.json({ erro: historico.erro }, { status: 400 });
  }

  // Mesma conexao de Configuracoes > Inteligencia Artificial, carregada
  // em tempo real para a workspace obtida da sessao. Sem credenciais duplicadas.
  let conexao;
  try {
    const [agente, llm] = await Promise.all([
      admin.from('agentes_workspace')
        .select('nome,instrucao').eq('conta_id', perfil.conta_id).eq('tipo', b.tipo).maybeSingle(),
      carregarConexaoIA(admin, perfil.conta_id),
    ]);
    if (agente.error || !agente.data) {
      return NextResponse.json({ erro: 'Salve a configuração do agente antes de testar.' }, { status: 409 });
    }
    if (!llm.conexao) {
      return NextResponse.json({
        erro: 'Esta workspace não tem uma conexão de IA pronta. Acesse Configurações > Inteligência Artificial; a mesma conexão será utilizada automaticamente pelos agentes.',
      }, { status: 409 });
    }
    conexao = { agente: agente.data, llm: llm.conexao };
  } catch {
    return NextResponse.json({ erro: 'Não foi possível consultar a IA da workspace.' }, { status: 503 });
  }

  const { system, user } = promptsDoLaboratorio(conexao.agente, mensagem, historico.historico);
  try {
    const resposta = await gerarComIA(conexao.llm.provedor, conexao.llm.chave, system, user, conexao.llm.modelo);
    const limpa = resposta.trim().slice(0, 4000);
    if (!limpa) throw new Error('resposta vazia');
    // Não salva conversas, não envia mensagem e nunca retorna credenciais.
    return NextResponse.json({ resposta: limpa, modo: 'simulacao', enviado: false });
  } catch {
    return NextResponse.json({ erro: 'O provedor de IA não respondeu. Verifique a chave e o modelo nas configurações.' }, { status: 502 });
  }
}
