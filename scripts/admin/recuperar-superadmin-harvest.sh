#!/usr/bin/env bash
# Recuperacao assistida do superadmin da instancia Harvest de PRODUCAO.
# Executar SOMENTE na VPS institucional Figueira, com acesso ao Docker.
# Nao armazena credenciais em arquivos, historico de shell ou argumentos do Docker.
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Erro: docker indisponivel. Rode no terminal da VPS institucional." >&2
  exit 1
fi
if [ ! -r /dev/tty ]; then
  echo "Erro: e necessario um terminal interativo para digitar a senha sem eco." >&2
  exit 1
fi
CID="$(docker ps -q --filter 'name=harvest_harvest' | head -n 1)"
if [ -z "$CID" ]; then
  echo "Erro: nao encontrei o container harvest_harvest em execucao." >&2
  exit 1
fi

printf 'Novo e-mail do superadmin: ' >/dev/tty
IFS= read -r NOVO_EMAIL </dev/tty
IFS= read -rs -p 'Nova senha (entrada oculta): ' NOVA_SENHA </dev/tty
printf '\n' >/dev/tty
trap 'unset NOVO_EMAIL NOVA_SENHA' EXIT

# Codigo Node enviado apenas como argumento de programa, SEM senha ou chave.
# Dados digitados sao enviados separadamente pelo STDIN do docker exec.
SCRIPT_NODE="$(cat <<'NODE'
(async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  const sep = raw.indexOf('\0');
  if (sep < 1) throw new Error('Entrada invalida.');
  const email = raw.slice(0, sep).trim().toLowerCase();
  const password = raw.slice(sep + 1);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Formato de e-mail invalido.');
  if (password.length < 8) throw new Error('Senha deve conter pelo menos 8 caracteres.');

  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!serviceKey || !anonKey) throw new Error('Credenciais de API do Harvest ausentes. Nenhuma alteracao realizada.');
  const base = 'http://kong:8000'; // mesma rede Docker do Harvest, sem trafego publico

  async function request(method, endpoint, body) {
    const resp = await fetch(base + endpoint, {
      method,
      headers: {
        apikey: serviceKey,
        Authorization: 'Bearer ' + serviceKey,
        'Content-Type': 'application/json',
        ...(body ? { Prefer: 'return=representation' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const txt = await resp.text();
    let data;
    try { data = JSON.parse(txt); } catch { data = null; }
    return { ok: resp.ok, status: resp.status, data };
  }

  // Preflight: uma unica conta superadmin e os registros Auth/Perfil coincidem.
  const perfis = await request('GET', '/rest/v1/perfis?papel=eq.super_admin&select=id,email,papel');
  if (!perfis.ok || !Array.isArray(perfis.data) || perfis.data.length !== 1)
    throw new Error('Preflight de superadmin nao passou. Nenhuma alteracao realizada.');
  const perfil = perfis.data[0];
  const auth = await request('GET', '/auth/v1/admin/users/' + encodeURIComponent(perfil.id));
  const usuario = auth.data?.user || auth.data;
  if (!auth.ok || usuario?.id !== perfil.id ||
      usuario?.email?.toLowerCase() !== perfil.email?.toLowerCase())
    throw new Error('Auth e perfil nao coincidem. Nenhuma alteracao realizada.');

  const colisoes = await request('GET',
    '/rest/v1/perfis?email=eq.' + encodeURIComponent(email) + '&select=id');
  if (!colisoes.ok || !Array.isArray(colisoes.data) ||
      colisoes.data.some(p => p.id !== perfil.id))
    throw new Error('E-mail ja usado ou verificacao de unicidade indisponivel.');

  console.log('Identidade de superadmin validada. Atualizando no Auth...');
  const atualizado = await request('PUT',
    '/auth/v1/admin/users/' + encodeURIComponent(perfil.id),
    { email, password, email_confirm: true });
  if (!atualizado.ok)
    throw new Error('Auth recusou a alteracao (HTTP ' + atualizado.status + '). Nenhuma senha foi exibida.');

  const perfilAtualizado = await request('PATCH',
    '/rest/v1/perfis?id=eq.' + encodeURIComponent(perfil.id),
    { email });
  if (!perfilAtualizado.ok || !Array.isArray(perfilAtualizado.data) ||
      perfilAtualizado.data.length !== 1)
    throw new Error('Auth atualizado, mas sincronizacao de perfis falhou. Revisao administrativa necessaria.');

  const confirmado = await request('GET',
    '/auth/v1/admin/users/' + encodeURIComponent(perfil.id));
  const userFinal = confirmado.data?.user || confirmado.data;
  if (!confirmado.ok || userFinal?.id !== perfil.id ||
      userFinal?.email?.toLowerCase() !== email)
    throw new Error('Nao foi possivel confirmar e-mail no Auth apos atualizacao.');

  // Verifica se a senha nova autentica, sem imprimir tokens nem expor credenciais.
  const login = await fetch(base + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: 'Bearer ' + anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  if (!login.ok) {
    throw new Error('E-mail alterado, mas login de teste falhou (HTTP ' + login.status + ').');
  }
  console.log('OK: superadmin atualizado, perfil sincronizado e login de teste aprovado.');
})().catch(e => {
  console.error('Falha segura:', e?.message || 'erro desconhecido');
  process.exitCode = 1;
});
NODE
)"

# printf e builtin do Bash: a senha nao entra como argumento de subprocesso,
# linha de comando, imagem Docker, log, repositório nem variavel de ambiente.
printf '%s\0%s' "$NOVO_EMAIL" "$NOVA_SENHA" | docker exec -i "$CID" node -e "$SCRIPT_NODE"
