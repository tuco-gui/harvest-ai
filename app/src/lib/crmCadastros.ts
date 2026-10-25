/** Esquema canônico dos cadastros CRM, com dados somente da workspace ativa. */
export const ENTIDADES_CRM = ['empresas','contatos','produtos'] as const;
export type EntidadeCadastro = typeof ENTIDADES_CRM[number];
export const ENTIDADES_CAMPOS = ['empresa','contato','oportunidade'] as const;
export type EntidadeCampos = typeof ENTIDADES_CAMPOS[number];
export const TIPOS_CAMPOS = ['texto','numero','data','selecao','booleano'] as const;
export type TipoCampo = typeof TIPOS_CAMPOS[number];
export type CampoDef = { id: number; entidade: EntidadeCampos; chave: string; rotulo: string;
  tipo: TipoCampo; opcoes: string[]; obrigatorio: boolean; ativo: boolean; grupo: string };
/** Grupos são nomes de apresentação e nunca alteram as chaves/valores já gravados. */
export function normalizarGrupoCampo(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return 'Principal';
  if (typeof v !== 'string') return null;
  const grupo = v.trim().replace(/\s+/g, ' ');
  if (grupo.length < 2 || grupo.length > 60 || /[<>\r\n]/.test(grupo)) return null;
  return grupo;
}
export function cadastroValido(t: unknown): t is EntidadeCadastro {
  return typeof t === 'string' && ENTIDADES_CRM.includes(t as EntidadeCadastro);
}
export function entidadeCampoValida(t: unknown): t is EntidadeCampos {
  return typeof t === 'string' && ENTIDADES_CAMPOS.includes(t as EntidadeCampos);
}
export function validarDefCampo(b: any): string | null {
  if (!entidadeCampoValida(b?.entidade)) return 'Entidade inválida.';
  if (!normalizarGrupoCampo(b?.grupo)) return 'Grupo deve ter de 2 a 60 caracteres.';
  if (typeof b.chave !== 'string' || !/^[a-z][a-z0-9_]{1,39}$/.test(b.chave))
    return 'Chave inválida. Use letras minúsculas, números e _.';
  if (typeof b.rotulo !== 'string' || b.rotulo.trim().length < 2 || b.rotulo.trim().length > 80)
    return 'Rótulo deve ter 2 a 80 caracteres.';
  if (!TIPOS_CAMPOS.includes(b.tipo)) return 'Tipo de campo não reconhecido.';
  if (!Array.isArray(b.opcoes) || b.opcoes.length > 30 ||
      b.opcoes.some((x:unknown)=>typeof x !== 'string' || !x.trim() || x.length>80))
    return 'Opções inválidas (máximo 30, com 80 caracteres cada).';
  if (b.tipo === 'selecao' && b.opcoes.length === 0) return 'Seleção precisa de opções.';
  if (typeof b.obrigatorio !== 'boolean') return 'Obrigatoriedade inválida.';
  return null;
}
export function validarValoresPersonalizados(
  valores: unknown, defs: CampoDef[], aplicarObrigatorios = true,
): { ok:true; valores:Record<string,string|number|boolean|null> } | {ok:false; erro:string} {
  if(!valores || typeof valores!=='object' || Array.isArray(valores))
    return {ok:false,erro:'Os valores personalizados precisam ser um objeto.'};
  const original = valores as Record<string,unknown>;
  const ativos = defs.filter(d=>d.ativo);
  const disponiveis = new Map(defs.map(d=>[d.chave,d]));
  const resultado:Record<string,string|number|boolean|null>={};
  if(Object.keys(original).length>60) return {ok:false,erro:'Limite de campos excedido.'};
  for(const [chave,valor] of Object.entries(original)){
    const d = disponiveis.get(chave);
    if(!d) return {ok:false,erro:'Campo desconhecido: '+chave};
    if(valor===null||valor===''||valor===undefined) {resultado[chave]=null;continue;}
    if(d.tipo==='booleano' && typeof valor==='boolean') {resultado[chave]=valor;continue;}
    if(d.tipo==='numero' && typeof valor==='number' && Number.isFinite(valor) && Math.abs(valor)<1e12) {
      resultado[chave]=valor;continue;
    }
    if (typeof valor !== 'string' || valor.length>1000) return {ok:false,erro:'Valor inválido para '+d.rotulo};
    if(d.tipo==='data'&&!/^\d{4}-\d{2}-\d{2}$/.test(valor))
      return {ok:false,erro:'Data inválida em '+d.rotulo};
    if(d.tipo==='selecao'&&!d.opcoes.includes(valor))
      return {ok:false,erro:'Opção inválida em '+d.rotulo};
    if(d.tipo==='numero'||d.tipo==='booleano') return {ok:false,erro:'Tipo inválido em '+d.rotulo};
    resultado[chave]=valor;
  }
  if(aplicarObrigatorios) for(const d of ativos){
    if(d.obrigatorio && (resultado[d.chave]===undefined || resultado[d.chave]===null || resultado[d.chave]===''))
      return {ok:false,erro:'Preencha o campo obrigatório: '+d.rotulo};
  }
  return {ok:true,valores:resultado};
}
export function validarCadastro(entidade:EntidadeCadastro,b:any) {
  if(!b||typeof b!=='object'||Array.isArray(b)) return 'Dados inválidos.';
  if(typeof b.nome!=='string'||b.nome.trim().length<2||b.nome.trim().length>160)
    return 'Nome deve ter 2 a 160 caracteres.';
  for(const chave of ['email','telefone','site','setor','cargo','cnpj','sku','descricao']){
    if(b[chave]!==undefined&&b[chave]!==null&&
       (typeof b[chave]!=='string'||b[chave].length>(chave==='descricao'?2000:220)))
      return 'Campo inválido: '+chave;
  }
  if(entidade==='produtos'&&(typeof b.preco!=='number'||!Number.isFinite(b.preco)||b.preco<0||b.preco>999999999999))
    return 'Informe um preço válido.';
  if(entidade==='produtos'&&b.ativo!==undefined&&typeof b.ativo!=='boolean')return 'Estado inválido.';
  if(entidade==='contatos'&&b.empresa_id!=null&&(!Number.isSafeInteger(b.empresa_id)||b.empresa_id<1))
    return 'Empresa inválida.';
  return null;
}
