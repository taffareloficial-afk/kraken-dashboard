-- ═══════════════════════════════════════════════════════════════════════════
-- Kraken Dashboard — Supabase Schema (tabelas reais)
-- Execute no SQL Editor: https://supabase.com → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tabela lancamentos ────────────────────────────────────────────────────────
-- Cada lançamento = 1 linha. descricao armazena o JSON completo do objeto.
CREATE TABLE IF NOT EXISTS public.lancamentos (
  id          TEXT        PRIMARY KEY,          -- UUID gerado pelo app
  data        TEXT,                             -- "YYYY-MM-DD"
  tipo        TEXT,                             -- type do objeto
  descricao   TEXT,                             -- JSON completo serializado
  valor       NUMERIC     DEFAULT 0,
  categoria   TEXT,                             -- 'provento' | 'operacao' | etc
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  user_id  TEXT        NOT NULL DEFAULT 'offline'
);

-- Índice para queries por user_id (performance)
CREATE INDEX IF NOT EXISTS idx_lancamentos_user_id
  ON public.lancamentos (user_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;

-- Permite acesso anônimo com user_id = 'offline'
-- (para sincronizar sem autenticação entre PC e iPhone)
CREATE POLICY "Allow offline access"
  ON public.lancamentos
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ALTERNATIVA MAIS RESTRITA (descomente se quiser)
-- Permite qualquer usuário acessar apenas seus próprios dados:
-- CREATE POLICY "Users own their data"
--   ON public.lancamentos
--   FOR ALL
--   TO anon, authenticated
--   USING (
--     user_id = 'offline'
--     OR (auth.role() = 'authenticated' AND user_id = auth.uid()::text)
--   )
--   WITH CHECK (
--     user_id = 'offline'
--     OR (auth.role() = 'authenticated' AND user_id = auth.uid()::text)
--   );

-- ── Realtime ──────────────────────────────────────────────────────────────────
ALTER TABLE public.lancamentos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lancamentos;

-- ── Tabela configuracoes (opcional, para sync de settings) ────────────────────
CREATE TABLE IF NOT EXISTS public.configuracoes (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chave       TEXT        NOT NULL,
  valor       TEXT,
  user_id  TEXT        NOT NULL DEFAULT 'offline',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (chave, user_id)
);

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow offline access on configuracoes"
  ON public.configuracoes
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
