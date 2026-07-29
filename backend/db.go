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

	return nil
}
