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

## Publicação e verificações de produção (mesma rodada)
- GitHub CI do PR #8 aprovado: 11 asserts de allowlist, TypeScript e build Next.js.
- Merge de correção `941793723df5d58f9bf22d4fbe5028bb94b532f1`; imagem gerada fora da VPS em CI `40150254479`, conclusão sucesso.
- Serviço `harvest_harvest` atualizado no Docker Swarm mantendo a configuração e as credenciais anteriores. Imagem efetiva após atualização: `ghcr.io/tuco-gui/harvest-ai:latest@sha256:bcf251764392bf066264b8344614da7b334b65ab4f581327da13160fc83c423b`; tarefa Swarm desejada `running`, estado `running`.
- Teste via navegador sem sessão, URL real `https://harvest.figueiramarketing.com.br`: `/esqueci-senha`, `/verificar-codigo` e `/entrar` renderizaram sem redirecionamento indevido.
- Teste de recuperação com domínio reservado de exemplo (`example.invalid`), sem endereço real nem envio: aplicação exibiu `A recuperação por e-mail está temporariamente indisponível. Contate o suporte.`. Isso confirmou indisponibilidade do SMTP com mensagem fiel; **o envio OTP segue não operacional até provisionar SMTP**.
- Login com senha original do titular **não foi testado** pelo agente; nenhum segredo de autenticação foi solicitado ou alterado.
- O experimento Deskcomm em outro PR continua separado e não foi promovido à VPS.

## Pendente
Provisionar identidade de envio SMTP institucional no runtime/cofre e comprovar entrega de um OTP em endereço autorizado, sem copiar senhas por chat ou log. Depois, titular testa seu login e eventual redefinição.
