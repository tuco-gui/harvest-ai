import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { operadorPodeVerConversa, telefoneAtendimento, validarCanalAtendimento } from '@/lib/crmAtendimentos';

export async function GET(req: Request, { params }: { params: Promise<{ telefone: string }> }) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro:'Sessão expirada.' }, { status:401 });
  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'crm_avancado')) ||
      !(await perfilTemModulo(admin, perfil, 'crm'))) {
    return NextResponse.json({ erro:'CRM avançado indisponível.' }, { status:403 });
  }
  const telefone = telefoneAtendimento((await params).telefone);
  if (!telefone) return NextResponse.json({ erro:'Telefone inválido.' }, { status:400 });
  const canalId=validarCanalAtendimento(new URL(req.url).searchParams.get('canal_id'));
  if(canalId===undefined)return NextResponse.json({erro:'Canal inválido.'},{status:400});
  const tabela=canalId===null?'crm_atendimentos':'crm_atendimentos_canais';
  let busca=admin.from(tabela).select('responsavel_id').eq('conta_id',perfil.conta_id)
    .eq('telefone',telefone);
  if(canalId!==null)busca=busca.eq('canal_id',canalId);
  const {data:meta,error:errMeta}=await busca.maybeSingle();
  if (errMeta) return NextResponse.json({ erro:'Falha ao validar acesso.' }, { status:503 });
  if (!operadorPodeVerConversa(perfil,meta)) {
    return NextResponse.json({ erro:'Conversa não atribuída.' }, { status:403 });
  }
  let auditoria=admin.from('crm_auditoria_atendimentos')
    .select('id,tipo,anterior,novo,alterado_por,criado_em')
    .eq('conta_id',perfil.conta_id).eq('telefone',telefone);
  auditoria=canalId===null?auditoria.is('canal_id',null):auditoria.eq('canal_id',canalId);
  const {data,error}=await auditoria.order('criado_em',{ascending:false}).limit(100);
  if (error) return NextResponse.json({ erro:'Falha ao consultar a auditoria.' }, { status:503 });
  return NextResponse.json({ eventos:data ?? [] });
}
