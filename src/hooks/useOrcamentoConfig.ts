import { useState } from 'react';
import type { EtapaOrcamentoConfig, OrcamentoModelo } from '../types/domain';
import { generateId } from '../utils/id';
import { pushCollection } from '../data/apiSync';

const KEY = 'brics:orcamento_modelos';
const LEGACY_KEY = 'brics:orcamento_config'; // formato antigo: um único config global, sem nome

const ETAPAS_DEFAULT: Omit<EtapaOrcamentoConfig, 'id'>[] = [
  { nome: 'Preparação do Terreno', percentualPadrao: 3, percentualMin: 2, percentualMax: 5, ordem: 1 },
  { nome: 'Fundações', percentualPadrao: 10, percentualMin: 7, percentualMax: 13, ordem: 2 },
  { nome: 'Estrutura', percentualPadrao: 16, percentualMin: 12, percentualMax: 22, ordem: 3 },
  { nome: 'Alvenaria e Vedação', percentualPadrao: 10, percentualMin: 7, percentualMax: 13, ordem: 4 },
  { nome: 'Cobertura', percentualPadrao: 8, percentualMin: 5, percentualMax: 11, ordem: 5 },
  { nome: 'Instalações Hidrossanitárias', percentualPadrao: 5, percentualMin: 4, percentualMax: 9, ordem: 6 },
  { nome: 'Instalações Elétricas', percentualPadrao: 7, percentualMin: 4, percentualMax: 9, ordem: 7 },
  { nome: 'Revestimentos e Regularizações', percentualPadrao: 9, percentualMin: 6, percentualMax: 13, ordem: 8 },
  { nome: 'Pisos e Revestimentos', percentualPadrao: 13, percentualMin: 9, percentualMax: 17, ordem: 9 },
  { nome: 'Pintura', percentualPadrao: 6, percentualMin: 4, percentualMax: 9, ordem: 10 },
  { nome: 'Esquadrias e Acabamentos Finais', percentualPadrao: 11, percentualMin: 7, percentualMax: 16, ordem: 11 },
  { nome: 'Entrega da Obra', percentualPadrao: 2, percentualMin: 1, percentualMax: 4, ordem: 12 },
];

function modeloPadrao(): OrcamentoModelo {
  return {
    id: generateId(),
    nome: 'Construção nova (padrão)',
    etapas: ETAPAS_DEFAULT.map((e) => ({ ...e, id: generateId() })),
    materialPercentual: 45.5,
    maoDeObraPercentual: 54.5,
  };
}

function readModelos(): OrcamentoModelo[] {
  const raw = localStorage.getItem(KEY);
  if (raw) return JSON.parse(raw) as OrcamentoModelo[];

  // migra o config antigo (singleton global) pro formato novo de modelos nomeados, preservando os ids
  // das etapas (que as atividades já existentes referenciam via etapaOrcamentoConfigId)
  const legacyRaw = localStorage.getItem(LEGACY_KEY);
  if (legacyRaw) {
    const legacy = JSON.parse(legacyRaw) as { etapas: EtapaOrcamentoConfig[]; materialPercentual: number; maoDeObraPercentual: number };
    const migrado: OrcamentoModelo[] = [{
      id: generateId(),
      nome: 'Construção nova (padrão)',
      etapas: legacy.etapas,
      materialPercentual: legacy.materialPercentual,
      maoDeObraPercentual: legacy.maoDeObraPercentual,
    }];
    localStorage.setItem(KEY, JSON.stringify(migrado));
    return migrado;
  }

  const seeded = [modeloPadrao()];
  localStorage.setItem(KEY, JSON.stringify(seeded));
  return seeded;
}

function writeModelos(modelos: OrcamentoModelo[]) {
  localStorage.setItem(KEY, JSON.stringify(modelos));
  pushCollection('orcamento_modelos', modelos);
}

export function useOrcamentoConfig() {
  const [modelos, setModelos] = useState<OrcamentoModelo[]>(() => readModelos());

  function persist(next: OrcamentoModelo[]) {
    writeModelos(next);
    setModelos(next);
  }

  function createModelo(nome: string): OrcamentoModelo {
    const novo: OrcamentoModelo = { id: generateId(), nome, etapas: [], materialPercentual: 45.5, maoDeObraPercentual: 54.5 };
    persist([...modelos, novo]);
    return novo;
  }

  function duplicarModelo(id: string): OrcamentoModelo | undefined {
    const original = modelos.find((m) => m.id === id);
    if (!original) return undefined;
    const copia: OrcamentoModelo = {
      ...original,
      id: generateId(),
      nome: `${original.nome} (cópia)`,
      etapas: original.etapas.map((e) => ({ ...e, id: generateId() })),
    };
    persist([...modelos, copia]);
    return copia;
  }

  function renomearModelo(id: string, nome: string) {
    persist(modelos.map((m) => (m.id === id ? { ...m, nome } : m)));
  }

  function removerModelo(id: string) {
    if (modelos.length <= 1) return; // sempre precisa sobrar pelo menos um modelo
    persist(modelos.filter((m) => m.id !== id));
  }

  function updateEtapa(modeloId: string, etapaId: string, patch: Partial<EtapaOrcamentoConfig>) {
    persist(modelos.map((m) => (m.id === modeloId ? { ...m, etapas: m.etapas.map((e) => (e.id === etapaId ? { ...e, ...patch } : e)) } : m)));
  }

  function addEtapa(modeloId: string) {
    persist(modelos.map((m) => {
      if (m.id !== modeloId) return m;
      const novaOrdem = m.etapas.length > 0 ? Math.max(...m.etapas.map((e) => e.ordem)) + 1 : 1;
      const nova: EtapaOrcamentoConfig = { id: generateId(), nome: 'Nova etapa', percentualPadrao: 0, percentualMin: 0, percentualMax: 0, ordem: novaOrdem };
      return { ...m, etapas: [...m.etapas, nova] };
    }));
  }

  function removeEtapa(modeloId: string, etapaId: string) {
    persist(modelos.map((m) => (m.id === modeloId ? { ...m, etapas: m.etapas.filter((e) => e.id !== etapaId) } : m)));
  }

  function reorderEtapas(modeloId: string, idsNaNovaOrdem: string[]) {
    const ordemMap = new Map(idsNaNovaOrdem.map((id, i) => [id, i + 1]));
    persist(modelos.map((m) => (m.id === modeloId ? { ...m, etapas: m.etapas.map((e) => ({ ...e, ordem: ordemMap.get(e.id) ?? e.ordem })) } : m)));
  }

  function updateSplit(modeloId: string, materialPercentual: number, maoDeObraPercentual: number) {
    persist(modelos.map((m) => (m.id === modeloId ? { ...m, materialPercentual, maoDeObraPercentual } : m)));
  }

  return {
    modelos,
    createModelo,
    duplicarModelo,
    renomearModelo,
    removerModelo,
    updateEtapa,
    addEtapa,
    removeEtapa,
    reorderEtapas,
    updateSplit,
  };
}
