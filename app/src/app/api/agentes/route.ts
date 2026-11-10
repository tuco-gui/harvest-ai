import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { tipoAgenteValido, validarConfiguracaoAgente, CATALOGO_AGENTES, TIPOS_AGENTE } from '@/lib/agentes';
import { carregarConexaoIA } from '@/lib/conexaoIAWorkspace';
import { validarFluxoAgente, FLUXO_BDR_IMOBILIARIO_BASE, type FluxoAgente } from '@/lib/fluxoAgente';
import {configuracaoPadrao,validarConfigAgente} from '@/lib/agenteModelos';

async function contexto() {
  const perfil = await perfilAtual();
  if (!perfil) return { erro: 'Sessão expirada.', status: 401 } as const;
  if (!perfil.conta_id) return { erro: 'Selecione uma workspace.', status: 400 } as const;
  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'agentes'))) {
    return { erro: 'Módulo de agentes não habilitado nesta workspace.', status: 403 } as const;
  }
  return { perfil, admin } as const;
}

export async function GET() {
  const c = await contexto();
  if ('erro' in c) return NextResponse.json({ erro: c.erro }, { status: c.status });
  const { data, error } = await c.admin.from('agentes_workspace')
    .select('*')
    .eq('conta_id', c.perfil.conta_id!).order('id');
  if (error) return NextResponse.json({ erro: 'O catálogo dos agentes ainda não está disponível no banco.' }, { status: 503 });
  const agentes = TIPOS_AGENTE.map(tipo =>
    data?.find(a => a.tipo === tipo) ?? {
      id: null, conta_id: c.perfil.conta_id, tipo, ...CATALOGO_AGENTES[tipo], configuracao:configuracaoPadrao(tipo),ativo: false, atualizado_em: null,
    }
  );
  // O resumo da conexao configurada em Configuracoes e seguro para a interface:
  // retornamos provedor/modelo, NUNCA a chave, e sempre da workspace ativa.
  try {
    const { estado } = await carregarConexaoIA(c.admin, c.perfil.conta_id!);
    const { data: fluxos, error: erroFluxos } = await c.admin.from('agentes_fluxos').select('tipo,configuracao').eq('conta_id', c.perfil.conta_id!);
    if (erroFluxos) return NextResponse.json({ erro: 'Configuração de fluxos indisponível. Migração pendente.' }, { status: 503 });
    return NextResponse.json({ agentes, conexaoIa: estado, fluxos: fluxos ?? [] });
  } catch {
    return NextResponse.json({
      erro: 'Não foi possível consultar a conexão de IA em Configurações.',
    }, { status: 503 });
  }
}

export async function PATCH(req: Request) {
  const c = await contexto();
  if ('erro' in c) return NextResponse.json({ erro: c.erro }, { status: c.status });
  if (c.perfil.papel === 'operador') return NextResponse.json({ erro: 'Somente administradores podem configurar agentes.' }, { status: 403 });

  const b = await req.json().catch(() => null);
  if (!b || !tipoAgenteValido(b.tipo)) return NextResponse.json({ erro: 'Tipo de agente inválido.' }, { status: 400 });
  const falha = validarConfiguracaoAgente(b.nome, b.instrucao);
  if (falha) return NextResponse.json({ erro: falha }, { status: 400 });
  if (typeof b.ativo !== 'boolean') return NextResponse.json({ erro: 'Estado do agente inválido.' }, { status: 400 });
  if(b.configuracao!==undefined){
    if(!validarConfigAgente(b.tipo,b.configuracao))return NextResponse.json({erro:'Configuração de modelo, horários ou autonomia inválida.'},{status:400});
    for(const [campo,tabela]of [['canais','whatsapp_canais'],['funis','funis']] as const){
      for(const id of b.configuracao[campo]){
        const {data,error}=await c.admin.from(tabela).select('id').eq('id',id).eq('conta_id',c.perfil.conta_id).maybeSingle();
        if(error||!data)return NextResponse.json({erro:'Canal/funil fora da workspace.'},{status:403});
      }
    }
  }

  const { data, error } = await c.admin.from('agentes_workspace').upsert({
    conta_id: c.perfil.conta_id,
    tipo: b.tipo,
    nome: b.nome.trim(),
    instrucao: b.instrucao.trim(),
    ativo: b.ativo,
    ...(b.configuracao!==undefined?{configuracao:b.configuracao}:{}),
    atualizado_em: new Date().toISOString(),
  }, { onConflict: 'conta_id,tipo' }).select('*').single();
  if (error) return NextResponse.json({ erro: 'Não foi possível salvar o agente.' }, { status: 500 });
  return NextResponse.json({ agente: data });
}

/** Configuração do fluxo. Nunca ativa robô nem dispara mensagens. */
export async function PUT(req: Request) {
  const c = await contexto();
  if ('erro' in c) return NextResponse.json({ erro: c.erro }, { status: c.status });
  if (c.perfil.papel === 'operador') return NextResponse.json({ erro: 'Somente administradores podem configurar fluxos.' }, { status: 403 });
  const b = await req.json().catch(() => null);
  if (!b || b.tipo !== 'bdr' || !b.fluxo || typeof b.fluxo !== 'object') return NextResponse.json({ erro: 'Fluxo inválido.' }, { status: 400 });
  const fluxo = b.fluxo as FluxoAgente;
  const erros = validarFluxoAgente(fluxo);
  if (erros.length) return NextResponse.json({ erro: erros.join(' ') }, { status: 400 });
  const { data, error } = await c.admin.from('agentes_fluxos').upsert({
    conta_id: c.perfil.conta_id, tipo: 'bdr', configuracao: fluxo, atualizado_em: new Date().toISOString(),
  }, { onConflict: 'conta_id,tipo' }).select('tipo,configuracao').single();
  if (error) return NextResponse.json({ erro: 'Não foi possível salvar o fluxo.' }, { status: 500 });
  return NextResponse.json({ fluxo: data?.configuracao ?? FLUXO_BDR_IMOBILIARIO_BASE, publicado: false });
}
