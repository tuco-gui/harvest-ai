-- Perfil do usuário: foto e o que vier depois.
-- Idempotente: pode rodar de novo sem medo.

alter table public.perfis add column if not exists avatar_url text;

-- Bucket público para as fotos. É público de propósito: são fotos de avatar,
-- não tem nada sensível, e assim a imagem carrega sem token na tag <img>.
-- O upload não passa por aqui — vai pelo servidor, com a service key, e o
-- nome do arquivo é sempre o id do próprio usuário, então ninguém sobrescreve
-- a foto de outro.
insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do update set public = true;

notify pgrst, 'reload schema';
