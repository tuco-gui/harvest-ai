import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

/** GET /api/funis → lista funis da conta ativa */
export async function GET() {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (!perfil.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: funis, error } = await admin
    .from('funis')
    .select('id, nome, ativo, criado_em')
    .eq('conta_id', perfil.conta_id)
    .order('nome');

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // Buscar contagem de estágios por funil
  const funilIds = (funis ?? []).map((f) => f.id);
  const { data: estagios } = funilIds.length
    ? await admin.from('funil_estagios').select('funil_id, id').in('funil_id', funilIds)
    : { data: [] };

  const contagem = new Map<number, number>();
  for (const e of estagios ?? []) {
    contagem.set(e.funil_id, (contagem.get(e.funil_id) ?? 0) + 1);
  }

  const resultado = (funis ?? []).map((f) => ({
    ...f,
    total_estagios: contagem.get(f.id) ?? 0,
  }));

  return NextResponse.json({ funis: resultado });
}

/** POST /api/funis → cria um novo funil com estágios padrão */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (!perfil.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}) as any);
  const nome = String(b.nome ?? '').trim();
  if (!nome) return NextResponse.json({ erro: 'Falta o nome do funil.' }, { status: 400 });

  const admin = supabaseAdmin();

  // Criar funil
  const { data: funil, error: funilErr } = await admin
    .from('funis')
    .insert({ conta_id: perfil.conta_id, nome })
    .select('id, nome, ativo, criado_em')
    .single();

  if (funilErr) return NextResponse.json({ erro: funilErr.message }, { status: 500 });

  // Criar estágios padrão (7 pipeline + 4 encerrados)
  const estagiosPadrao = [
    { nome: 'Novo',         ordem: 1,  grupo: 'pipeline',  probabilidade: 5 },
    { nome: 'Contatado',    ordem: 2,  grupo: 'pipeline',  probabilidade: 10 },
    { nome: 'Respondeu',    ordem: 3,  grupo: 'pipeline',  probabilidade: 20 },
    { nome: 'Qualificando', ordem: 4,  grupo: 'pipeline',  probabilidade: 35 },
    { nome: 'Reunião',      ordem: 5,  grupo: 'pipeline',  probabilidade: 50 },
    { nome: 'Proposta',     ordem: 6,  grupo: 'pipeline',  probabilidade: 70 },
    { nome: 'Ganho',        ordem: 7,  grupo: 'pipeline',  probabilidade: 100 },
    { nome: 'Sem interesse', ordem: 8, grupo: 'encerrado', probabilidade: 0 },
    { nome: 'Opt-out',       ordem: 9, grupo: 'encerrado', probabilidade: 0 },
    { nome: 'Inválido',     ordem: 10, grupo: 'encerrado', probabilidade: 0 },
    { nome: 'Perdido',      ordem: 11, grupo: 'encerrado', probabilidade: 0 },
  ];

  // Se o cliente enviou estágios customizados, usa eles; senão, padrão
  const estagios = Array.isArray(b.estagios) && b.estagios.length
    ? b.estagios.map((e: any, i: number) => ({
        funil_id: funil.id,
        nome: String(e.nome ?? '').trim() || `Estágio ${i + 1}`,
        ordem: Number(e.ordem) || i + 1,
        grupo: e.grupo === 'encerrado' ? 'encerrado' : 'pipeline',
        probabilidade: Number(e.probabilidade) || 0,
      }))
    : estagiosPadrao.map((e) => ({ ...e, funil_id: funil.id }));

  await admin.from('funil_estagios').insert(estagios);

  return NextResponse.json({ funil, estagios: estagios.length });
}
