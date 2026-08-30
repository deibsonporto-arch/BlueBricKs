import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconChevronDown, IconChevronRight, IconPackageImport, IconTrash } from '@tabler/icons-react';
import { useAtividades } from '../../hooks/useAtividades';
import { useRequisicoes } from '../../hooks/useRequisicoes';
import { useEstoque } from '../../hooks/useEstoque';
import { useObras } from '../../hooks/useObras';
import { EmptyState } from '../../components/common/EmptyState';
import { EntradaEstoqueFormModal, type EntradaEstoquePrefill } from '../../components/almoxarifado/EntradaEstoqueFormModal';
import { formatBRL, formatNumberBR } from '../../utils/currency';
import { diffDays, formatDate, todayISO } from '../../utils/dateUtils';
import { generateId } from '../../utils/id';
import type { ItemRequisicao } from '../../types/domain';
import './RequisicoesTab.css';

const ANTECEDENCIA_PADRAO = 7;

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

/** Classe de urgência a partir de quantos dias faltam pro início da tarefa dona do item — vermelho
 * (já era pra ter começado), laranja (começa em até 2 dias), amarelo (dentro da janela de
 * antecedência configurada) ou neutro (ainda folgado). */
function classeUrgencia(diasParaInicio: number | undefined, antecedenciaDias: number): string {
  if (diasParaInicio == null) return '';
  if (diasParaInicio < 0) return 'requisicoes-urgencia--atrasada';
  if (diasParaInicio <= 2) return 'requisicoes-urgencia--critica';
  if (diasParaInicio <= antecedenciaDias) return 'requisicoes-urgencia--proxima';
  return 'requisicoes-urgencia--tranquila';
}

function chaveAutoEnviadas(obraId: string): string {
  return `brics:reqAutoEnviadas:${obraId}`;
}
function carregarAutoEnviadas(obraId: string): Set<string> {
  try {
    const raw = localStorage.getItem(chaveAutoEnviadas(obraId));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}
function marcarAutoEnviada(obraId: string, subatividadeId: string) {
  const atuais = carregarAutoEnviadas(obraId);
  atuais.add(subatividadeId);
  localStorage.setItem(chaveAutoEnviadas(obraId), JSON.stringify([...atuais]));
}

export function RequisicoesTab() {
  const { id } = useParams<{ id: string }>();
  const obraId = id!;
  const { atividades } = useAtividades(obraId);
  const { obras, updateObra } = useObras();
  const obra = obras.find((o) => o.id === obraId);
  const { requisicoes, createRequisicoes, updateRequisicao, deleteRequisicao } = useRequisicoes(obraId);
  const { entradas, createEntrada } = useEstoque(obraId);
  const [recolhidas, setRecolhidas] = useState<Set<string>>(new Set());
  const [entradaPrefill, setEntradaPrefill] = useState<EntradaEstoquePrefill | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const antecedenciaDias = obra?.antecedenciaRequisicaoDias ?? ANTECEDENCIA_PADRAO;

  // data de início (e conclusão) de cada subatividade, pra calcular urgência e decidir quando
  // mandar sozinho pra Requisições — sem precisar duplicar essas datas no ItemRequisicao.
  const infoSubatividade = useMemo(() => {
    const mapa = new Map<string, { dataInicio: string; concluida: boolean; temInsumosMateriais: boolean }>();
    for (const a of atividades) {
      for (const s of a.subatividades) {
        const temInsumosMateriais = (s.insumos ?? []).some((i) => i.tipo !== 'mao_de_obra');
        mapa.set(s.id, { dataInicio: s.dataInicio, concluida: s.concluida, temInsumosMateriais });
      }
    }
    return mapa;
  }, [atividades]);

  // envia sozinho pra Requisições qualquer subatividade com insumos de material/aluguel que entrou
  // na janela de antecedência configurada (e ainda não foi enviada, manual ou automaticamente).
  useEffect(() => {
    const hoje = todayISO();
    const autoEnviadas = carregarAutoEnviadas(obraId);
    const jaTemRequisicao = new Set(requisicoes.map((r) => r.subatividadeId));

    for (const a of atividades) {
      for (const s of a.subatividades) {
        if (s.concluida) continue;
        const insumosMateriais = (s.insumos ?? []).filter((i) => i.tipo !== 'mao_de_obra');
        if (insumosMateriais.length === 0) continue;
        if (autoEnviadas.has(s.id) || jaTemRequisicao.has(s.id)) continue;

        const diasParaInicio = diffDays(hoje, s.dataInicio);
        if (diasParaInicio > antecedenciaDias) continue;

        const now = new Date().toISOString();
        createRequisicoes(
          insumosMateriais.map((i) => ({
            id: generateId(),
            obraId,
            atividadeId: a.id,
            atividadeNome: a.nome,
            subatividadeId: s.id,
            subatividadeNome: s.nome,
            descricao: i.descricao,
            unidade: i.unidade,
            quantidade: i.quantidade,
            custoUnitario: i.custoUnitario,
            tipo: i.tipo,
            status: 'pendente' as const,
            createdAt: now,
            updatedAt: now,
          })),
        );
        marcarAutoEnviada(obraId, s.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atividades, obraId, antecedenciaDias]);

  const grupos = useMemo(() => agruparPorEtapa(requisicoes), [requisicoes]);
  const requisicoesComEntrada = useMemo(() => new Set(entradas.map((e) => e.requisicaoId).filter(Boolean) as string[]), [entradas]);

  function diasParaInicioDe(r: ItemRequisicao): number | undefined {
    const info = infoSubatividade.get(r.subatividadeId);
    return info ? diffDays(todayISO(), info.dataInicio) : undefined;
  }

  // consolidado: mesmo material pedido em várias subatividades vira 1 grupo só, com o total pra
  // comprar de uma vez e a lista de quem precisa de quanto — ordenado pelo mais urgente primeiro.
  const consolidadoPorMaterial = useMemo(() => {
    const pendentes = requisicoes.filter((r) => r.tipo !== 'mao_de_obra' && r.status === 'pendente');
    const porDescricao = new Map<string, ItemRequisicao[]>();
    for (const r of pendentes) {
      const chave = `${r.descricao.trim().toLowerCase()}__${r.unidade.trim().toLowerCase()}`;
      const lista = porDescricao.get(chave) ?? [];
      lista.push(r);
      porDescricao.set(chave, lista);
    }
    return [...porDescricao.values()]
      .map((itens) => {
        const comDias = itens
          .map((r) => ({ item: r, dias: diasParaInicioDe(r) }))
          .sort((a, b) => (a.dias ?? Infinity) - (b.dias ?? Infinity));
        return {
          descricao: itens[0].descricao,
          unidade: itens[0].unidade,
          totalQuantidade: itens.reduce((s, r) => s + r.quantidade, 0),
          itens: comDias,
          diasMaisUrgente: comDias[0]?.dias,
        };
      })
      .sort((a, b) => (a.diasMaisUrgente ?? Infinity) - (b.diasMaisUrgente ?? Infinity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requisicoes, infoSubatividade]);

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function marcarSelecionadosComoRequisitado(ids: string[]) {
    for (const id of ids) await updateRequisicao(id, { status: 'requisitado', updatedAt: new Date().toISOString() });
    setSelecionados((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }

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

  return (
    <div className="requisicoes-tab">
      <div className="requisicoes-tab__header">
        <div>
          <h2>Requisições</h2>
          <p className="requisicoes-tab__hint">Materiais e aluguéis pra requisitar/comprar — a mão de obra aparece junto só como referência de contexto.</p>
        </div>
        <label className="requisicoes-antecedencia">
          Enviar sozinho pra Requisições com
          <input
            type="number"
            min={0}
            value={antecedenciaDias}
            onChange={(e) => updateObra(obraId, { antecedenciaRequisicaoDias: Math.max(0, Number(e.target.value) || 0) })}
          />
          dias de antecedência do início da tarefa
        </label>
      </div>

      {requisicoes.length === 0 ? (
        <EmptyState
          title="Nenhuma requisição ainda"
          description={`Assim que uma subatividade com insumos entrar na janela de ${antecedenciaDias} dias antes do início dela, os materiais/aluguéis vão sozinhos pra cá. Ou vá em Visão Geral e clique em "Enviar tudo para Requisições" numa subatividade específica.`}
        />
      ) : (
        <>
          {consolidadoPorMaterial.length > 0 && (
            <div className="requisicoes-consolidado">
              <h3>Consolidado por material — compre tudo de uma vez</h3>
              <p className="requisicoes-tab__hint">Mesmo material pedido em várias tarefas vira um total só. Marque quais partes você já vai comprar agora — pode ser tudo ou só uma parte.</p>
              {consolidadoPorMaterial.map((grupo) => {
                const idsDoGrupo = grupo.itens.map((x) => x.item.id);
                const algumSelecionado = idsDoGrupo.some((id) => selecionados.has(id));
                return (
                  <div key={`${grupo.descricao}__${grupo.unidade}`} className="requisicoes-material-card">
                    <div className="requisicoes-material-card__header">
                      <strong>{grupo.descricao}</strong>
                      <span className="requisicoes-material-card__total">Total: {formatNumberBR(grupo.totalQuantidade)} {grupo.unidade}</span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={!algumSelecionado}
                        onClick={() => marcarSelecionadosComoRequisitado(idsDoGrupo.filter((id) => selecionados.has(id)))}
                      >
                        Marcar selecionados como requisitado
                      </button>
                    </div>
                    <ul className="requisicoes-material-card__lista">
                      {grupo.itens.map(({ item, dias }) => (
                        <li key={item.id} className={classeUrgencia(dias, antecedenciaDias)}>
                          <input type="checkbox" checked={selecionados.has(item.id)} onChange={() => toggleSelecionado(item.id)} />
                          <span className="requisicoes-material-card__qtd">{formatNumberBR(item.quantidade)} {item.unidade}</span>
                          <span className="requisicoes-material-card__origem">{item.subatividadeNome} <small>({item.atividadeNome})</small></span>
                          <span className="requisicoes-material-card__data">
                            {dias == null
                              ? '—'
                              : dias < 0
                                ? `atrasada · início era ${formatDate(infoSubatividade.get(item.subatividadeId)!.dataInicio)}`
                                : dias === 0
                                  ? 'começa hoje'
                                  : `início em ${dias}d — ${formatDate(infoSubatividade.get(item.subatividadeId)!.dataInicio)}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}

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
                            <th>Início da tarefa</th>
                            <th>Recebimento</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {materiaisEAlugueis.map((i) => {
                            const jaDeuEntrada = requisicoesComEntrada.has(i.id);
                            const dias = diasParaInicioDe(i);
                            return (
                            <tr key={i.id} className={`${i.status === 'requisitado' ? 'is-requisitado' : ''} ${classeUrgencia(dias, antecedenciaDias)}`}>
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
                              <td>
                                {dias == null ? '—' : dias < 0 ? 'atrasada' : dias === 0 ? 'hoje' : `${dias}d`}
                                {infoSubatividade.get(i.subatividadeId) && <> · {formatDate(infoSubatividade.get(i.subatividadeId)!.dataInicio)}</>}
                              </td>
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
        </>
      )}

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
