package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Endpoints somente-leitura sobre a base de referência SINAPI (importada mensalmente
// por scripts/import-sinapi.mjs — ver backend/db.go:migrateSinapi). Ficam fora do
// padrão /api/{collection}: são consultados sob demanda (busca, filtro por UF/mês),
// não sincronizados por inteiro pro localStorage.

func normalizeDesoneracao(v string) string {
	if v == "CD" {
		return "CD"
	}
	return "SD" // default: "não desonerado", igual ao combinado com o usuário
}

func latestMesReferencia(ctx context.Context, pool *pgxpool.Pool) (string, error) {
	var mes *string
	err := pool.QueryRow(ctx, `SELECT MAX(mes_referencia) FROM sinapi_composicoes`).Scan(&mes)
	if err != nil || mes == nil {
		return "", err
	}
	return *mes, nil
}

func handleSinapiMeses(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := pool.Query(r.Context(), `SELECT DISTINCT mes_referencia FROM sinapi_composicoes ORDER BY mes_referencia DESC`)
		if err != nil {
			internalError(w, "listar meses sinapi", err)
			return
		}
		defer rows.Close()

		meses := make([]string, 0)
		for rows.Next() {
			var mes string
			if err := rows.Scan(&mes); err != nil {
				internalError(w, "listar meses sinapi", err)
				return
			}
			meses = append(meses, mes)
		}
		writeJSON(w, http.StatusOK, meses)
	}
}

func handleSinapiGrupos(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		mes := r.URL.Query().Get("mes")
		if mes == "" {
			resolved, err := latestMesReferencia(ctx, pool)
			if err != nil {
				internalError(w, "resolver mes sinapi", err)
				return
			}
			mes = resolved
		}

		rows, err := pool.Query(ctx, `
			SELECT DISTINCT grupo FROM sinapi_composicoes
			WHERE mes_referencia = $1 AND grupo IS NOT NULL AND grupo <> ''
			ORDER BY grupo ASC`, mes)
		if err != nil {
			internalError(w, "listar grupos sinapi", err)
			return
		}
		defer rows.Close()

		grupos := make([]string, 0)
		for rows.Next() {
			var grupo string
			if err := rows.Scan(&grupo); err != nil {
				internalError(w, "listar grupos sinapi", err)
				return
			}
			grupos = append(grupos, grupo)
		}
		writeJSON(w, http.StatusOK, grupos)
	}
}

type composicaoResumo struct {
	Codigo    int      `json:"codigo"`
	Grupo     *string  `json:"grupo"`
	Descricao string   `json:"descricao"`
	Unidade   string   `json:"unidade"`
	Custo     *float64 `json:"custo"`
}

func handleSinapiComposicoesBusca(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		q := r.URL.Query().Get("q")
		grupo := r.URL.Query().Get("grupo")
		uf := r.URL.Query().Get("uf")
		desoneracao := normalizeDesoneracao(r.URL.Query().Get("desoneracao"))
		mes := r.URL.Query().Get("mes")
		limit := 30
		if raw := r.URL.Query().Get("limit"); raw != "" {
			if n, err := strconv.Atoi(raw); err == nil && n > 0 && n <= 200 {
				limit = n
			}
		}

		if mes == "" {
			resolved, err := latestMesReferencia(ctx, pool)
			if err != nil {
				internalError(w, "resolver mes sinapi", err)
				return
			}
			mes = resolved
		}

		var rows pgx.Rows
		var err error
		if q != "" {
			rows, err = pool.Query(ctx, `
				SELECT codigo, grupo, descricao, unidade, (custos->$1->>'custo')::numeric
				FROM sinapi_composicoes
				WHERE mes_referencia = $2 AND desoneracao = $3
					AND ($6 = '' OR grupo = $6)
					AND to_tsvector('portuguese', descricao) @@ plainto_tsquery('portuguese', $4)
				ORDER BY ts_rank(to_tsvector('portuguese', descricao), plainto_tsquery('portuguese', $4)) DESC
				LIMIT $5`, uf, mes, desoneracao, q, limit, grupo)
		} else {
			rows, err = pool.Query(ctx, `
				SELECT codigo, grupo, descricao, unidade, (custos->$1->>'custo')::numeric
				FROM sinapi_composicoes
				WHERE mes_referencia = $2 AND desoneracao = $3
					AND ($5 = '' OR grupo = $5)
				ORDER BY descricao ASC
				LIMIT $4`, uf, mes, desoneracao, limit, grupo)
		}
		if err != nil {
			internalError(w, "buscar composicoes sinapi", err)
			return
		}
		defer rows.Close()

		resultado := make([]composicaoResumo, 0)
		for rows.Next() {
			var c composicaoResumo
			if err := rows.Scan(&c.Codigo, &c.Grupo, &c.Descricao, &c.Unidade, &c.Custo); err != nil {
				internalError(w, "buscar composicoes sinapi", err)
				return
			}
			resultado = append(resultado, c)
		}
		writeJSON(w, http.StatusOK, resultado)
	}
}

type insumoResumo struct {
	Codigo        int      `json:"codigo"`
	Classificacao *string  `json:"classificacao"`
	Descricao     string   `json:"descricao"`
	Unidade       string   `json:"unidade"`
	Preco         *float64 `json:"preco"`
}

func handleSinapiInsumosBusca(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		q := r.URL.Query().Get("q")
		uf := r.URL.Query().Get("uf")
		desoneracao := normalizeDesoneracao(r.URL.Query().Get("desoneracao"))
		mes := r.URL.Query().Get("mes")
		limit := 30
		if raw := r.URL.Query().Get("limit"); raw != "" {
			if n, err := strconv.Atoi(raw); err == nil && n > 0 && n <= 200 {
				limit = n
			}
		}

		if mes == "" {
			resolved, err := latestMesReferencia(ctx, pool)
			if err != nil {
				internalError(w, "resolver mes sinapi", err)
				return
			}
			mes = resolved
		}

		rows, err := pool.Query(ctx, `
			SELECT codigo, classificacao, descricao, unidade, (precos->$1)::numeric
			FROM sinapi_insumos
			WHERE mes_referencia = $2 AND desoneracao = $3
				AND ($4 = '' OR descricao ILIKE '%' || $4 || '%')
			ORDER BY descricao ASC
			LIMIT $5`, uf, mes, desoneracao, q, limit)
		if err != nil {
			internalError(w, "buscar insumos sinapi", err)
			return
		}
		defer rows.Close()

		resultado := make([]insumoResumo, 0)
		for rows.Next() {
			var it insumoResumo
			if err := rows.Scan(&it.Codigo, &it.Classificacao, &it.Descricao, &it.Unidade, &it.Preco); err != nil {
				internalError(w, "buscar insumos sinapi", err)
				return
			}
			resultado = append(resultado, it)
		}
		writeJSON(w, http.StatusOK, resultado)
	}
}

type materialExplodido struct {
	Codigo        int      `json:"codigo"`
	Descricao     string   `json:"descricao"`
	Unidade       string   `json:"unidade"`
	Classificacao *string  `json:"classificacao"`
	Coeficiente   float64  `json:"coeficiente"` // já multiplicado pela(s) quantidade(s) informada(s)
	PrecoUnitario *float64 `json:"precoUnitario"`
	CustoTotal    *float64 `json:"custoTotal"`
}

// explodeComposicoes recebe pares (código da composição, quantidade) e devolve a lista consolidada
// de insumos-folha (materiais, mão de obra, equipamentos), já com o coeficiente multiplicado pela
// quantidade e somado entre composições que compartilham o mesmo insumo. É o motor tanto da busca
// de itens de uma composição isolada quanto da lista de materiais consolidada do orçamento inteiro.
func explodeComposicoes(ctx context.Context, pool *pgxpool.Pool, codigos []int32, quantidades []float64, mes, uf, desoneracao string) ([]materialExplodido, error) {
	rows, err := pool.Query(ctx, `
		WITH RECURSIVE seed(composicao_codigo, quantidade) AS (
			SELECT * FROM unnest($1::int[], $2::numeric[])
		),
		explode AS (
			SELECT ci.item_codigo, ci.tipo_item, ci.descricao, ci.unidade, s.quantidade * ci.coeficiente AS fator
			FROM sinapi_composicao_itens ci
			JOIN seed s ON ci.composicao_codigo = s.composicao_codigo
			WHERE ci.mes_referencia = $3
			UNION ALL
			SELECT ci.item_codigo, ci.tipo_item, ci.descricao, ci.unidade, e.fator * ci.coeficiente
			FROM sinapi_composicao_itens ci
			JOIN explode e ON ci.composicao_codigo = e.item_codigo AND e.tipo_item = 'COMPOSICAO'
			WHERE ci.mes_referencia = $3
		)
		SELECT item_codigo, descricao, unidade, SUM(fator) AS coeficiente
		FROM explode
		WHERE tipo_item = 'INSUMO'
		GROUP BY item_codigo, descricao, unidade
		ORDER BY coeficiente DESC`, codigos, quantidades, mes)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	itens := make([]materialExplodido, 0)
	codigosInsumo := make([]int32, 0)
	for rows.Next() {
		var m materialExplodido
		var codigo int32
		if err := rows.Scan(&codigo, &m.Descricao, &m.Unidade, &m.Coeficiente); err != nil {
			return nil, err
		}
		m.Codigo = int(codigo)
		itens = append(itens, m)
		codigosInsumo = append(codigosInsumo, codigo)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(itens) == 0 {
		return itens, nil
	}

	precoRows, err := pool.Query(ctx, `
		SELECT codigo, classificacao, (precos->$1)::numeric
		FROM sinapi_insumos
		WHERE codigo = ANY($2) AND mes_referencia = $3 AND desoneracao = $4`, uf, codigosInsumo, mes, desoneracao)
	if err != nil {
		return nil, err
	}
	defer precoRows.Close()

	precos := make(map[int32]*float64, len(codigosInsumo))
	classificacoes := make(map[int32]*string, len(codigosInsumo))
	for precoRows.Next() {
		var codigo int32
		var classificacao *string
		var preco *float64
		if err := precoRows.Scan(&codigo, &classificacao, &preco); err != nil {
			return nil, err
		}
		precos[codigo] = preco
		classificacoes[codigo] = classificacao
	}
	if err := precoRows.Err(); err != nil {
		return nil, err
	}

	for i := range itens {
		codigo := int32(itens[i].Codigo)
		itens[i].Classificacao = classificacoes[codigo]
		if preco := precos[codigo]; preco != nil {
			itens[i].PrecoUnitario = preco
			custo := *preco * itens[i].Coeficiente
			itens[i].CustoTotal = &custo
		}
	}

	return itens, nil
}

func handleSinapiComposicaoItens(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		codigoStr := r.PathValue("codigo")
		codigo, err := strconv.Atoi(codigoStr)
		if err != nil {
			http.Error(w, "código inválido", http.StatusBadRequest)
			return
		}

		uf := r.URL.Query().Get("uf")
		desoneracao := normalizeDesoneracao(r.URL.Query().Get("desoneracao"))
		mes := r.URL.Query().Get("mes")
		quantidade := 1.0
		if raw := r.URL.Query().Get("quantidade"); raw != "" {
			if n, err := strconv.ParseFloat(raw, 64); err == nil && n > 0 {
				quantidade = n
			}
		}

		if mes == "" {
			resolved, err := latestMesReferencia(ctx, pool)
			if err != nil {
				internalError(w, "resolver mes sinapi", err)
				return
			}
			mes = resolved
		}

		itens, err := explodeComposicoes(ctx, pool, []int32{int32(codigo)}, []float64{quantidade}, mes, uf, desoneracao)
		if err != nil {
			internalError(w, "explodir composicao sinapi", err)
			return
		}
		writeJSON(w, http.StatusOK, itens)
	}
}

type linhaMateriaisRequest struct {
	ComposicaoCodigo int     `json:"composicaoCodigo"`
	Quantidade       float64 `json:"quantidade"`
}

type materiaisRequest struct {
	Mes         string                   `json:"mes"`
	UF          string                   `json:"uf"`
	Desoneracao string                   `json:"desoneracao"`
	Linhas      []linhaMateriaisRequest  `json:"linhas"`
}

func handleSinapiMateriaisConsolidados(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		var req materiaisRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "corpo inválido", http.StatusBadRequest)
			return
		}
		if len(req.Linhas) == 0 {
			writeJSON(w, http.StatusOK, []materialExplodido{})
			return
		}

		mes := req.Mes
		if mes == "" {
			resolved, err := latestMesReferencia(ctx, pool)
			if err != nil {
				internalError(w, "resolver mes sinapi", err)
				return
			}
			mes = resolved
		}
		desoneracao := normalizeDesoneracao(req.Desoneracao)

		codigos := make([]int32, len(req.Linhas))
		quantidades := make([]float64, len(req.Linhas))
		for i, l := range req.Linhas {
			codigos[i] = int32(l.ComposicaoCodigo)
			quantidades[i] = l.Quantidade
		}

		itens, err := explodeComposicoes(ctx, pool, codigos, quantidades, mes, req.UF, desoneracao)
		if err != nil {
			internalError(w, "consolidar materiais sinapi", err)
			return
		}
		writeJSON(w, http.StatusOK, itens)
	}
}
