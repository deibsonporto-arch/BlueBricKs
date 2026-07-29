package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	ctx := context.Background()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL não definido")
	}

	pool, err := connectWithRetry(ctx, dbURL)
	if err != nil {
		log.Fatalf("erro ao conectar no postgres: %v", err)
	}
	defer pool.Close()

	if err := migrate(ctx, pool); err != nil {
		log.Fatalf("erro ao migrar schema: %v", err)
	}

	if err := seedAdminUsuario(ctx, pool); err != nil {
		log.Fatalf("erro ao semear usuário admin: %v", err)
	}

	srv := newServer(pool)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("BlueBRICKs backend ouvindo na porta %s", port)
	if err := http.ListenAndServe(":"+port, srv); err != nil {
		log.Fatal(err)
	}
}

// Postgres pode ainda estar subindo quando o backend inicia (docker-compose não
// garante prontidão real, só ordem de start), então tenta reconectar por um tempo.
func connectWithRetry(ctx context.Context, dbURL string) (*pgxpool.Pool, error) {
	var pool *pgxpool.Pool
	var err error
	for i := 0; i < 20; i++ {
		pool, err = pgxpool.New(ctx, dbURL)
		if err == nil {
			pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
			err = pool.Ping(pingCtx)
			cancel()
			if err == nil {
				return pool, nil
			}
		}
		log.Printf("postgres ainda não disponível (tentativa %d/20): %v", i+1, err)
		time.Sleep(2 * time.Second)
	}
	return nil, err
}
