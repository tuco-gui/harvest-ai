import assert from 'node:assert/strict';
import {cadastroValido,entidadeCampoValida,validarDefCampo,
 validarValoresPersonalizados,validarCadastro,type CampoDef} from '../../app/src/lib/crmCadastros.ts';
import {modulosDaConta} from '../../app/src/lib/autorizacao.ts';
assert(cadastroValido('empresas'));
assert(cadastroValido('contatos'));
assert(cadastroValido('produtos'));
assert(!cadastroValido('perfis'));
assert(entidadeCampoValida('oportunidade'));
assert(!entidadeCampoValida('__proto__'));
const campo:CampoDef={id:1,entidade:'contato',chave:'segmento',rotulo:'Segmento',
 tipo:'selecao',opcoes:['Varejo','Serviços'],obrigatorio:true,ativo:true};
assert.equal(validarDefCampo({...campo}),null);
assert(validarDefCampo({...campo,chave:'DROP TABLE'}));
assert(validarDefCampo({...campo,tipo:'selecao',opcoes:[]}));
assert(validarDefCampo({...campo,entidade:'users'}));
const ok=validarValoresPersonalizados({segmento:'Varejo'},[campo]);
assert(ok.ok);
assert(!validarValoresPersonalizados({segmento:'Outro'},[campo]).ok);
assert(!validarValoresPersonalizados({segmento:''},[campo]).ok);
assert(!validarValoresPersonalizados({nome_desconhecido:'x'},[campo]).ok);
assert(validarCadastro('produtos',{nome:'Plano de mídia',preco:-1}));
assert.equal(validarCadastro('produtos',{nome:'Plano de mídia',preco:199.90,ativo:true}),null);
assert(validarCadastro('contatos',{nome:'A',empresa_id:9}));
assert(!modulosDaConta(['crm'],'super_admin').has('crm_avancado'));
assert(modulosDaConta(['crm','crm_avancado'],'admin').has('crm_avancado'));
console.log('CRM cadastros: tipos, relacionamentos, campos dinamicos e gates OK');
