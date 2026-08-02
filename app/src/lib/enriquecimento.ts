/** Enriquecimento de lead: decisor (Perplexity) → LinkedIn (Serper) → e-mail
 *  (Anymail Finder). Cada etapa é opcional — sem a chave, ou se a etapa
 *  falhar, segue sem ela e devolve um aviso. Achar o decisor é pré-requisito
 *  das outras duas (não faz sentido buscar LinkedIn/e-mail de ninguém). */

export type CredenciaisEnriquecimento = {
  perplexity_key?: string | null;
  serper_key?: string | null;
  anymail_key?: string | null;
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

  if (cred.perplexity_key) {
    try {
      const r = await buscarDecisor(cred.perplexity_key, lead);
      decisorNome = r.nome;
      cnpj = r.cnpj;
    } catch (e: any) {
      avisos.push(`Decisor: ${e?.message ?? 'falhou'}`);
    }
  }

  if (decisorNome) {
    const [linkedinResult, emailResult] = await Promise.all([
      cred.serper_key
        ? buscarLinkedin(cred.serper_key, decisorNome, lead.empresa)
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
