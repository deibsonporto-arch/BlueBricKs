package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const sessionTTL = 30 * 24 * time.Hour

// Hash SHA-256 de "porto123", pré-computado — o mesmo valor usado no seed
// original do front-end (src/data/seed.ts), pra manter usuário/senha padrão.
const adminSenhaHash = "904b79512596ca779c2efb5c00e4fcff88e5b8f0189a06c8c8815020829487ab"

func seedAdminUsuario(ctx context.Context, pool *pgxpool.Pool) error {
	var count int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM usuarios`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	usuario := map[string]any{
		"id":           "usuario-deibson-porto",
		"nomeUsuario":  "DeibsonPorto",
		"nomeExibicao": "Deibson Porto",
		"senhaHash":    adminSenhaHash,
		"createdAt":    time.Now().UTC().Format(time.RFC3339),
	}
	data, err := json.Marshal(usuario)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `INSERT INTO usuarios (id, data, sort_order) VALUES ($1, $2, 0)`, usuario["id"], data)
	return err
}

type loginRequest struct {
	NomeUsuario string `json:"nomeUsuario"`
	SenhaHash   string `json:"senhaHash"`
}

type loginResponse struct {
	Token   string          `json:"token"`
	Usuario json.RawMessage `json:"usuario"`
}

func handleLogin(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req loginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "corpo inválido", http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(req.NomeUsuario) == "" || req.SenhaHash == "" {
			http.Error(w, "usuário e senha são obrigatórios", http.StatusBadRequest)
			return
		}

		var data []byte
		err := pool.QueryRow(r.Context(), `
			SELECT data FROM usuarios
			WHERE lower(data->>'nomeUsuario') = lower($1) AND data->>'senhaHash' = $2
			LIMIT 1`, req.NomeUsuario, req.SenhaHash).Scan(&data)
		if err == pgx.ErrNoRows {
			http.Error(w, "usuário ou senha inválidos", http.StatusUnauthorized)
			return
		}
		if err != nil {
			internalError(w, "login query", err)
			return
		}

		var usuario struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(data, &usuario); err != nil {
			internalError(w, "login unmarshal", err)
			return
		}

		token, err := generateToken()
		if err != nil {
			internalError(w, "login generateToken", err)
			return
		}
		expiresAt := time.Now().Add(sessionTTL)
		if _, err := pool.Exec(r.Context(), `INSERT INTO sessions (token, usuario_id, expires_at) VALUES ($1, $2, $3)`,
			token, usuario.ID, expiresAt); err != nil {
			internalError(w, "login insert session", err)
			return
		}

		writeJSON(w, http.StatusOK, loginResponse{Token: token, Usuario: data})
	}
}

func handleLogout(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := bearerToken(r)
		if token != "" {
			_, _ = pool.Exec(r.Context(), `DELETE FROM sessions WHERE token = $1`, token)
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func requireAuth(pool *pgxpool.Pool, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := bearerToken(r)
		if token == "" {
			http.Error(w, "não autenticado", http.StatusUnauthorized)
			return
		}
		var expiresAt time.Time
		err := pool.QueryRow(r.Context(), `SELECT expires_at FROM sessions WHERE token = $1`, token).Scan(&expiresAt)
		if err == pgx.ErrNoRows {
			http.Error(w, "sessão inválida", http.StatusUnauthorized)
			return
		}
		if err != nil {
			internalError(w, "requireAuth query", err)
			return
		}
		if time.Now().After(expiresAt) {
			http.Error(w, "sessão expirada", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if !strings.HasPrefix(h, "Bearer ") {
		return ""
	}
	return strings.TrimPrefix(h, "Bearer ")
}

func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
