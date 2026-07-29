import type { Fornecedor, Obra } from '../types/domain';

export function generateId(): string {
  return crypto.randomUUID();
}

export function generateObraCodigo(obras: Obra[]): string {
  const year = new Date().getFullYear();
  const prefix = `OB-${year}-`;
  const seqs = obras
    .map((o) => o.codigo)
    .filter((c) => c.startsWith(prefix))
    .map((c) => parseInt(c.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n));
  const next = (seqs.length ? Math.max(...seqs) : 0) + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

export function generateFornecedorCodigo(fornecedores: Fornecedor[]): string {
  const prefix = 'F';
  const seqs = fornecedores
    .map((f) => f.codigo)
    .filter((c) => c?.startsWith(prefix))
    .map((c) => parseInt(c.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n));
  const next = (seqs.length ? Math.max(...seqs) : 0) + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}
