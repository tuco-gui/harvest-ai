import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { autenticarN8nBDR } from '@/lib/bdrAutenticacao';
import { processarBDR } from '@/lib/bdr';
import { capturarLeadSuperlogica, origemImutavel, sincronizarSuperlogica } from '@/lib/superlogica';
import { normalizarTelefone } from '@/lib/telefone';
import {recursoDaWorkspace} from '@/lib/servicosWorkspace';

export const maxDuration = 300;
/** Chamado pelos workflows EXISTENTES após persistir LP/chat na planilha, ou pelo tick n8n. */
export async function POST(req: Request) {
  const b = await req.json().catch(()=>null);
  if (!autenticarN8nBDR(req.headers.get('authorization'),b?.tenant_id))
    return NextResponse.json({erro:'Não autorizado.'},{status:401});
  const admin = supabaseAdmin();
  try {
    if(!(await recursoDaWorkspace(admin,b.tenant_id,['integracoes.superlogica'],'configurar')))
      return NextResponse.json({erro:'Integração não liberada para esta workspace.'},{status:403});
    if (b.acao==='processar') {
      await processarBDR(admin,b.tenant_id);
      return NextResponse.json({ok:true});
    }
    if (b.acao!=='capturar' || typeof b.protocolo!=='string' || !b.protocolo.trim() || b.protocolo.length>180 ||
      typeof b.nome!=='string' || b.nome.trim().length<2 || b.nome.length>160 ||
      !['lp','minichat','meta'].includes(b.origem?.source_channel))
      return NextResponse.json({erro:'Dados de captura inválidos.'},{status:400});
    const telefone = typeof b.telefone==='string'?normalizarTelefone(b.telefone):null;
    const email = typeof b.email==='string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) && b.email.length<=254?b.email.toLowerCase():null;
    if (!telefone && !email) return NextResponse.json({erro:'Informe telefone ou e-mail válido.'},{status:400});
    const registroId = await capturarLeadSuperlogica(admin,b.tenant_id,{chave:`${b.origem.source_channel}:${b.protocolo}`,
      nome:b.nome.trim(),telefone,email,origem:origemImutavel({...b.origem,protocolo:b.protocolo})});
    if (!registroId) return NextResponse.json({erro:'Workspace não configurada para este fluxo.'},{status:409});
    await sincronizarSuperlogica(admin,b.tenant_id);
    // HTTP 200 indica captura Harvest. Não equivale à confirmação do Superlógica.
    return NextResponse.json({ok:true,registro_id:registroId,capturado:true});
  } catch { return NextResponse.json({erro:'Falha na orquestração BDR. Lead preservado na origem; tente reconciliar.'},{status:503}); }
}
