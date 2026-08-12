import { useEffect, useState } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { Modal } from '../common/Modal';
import type { ItemOrcamentoAnalitico, SinapiDesoneracao } from '../../types/domain';
import { buscarComposicoesSinapi, type SinapiComposicaoResumo } from '../../data/apiSync';
import { criarItemOrcamentoAnalitico } from '../../utils/orcamentoAnalitico';
import type { QuantitativoExtraido } from '../../utils/quantitativos/types';
import { formatBRL, formatNumberBR, parseNumberBR } from '../../utils/currency';
import './ImportarQuantitativosPanel.css';

interface LinhaConfirmacao {
  extraido: QuantitativoExtraido;
  quantidadeInput: string;
  candidatos: SinapiComposicaoResumo[];
  codigoSelecionado: number | null; // null = pular
  carregando: boolean;
}

interface ImportarQuantitativosPanelProps {
  obraId: string;
  itensExtraidos: QuantitativoExtraido[];
  filtro: { uf: string; mes: string; desoneracao: SinapiDesoneracao };
  onImportar: (itens: ItemOrcamentoAnalitico[]) => void;
  onFechar: () => void;
}

/** Painel de confirmação pra importação em lote de quantitativos (planilha/memorial) — nunca lança
 * nada sem o usuário revisar/escolher a composição de cada linha, mesmo espírito do painel de
 * extração de nota fiscal (NotaFiscalExtracaoPanel). */
export function ImportarQuantitativosPanel({ obraId, itensExtraidos, filtro, onImportar, onFechar }: ImportarQuantitativosPanelProps) {
  const [linhas, setLinhas] = useState<LinhaConfirmacao[]>(() =>
    itensExtraidos.map((extraido) => ({
      extraido,
      quantidadeInput: formatNumberBR(extraido.quantidade),
      candidatos: [],
      codigoSelecionado: null,
      carregando: true,
    })),
  );

  useEffect(() => {
    let cancelado = false;
    Promise.all(
      itensExtraidos.map((extraido) =>
        buscarComposicoesSinapi(extraido.descricao, filtro, 5).catch(() => [] as SinapiComposicaoResumo[]),
      ),
    ).then((resultados) => {
      if (cancelado) return;
      setLinhas((atual) =>
        atual.map((linha, i) => {
          const candidatos = resultados[i] ?? [];
          const melhor = candidatos.find((c) => c.custo != null);
          return { ...linha, candidatos, codigoSelecionado: melhor?.codigo ?? null, carregando: false };
        }),
      );
    });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleQuantidadeChange(i: number, raw: string) {
    setLinhas((atual) => atual.map((l, idx) => (idx === i ? { ...l, quantidadeInput: raw } : l)));
  }

  function handleSelecaoChange(i: number, raw: string) {
    const codigo = raw === '' ? null : Number(raw);
    setLinhas((atual) => atual.map((l, idx) => (idx === i ? { ...l, codigoSelecionado: codigo } : l)));
  }

  const linhasValidas = linhas.filter((l) => {
    if (l.carregando || l.codigoSelecionado == null) return false;
    const composicao = l.candidatos.find((c) => c.codigo === l.codigoSelecionado);
    const quantidade = parseNumberBR(l.quantidadeInput);
    return composicao != null && composicao.custo != null && quantidade > 0;
  });

  function handleImportar() {
    const itens = linhasValidas.map((l) => {
      const composicao = l.candidatos.find((c) => c.codigo === l.codigoSelecionado)!;
      const quantidade = parseNumberBR(l.quantidadeInput);
      return criarItemOrcamentoAnalitico(obraId, composicao, quantidade, filtro);
    });
    onImportar(itens);
  }

  return (
    <Modal
      open
      title={`Importar quantitativos — ${itensExtraidos.length} linha(s) encontrada(s)`}
      onClose={onFechar}
      width={860}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={handleImportar} disabled={linhasValidas.length === 0}>
            Importar {linhasValidas.length} item(ns)
          </button>
        </>
      }
    >
      {itensExtraidos.length === 0 ? (
        <p className="importar-quantitativos__vazio">
          <IconAlertTriangle size={16} /> Não encontrei nenhuma linha reconhecível nesse arquivo. Confira se o formato é "descrição — quantidade — unidade" (planilha) ou "descrição: quantidade unidade" (memorial) e tente de novo.
        </p>
      ) : (
        <div className="scroll-x">
          <table className="orcamento-etapas-table">
            <thead>
              <tr>
                <th>Detectado</th>
                <th>Quantidade</th>
                <th>Composição SINAPI</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha, i) => {
                const composicaoSelecionada = linha.candidatos.find((c) => c.codigo === linha.codigoSelecionado);
                const semCusto = composicaoSelecionada != null && composicaoSelecionada.custo == null;
                return (
                  <tr key={i}>
                    <td>{linha.extraido.descricao}</td>
                    <td className="importar-quantitativos__qtd">
                      <input
                        type="text" inputMode="decimal"
                        value={linha.quantidadeInput}
                        onChange={(e) => handleQuantidadeChange(i, e.target.value)}
                      />
                      <span className="importar-quantitativos__unidade">{linha.extraido.unidade}</span>
                    </td>
                    <td>
                      {linha.carregando ? (
                        'Buscando...'
                      ) : (
                        <>
                          <select value={linha.codigoSelecionado ?? ''} onChange={(e) => handleSelecaoChange(i, e.target.value)}>
                            <option value="">— pular esta linha —</option>
                            {linha.candidatos.map((c) => (
                              <option key={c.codigo} value={c.codigo}>
                                {c.descricao} {c.custo != null ? `(${formatBRL(c.custo)})` : '(sem custo)'}
                              </option>
                            ))}
                          </select>
                          {linha.candidatos.length === 0 && (
                            <p className="importar-quantitativos__hint">Nenhuma composição encontrada pra essa descrição — pesquise manualmente depois.</p>
                          )}
                          {semCusto && (
                            <p className="importar-quantitativos__hint importar-quantitativos__hint--erro">
                              Sem custo em {filtro.uf}/{filtro.mes} — escolha outra composição ou pule esta linha.
                            </p>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
