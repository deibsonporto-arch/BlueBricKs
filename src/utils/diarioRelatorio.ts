import type { DiarioEntry } from '../types/domain';
import { endDateFromDuration } from './dateUtils';

/** Data final de uma quinzena (15 dias corridos, inclusive) a partir de uma data de início. */
export function quinzenaFim(inicio: string): string {
  return endDateFromDuration(inicio, 15);
}

export function entriesNoPeriodo(entries: DiarioEntry[], inicio: string, fim: string): DiarioEntry[] {
  return entries
    .filter((e) => e.data >= inicio && e.data <= fim)
    .sort((a, b) => (a.data < b.data ? -1 : 1));
}

/** Custo com diárias de mão de obra de um único dia (mestre + pedreiros/serventes/carpinteiros legados + colaboradores extra + lista livre de mão de obra). Empreitados ficam de fora — não têm valor de diária, o custo deles é tratado à parte. */
export function custoMaoDeObraDoDia(e: DiarioEntry): number {
  const temMestre = e.mestreDeObra.trim() ? 1 : 0;
  return (
    temMestre * (e.valorDiariaMestre ?? 0) +
    e.pedreiros * (e.valorDiariaPedreiro ?? 0) +
    e.serventes * (e.valorDiariaServente ?? 0) +
    e.carpinteiros * (e.valorDiariaCarpinteiro ?? 0) +
    (e.colaboradoresExtra ?? []).reduce((s, c) => s + c.quantidade * c.valorDiaria, 0) +
    (e.maoDeObra ?? []).reduce((s, m) => s + m.valorDiaria, 0)
  );
}

export interface DiarioResumoPeriodo {
  totalDias: number;
  totalMestre: number;
  totalPedreiros: number;
  totalServentes: number;
  totalCarpinteiros: number;
  totalMaoDeObra: number;
  totalEmpreitados: number;
  totalColaboradoresDia: number;
  custoMestre: number;
  custoPedreiros: number;
  custoServentes: number;
  custoCarpinteiros: number;
  custoMaoDeObraLivre: number;
  custoTotalMaoDeObra: number;
  totalMarmitas: number;
  custoTotalMarmitas: number;
}

export function resumirPeriodo(entries: DiarioEntry[]): DiarioResumoPeriodo {
  const resumo: DiarioResumoPeriodo = {
    totalDias: entries.length,
    totalMestre: 0,
    totalPedreiros: 0,
    totalServentes: 0,
    totalCarpinteiros: 0,
    totalMaoDeObra: 0,
    totalEmpreitados: 0,
    totalColaboradoresDia: 0,
    custoMestre: 0,
    custoPedreiros: 0,
    custoServentes: 0,
    custoCarpinteiros: 0,
    custoMaoDeObraLivre: 0,
    custoTotalMaoDeObra: 0,
    totalMarmitas: 0,
    custoTotalMarmitas: 0,
  };

  let custoColaboradoresExtra = 0;

  for (const e of entries) {
    const temMestre = e.mestreDeObra.trim() ? 1 : 0;
    const empreitadosQtd = e.empreitados.reduce((s, emp) => s + emp.quantidade, 0);
    const colaboradoresExtraQtd = (e.colaboradoresExtra ?? []).reduce((s, c) => s + c.quantidade, 0);
    const maoDeObraQtd = (e.maoDeObra ?? []).length;

    resumo.totalMestre += temMestre;
    resumo.totalPedreiros += e.pedreiros;
    resumo.totalServentes += e.serventes;
    resumo.totalCarpinteiros += e.carpinteiros;
    resumo.totalMaoDeObra += maoDeObraQtd;
    resumo.totalEmpreitados += empreitadosQtd;
    // Empreitados não entram no total de colaboradores-dia (que é só quem tem diária) — ficam numa linha separada.
    resumo.totalColaboradoresDia += temMestre + e.pedreiros + e.serventes + e.carpinteiros + colaboradoresExtraQtd + maoDeObraQtd;

    resumo.custoMestre += temMestre * (e.valorDiariaMestre ?? 0);
    resumo.custoPedreiros += e.pedreiros * (e.valorDiariaPedreiro ?? 0);
    resumo.custoServentes += e.serventes * (e.valorDiariaServente ?? 0);
    resumo.custoCarpinteiros += e.carpinteiros * (e.valorDiariaCarpinteiro ?? 0);
    custoColaboradoresExtra += (e.colaboradoresExtra ?? []).reduce((s, c) => s + c.quantidade * c.valorDiaria, 0);
    resumo.custoMaoDeObraLivre += (e.maoDeObra ?? []).reduce((s, m) => s + m.valorDiaria, 0);

    resumo.totalMarmitas += e.marmitasQuantidade ?? 0;
    resumo.custoTotalMarmitas += (e.marmitasQuantidade ?? 0) * (e.marmitasValorUnitario ?? 0);
  }

  resumo.custoTotalMaoDeObra =
    resumo.custoMestre + resumo.custoPedreiros + resumo.custoServentes + resumo.custoCarpinteiros + custoColaboradoresExtra + resumo.custoMaoDeObraLivre;

  return resumo;
}

export interface DiarioTrabalhadorResumo {
  nome: string;
  funcao: string;
  valorDiariaMedia: number;
  qtdDiarias: number;
  total: number;
}

/** Agrupa por colaborador nomeado (mestre de obra + lista livre de mão de obra) — pedreiros/serventes/carpinteiros legados e colaboradores extra não têm nome, então ficam de fora daqui. */
export function resumirPorTrabalhador(entries: DiarioEntry[]): DiarioTrabalhadorResumo[] {
  const grupos = new Map<string, { nome: string; funcao: string; total: number; qtdDiarias: number }>();

  function registrar(nome: string, funcao: string, valorDiaria: number) {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) return;
    const chave = `${nomeLimpo.toLowerCase()}||${funcao.toLowerCase()}`;
    const atual = grupos.get(chave) ?? { nome: nomeLimpo, funcao, total: 0, qtdDiarias: 0 };
    atual.total += valorDiaria;
    atual.qtdDiarias += 1;
    grupos.set(chave, atual);
  }

  for (const e of entries) {
    if (e.mestreDeObra.trim()) registrar(e.mestreDeObra, 'Mestre de Obras', e.valorDiariaMestre ?? 0);
    for (const m of e.maoDeObra ?? []) registrar(m.nome, m.funcao || 'Colaborador', m.valorDiaria);
  }

  return Array.from(grupos.values())
    .map((g) => ({ nome: g.nome, funcao: g.funcao, valorDiariaMedia: g.qtdDiarias > 0 ? g.total / g.qtdDiarias : 0, qtdDiarias: g.qtdDiarias, total: g.total }))
    .sort((a, b) => a.funcao.localeCompare(b.funcao) || a.nome.localeCompare(b.nome));
}
