-- Prospecta IA — schema
-- Rodar no SQL Editor do Supabase (ou via pg-meta). Idempotente.

-- 1. Buscas: uma linha por chamada à SerpAPI. Extrato de créditos + evita repetir busca.
create table if not exists public.prospecta_buscas (
  id                bigserial primary key,
  criado_em         timestamptz not null default now(),
  termo             text        not null,
  localizacao       text,
  ll                text,                       -- "@lat,lng,zoom"
  pagina            integer     not null default 1,
  engine            text        not null default 'google_maps',
  total_resultados  integer,
  novos_leads       integer,
  status            text        not null default 'ok',   -- ok | erro
  erro              text,
  origem            text        not null default 'painel'
);

-- 2. Leads: uma linha por empresa. place_id e telefone são as chaves de dedupe.
create table if not exists public.prospecta_leads (
  id                bigserial primary key,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  busca_id          bigint references public.prospecta_buscas(id) on delete set null,

  -- identidade / Google Maps
  place_id          text unique,
  empresa           text        not null,
  telefone          text,                       -- só dígitos, com DDI 55
  telefone_original text,
  endereco          text,
  categoria         text,
  especialidades    text,
  rating            numeric(2,1),
  reviews           integer,
  site              text,
  latitude          numeric,
  longitude         numeric,

  -- enriquecimento
  tem_whatsapp      text        not null default 'nao_verificado',  -- sim | nao | nao_verificado
  whatsapp_jid      text,
  email             text,
  instagram         text,
  resumo_site       text,
  score             integer,
  temperatura       text,                       -- frio | morno | quente

  -- pipeline
  status            text        not null default 'novo',
    -- novo | enriquecido | disparado | respondeu | qualificado | descartado
  disparo           text        not null default 'nao',  -- 'sim' quando o WhatsApp sai
  disparado_em      timestamptz,
  respondeu_em      timestamptz,
  origem            text        not null default 'serpapi'
);

-- Dedupe é pelo place_id (identidade real da empresa no Google Maps).
-- Telefone é só índice de consulta: duas empresas podem legitimamente dividir
-- um número (franquia, mesmo dono), e uma UNIQUE aqui derrubaria o lote inteiro
-- no upsert com ON CONFLICT (place_id).
create index if not exists prospecta_leads_telefone_idx on public.prospecta_leads (telefone);
create index if not exists prospecta_leads_status_idx on public.prospecta_leads (status);
create index if not exists prospecta_leads_score_idx  on public.prospecta_leads (score desc nulls last);

-- atualizado_em automático: uma trigger em vez de cada nó do n8n lembrar de setar
create or replace function public.set_atualizado_em() returns trigger
language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists prospecta_leads_atualizado_em on public.prospecta_leads;
create trigger prospecta_leads_atualizado_em
  before update on public.prospecta_leads
  for each row execute function public.set_atualizado_em();

-- 3. Mensagens: histórico do que a IA gerou e do que foi enviado/recebido.
create table if not exists public.prospecta_mensagens (
  id          bigserial primary key,
  criado_em   timestamptz not null default now(),
  lead_id     bigint      not null references public.prospecta_leads(id) on delete cascade,
  parte       integer,
  direcao     text        not null default 'saida',   -- saida | entrada
  conteudo    text        not null,
  status      text        not null default 'gerada',  -- gerada | enviada | erro
  enviado_em  timestamptz,
  erro        text
);

create index if not exists prospecta_mensagens_lead_idx on public.prospecta_mensagens (lead_id);

-- RLS ligado sem policy: só a service_role (usada pelo n8n) escreve/lê.
-- Sem isso a anon key exposta no painel leria a base inteira.
alter table public.prospecta_buscas    enable row level security;
alter table public.prospecta_leads     enable row level security;
alter table public.prospecta_mensagens enable row level security;

-- GRANTs explícitos para a service_role (o role que o n8n usa).
-- Normalmente os ALTER DEFAULT PRIVILEGES do Supabase já cobrem isso; explicitar
-- deixa o script auto-contido e é idempotente.
-- anon e authenticated não recebem nada de propósito: o painel não fala com o banco.
grant usage on schema public to service_role;

grant all privileges on public.prospecta_buscas    to service_role;
grant all privileges on public.prospecta_leads     to service_role;
grant all privileges on public.prospecta_mensagens to service_role;

grant usage, select on sequence public.prospecta_buscas_id_seq    to service_role;
grant usage, select on sequence public.prospecta_leads_id_seq     to service_role;
grant usage, select on sequence public.prospecta_mensagens_id_seq to service_role;

-- Pede ao PostgREST para recarregar o cache de schema.
--
-- Isto só funciona se o serviço rest estiver com o canal ligado:
--     PGRST_DB_CHANNEL_ENABLED=true
--     PGRST_DB_CHANNEL=pgrst
-- Sem essas duas variáveis a tabela nova entra num estado traiçoeiro —
-- SELECT funciona, mas todo INSERT devolve `404 {}` sem mensagem, e só um
-- restart do container resolve. Aconteceu em 30/07/2026; corrigido na stack
-- em 31/07 e verificado (tabela criada e INSERT no segundo seguinte, 201).
-- Sintoma de confirmação, se voltar: GET /rest/v1/ não lista a tabela.
notify pgrst, 'reload schema';
