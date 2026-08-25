/** Nó genérico o suficiente pra representar Atividade, Subatividade ou o 3º nível (neto) no grafo de dependências. */
export interface NivelamentoInput {
  id: string;
  dependeDe: string[];
}

/**
 * Nivelamento por caminho mais longo (estilo critical-path): nível 0 = sem predecessora visível
 * (pode começar já — "Fase 0 (livre)"), nível N = 1 + maior nível entre as predecessoras. Calcula só
 * sobre os nós passados em `nodes` — predecessoras fora desse conjunto (ex: nível escondido pelos
 * checkboxes de visibilidade) são ignoradas, então o nó fica como se não tivesse aquela dependência.
 */
export function computeNiveis(nodes: NivelamentoInput[]): Map<string, number> {
  const ids = new Set(nodes.map((n) => n.id));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const niveis = new Map<string, number>();
  const emCalculo = new Set<string>();

  function nivelDe(id: string): number {
    const memo = niveis.get(id);
    if (memo !== undefined) return memo;
    if (emCalculo.has(id)) return 0; // ciclo (não deveria acontecer, mas evita loop infinito)
    emCalculo.add(id);
    const node = byId.get(id);
    const preds = (node?.dependeDe ?? []).filter((p) => ids.has(p) && p !== id);
    const nivel = preds.length === 0 ? 0 : 1 + Math.max(...preds.map(nivelDe));
    emCalculo.delete(id);
    niveis.set(id, nivel);
    return nivel;
  }

  nodes.forEach((n) => nivelDe(n.id));
  return niveis;
}

const PALETA_CORES = [
  '#4c6ef5', '#2f9e44', '#e8590c', '#ae3ec9', '#1098ad',
  '#f08c00', '#e64980', '#495057', '#0ca678', '#5c7cfa',
  '#d9480f', '#7048e8', '#37b24d', '#c92a2a', '#1971c2',
  '#f76707', '#9c36b5',
];

/** Cor estável por índice de etapa (Atividade) — mesmo índice sempre volta a mesma cor. */
export function corDaEtapa(indiceAtividade: number): string {
  return PALETA_CORES[indiceAtividade % PALETA_CORES.length];
}
