import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import type { Atividade } from '../../types/domain';
import { useAtividades } from '../../hooks/useAtividades';
import { ETAPAS_PADRAO, ordenarPorSequenciaPadrao } from '../../utils/etapasPadrao';
import { generateId } from '../../utils/id';
import { atividadeRepository } from '../../data/repositories/atividadeRepository';
import './UsarEtapasPadraoModal.css';

interface UsarEtapasPadraoModalProps {
  open: boolean;
  obraId: string;
  obraDataInicio: string;
  atividades: Atividade[];
  onClose: () => void;
  onApplied: () => void;
}

export function UsarEtapasPadraoModal({ open, obraId, obraDataInicio, atividades, onClose, onApplied }: UsarEtapasPadraoModalProps) {
  const { createAtividade, mergeAtividade, reorderAtividades } = useAtividades(obraId);

  const nomesPadrao = useMemo(() => new Set(ETAPAS_PADRAO.map((e) => e.nome.trim().toLowerCase())), []);
  const existentes = useMemo(() => new Set(atividades.map((a) => a.nome.trim().toLowerCase())), [atividades]);
  const faltantes = useMemo(() => ETAPAS_PADRAO.filter((e) => !existentes.has(e.nome.trim().toLowerCase())), [existentes]);
  // atividades já lançadas cujo nome não bate com nenhuma etapa padrão — candidatas a mesclar
  const atividadesForaDoPadrao = useMemo(() => atividades.filter((a) => !nomesPadrao.has(a.nome.trim().toLowerCase())), [atividades, nomesPadrao]);

  const [selecionadas, setSelecionadas] = useState<Set<string>>(() => new Set(faltantes.map((e) => e.nome)));
  const [mesclagens, setMesclagens] = useState<Record<string, string>>({});
  const [aplicando, setAplicando] = useState(false);

  // reabrir com estado fresco toda vez (Modal não desmonta ao fechar)
  useEffect(() => {
    if (open) {
      setSelecionadas(new Set(faltantes.map((e) => e.nome)));
      setMesclagens({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggleEtapa(nome: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome); else next.add(nome);
      return next;
    });
  }

  // opções de destino pra mesclagem: etapas padrão já existentes na obra + as marcadas pra criar agora
  const opcoesDestino = ETAPAS_PADRAO.filter((e) => existentes.has(e.nome.trim().toLowerCase()) || selecionadas.has(e.nome));

  async function aplicar() {
    setAplicando(true);
    try {
      let ultimaId = atividades.length > 0 ? atividades[atividades.length - 1].id : undefined;
      const now = new Date().toISOString();
      const idPorNome = new Map(atividades.map((a) => [a.nome.trim().toLowerCase(), a.id]));

      for (const etapa of faltantes) {
        if (!selecionadas.has(etapa.nome)) continue;
        const nova: Atividade = {
          id: generateId(),
          obraId,
          nome: etapa.nome,
          etapa: etapa.nome,
          dependeDe: ultimaId ? [ultimaId] : [],
          dataInicio: obraDataInicio,
          dataFim: obraDataInicio,
          duracaoSemanas: 1,
          status: 'pendente',
          concluida: false,
          custoMaoDeObra: 0,
          custoMaterial: 0,
          custoAluguel: 0,
          materiaisNecessarios: [],
          maoDeObraNecessaria: [],
          equipamentosAluguel: [],
          subatividades: [],
          createdAt: now,
          updatedAt: now,
        };
        await createAtividade(nova);
        idPorNome.set(etapa.nome.trim().toLowerCase(), nova.id);
        ultimaId = nova.id;
      }

      for (const [sourceId, destNome] of Object.entries(mesclagens)) {
        if (!destNome) continue;
        const destId = idPorNome.get(destNome.trim().toLowerCase());
        if (!destId || destId === sourceId) continue;
        await mergeAtividade(sourceId, destId);
      }

      const atualizadas = atividadeRepository.list().filter((a) => a.obraId === obraId);
      const ordenadas = ordenarPorSequenciaPadrao(atualizadas);
      await reorderAtividades(ordenadas.map((a) => a.id));

      onApplied();
    } finally {
      setAplicando(false);
    }
  }

  const nadaPraFazer = faltantes.length === 0 && atividadesForaDoPadrao.length === 0;

  return (
    <Modal
      open={open}
      title="Usar etapas pré-cadastradas"
      onClose={onClose}
      width={720}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={aplicar} disabled={aplicando || nadaPraFazer}>
            {aplicando ? 'Aplicando...' : 'Aplicar'}
          </button>
        </>
      }
    >
      {nadaPraFazer ? (
        <p className="form-field__hint">Todas as etapas padrão já estão cadastradas nessa obra — nada pra fazer aqui.</p>
      ) : (
        <div className="form-grid">
          {faltantes.length > 0 && (
            <div className="form-field form-field--full">
              <label>Etapas padrão a criar ({selecionadas.size} de {faltantes.length})</label>
              <p className="form-field__hint">Entram como atividades vazias (0 dias de custo), em sequência — depois é só editar datas, custos e adicionar subatividades.</p>
              <div className="usar-etapas-padrao__lista">
                {faltantes.map((etapa) => (
                  <label key={etapa.nome} className="usar-etapas-padrao__item">
                    <input type="checkbox" checked={selecionadas.has(etapa.nome)} onChange={() => toggleEtapa(etapa.nome)} />
                    {etapa.nome}
                  </label>
                ))}
              </div>
            </div>
          )}

          {atividadesForaDoPadrao.length > 0 && (
            <div className="form-field form-field--full">
              <label>Atividades já lançadas — mesclar com uma etapa padrão?</label>
              <p className="form-field__hint">
                Se alguma dessas já é, na prática, uma das etapas padrão (ex: "Estruturas" → "Supraestrutura"), escolha o destino: todas as subatividades, insumos e predecessoras dela são movidos pra lá, e ela é removida. Deixe em "Manter separada" pra não mexer.
              </p>
              <div className="usar-etapas-padrao__mescla-lista">
                {atividadesForaDoPadrao.map((a) => (
                  <div key={a.id} className="usar-etapas-padrao__mescla-row">
                    <span className="usar-etapas-padrao__mescla-nome">
                      {a.nome}
                      {a.subatividades.length > 0 && <span className="usar-etapas-padrao__mescla-sub"> ({a.subatividades.length} subatividade{a.subatividades.length > 1 ? 's' : ''})</span>}
                    </span>
                    <select
                      value={mesclagens[a.id] ?? ''}
                      onChange={(e) => setMesclagens((prev) => ({ ...prev, [a.id]: e.target.value }))}
                    >
                      <option value="">Manter separada</option>
                      {opcoesDestino.map((e) => <option key={e.nome} value={e.nome}>Mesclar com "{e.nome}"</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
