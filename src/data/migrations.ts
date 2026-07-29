import { atividadeRepository } from './repositories/atividadeRepository';

/**
 * Migra Subatividade.dependeDe do formato antigo (string única) para o novo (string[], até 2 predecessoras).
 * Roda a cada carregamento — é barata e não faz nada quando os dados já estão no formato novo.
 */
export function migrateSubatividadeDependeDe(): void {
  const all = atividadeRepository.list();
  for (const atividade of all) {
    let changed = false;
    const novasSubatividades = atividade.subatividades.map((s) => {
      const raw = s.dependeDe as unknown;
      if (Array.isArray(raw)) return s;
      changed = true;
      return { ...s, dependeDe: raw ? [raw as string] : [] };
    });
    if (changed) {
      atividadeRepository.update(atividade.id, { subatividades: novasSubatividades });
    }
  }
}
