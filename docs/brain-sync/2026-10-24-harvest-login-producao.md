# Brain/Wiki — Harvest — correção de autenticação em produção
**Data local:** 2026-10-24 (America/Sao_Paulo)
**Fonte operacional:** `tuco-gui/harvest-ai` (não publicar vault completo)
**Referência:** `docs/decisoes/ADR-011-harvest-unico-producao-workspaces.md`
**Escopo:** INSTITUCIONAL; somente Figueira/Harvest, sem dados de cliente.

## Decisão vigente
Harvest deve operar em uma única instalação de produção na VPS. O ambiente de validação de funcionalidades é a **workspace Figueira Marketing**, marcada pelos módulos de cada conta, não um staging separado. Após homologação, habilitar recursos nas demais workspaces. Não confundir com `Figueira QA` ou projeto Vercel.

## Diagnóstico verificado (produção real)
- Confirmado **um** superadmin em `perfis`, vinculado ao Supabase Auth com e-mail confirmado e `senha_provisoria=false`. Nenhum usuário/senha/permissão foi alterado.
- Workspace Figueira Marketing, slug `figueira-marketing`, tem os módulos WhatsApp, IA, usuários, chamados, status e CRM.
- O middleware exigia login em `/esqueci-senha`, `/verificar-codigo` e `/api/auth/esqueci-senha`, inviabilizando recuperação quando não autenticado.
- No serviço Harvest em produção, não foram encontrados `SMTP_*` ou Docker secrets de SMTP. `config_sistema` do Harvest não possuía host, usuário ou senha SMTP. O código não faz fallback para DB em produção. Não existe garantia de envio de OTP enquanto o provedor institucional não estiver configurado.
- A imagem antiga antes do hotfix tem digest `ghcr.io/tuco-gui/harvest-ai@sha256:24581b7e06d8bbb4c3f2891dd4019dd96f17cddbc61867287c87d2d75790d94c`.

## Correção de código
Hotfix separado do piloto Deskcomm, no PR #8, aprovado em testes de rota, TypeScript e build. Allowlist exata para recuperação de senha, sem abrir rotas privadas, mensagem operacional se SMTP estiver indisponível, texto de confirmação sem presumir entrega. Sem migrations ou alteração em perfis/contas.

## Operação
- Continuar acessando a URL **real de produção** `https://harvest.figueiramarketing.com.br/entrar`, no Supabase existente.
- Não recriar superadmin, redefinir senha, reproduzir senha em logs ou copiar SMTP de outro serviço sem vínculo autorizado no cofre.
- Validação funcional do titular é necessária para confirmar senha existente. SMTP precisa de origem institucional segura antes de testar OTP entregue.
- Registrar status de imagem e serviço após publicação; não confundir Git merge, build e rollout com aplicativo pronto.

## Sincronização
Este Markdown é uma nota **para** a Wiki do Obsidian. O Brain canônico `/Users/gui_t/Figueira_Marketing/brain` não está acessível diretamente nesta sessão. Não afirmar que foi sincronizado no Mac. Preservar versões anteriores, sem overwrite.
