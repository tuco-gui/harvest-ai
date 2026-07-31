export type ProvedorIA = 'groq' | 'gemini' | 'openai' | 'claude' | 'ollama';

/** Groq e Gemini têm plano gratuito generoso. Ollama Cloud também tem uso
 *  grátis e dá acesso a modelos abertos (Llama, Qwen, DeepSeek, GLM, Gemma…) —
 *  o catálogo muda direto, por isso o modelo é sempre digitável, nunca fixo.
 *  OpenAI e Claude são pagos, mas alguns times já têm chave de outro uso. */
export const PROVEDORES: { valor: ProvedorIA; nome: string; gratis: boolean; ondePegar: string }[] = [
  { valor: 'groq', nome: 'Groq (Llama)', gratis: true, ondePegar: 'console.groq.com/keys' },
  { valor: 'gemini', nome: 'Google Gemini', gratis: true, ondePegar: 'aistudio.google.com/apikey' },
  { valor: 'ollama', nome: 'Ollama Cloud (open source)', gratis: true, ondePegar: 'ollama.com/settings/keys' },
  { valor: 'openai', nome: 'OpenAI (GPT)', gratis: false, ondePegar: 'platform.openai.com/api-keys' },
  { valor: 'claude', nome: 'Anthropic (Claude)', gratis: false, ondePegar: 'console.anthropic.com' },
];

// Modelo padrão de cada provedor, usado quando a conta não digita um modelo
// próprio. Vale revisar de tempos em tempos — cada provedor troca no seu
// próprio ritmo, e o do Ollama especialmente (catálogo de nuvem novo).
const MODELOS: Record<ProvedorIA, string> = {
  groq: 'llama-3.3-70b-versatile',
  gemini: 'gemini-2.0-flash',
  ollama: 'gpt-oss:120b-cloud',
  openai: 'gpt-4o-mini',
  claude: 'claude-haiku-4-5-20251001',
};

export function montarPrompts(contexto: string, lead: {
  empresa: string; especialidades?: string | null; rating?: number | null;
  reviews?: number | null; endereco?: string | null; site?: string | null;
}) {
  const system =
    'Você escreve a primeira mensagem de WhatsApp de uma prospecção B2B, em português brasileiro. ' +
    'Uma mensagem só, de 25 a 45 palavras, terminando com uma pergunta. ' +
    'Tom humano, direto e educado. Sem emoji no início, no máximo um na mensagem inteira. ' +
    'Nunca invente fato sobre a empresa: use apenas o que vier nos dados. ' +
    'Proibido urgência artificial, promessa de resultado e linguagem de spam. ' +
    'Responda apenas com o texto da mensagem, sem aspas e sem explicação.\n\n' +
    `Contexto de quem está mandando:\n${contexto || '(não informado)'}`;

  const user =
    `Empresa: ${lead.empresa}\n` +
    `Ramo: ${lead.especialidades ?? 'não informado'}\n` +
    `Nota no Google: ${lead.rating ?? 'não informada'} (${lead.reviews ?? 0} avaliações)\n` +
    `Endereço: ${lead.endereco ?? 'não informado'}\n` +
    `Site: ${lead.site ?? 'não tem'}`;

  return { system, user };
}

/** Gera a mensagem no provedor escolhido. Lança erro com a mensagem do
 *  provedor quando a chamada falha — quem chama decide o que mostrar.
 *  `modeloCustom` sobrescreve o modelo padrão quando a conta digitou um. */
export async function gerarComIA(
  provedor: ProvedorIA, chave: string, system: string, user: string, modeloCustom?: string | null,
): Promise<string> {
  const modelo = modeloCustom?.trim() || MODELOS[provedor];

  if (provedor === 'openai' || provedor === 'groq') {
    // A API da Groq é compatível com a da OpenAI — só troca a base e o modelo.
    const base = provedor === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1';
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        model: modelo, temperature: 0.8, max_tokens: 220,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!r.ok) throw new Error(await mensagemErro(r));
    const d = await r.json();
    const texto = d.choices?.[0]?.message?.content?.trim();
    if (!texto) throw new Error('A resposta veio vazia.');
    return texto;
  }

  if (provedor === 'ollama') {
    // API nativa da Ollama Cloud (ollama.com), não a compatível com OpenAI.
    const r = await fetch('https://ollama.com/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        model: modelo, stream: false,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) throw new Error(await mensagemErro(r));
    const d = await r.json();
    const texto = d.message?.content?.trim();
    if (!texto) throw new Error('A resposta veio vazia.');
    return texto;
  }

  if (provedor === 'gemini') {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${chave}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 220 },
        }),
        signal: AbortSignal.timeout(40_000),
      },
    );
    if (!r.ok) throw new Error(await mensagemErro(r));
    const d = await r.json();
    const texto = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!texto) throw new Error('A resposta veio vazia.');
    return texto;
  }

  // claude
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': chave, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: modelo, max_tokens: 220, temperature: 0.8, system, messages: [{ role: 'user', content: user }] }),
    signal: AbortSignal.timeout(40_000),
  });
  if (!r.ok) throw new Error(await mensagemErro(r));
  const d = await r.json();
  const texto = d.content?.[0]?.text?.trim();
  if (!texto) throw new Error('A resposta veio vazia.');
  return texto;
}

async function mensagemErro(r: Response): Promise<string> {
  try {
    const d = await r.json();
    return d.error?.message ?? d.message ?? `A API respondeu ${r.status}.`;
  } catch {
    return `A API respondeu ${r.status}.`;
  }
}
