package main

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Coleções migradas do localStorage do front-end. Cada uma vira uma tabela
// "documento" (id + data JSONB), preservando o mesmo modelo do repositório
// genérico do front-end (Repository<T>). A coluna embedding fica reservada
// para busca semântica futura via pgvector — não é preenchida hoje.
var collections = []string{
	"atividades",
	"cotacoes",
	"diario_entries",
	"empreitadas",
	"equipes",
	"ferramentas_catalogo",
	"ferramentas",
	"fornecedores",
	"historico_precos",
	"itens_providenciados",
	"lancamentos",
	"lembretes",
	"listas_materiais",
	"locacoes",
	"locais_ferramentas",
	"obras",
	"materiais_catalogo",
	"pmo_entries",
	"templates",
	"usuarios",
	"orcamento_modelos",
	"orcamento_analitico_itens",
	"orcamento_materiais_itens",
}

var collectionSet = func() map[string]bool {
	m := make(map[string]bool, len(collections))
	for _, c := range collections {
		m[c] = true
	}
	return m
}()

func isValidCollection(name string) bool {
	return collectionSet[name]
}

func migrate(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, `CREATE EXTENSION IF NOT EXISTS vector`); err != nil {
		return fmt.Errorf("extensão pgvector: %w", err)
	}

	for _, name := range collections {
		ddl := fmt.Sprintf(`
			CREATE TABLE IF NOT EXISTS %s (
				id TEXT PRIMARY KEY,
				data JSONB NOT NULL,
				sort_order INTEGER NOT NULL DEFAULT 0,
				embedding vector(1536),
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			)`, name)
		if _, err := pool.Exec(ctx, ddl); err != nil {
			return fmt.Errorf("tabela %s: %w", name, err)
		}
		idx := fmt.Sprintf(`CREATE INDEX IF NOT EXISTS %s_sort_order_idx ON %s (sort_order)`, name, name)
		if _, err := pool.Exec(ctx, idx); err != nil {
			return fmt.Errorf("índice %s: %w", name, err)
		}
	}

	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS sessions (
			token TEXT PRIMARY KEY,
			usuario_id TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			expires_at TIMESTAMPTZ NOT NULL
		)`); err != nil {
		return fmt.Errorf("tabela sessions: %w", err)
	}

	// Anexos (fotos, PDFs, comprovantes) ficam fora do padrão coleção/JSONB: são
	// blobs grandes referenciados por id a partir de outras coleções (ex: lancamentos),
	// não uma lista ordenada que se lê/escreve por inteiro.
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS anexos (
			id TEXT PRIMARY KEY,
			data_url TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`); err != nil {
		return fmt.Errorf("tabela anexos: %w", err)
	}

	if err := migrateSinapi(ctx, pool); err != nil {
		return err
	}

	return nil
}

// Base de referência SINAPI (insumos, composições e a árvore composição→itens).
// Dados grandes e somente-leitura, importados mensalmente por script externo
// (scripts/import-sinapi.mjs) — por isso ficam fora do padrão coleção/JSONB
// (não fazem parte do fetchBootstrap/localStorage, são consultados sob demanda
// pelos endpoints /api/sinapi/*).
func migrateSinapi(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS sinapi_insumos (
			codigo INTEGER NOT NULL,
			mes_referencia TEXT NOT NULL,
			desoneracao TEXT NOT NULL,
			classificacao TEXT,
			descricao TEXT NOT NULL,
			unidade TEXT NOT NULL,
			origem_preco TEXT,
			precos JSONB NOT NULL,
			PRIMARY KEY (codigo, mes_referencia, desoneracao)
		)`); err != nil {
		return fmt.Errorf("tabela sinapi_insumos: %w", err)
	}

	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS sinapi_composicoes (
			codigo INTEGER NOT NULL,
			mes_referencia TEXT NOT NULL,
			desoneracao TEXT NOT NULL,
			grupo TEXT,
			descricao TEXT NOT NULL,
			unidade TEXT NOT NULL,
			custos JSONB NOT NULL,
			PRIMARY KEY (codigo, mes_referencia, desoneracao)
		)`); err != nil {
		return fmt.Errorf("tabela sinapi_composicoes: %w", err)
	}
	if _, err := pool.Exec(ctx, `
		CREATE INDEX IF NOT EXISTS sinapi_composicoes_busca_idx
		ON sinapi_composicoes USING gin (to_tsvector('portuguese', descricao))`); err != nil {
		return fmt.Errorf("índice sinapi_composicoes_busca_idx: %w", err)
	}

	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS sinapi_composicao_itens (
			id SERIAL PRIMARY KEY,
			composicao_codigo INTEGER NOT NULL,
			mes_referencia TEXT NOT NULL,
			tipo_item TEXT NOT NULL,
			item_codigo INTEGER NOT NULL,
			descricao TEXT NOT NULL,
			unidade TEXT NOT NULL,
			coeficiente NUMERIC NOT NULL
		)`); err != nil {
		return fmt.Errorf("tabela sinapi_composicao_itens: %w", err)
	}
	if _, err := pool.Exec(ctx, `
		CREATE INDEX IF NOT EXISTS sinapi_composicao_itens_pai_idx
		ON sinapi_composicao_itens (composicao_codigo, mes_referencia)`); err != nil {
		return fmt.Errorf("índice sinapi_composicao_itens_pai_idx: %w", err)
	}

	return nil
}
