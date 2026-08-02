/** Enriquecimento de lead: decisor (Perplexity ou busca+IA grátis) →
 *  LinkedIn (Serper ou Tavily) → e-mail (Anymail Finder). Cada etapa é
 *  opcional — sem a chave, ou se a etapa falhar, segue sem ela e devolve um
 *  aviso. Achar o decisor é pré-requisito das outras duas (não faz sentido
 *  buscar LinkedIn/e-mail de ninguém). */

import { gerarComIA, type ProvedorIA } from '@/lib/ia';

export type ProvedorLinkedin = 'serper' | 'tavily';
export type ProvedorDecisor = 'perplexity' | 'gratis';

export type CredenciaisEnriquecimento = {
  perplexity_key?: string | null;
  decisor_provedor?: ProvedorDecisor | string | null;
  serper_key?: string | null;
  tavily_key?: string | null;
  linkedin_provedor?: ProvedorLinkedin | string | null;
  anymail_key?: string | null;
  ia_provedor?: string | null;
  ia_key?: string | null;
  ia_modelo?: string | null;
};

export type LeadParaEnriquecer = {
  empresa: string;
  endereco: string | null;
  site: string | null;
  place_id: string | null;
};

export type ResultadoEnriquecimento = {
  cnpj: string | null;
  decisorNome: string | null;
  linkedin: string | null;
  email: string | null;
  emailStatus: string | null;
  avisos: string[];
};

export async function enriquecerLead(
  cred: CredenciaisEnriquecimento, lead: LeadParaEnriquecer,
): Promise<ResultadoEnriquecimento> {
  const avisos: string[] = [];
  let cnpj: string | null = null;
  let decisorNome: string | null = null;
  let linkedin: string | null = null;
  let email: string | null = null;
  let emailStatus: string | null = null;

  if (cred.decisor_provedor === 'gratis') {
    if (cred.ia_key && (cred.serper_key || cred.tavily_key)) {
      try {
        const r = await buscarDecisorGratis(cred, lead);
        decisorNome = r.nome;
        cnpj = r.cnpj;
      } catch (e: any) {
        avisos.push(`Decisor: ${e?.message ?? 'falhou'}`);
      }
    } else {
      avisos.push('Decisor: configure a IA e o Serper/Tavily em Configurações pra usar o modo grátis.');
    }
  } else if (cred.perplexity_key) {
    try {
      const r = await buscarDecisor(cred.perplexity_key, lead);
      decisorNome = r.nome;
      cnpj = r.cnpj;
    } catch (e: any) {
      avisos.push(`Decisor: ${e?.message ?? 'falhou'}`);
    }
  }

  if (decisorNome) {
    const usarTavily = cred.linkedin_provedor === 'tavily';
    const chaveLinkedin = usarTavily ? cred.tavily_key : cred.serper_key;
    const [linkedinResult, emailResult] = await Promise.all([
      chaveLinkedin
        ? (usarTavily ? buscarLinkedinTavily : buscarLinkedin)(chaveLinkedin, decisorNome, lead.empresa)
            .catch((e: any) => { avisos.push(`LinkedIn: ${e?.message ?? 'falhou'}`); return null; })
        : Promise.resolve(null),
      cred.anymail_key
        ? buscarEmail(cred.anymail_key, decisorNome, extrairDominio(lead.site), lead.empresa)
            .catch((e: any) => { avisos.push(`E-mail: ${e?.message ?? 'falhou'}`); return { email: null, status: null }; })
        : Promise.resolve({ email: null, status: null }),
    ]);
    linkedin = linkedinResult;
    email = emailResult.email;
    emailStatus = emailResult.status;
  }

  return { cnpj, decisorNome, linkedin, email, emailStatus, avisos };
}

/** Acha o sócio/decisor cruzando nome + endereço na web aberta. Modelo de
 *  raciocínio (`sonar-reasoning-pro`) — a resposta vem com um bloco
 *  `<think>...</think>` antes do JSON final, por isso removemos antes de parsear. */
export async function buscarDecisor(
  chave: string, lead: { empresa: string; endereco: string | null; place_id: string | null },
): Promise<{ nome: string | null; cnpj: string | null }> {
  const mapsUrl = lead.place_id ? `https://www.google.com/maps/place/?q=place_id:${lead.place_id}` : null;

  const system =
    'Você é um especialista em pesquisa de dados públicos brasileiros, focado em identificar ' +
    'o decisor (sócio-administrador, proprietário ou CEO) de uma empresa. Busque pelo quadro ' +
    'societário (CNPJ, Receita Federal, Junta Comercial), site oficial e diretórios de empresas. ' +
    'Não invente: se não achar com confiança, diga que não encontrou. ' +
    'Responda SOMENTE com um JSON no formato {"encontrado": true|false, "nome": string|null, "cnpj": string|null}, ' +
    'sem nenhum texto antes ou depois.';
  const user =
    `Empresa: ${lead.empresa}\nEndereço: ${lead.endereco ?? 'não informado'}` +
    (mapsUrl ? `\nGoogle Maps: ${mapsUrl}` : '');

  const r = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
    body: JSON.stringify({
      model: 'sonar-reasoning-pro',
      temperature: 0.2,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new Error(await mensagemErro(r));
  const d = await r.json();
  const texto: string = d.choices?.[0]?.message?.content ?? '';
  const semPensamento = texto.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const bruto = semPensamento.match(/\{[\s\S]*\}/)?.[0];
  if (!bruto) return { nome: null, cnpj: null };

  try {
    const j = JSON.parse(bruto);
    return {
      nome: j.encontrado && typeof j.nome === 'string' ? j.nome.trim() || null : null,
      cnpj: typeof j.cnpj === 'string' ? j.cnpj.trim() || null : null,
    };
  } catch {
    return { nome: null, cnpj: null };
  }
}

/** Mesma missão do buscarDecisor, sem gastar da Perplexity: busca a web
 *  aberta (Serper ou Tavily, o que a conta já tiver configurado pro
 *  LinkedIn) e manda os resultados pra IA já configurada (Groq/Gemini/etc)
 *  extrair o nome. Menos preciso que a Perplexity — ela é feita sob medida
 *  pra pesquisa com raciocínio — mas roda de graça em cima do que a conta
 *  já tem cadastrado. */
export async function buscarDecisorGratis(
  cred: { serper_key?: string | null; tavily_key?: string | null; linkedin_provedor?: string | null;
          ia_provedor?: string | null; ia_key?: string | null; ia_modelo?: string | null },
  lead: { empresa: string; endereco: string | null },
): Promise<{ nome: string | null; cnpj: string | null }> {
  const usarTavily = cred.linkedin_provedor === 'tavily' && !!cred.tavily_key;
  const consulta = `"${lead.empresa}" ${lead.endereco ?? ''} sócio proprietário administrador CNPJ`.trim();

  const resultados = usarTavily
    ? await buscarNaWebTavily(cred.tavily_key!, consulta)
    : cred.serper_key ? await buscarNaWebSerper(cred.serper_key, consulta) : [];
  if (!resultados.length) return { nome: null, cnpj: null };

  const contexto = resultados
    .slice(0, 5)
    .map((r, i) => `[${i + 1}] ${r.titulo}\n${r.resumo}\n${r.url}`)
    .join('\n\n');

  const system =
    'Você identifica o decisor (sócio-administrador, proprietário ou CEO) de uma empresa a ' +
    'partir de resultados de busca. Não invente: se os resultados não mostrarem um nome com ' +
    'confiança, diga que não encontrou. ' +
    'Responda SOMENTE com um JSON no formato {"encontrado": true|false, "nome": string|null, "cnpj": string|null}, ' +
    'sem nenhum texto antes ou depois, sem bloco de código markdown.';
  const user = `Empresa: ${lead.empresa}\nEndereço: ${lead.endereco ?? 'não informado'}\n\nResultados de busca:\n${contexto}`;

  const texto = await gerarComIA(
    (cred.ia_provedor ?? 'groq') as ProvedorIA, cred.ia_key!, system, user, cred.ia_modelo,
  );
  const bruto = texto.replace(/```json|```/gi, '').match(/\{[\s\S]*\}/)?.[0];
  if (!bruto) return { nome: null, cnpj: null };

  try {
    const j = JSON.parse(bruto);
    return {
      nome: j.encontrado && typeof j.nome === 'string' ? j.nome.trim() || null : null,
      cnpj: typeof j.cnpj === 'string' ? j.cnpj.trim() || null : null,
    };
  } catch {
    return { nome: null, cnpj: null };
  }
}

async function buscarNaWebSerper(chave: string, consulta: string): Promise<{ titulo: string; resumo: string; url: string }[]> {
  const r = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': chave, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: consulta, gl: 'br', num: 5 }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(r.status === 403 ? 'Chave recusada pelo Serper.' : `Serper respondeu ${r.status}.`);
  const d = await r.json();
  const organico = Array.isArray(d.organic) ? d.organic : [];
  return organico.map((o: any) => ({ titulo: o.title ?? '', resumo: o.snippet ?? '', url: o.link ?? '' }));
}

async function buscarNaWebTavily(chave: string, consulta: string): Promise<{ titulo: string; resumo: string; url: string }[]> {
  const r = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
    body: JSON.stringify({ query: consulta, max_results: 5 }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Chave recusada pelo Tavily.' : `Tavily respondeu ${r.status}.`);
  const d = await r.json();
  const resultados = Array.isArray(d.results) ? d.results : [];
  return resultados.map((o: any) => ({ titulo: o.title ?? '', resumo: o.content ?? '', url: o.url ?? '' }));
}

/** Busca o LinkedIn pessoal restringindo a resultados de linkedin.com/in/. */
export async function buscarLinkedin(chave: string, nomeDecisor: string, empresa: string): Promise<string | null> {
  const r = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': chave, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: `"${nomeDecisor}" "${empresa}" site:linkedin.com/in`, gl: 'br', num: 5 }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(r.status === 403 ? 'Chave recusada pelo Serper.' : `Serper respondeu ${r.status}.`);
  const d = await r.json();
  const organico = Array.isArray(d.organic) ? d.organic : [];
  const achado = organico.find((o: any) => typeof o.link === 'string' && o.link.includes('linkedin.com/in/'));
  return achado?.link ?? null;
}

/** Mesmo papel do buscarLinkedin, via Tavily em vez de Serper — 1.000
 *  buscas grátis por mês (recorrente), contra o crédito único do Serper. */
export async function buscarLinkedinTavily(chave: string, nomeDecisor: string, empresa: string): Promise<string | null> {
  const r = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
    body: JSON.stringify({
      query: `${nomeDecisor} ${empresa}`,
      include_domains: ['linkedin.com/in'],
      max_results: 5,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Chave recusada pelo Tavily.' : `Tavily respondeu ${r.status}.`);
  const d = await r.json();
  const resultados = Array.isArray(d.results) ? d.results : [];
  const achado = resultados.find((o: any) => typeof o.url === 'string' && o.url.includes('linkedin.com/in/'));
  return achado?.url ?? null;
}

/** Acha e valida o e-mail corporativo. Prioriza domínio do site (mais
 *  preciso, segundo a doc do Anymail Finder); sem site, cai pro nome da
 *  empresa. `status !== 'valid'` significa não confiar no e-mail devolvido. */
export async function buscarEmail(
  chave: string, nomeDecisor: string, dominio: string | null, empresa: string,
): Promise<{ email: string | null; status: string | null }> {
  const corpo: Record<string, string> = { full_name: nomeDecisor };
  if (dominio) corpo.domain = dominio; else corpo.company_name = empresa;

  const r = await fetch('https://api.anymailfinder.com/v5.1/find-email/person', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok && r.status !== 404) throw new Error(await mensagemErro(r));
  const d = await r.json().catch(() => ({}) as any);
  return { email: d.email ?? null, status: d.email_status ?? (r.status === 404 ? 'not_found' : null) };
}

function extrairDominio(site: string | null): string | null {
  if (!site) return null;
  try {
    return new URL(site.startsWith('http') ? site : `https://${site}`).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function mensagemErro(r: Response): Promise<string> {
  try {
    const d = await r.json();
    return d.error?.message ?? d.message ?? `A API respondeu ${r.status}.`;
  } catch {
    return `A API respondeu ${r.status}.`;
  }
}
