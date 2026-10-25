import {redirect} from 'next/navigation';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import {perfilTemModulo} from '@/lib/autorizacao';
import {isAdmin} from '@/lib/crmControleAcesso';
import GestaoCamposCRM from '@/componentes/GestaoCamposCRM';
export default async function Pagina(){
 const perfil=await perfilAtual();
 if(!perfil)redirect('/entrar');
 if(!perfil.conta_id)redirect('/contas');
 const admin=supabaseAdmin();
 if(!(await perfilTemModulo(admin,perfil,'crm'))||
 !(await perfilTemModulo(admin,perfil,'crm_avancado'))||!isAdmin(perfil.papel))redirect('/crm');
 return <GestaoCamposCRM/>;
}