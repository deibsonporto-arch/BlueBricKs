package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func internalError(w http.ResponseWriter, context string, err error) {
	log.Printf("erro interno em %s: %v", context, err)
	http.Error(w, "erro interno", http.StatusInternalServerError)
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func fetchCollection(ctx context.Context, pool *pgxpool.Pool, name string) ([]json.RawMessage, error) {
	rows, err := pool.Query(ctx, fmt.Sprintf(`SELECT data FROM %s ORDER BY sort_order ASC`, name))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]json.RawMessage, 0)
	for rows.Next() {
		var data json.RawMessage
		if err := rows.Scan(&data); err != nil {
			return nil, err
		}
		items = append(items, data)
	}
	return items, rows.Err()
}

func handleListCollection(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("collection")
		if !isValidCollection(name) {
			http.Error(w, "coleção desconhecida", http.StatusNotFound)
			return
		}
		items, err := fetchCollection(r.Context(), pool, name)
		if err != nil {
			internalError(w, "listar "+name, err)
			return
		}
		writeJSON(w, http.StatusOK, items)
	}
}

func handleBootstrap(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		result := make(map[string][]json.RawMessage, len(collections))
		for _, name := range collections {
			items, err := fetchCollection(r.Context(), pool, name)
			if err != nil {
				internalError(w, "bootstrap "+name, err)
				return
			}
			result[name] = items
		}
		writeJSON(w, http.StatusOK, result)
	}
}

type itemWithID struct {
	ID *string `json:"id"`
}

// handleBulkReplace substitui o conteúdo inteiro de uma coleção pelo array enviado,
// preservando a ordem recebida em sort_order. Espelha o padrão do front-end, que
// sempre lê/escreve a coleção inteira de uma vez (readCollection/writeCollection).
func handleBulkReplace(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("collection")
		if !isValidCollection(name) {
			http.Error(w, "coleção desconhecida", http.StatusNotFound)
			return
		}

		var items []json.RawMessage
		if err := json.NewDecoder(r.Body).Decode(&items); err != nil {
			http.Error(w, "corpo inválido: esperado um array JSON", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		tx, err := pool.Begin(ctx)
		if err != nil {
			internalError(w, "begin tx "+name, err)
			return
		}
		defer tx.Rollback(ctx)

		if _, err := tx.Exec(ctx, fmt.Sprintf(`DELETE FROM %s`, name)); err != nil {
			internalError(w, "delete "+name, err)
			return
		}

		insertSQL := fmt.Sprintf(`INSERT INTO %s (id, data, sort_order) VALUES ($1, $2, $3)`, name)
		for i, raw := range items {
			var meta itemWithID
			if err := json.Unmarshal(raw, &meta); err != nil || meta.ID == nil || *meta.ID == "" {
				http.Error(w, fmt.Sprintf("item %d sem campo 'id' válido", i), http.StatusBadRequest)
				return
			}
			if _, err := tx.Exec(ctx, insertSQL, *meta.ID, raw, i); err != nil {
				internalError(w, "insert "+name, err)
				return
			}
		}

		if err := tx.Commit(ctx); err != nil {
			internalError(w, "commit "+name, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

type anexoRequest struct {
	DataURL string `json:"dataUrl"`
}

type anexoResponse struct {
	ID      string `json:"id"`
	DataURL string `json:"dataUrl"`
}

func handleGetAnexo(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var dataURL string
		err := pool.QueryRow(r.Context(), `SELECT data_url FROM anexos WHERE id = $1`, id).Scan(&dataURL)
		if err == pgx.ErrNoRows {
			http.Error(w, "anexo não encontrado", http.StatusNotFound)
			return
		}
		if err != nil {
			internalError(w, "get anexo", err)
			return
		}
		writeJSON(w, http.StatusOK, anexoResponse{ID: id, DataURL: dataURL})
	}
}

func handlePutAnexo(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var req anexoRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.DataURL == "" {
			http.Error(w, `corpo inválido: esperado {"dataUrl": "..."}`, http.StatusBadRequest)
			return
		}
		_, err := pool.Exec(r.Context(), `
			INSERT INTO anexos (id, data_url) VALUES ($1, $2)
			ON CONFLICT (id) DO UPDATE SET data_url = EXCLUDED.data_url, updated_at = now()`,
			id, req.DataURL)
		if err != nil {
			internalError(w, "put anexo", err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func handleDeleteAnexo(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if _, err := pool.Exec(r.Context(), `DELETE FROM anexos WHERE id = $1`, id); err != nil {
			internalError(w, "delete anexo", err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
