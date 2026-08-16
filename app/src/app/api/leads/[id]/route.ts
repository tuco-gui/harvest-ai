import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { normalizarTelefone } from '@/lib/telefone';
import { estaSuprimido } from '@/lib/supressao';

/**
 * Edição real do cadastro do lead (Entrega 22). Fonte única de verdade do
 * lead — campanhas apenas referenciam (campanha_leads), nunca guardam uma
 * cópia divergente dos dados. `especialidades` é o campo usado na prática
 * como "categoria/ramo" do lead (é o que a UI já exibe e o que a
 * importação de planilha mapeia da coluna "categoria" — a coluna
 * `prospecta_leads.categoria` em si nunca chegou a ser usada pelo app).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leadId = Number(id);
  if (!Number.isInteger(leadId)) return NextResponse.json({ erro: 'Lead inválido.' }, { status: 400 });

  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  const b = await req.json().catch(() => ({}) as any);
  const admin = supabaseAdmin();

  const { data: atual } = await admin
    .from('prospecta_leads').select('id, telefone, telefone_original')
    .eq('id', leadId).eq('conta_id', perfil.conta_id).maybeSingle();
  if (!atual) return NextResponse.json({ erro: 'Lead não encontrado.' }, { status: 404 });

  const dados: Record<string, unknown> = {};
  if (typeof b.empresa === 'string' && b.empresa.trim()) dados.empresa = b.empresa.trim();
  if (typeof b.endereco === 'string') dados.endereco = b.endereco.trim() || null;
  if (typeof b.especialidades === 'string') dados.especialidades = b.especialidades.trim() || null;

  let avisoSupressao: string | null = null;

  // ---- Regra crítica de telefone (Entrega 22) ----
  // Editar telefone NUNCA pode ser mecanismo pra escapar de supressão.
  if (typeof b.telefone === 'string' && b.telefone.trim()) {
    const novoNormalizado = normalizarTelefone(b.telefone);
    if (!novoNormalizado) {
      return NextResponse.json({ erro: 'Telefone inválido.' }, { status: 400 });
    }

    if (novoNormalizado !== atual.telefone) {
      // Duplicidade dentro da conta — outro lead já usa esse telefone.
      const { data: duplicado } = await admin
        .from('prospecta_leads').select('id, empresa')
        .eq('conta_id', perfil.conta_id).eq('telefone', novoNormalizado).neq('id', leadId).maybeSingle();
      if (duplicado) {
        return NextResponse.json(
          { erro: `Esse telefone já pertence a outro lead desta conta ("${duplicado.empresa}").`, duplicado: true },
          { status: 409 },
        );
      }

      // O telefone ANTIGO pode estar suprimido (opt-out) — a supressão fica
      // como está, presa ao número antigo. Trocar o telefone do lead não
      // remove essa supressão nem "limpa" o histórico dela.
      // O telefone NOVO também pode já estar suprimido — nesse caso o lead
      // simplesmente continua inelegível pro próximo disparo (a barreira
      // real de bloqueio é em /api/disparo via estaSuprimido; aqui só
      // avisamos, não impedimos salvar o cadastro).
      if (await estaSuprimido(admin, perfil.conta_id, novoNormalizado)) {
        avisoSupressao = 'O novo telefone está em supressão (opt-out) nesta conta — o lead não vai receber disparos até isso mudar.';
      }

      dados.telefone = novoNormalizado;
      dados.telefone_original = b.telefone.trim();

      // Registro de auditoria — histórico de contato é a fonte de trilha por
      // telefone/lead já usada no resto do produto (ver lib/historicoContato.ts).
      await admin.from('historico_contato').insert({
        conta_id: perfil.conta_id,
        lead_id: leadId,
        campanha_id: null,
        telefone: novoNormalizado,
        provider: 'sistema',
        canal: 'auditoria',
        status: 'telefone_alterado',
        motivo_bloqueio: `Telefone alterado de ${atual.telefone ?? 'vazio'} para ${novoNormalizado} por ${perfil.email ?? perfil.id}.`,
        origem: 'edicao_lead',
      });
    }
  }

  if (!Object.keys(dados).length) {
    return NextResponse.json({ ok: true, avisoSupressao });
  }

  const { error } = await admin
    .from('prospecta_leads').update(dados).eq('id', leadId).eq('conta_id', perfil.conta_id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, avisoSupressao });
}
