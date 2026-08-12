package main

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

func newServer(pool *pgxpool.Pool) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", handleHealth)
	mux.HandleFunc("POST /api/auth/login", handleLogin(pool))
	mux.HandleFunc("POST /api/auth/logout", handleLogout(pool))

	mux.Handle("GET /api/bootstrap", requireAuth(pool, handleBootstrap(pool)))
	mux.Handle("GET /api/anexos/{id}", requireAuth(pool, handleGetAnexo(pool)))
	mux.Handle("PUT /api/anexos/{id}", requireAuth(pool, handlePutAnexo(pool)))
	mux.Handle("DELETE /api/anexos/{id}", requireAuth(pool, handleDeleteAnexo(pool)))
	mux.Handle("GET /api/sinapi/meses", requireAuth(pool, handleSinapiMeses(pool)))
	mux.Handle("GET /api/sinapi/grupos", requireAuth(pool, handleSinapiGrupos(pool)))
	mux.Handle("GET /api/sinapi/composicoes", requireAuth(pool, handleSinapiComposicoesBusca(pool)))
	mux.Handle("GET /api/sinapi/composicoes/{codigo}/itens", requireAuth(pool, handleSinapiComposicaoItens(pool)))
	mux.Handle("GET /api/sinapi/insumos", requireAuth(pool, handleSinapiInsumosBusca(pool)))
	mux.Handle("POST /api/sinapi/materiais", requireAuth(pool, handleSinapiMateriaisConsolidados(pool)))
	mux.Handle("GET /api/{collection}", requireAuth(pool, handleListCollection(pool)))
	mux.Handle("PUT /api/{collection}", requireAuth(pool, handleBulkReplace(pool)))

	return withCORS(mux)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
