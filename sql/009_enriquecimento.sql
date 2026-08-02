-- Enriquecimento por lead: decisor (Perplexity), LinkedIn (Serper) e e-mail
-- (Anymail Finder). Sob demanda, nunca automático — mesmo padrão de custo
-- controlado do crédito de SerpAPI e do token de IA. Idempotente.

alter table public.conta_credenciais add column if not exists perplexity_key text;
alter table public.conta_credenciais add column if not exists serper_key text;
alter table public.conta_credenciais add column if not exists anymail_key text;

-- prospecta_leads já tinha `email` (reaproveitado aqui pro e-mail do decisor)
-- e `status` já previa o valor 'enriquecido' desde o schema original.
alter table public.prospecta_leads add column if not exists cnpj text;
alter table public.prospecta_leads add column if not exists decisor_nome text;
alter table public.prospecta_leads add column if not exists linkedin text;
alter table public.prospecta_leads add column if not exists email_status text; -- valid | risky | not_found
alter table public.prospecta_leads add column if not exists enriquecido_em timestamptz;

notify pgrst, 'reload schema';
