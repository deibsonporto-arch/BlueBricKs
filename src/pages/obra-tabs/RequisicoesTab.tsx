import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconChevronDown, IconChevronRight, IconPackageImport, IconTrash } from '@tabler/icons-react';
import { useAtividades } from '../../hooks/useAtividades';
import { useRequisicoes } from '../../hooks/useRequisicoes';
import { useEstoque } from '../../hooks/useEstoque';
import { EmptyState } from '../../components/common/EmptyState';
import { EntradaEstoqueFormModal, type EntradaEstoquePrefill } from '../../components/almoxarifado/EntradaEstoqueFormModal';
import { formatBRL, formatNumberBR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';
import type { ItemRequisicao } from '../../types/domain';
import './RequisicoesTab.css';

interface GrupoEtapa {
  atividadeId: string;
  atividadeNome: string;
  subgrupos: { subatividadeId: string; subatividadeNome: string; itens: ItemRequisicao[] }[];
}

function agruparPorEtapa(requisicoes: ItemRequisicao[]): GrupoEtapa[] {
  const porAtividade = new Map<string, ItemRequisicao[]>();
  for (const r of requisicoes) {
    const lista = porAtividade.get(r.atividadeId) ?? [];
    lista.push(r);
    porAtividade.set(r.atividadeId, lista);
  }
  return [...porAtividade.entries()].map(([atividadeId, itensDaAtividade]) => {
    const porSub = new Map<string, ItemRequisicao[]>();
    for (const r of itensDaAtividade) {
      const lista = porSub.get(r.subatividadeId) ?? [];
      lista.push(r);
      porSub.set(r.subatividadeId, lista);
    }
    return {
      atividadeId,
      atividadeNome: itensDaAtividade[0].atividadeNome,
      subgrupos: [...porSub.entries()].map(([subatividadeId, itensDaSub]) => ({
        subatividadeId,
        subatividadeNome: itensDaSub[0].subatividadeNome,
        itens: itensDaSub,
      })),
    };
  });
}

export function RequisicoesTab() {
  const { id } = useParams<{ id: string }>();
  const obraId = id!;
  const { atividades } = useAtividades(obraId);
  const { requisicoes, updateRequisicao, deleteRequisicao } = useRequisicoes(obraId);
  const { entradas, createEntrada } = useEstoque(obraId);
  const [recolhidas, setRecolhidas] = useState<Set<string>>(new Set());
  const [entradaPrefill, setEntradaPrefill] = useState<EntradaEstoquePrefill | null>(null);

  const grupos = useMemo(() => agruparPorEtapa(requisicoes), [requisicoes]);
  const requisicoesComEntrada = useMemo(() => new Set(entradas.map((e) => e.requisicaoId).filter(Boolean) as string[]), [entradas]);

  function toggleRecolhida(subatividadeId: string) {
    setRecolhidas((prev) => {
      const next = new Set(prev);
      if (next.has(subatividadeId)) next.delete(subatividadeId); else next.add(subatividadeId);
      return next;
    });
  }

  async function handleExcluirGrupo(itens: ItemRequisicao[]) {
    if (!confirm('Remover essa requisição? Isso só apaga daqui de Requisições — a subatividade e os insumos dela na Visão Geral continuam intactos. Pode reenviar depois se precisar.')) return;
    for (const i of itens) await deleteRequisicao(i.id);
  }

  if (requisicoes.length === 0) {
    return (
      <EmptyState
        title="Nenhuma requisição ainda"
        description={'Vá em Visão Geral, abra uma subatividade com insumos decompostos de uma composição SINAPI e clique em "Enviar tudo para Requisições".'}
      />
    );
  }

  return (
    <div className="requisicoes-tab">
      <h2>Requisições</h2>
      <p className="requisicoes-tab__hint">Materiais e aluguéis pra requisitar/comprar, agrupados por etapa e subetapa — a mão de obra aparece junto só como referência de contexto.</p>

      {grupos.map((grupo) => (
        <div key={grupo.atividadeId} className="requisicoes-etapa-card">
          <h3>{grupo.atividadeNome}</h3>
          {grupo.subgrupos.map((sub) => {
            const maoDeObra = sub.itens.filter((i) => i.tipo === 'mao_de_obra');
            const materiaisEAlugueis = sub.itens.filter((i) => i.tipo !== 'mao_de_obra');
            const totalRequisitar = materiaisEAlugueis.reduce((s, i) => s + i.quantidade * i.custoUnitario, 0);
            const recolhida = recolhidas.has(sub.subatividadeId);
            return (
              <div key={sub.subatividadeId} className="requisicoes-subetapa">
                <div className="requisicoes-subetapa__header">
                  <button
                    type="button"
                    className="requisicoes-subetapa__toggle"
                    onClick={() => toggleRecolhida(sub.subatividadeId)}
                    aria-label={recolhida ? 'Expandir' : 'Recolher'}
                  >
                    {recolhida ? <IconChevronRight size={14} /> : <IconChevronDown size={14} />}
                  </button>
                  <h4>{sub.subatividadeNome}</h4>
                  <span className="requisicoes-subetapa__total">{formatBRL(totalRequisitar)} a requisitar</span>
                  <button
                    type="button"
                    className="btn btn-ghost requisicoes-subetapa__excluir"
                    onClick={() => handleExcluirGrupo(sub.itens)}
                    aria-label="Remover essa requisição"
                    title="Remover essa requisição (só daqui — não afeta a subatividade)"
                  >
                    <IconTrash size={14} />
                  </button>
                </div>

                {!recolhida && maoDeObra.length > 0 && (
                  <div className="requisicoes-grupo">
                    <span className="requisicoes-grupo__label">Mão de obra (referência)</span>
                    <ul className="requisicoes-mao-de-obra-lista">
                      {maoDeObra.map((i) => (
                        <li key={i.id}>{i.descricao} · {formatNumberBR(i.quantidade)} {i.unidade}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!recolhida && materiaisEAlugueis.length > 0 && (
                  <div className="requisicoes-grupo">
                    <span className="requisicoes-grupo__label">Materiais e aluguéis</span>
                    <div className="scroll-x">
                      <table className="requisicoes-table">
                        <thead>
                          <tr>
                            <th></th>
                            <th>Tipo</th>
                            <th>Descrição</th>
                            <th>Un.</th>
                            <th>Qtd.</th>
                            <th>Custo unit.</th>
                            <th>Total</th>
                            <th>Enviado em</th>
                            <th>Recebimento</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {materiaisEAlugueis.map((i) => {
                            const jaDeuEntrada = requisicoesComEntrada.has(i.id);
                            return (
                            <tr key={i.id} className={i.status === 'requisitado' ? 'is-requisitado' : undefined}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={i.status === 'requisitado'}
                                  onChange={() => updateRequisicao(i.id, { status: i.status === 'requisitado' ? 'pendente' : 'requisitado', updatedAt: new Date().toISOString() })}
                                  title="Marcar como requisitado"
                                />
                              </td>
                              <td>{i.tipo === 'aluguel' ? 'Aluguel' : 'Material'}</td>
                              <td>{i.descricao}</td>
                              <td>{i.unidade}</td>
                              <td>{formatNumberBR(i.quantidade)}</td>
                              <td>{formatBRL(i.custoUnitario)}</td>
                              <td>{formatBRL(i.quantidade * i.custoUnitario)}</td>
                              <td>{formatDate(i.createdAt.slice(0, 10))}</td>
                              <td>
                                {jaDeuEntrada ? (
                                  <span className="requisicoes-entrada-badge">✓ Deu entrada</span>
                                ) : i.tipo === 'material' ? (
                                  <button
                                    type="button"
                                    className="btn btn-secondary requisicoes-entrada-btn"
                                    onClick={() => setEntradaPrefill({
                                      material: i.descricao,
                                      unidade: i.unidade,
                                      quantidade: Math.round(i.quantidade * 100) / 100,
                                      custoUnitario: i.custoUnitario || undefined,
                                      atividadeId: grupo.atividadeId,
                                      subatividadeId: sub.subatividadeId,
                                      requisicaoId: i.id,
                                    })}
                                  >
                                    <IconPackageImport size={14} /> Dar entrada
                                  </button>
                                ) : null}
                              </td>
                              <td>
                                <button type="button" className="btn btn-ghost" onClick={() => deleteRequisicao(i.id)} aria-label="Remover da requisição">
                                  <IconTrash size={14} />
                                </button>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <EntradaEstoqueFormModal
        open={entradaPrefill !== null}
        obraId={obraId}
        entradas={entradas}
        atividades={atividades}
        prefill={entradaPrefill ?? undefined}
        onClose={() => setEntradaPrefill(null)}
        onCreate={(entrada) => { createEntrada(entrada); setEntradaPrefill(null); }}
      />
    </div>
  );
}
