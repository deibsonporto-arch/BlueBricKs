import { useCallback, useEffect, useState } from 'react';
import type { Atividade, ObraTemplate, Subatividade, TemplateAtividade, TemplateSubatividade, TipoObra } from '../types/domain';
import { templateRepository } from '../data/repositories/templateRepository';
import { addDays, businessDaysBetween, diffDays, durationDays, endDateFromDuration, endDateFromDurationUteis } from '../utils/dateUtils';
import { generateId } from '../utils/id';
import { recomputeParentAggregates } from '../utils/subatividades';

function buildTemplateAtividadesFromAtividades(atividades: Atividade[], dataInicioObra: string): TemplateAtividade[] {
  const atividadeTempIds = new Map(atividades.map((a, i) => [a.id, `a${i}`]));
  const subatividadeTempIds = new Map<string, string>();
  const netoTempIds = new Map<string, string>();
  atividades.forEach((a, ai) => {
    a.subatividades.forEach((s, si) => {
      subatividadeTempIds.set(s.id, `a${ai}-s${si}`);
      (s.subatividades ?? []).forEach((n, ni) => netoTempIds.set(n.id, `a${ai}-s${si}-n${ni}`));
    });
  });

  const resolveTempId = (realId: string | undefined): string | undefined =>
    realId ? atividadeTempIds.get(realId) ?? subatividadeTempIds.get(realId) ?? netoTempIds.get(realId) : undefined;

  const buildTemplateSubatividade = (s: Subatividade, tempId: string): TemplateSubatividade => ({
    tempId,
    nome: s.nome,
    dependeDeTempId: resolveTempId(s.dependeDe[0]),
    offsetDiasInicio: Math.max(0, diffDays(dataInicioObra, s.dataInicio)),
    duracaoDias: s.contagemDias === 'uteis' ? businessDaysBetween(s.dataInicio, s.dataFim) : durationDays(s.dataInicio, s.dataFim),
    diasEsperaAposPredecessora: s.diasEsperaAposPredecessora ?? 0,
    dataAutomatica: s.dataAutomatica ?? true,
    contagemDias: s.contagemDias ?? 'uteis',
    custoMaoDeObra: s.custoMaoDeObra,
    custoMaterial: s.custoMaterial,
    custoAluguel: s.custoAluguel,
    materiaisNecessarios: s.materiaisNecessarios,
    maoDeObraNecessaria: s.maoDeObraNecessaria,
    equipamentosAluguel: s.equipamentosAluguel,
    subatividades: s.subatividades?.length
      ? s.subatividades.map((n) => buildTemplateSubatividade(n, netoTempIds.get(n.id)!))
      : undefined,
  });

  return atividades.map((a) => ({
    tempId: atividadeTempIds.get(a.id)!,
    nome: a.nome,
    etapa: a.etapa,
    dependeDeTempId: resolveTempId(a.dependeDe[0]),
    subatividades: a.subatividades.map((s) => buildTemplateSubatividade(s, subatividadeTempIds.get(s.id)!)),
  }));
}

export function useTemplates() {
  const [templates, setTemplates] = useState<ObraTemplate[]>([]);

  const refresh = useCallback(() => setTemplates(templateRepository.list()), []);
  useEffect(() => refresh(), [refresh]);

  const getTemplateByTipo = useCallback(
    (tipo: TipoObra) => templates.find((t) => t.tipo === tipo),
    [templates],
  );

  const saveTemplateFromObra = useCallback(
    async (nome: string, tipo: TipoObra, orcamentoBase: number, dataInicioObra: string, atividades: Atividade[]) => {
      const template: ObraTemplate = {
        id: generateId(),
        tipo,
        nome,
        orcamentoBase,
        atividades: buildTemplateAtividadesFromAtividades(atividades, dataInicioObra),
        createdAt: new Date().toISOString(),
      };
      templateRepository.create(template);
      refresh();
      return template;
    },
    [refresh],
  );

  const updateTemplateFromObra = useCallback(
    async (templateId: string, nome: string, tipo: TipoObra, orcamentoBase: number, dataInicioObra: string, atividades: Atividade[]) => {
      templateRepository.update(templateId, {
        nome,
        tipo,
        orcamentoBase,
        atividades: buildTemplateAtividadesFromAtividades(atividades, dataInicioObra),
      });
      refresh();
    },
    [refresh],
  );

  const applyTemplateToNewObra = useCallback(
    (template: ObraTemplate, obraId: string, dataInicioObra: string): Atividade[] => {
      const now = new Date().toISOString();

      const atividadeIdMap = new Map(template.atividades.map((ta) => [ta.tempId, generateId()]));
      const subatividadeIdMap = new Map<string, string>();
      const netoIdMap = new Map<string, string>();
      template.atividades.forEach((ta) => {
        ta.subatividades.forEach((ts) => {
          subatividadeIdMap.set(ts.tempId, generateId());
          (ts.subatividades ?? []).forEach((tn) => netoIdMap.set(tn.tempId, generateId()));
        });
      });

      const resolveRealId = (tempId: string | undefined): string | undefined =>
        tempId ? atividadeIdMap.get(tempId) ?? subatividadeIdMap.get(tempId) ?? netoIdMap.get(tempId) : undefined;

      const buildSubatividade = (ts: TemplateSubatividade, id: string, ordem: number): Subatividade => {
        const contagemDias = ts.contagemDias ?? 'uteis';
        const dataInicio = addDays(dataInicioObra, ts.offsetDiasInicio);
        const dataFim = contagemDias === 'uteis' ? endDateFromDurationUteis(dataInicio, ts.duracaoDias) : endDateFromDuration(dataInicio, ts.duracaoDias);
        const netos = ts.subatividades?.map((tn, i) => buildSubatividade(tn, netoIdMap.get(tn.tempId)!, i));

        const base: Subatividade = {
          id,
          nome: ts.nome,
          concluida: false,
          status: 'pendente',
          iniciada: false,
          dataInicio,
          dataFim,
          dependeDe: (() => {
            const r = resolveRealId(ts.dependeDeTempId);
            return r ? [r] : [];
          })(),
          diasEsperaAposPredecessora: ts.diasEsperaAposPredecessora ?? 0,
          dataAutomatica: ts.dataAutomatica ?? true,
          contagemDias,
          ordem,
          custoMaoDeObra: ts.custoMaoDeObra,
          custoMaterial: ts.custoMaterial,
          custoAluguel: ts.custoAluguel,
          materiaisNecessarios: ts.materiaisNecessarios,
          maoDeObraNecessaria: ts.maoDeObraNecessaria,
          equipamentosAluguel: ts.equipamentosAluguel,
        };
        return netos?.length ? { ...base, subatividades: netos, ...recomputeParentAggregates({ ...base, subatividades: netos }) } : base;
      };

      return template.atividades.map((ta) => {
        const subatividades: Subatividade[] = ta.subatividades.map((ts, i) => buildSubatividade(ts, subatividadeIdMap.get(ts.tempId)!, i));

        const atividadeBase: Atividade = {
          id: atividadeIdMap.get(ta.tempId)!,
          obraId,
          nome: ta.nome,
          etapa: ta.etapa,
          dependeDe: (() => {
            const r = resolveRealId(ta.dependeDeTempId);
            return r ? [r] : [];
          })(),
          dataInicio: dataInicioObra,
          dataFim: dataInicioObra,
          status: 'pendente',
          concluida: false,
          custoMaoDeObra: 0,
          custoMaterial: 0,
          custoAluguel: 0,
          materiaisNecessarios: [],
          maoDeObraNecessaria: [],
          equipamentosAluguel: [],
          subatividades,
          createdAt: now,
          updatedAt: now,
        };

        return { ...atividadeBase, ...recomputeParentAggregates(atividadeBase) };
      });
    },
    [],
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      templateRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  return { templates, getTemplateByTipo, saveTemplateFromObra, updateTemplateFromObra, deleteTemplate, applyTemplateToNewObra, refresh };
}
