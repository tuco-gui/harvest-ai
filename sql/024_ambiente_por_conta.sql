-- ADR-009 — elimina o ambiente de staging separado (Vercel + Supabase Cloud
-- harvest-staging): passa a testar dentro da própria produção, via uma conta
-- de teste sob o papel Super Admin. Pré-requisito técnico: a guarda
-- fail-closed do WhatsApp (hoje WHATSAPP_MODE/WHATSAPP_QA_WHITELIST, um env
-- var global do deploy) precisa virar um campo por conta — senão marcar uma
-- conta como "de teste" dentro de produção não isola nada.
-- Idempotente. Rode com: ./scripts/sql.sh -f sql/024_ambiente_por_conta.sql

alter table public.contas
  add column if not exists ambiente text not null default 'producao';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contas_ambiente_check'
      and conrelid = 'public.contas'::regclass
  ) then
    alter table public.contas
      add constraint contas_ambiente_check check (ambiente in ('producao', 'teste'));
  end if;
end $$;

-- Mesmo formato do antigo WHATSAPP_QA_WHITELIST: telefones em E.164 (só
-- dígitos) separados por vírgula. Só é consultado quando ambiente = 'teste'.
alter table public.contas
  add column if not exists whatsapp_qa_whitelist text;

-- Rollback:
--   alter table public.contas drop constraint if exists contas_ambiente_check;
--   alter table public.contas drop column if exists ambiente;
--   alter table public.contas drop column if exists whatsapp_qa_whitelist;
