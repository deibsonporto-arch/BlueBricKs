import type { Atividade, Cotacao } from '../types/domain';
import { melhorFornecedor } from '../hooks/useCotacoes';
import { parseISODate } from './dateUtils';

export type TipoItemSemana = 'aluguel' | 'compra' | 'mobilizacao' | 'servico_contratado';

export interface ItemSemana {
  key: string;
  tipo: TipoItemSemana;
  label: string;
  atividadeNome: string;
  dia: string; // ISO date
}

export interface RangeSemana {
  monday: Date;
  friday: Date;
}

export function getNextWeekRange(): RangeSemana {
  const today = new Date();
  const dow = (today.getDay() + 6) % 7; // 0 = segunda
  const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow);
  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(thisMonday.getDate() + 7);
  const nextFriday = new Date(nextMonday);
  nextFriday.setDate(nextMonday.getDate() + 4);
  return { monday: nextMonday, friday: nextFriday };
}

function clampDiaISO(atividade: Atividade, range: RangeSemana): string {
  const start = parseISODate(atividade.dataInicio);
  const clamped = start < range.monday ? range.monday : start > range.friday ? range.friday : start;
  return clamped.toISOString().slice(0, 10);
}

function overlaps(atividade: Atividade, range: RangeSemana): boolean {
  const start = parseISODate(atividade.dataInicio);
  const end = parseISODate(atividade.dataFim);
  return start <= range.friday && end >= range.monday;
}

export function buildItensSemana(atividades: Atividade[], cotacoes: Cotacao[], range: RangeSemana): ItemSemana[] {
  const itens: ItemSemana[] = [];
  const atividadesDaSemana = atividades.filter((a) => overlaps(a, range));

  for (const a of atividadesDaSemana) {
    const dia = clampDiaISO(a, range);

    for (const m of a.materiaisNecessarios) {
      itens.push({
        key: `${a.id}:mat:${m.id}`,
        tipo: 'compra',
        label: `${m.nome} (${m.quantidade} ${m.unidade})`,
        atividadeNome: a.nome,
        dia,
      });
    }
    for (const e of a.equipamentosAluguel) {
      itens.push({
        key: `${a.id}:eq:${e.id}`,
        tipo: 'aluguel',
        label: `${e.nome} (${e.dias}d)`,
        atividadeNome: a.nome,
        dia,
      });
    }
    for (const mo of a.maoDeObraNecessaria) {
      itens.push({
        key: `${a.id}:mo:${mo.id}`,
        tipo: 'mobilizacao',
        label: `${mo.tipo} (${mo.quantidadePessoas} pessoa${mo.quantidadePessoas === 1 ? '' : 's'})`,
        atividadeNome: a.nome,
        dia,
      });
    }
    for (const s of a.subatividades) {
      for (const i of s.insumos ?? []) {
        itens.push({
          key: `${a.id}:ins:${i.id}`,
          tipo: i.tipo === 'mao_de_obra' ? 'mobilizacao' : i.tipo === 'aluguel' ? 'aluguel' : 'compra',
          label: `${i.descricao} (${i.quantidade} ${i.unidade})`,
          atividadeNome: a.nome,
          dia,
        });
      }
    }
  }

  const idsAtividadesDaSemana = new Set(atividadesDaSemana.map((a) => a.id));
  for (const c of cotacoes) {
    if (c.status !== 'aprovado' || !c.atividadeId || !idsAtividadesDaSemana.has(c.atividadeId)) continue;
    const atividade = atividadesDaSemana.find((a) => a.id === c.atividadeId);
    if (!atividade) continue;
    const melhor = melhorFornecedor(c);
    itens.push({
      key: `cot:${c.id}`,
      tipo: 'servico_contratado',
      label: melhor ? `${c.itemServico} — ${melhor.nome}` : c.itemServico,
      atividadeNome: atividade.nome,
      dia: clampDiaISO(atividade, range),
    });
  }

  return itens;
}
