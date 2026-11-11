-- Catálogo visual por workspace, sem mover arquivos nem alterar cadastros antigos.
BEGIN;
ALTER TABLE public.crm_produtos
 ADD COLUMN IF NOT EXISTS imagens jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.crm_produtos
 ADD CONSTRAINT crm_produtos_imagens_array CHECK (
   jsonb_typeof(imagens)='array' AND jsonb_array_length(imagens)<=12
 );
COMMENT ON COLUMN public.crm_produtos.imagens IS
 'Galeria de até 12 imagens; URLs HTTPS autorizadas, legendas e indicador de uso ilustrativo; a UI não deve tratar referências como fotos da unidade.';
NOTIFY pgrst, 'reload schema';
COMMIT;
