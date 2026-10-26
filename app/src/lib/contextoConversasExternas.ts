import {NextResponse} from 'next/server';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import {perfilTemModulo} from '@/lib/autorizacao';
import {isAdmin} from '@/lib/crmControleAcesso';

export async function contexto(){
 const perfil=await perfilAtual();
 if(!perfil?.conta_id)return {erro:NextResponse.json({erro:'Sessão ou workspace ausente.'},{status:401})} as const;
 const admin=supabaseAdmin();
 if(!(await perfilTemModulo(admin,perfil,'crm'))||
    !(await perfilTemModulo(admin,perfil,'crm_avancado')))
  return {erro:NextResponse.json({erro:'CRM avançado não habilitado.'},{status:403})} as const;
 return {perfil,admin} as const;
}
export {isAdmin};
