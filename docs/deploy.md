# Publicar e implantar o Harvest AI no VPS

O app roda como uma stack própria no Docker Swarm, ao lado do que já existe.
Não toca em Supabase, n8n, Baserow, Evolution nem Chatwoot.

## A regra que não pode ser quebrada

**Nunca construir a imagem dentro do VPS.** Compilar o Next.js pede de 1,5 a
3 GB de RAM em pico. O servidor tem 16 GB, com ~12 GB já em uso — sobram
~3,9 GB. Um build lá dentro pode derrubar o Supabase ou o n8n por falta de
memória, e aí o problema deixa de ser o deploy.

Constrói-se fora, publica-se a imagem, e o servidor só baixa e roda. Em
produção o app ocupa ~250 MB, com teto de 512 MB declarado na stack.

## Como o deploy automático funciona

Um push em `app/**` na `main` (ou um `workflow_dispatch` na `main`) dispara
`.github/workflows/imagem.yml`:

1. O job `validar` executa `tests/unit/deploy-imagem.test.ts`.
2. O job `publicar` constrói fora do VPS e publica duas tags no GHCR:
   `:latest` e `:<sha-do-commit>`.
3. O job `implantar` atualiza **somente a imagem** do serviço Swarm
   `harvest_harvest`, usando o **digest** imutável devolvido pelo build
   (`ghcr.io/tuco-gui/harvest-ai@sha256:...`), com `--with-registry-auth`.
4. O workflow espera a convergência do Swarm, confere a imagem efetiva e
   testa `https://harvest.figueiramarketing.com.br/entrar` até receber `200`.
5. Se a atualização ou o smoke test falhar, ele restaura automaticamente a
   imagem que estava em produção antes da troca.

O deploy não roda em pull request. Ele usa o environment `Production` do
GitHub e também pode ser disparado manualmente em **Actions → Publicar e
implantar imagem → Run workflow**.

## Uma vez só

### DNS

Registro A apontando para o servidor:

```
harvest.figueiramarketing.com.br   A   77.37.40.97
```

O certificado sai sozinho: o `letsencryptresolver` já está configurado no
Traefik.

### Secrets do GitHub

Configure em **Settings → Secrets and variables → Actions**, no repositório ou
no environment `Production`:

| Secret | Conteúdo |
|---|---|
| `DEPLOY_HOST` | IP ou hostname do VPS (ex.: `77.37.40.97`) |
| `DEPLOY_USER` | usuário SSH com acesso ao Docker (ex.: `root`) |
| `DEPLOY_SSH_KEY` | chave privada ed25519 sem passphrase, de `BEGIN` a `END` |
| `DEPLOY_KNOWN_HOSTS` | saída de `ssh-keyscan -H 77.37.40.97` |
| `DEPLOY_PORT` | opcional; padrão `22` |

Gere uma chave dedicada e autorize no servidor:

```bash
ssh-keygen -t ed25519 -C harvest-deploy -f ~/.ssh/harvest_deploy -N ''
ssh-copy-id -i ~/.ssh/harvest_deploy.pub root@77.37.40.97
ssh-keyscan -H 77.37.40.97 > /tmp/harvest_known_hosts
```

Cole o conteúdo de `~/.ssh/harvest_deploy` em `DEPLOY_SSH_KEY` e o de
`/tmp/harvest_known_hosts` em `DEPLOY_KNOWN_HOSTS`. A chave privada nunca entra
no git.

Variáveis opcionais do repositório:

| Variável | Padrão |
|---|---|
| `HARVEST_SWARM_SERVICE` | `harvest_harvest` |
| `HARVEST_HEALTHCHECK_URL` | `https://harvest.figueiramarketing.com.br/entrar` |

Enquanto `DEPLOY_HOST` não existir, a imagem continua sendo publicada e o job
de implantação apenas avisa que foi ignorado — nenhum serviço é alterado.

### Acesso ao registro

A imagem é pública, então o servidor consegue baixá-la sem login permanente.
O workflow usa o `GITHUB_TOKEN` efêmero da Action para `docker login` e
`--with-registry-auth`, e faz `docker logout` ao terminar. Isso mantém o
deploy funcionando mesmo se o pacote voltar a ser privado.

Para o fallback manual, use um token clássico com escopo `write:packages`:

```bash
echo SEU_TOKEN | docker login ghcr.io -u tuco-gui --password-stdin
```

## A cada versão

O caminho normal é só fazer merge na `main` e acompanhar o workflow. Para
conferir o resultado:

```bash
docker service inspect \
  --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' harvest_harvest
```

Fallback manual, usando o digest publicado:

```bash
docker service update \
  --with-registry-auth \
  --image ghcr.io/tuco-gui/harvest-ai@sha256:<digest> \
  --force harvest_harvest
```

Rollback manual, com a imagem anterior:

```bash
docker service update \
  --with-registry-auth \
  --image <imagem-anterior> \
  --force harvest_harvest
```

## Como saber se subiu

O job `implantar` fica verde apenas depois de o Swarm convergir e o smoke test
de `/entrar` responder `200`. Fora do Actions:

```bash
curl -sI https://harvest.figueiramarketing.com.br/entrar | head -1
```

Deve responder `200`. A raiz `/` responde `307` para `/entrar` quando não há
sessão — isso é o middleware funcionando, não erro.

## Se der errado

O workflow tenta restaurar automaticamente a imagem anterior. Se o rollback
também falhar, o log aponta a imagem de rollback e a intervenção é manual:

```bash
docker service update \
  --with-registry-auth \
  --image <imagem-anterior> \
  --force harvest_harvest
```

Como último recurso, remova a stack `harvest` no Portainer. Nada mais é
afetado, porque nenhum outro serviço depende dela e o roteador do Traefik é
exclusivo desse hostname.

## Onde ficam os segredos

| Segredo | Onde vive |
|---|---|
| `SUPABASE_SERVICE_KEY` | variável da stack, só no servidor |
| `DEPLOY_SSH_KEY` | secrets do GitHub Actions, nunca no git |
| Chave da SerpAPI de cada cliente | tabela `conta_credenciais`, lida pelo servidor |
| Token da Evolution de cada cliente | idem |

Nenhum deles chega ao navegador. O front pede `/api/busca` e o servidor
resolve a conta pela sessão, busca a chave e chama a ponte do n8n.

## Folga de memória

Com ~3,9 GB livres cabe este app com sobra, mas não muitos mais. Se um dia
apertar, o primeiro candidato a desligar é o Supabase Studio — ele só serve
para administrar o banco e pode subir sob demanda.
