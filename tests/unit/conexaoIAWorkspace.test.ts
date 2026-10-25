import assert from 'node:assert/strict';
import { resolverConexaoIA, estadoConexaoIA } from '../../app/src/lib/conexaoIAWorkspace.ts';

const tokenFake = 'somente-teste-nao-e-credencial-real';
const normal = { ia_provedor: 'gemini', ia_key: tokenFake, ia_modelo: 'gemini-2.5-flash' };
const conexao = resolverConexaoIA(normal);
assert.deepEqual(conexao, { provedor: 'gemini', chave: tokenFake, modelo: 'gemini-2.5-flash' });
assert.deepEqual(estadoConexaoIA(normal), {
  configurada: true, provedor: 'gemini', modelo: 'gemini-2.5-flash',
});
assert(!JSON.stringify(estadoConexaoIA(normal)).includes(tokenFake), 'API publica nao deve expor token');

for (const provedor of ['openai', 'groq', 'claude', 'ollama', 'gemini']) {
  assert.equal(resolverConexaoIA({ ia_provedor: provedor, ia_key: tokenFake })?.provedor, provedor);
}
assert.equal(resolverConexaoIA({ ia_provedor: 'outro', ia_key: tokenFake }), null);
assert.equal(resolverConexaoIA({ ia_provedor: 'gemini', ia_key: '  ' }), null);
assert.equal(resolverConexaoIA(null), null);
assert.deepEqual(estadoConexaoIA(null), { configurada: false, provedor: null, modelo: null });
assert.deepEqual(resolverConexaoIA({ ia_key: tokenFake }), { provedor: 'openai', chave: tokenFake, modelo: null });
assert.equal(resolverConexaoIA({ ia_provedor: 'groq', ia_key: tokenFake, ia_modelo: '  ' })?.modelo, null);
console.log('conexaoIAWorkspace: heranca de provedor/modelo, privacidade e ausencia de chave aprovadas');
