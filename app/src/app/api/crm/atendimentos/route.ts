import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { isAdmin } from '@/lib/crmControleAcesso';
import { montarConversas, operadorPodeVerConversa, responsaveisDaWorkspace,
  telefoneAtendimento, validarAlteracaoAtendimento } from '@/lib/crmAtendimentos';

async function contexto() {
  const perfil = await perfilAtual();
  if (!perfil) return { erro: NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 }) } as const;
  if (!perfil.conta_id) return { erro: NextResponse.json({ erro: 'Selecione uma workspace.' }, { status: 400 }) } as const;
  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'crm')) ||
      !(await perfilTemModulo(admin, perfil, 'crm_avancado'))) {
    return { erro: NextResponse.json({ erro: 'Inbox CRM não habilitada nesta workspace.' }, { status: 403 }) } as const;
  }
  return { perfil, admin } as const;
}

export async function GET() {
  const c = await contexto();
  if ('erro' in c) return c.erro;
  const { perfil, admin } = c;
  // Nenhuma mensagem é copiada. Dados da Inbox são consultados na origem.
  const [eventos, meta] = await Promise.all([
    admin.from('inbound_eventos')
      .select('telefone,nome_contato,mensagem,recebido_em,lead_id')
      .eq('conta_id', perfil.conta_id).order('recebido_em', { ascending: false }).limit(500),
    admin.from('crm_atendimentos')
      .select('telefone,status,responsavel_id,etiquetas,atualizado_em')
      .eq('conta_id', perfil.conta_id).limit(500),
  ]);
  if (eventos.error || meta.error) {
    return NextResponse.json({ erro: 'Central de atendimento indisponível. Verifique a migração 036.' }, { status: 503 });
  }
  const conversas = montarConversas(eventos.data ?? [], meta.data ?? [], perfil);
  try {
    const responsaveis = isAdmin(perfil.papel)
      ? await responsaveisDaWorkspace(admin, perfil) : [];
    return NextResponse.json({
      conversas, responsaveis, podeAtribuir: isAdmin(perfil.papel),
      aviso: 'Lista limitada às 500 mensagens recebidas mais recentes desta workspace.',
    });
  } catch {
    return NextResponse.json({ erro: 'Falha ao carregar os responsáveis.' }, { status: 503 });
  }
}

export async function PATCH(req: Request) {
  const c = await contexto();
  if ('erro' in c) return c.erro;
  const { perfil, admin } = c;
  const body = await req.json().catch(() => null);
  const telefone = telefoneAtendimento(body?.telefone);
  if (!telefone) return NextResponse.json({ erro: 'Telefone inválido.' }, { status: 400 });
  const valido = validarAlteracaoAtendimento(body, isAdmin(perfil.papel));
  if ('erro' in valido) return NextResponse.json({ erro: valido.erro }, { status: 400 });

  const { data: existe, error: erroOrigem } = await admin.from('inbound_eventos')
    .select('id').eq('conta_id', perfil.conta_id).eq('telefone', telefone)
    .limit(1).maybeSingle();
  if (erroOrigem) return NextResponse.json({ erro: 'Falha ao verificar a conversa.' }, { status: 503 });
  if (!existe) return NextResponse.json({ erro: 'Esta conversa não existe na Inbox desta workspace.' }, { status: 404 });

  const { data: atual, error: erroMeta } = await admin.from('crm_atendimentos')
    .select('responsavel_id').eq('conta_id', perfil.conta_id).eq('telefone', telefone).maybeSingle();
  if (erroMeta) return NextResponse.json({ erro: 'Falha ao verificar o responsável.' }, { status: 503 });
  if (!operadorPodeVerConversa(perfil, atual)) {
    return NextResponse.json({ erro: 'Você não está atribuído a este atendimento.' }, { status: 403 });
  }
  let responsavelId = atual?.responsavel_id ?? null;
  if (isAdmin(perfil.papel)) {
    responsavelId = valido.responsavel_id;
    if (responsavelId) {
      const membros = await responsaveisDaWorkspace(admin, perfil).catch(() => null);
      if (!membros) return NextResponse.json({ erro: 'Não foi possível validar a equipe.' }, { status: 503 });
      if (!membros.some(x => x.id === responsavelId)) {
        return NextResponse.json({ erro: 'O responsável não pertence à workspace ativa.' }, { status: 403 });
      }
    }
  }
  const { data, error } = await admin.from('crm_atendimentos').upsert({
    conta_id: perfil.conta_id, telefone, status: valido.status,
    etiquetas: valido.etiquetas, responsavel_id: responsavelId,
    atualizado_por: perfil.id, atualizado_em: new Date().toISOString(),
  }, { onConflict: 'conta_id,telefone' })
    .select('telefone,status,etiquetas,responsavel_id,atualizado_em').single();
  if (error || !data) return NextResponse.json({ erro: 'Não foi possível salvar o atendimento.' }, { status: 500 });
  return NextResponse.json({ atendimento: data, envioRealizado: false });
}
