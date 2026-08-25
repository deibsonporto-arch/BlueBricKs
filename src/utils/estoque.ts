import type { EntradaEstoque, SaidaEstoque } from '../types/domain';

export interface SaldoMaterial {
  codigo: string;
  material: string;
  marca?: string;
  unidade: string;
  totalEntrado: number;
  totalSaido: number;
  saldo: number;
  custoUnitario?: number; // preço da entrada mais recente com custo informado — usado só como referência
  valorEstoque: number; // saldo × custoUnitario (0 se não houver custo conhecido)
}

/** Saldo por material = soma de todas as entradas menos soma de todas as saídas daquele código —
 * nunca guardado, sempre recalculado, pra nunca dessincronizar do histórico de lançamentos. O custo
 * unitário usado pro valor em estoque é o da entrada mais recente que informou um custo. */
export function calcularSaldos(entradas: EntradaEstoque[], saidas: SaidaEstoque[]): Map<string, SaldoMaterial> {
  const saldos = new Map<string, SaldoMaterial>();
  const entradasOrdenadas = [...entradas].sort((a, b) => a.data.localeCompare(b.data));

  for (const e of entradasOrdenadas) {
    const atual = saldos.get(e.codigo);
    if (atual) {
      atual.totalEntrado += e.quantidade;
      atual.saldo += e.quantidade;
      if (e.custoUnitario != null) atual.custoUnitario = e.custoUnitario;
    } else {
      saldos.set(e.codigo, {
        codigo: e.codigo,
        material: e.material,
        marca: e.marca,
        unidade: e.unidade,
        totalEntrado: e.quantidade,
        totalSaido: 0,
        saldo: e.quantidade,
        custoUnitario: e.custoUnitario,
        valorEstoque: 0,
      });
    }
  }

  for (const s of saidas) {
    const atual = saldos.get(s.codigo);
    if (atual) {
      atual.totalSaido += s.quantidade;
      atual.saldo -= s.quantidade;
    }
  }

  for (const saldo of saldos.values()) {
    saldo.valorEstoque = saldo.saldo * (saldo.custoUnitario ?? 0);
  }

  return saldos;
}

/** Próximo código sequencial (MAT-0001, MAT-0002, ...) — olha só as entradas já lançadas nessa obra. */
export function proximoCodigoMaterial(entradas: EntradaEstoque[]): string {
  const numeros = entradas
    .map((e) => Number(e.codigo.replace(/\D/g, '')))
    .filter((n) => !Number.isNaN(n));
  const proximo = (numeros.length > 0 ? Math.max(...numeros) : 0) + 1;
  return `MAT-${String(proximo).padStart(4, '0')}`;
}

const PALETA_ETAPA = ['#6b7686', '#47608a', '#2f6fb0', '#1f5fb8', '#164a8f', '#0e3563', '#3a7d8c', '#5a5f8a'];

/** Cor determinística por nome de etapa — mesma etapa sempre com a mesma cor, sem precisar de uma
 * tabela de mapeamento fixa (os nomes das etapas variam por obra). */
export function corDaEtapa(nome: string | undefined): string {
  if (!nome) return '#8a97a8';
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
  return PALETA_ETAPA[hash % PALETA_ETAPA.length];
}
