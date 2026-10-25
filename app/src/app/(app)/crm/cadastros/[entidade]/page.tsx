import { redirect, notFound } from 'next/navigation';
import { perfilAtual,supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { isAdmin } from '@/lib/crmControleAcesso';
import { cadastroValido } from '@/lib/crmCadastros';
import CadastrosCRM from '@/componentes/CadastrosCRM';

export default async function Pagina({params}:{params:Promise<{entidade:string}>}) {
 const {entidade}=await params;
 if(entidade==='contatos')redirect('/crm/contatos');
 if(!cadastroValido(entidade))notFound();
 const perfil=await perfilAtual();
 if(!perfil)redirect('/entrar');
 if(!perfil.conta_id)redirect('/contas');
 const admin=supabaseAdmin();
 if(!(await perfilTemModulo(admin,perfil,'crm'))||
    !(await perfilTemModulo(admin,perfil,'crm_avancado')))redirect('/crm');
 if(!isAdmin(perfil.papel))redirect('/crm');
 return <CadastrosCRM entidade={entidade}/>;
}