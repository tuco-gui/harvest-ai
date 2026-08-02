-- Modo grátis pra achar o decisor: busca (Serper/Tavily, já cadastrados)
-- + IA (Groq/Gemini, já cadastrados) em vez da Perplexity. Sem chave nova —
-- reaproveita o que a conta já tem. Idempotente.

alter table public.conta_credenciais add column if not exists decisor_provedor text not null default 'perplexity';

notify pgrst, 'reload schema';
