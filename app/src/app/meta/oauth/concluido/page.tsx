import MetaOAuthConcluido from '@/componentes/MetaOAuthConcluido';
export default async function Pagina({searchParams}:{
 searchParams:Promise<{resultado?:string}>}){
 const {resultado}=await searchParams;
 return <MetaOAuthConcluido resultado={resultado==='ok'?'ok':'erro'}/>;
}
