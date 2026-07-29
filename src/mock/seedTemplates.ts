import type { ObraTemplate, TemplateAtividade, TemplateSubatividade } from '../types/domain';
import { ETAPAS_TECNICAS } from '../data/etapasTecnicasSubatividades';

const now = new Date().toISOString();

interface EtapaOutline {
  nome: string;
  subetapas: string[];
}

/** Gera a árvore de um template a partir de uma lista simples de etapas + subetapas: encadeia subetapas em sequência dentro da mesma etapa, e etapas em sequência entre si. Custos/materiais nascem zerados — o usuário ajusta depois pela tabela ou pelo modal de subatividade. */
function buildTemplateAtividades(outline: EtapaOutline[], diasPorSubetapa = 3): TemplateAtividade[] {
  let cursorOffset = 0;
  let prevAtividadeTempId: string | undefined;

  return outline.map((etapa, ei) => {
    const atividadeTempId = `a${ei}`;
    let localOffset = cursorOffset;
    let prevSubTempId: string | undefined;

    const subatividades: TemplateSubatividade[] = etapa.subetapas.map((nomeSub, si) => {
      const subTempId = `${atividadeTempId}-s${si}`;
      const sub: TemplateSubatividade = {
        tempId: subTempId,
        nome: nomeSub,
        dependeDeTempId: prevSubTempId,
        offsetDiasInicio: localOffset,
        duracaoDias: diasPorSubetapa,
        custoMaoDeObra: 0,
        custoMaterial: 0,
        custoAluguel: 0,
        materiaisNecessarios: [],
        maoDeObraNecessaria: [],
        equipamentosAluguel: [],
      };
      localOffset += diasPorSubetapa;
      prevSubTempId = subTempId;
      return sub;
    });

    cursorOffset = localOffset;

    const atividade: TemplateAtividade = {
      tempId: atividadeTempId,
      nome: etapa.nome,
      etapa: etapa.nome,
      dependeDeTempId: prevAtividadeTempId,
      subatividades,
    };
    prevAtividadeTempId = atividadeTempId;
    return atividade;
  });
}

const ETAPAS_TECNICAS_OUTLINE: EtapaOutline[] = ETAPAS_TECNICAS.map((e) => ({ nome: e.nome, subetapas: e.subatividades }));

export const seedTemplates: ObraTemplate[] = [
  {
    id: 'template-casa-padrao',
    tipo: 'casa',
    nome: 'Casa — Cronograma completo (12 etapas técnicas)',
    orcamentoBase: 500000,
    atividades: buildTemplateAtividades(ETAPAS_TECNICAS_OUTLINE, 7),
    createdAt: now,
  },
  {
    id: 'template-galpao-padrao',
    tipo: 'galpao',
    nome: 'Galpão — Cronograma completo (12 etapas técnicas)',
    orcamentoBase: 900000,
    atividades: buildTemplateAtividades(ETAPAS_TECNICAS_OUTLINE, 7),
    createdAt: now,
  },
];
