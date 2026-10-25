import { telefoneAtendimento } from './crmAtendimentos.ts';

export type ConversaChatwootVerificada = {
  id:number; inbox_id:number; contact_id?:number|null;
  meta?: { sender?: { id?:number|null }; assignee?: {id?:number|null} | null };
  assignee?: {id?:number|null} | null;
};

export function idContatoConversa(c: ConversaChatwootVerificada): number | null {
  const v = c.meta?.sender?.id ?? c.contact_id;
  return Number.isSafeInteger(v) && Number(v)>0 ? Number(v) : null;
}

export function canalPertenceAoVinculo(c: ConversaChatwootVerificada, inboxes:number[]) {
  return Number.isSafeInteger(c.inbox_id) && inboxes.includes(c.inbox_id);
}

export function contatoConfere(c: {phone_number?: string|null}, telefoneHarvest:string) {
  const a=telefoneAtendimento(c.phone_number);
  const b=telefoneAtendimento(telefoneHarvest);
  return !!a && !!b && a===b;
}

export function atribuidoAoAgente(c:ConversaChatwootVerificada, agenteId:number): boolean {
  const assignee=c.meta?.assignee?.id ?? c.assignee?.id;
  return assignee === agenteId;
}
