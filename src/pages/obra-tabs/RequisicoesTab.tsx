import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconBan, IconChevronDown, IconChevronRight, IconPackageImport, IconRefresh, IconTrash } from '@tabler/icons-react';
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

/** Só material e aluguel viram requisição de compra — mão de obra é referência, e "parâmetro
 * calculado" (m² de alvenaria/reboco/porcelanato vindo das Medidas do ambiente) é só uma base pro
 * cálculo dos materiais reais, não algo que se compra em si. */
function ehRequisitavel(tipo: ItemRequisicao['tipo']): boolean {
  return tipo === 'material' || tipo === 'aluguel';
}

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

/** Compara os insumos atuais da subatividade com as linhas de requisição já pendentes dela (por
 * descrição — ainda não requisitadas nem com entrada dada) e devolve o que precisa mudar: linhas
 * pra atualizar (quantidade/custo/unidade/tipo mudou) e insumos novos que ainda não têm linha. Linhas
 * já marcadas "requisitado" nunca são tocadas — uma vez comprado, editar o insumo depois não desfaz. */
function sincronizarSubatividade(
  requisicoesDaSub: ItemRequisicao[],
  insumosMateriais: { descricao: string; unidade: string; quantidade: number; custoUnitario: number; tipo: ItemRequisicao['tipo'] }[],
) {
  // "ignorado" (ex: material incluso na empreitada) conta como "já existe" pra não voltar a ser
  // recriado sozinho — mas só os "pendente" são de fato atualizados quando o insumo muda.
  const existentes = requisicoesDaSub.filter((r) => ehRequisitavel(r.tipo));
  const usadas = new Set<string>();
  const atualizacoes: { id: string; patch: Partial<ItemRequisicao> }[] = [];
  const novos: typeof insumosMateriais = [];

  for (const insumo of insumosMateriais) {
    const match = existentes.find((r) => !usadas.has(r.id) && r.descricao.trim().toLowerCase() === insumo.descricao.trim().toLowerCase());
    if (!match) {
      novos.push(insumo);
      continue;
    }
    usadas.add(match.id);
    if (match.status !== 'pendente') continue;
    if (match.quantidade !== insumo.quantidade || match.custoUnitario !== insumo.custoUnitario || match.unidade !== insumo.unidade || match.tipo !== insumo.tipo) {
      atualizacoes.push({
        id: match.id,
        patch: { quantidade: insumo.quantidade, custoUnitario: insumo.custoUnitario, unidade: insumo.unidade, tipo: insumo.tipo, updatedAt: new Date().toISOString() },
      });
    }
  }
  return { atualizacoes, novos };
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
  // lista de itens dentro de cada grupo do "Consolidado por material" — some por padrão, só abre a
  // que o usuário clicar (o "descricao" do grupo é a chave, já que os grupos não têm id próprio)
  const [gruposAbertos, setGruposAbertos] = useState<Set<string>>(new Set());
  const [entradaPrefill, setEntradaPrefill] = useState<EntradaEstoquePrefill | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const antecedenciaDias = obra?.antecedenciaRequisicaoDias ?? ANTECEDENCIA_PADRAO;

  // data de início (e conclusão) de cada subatividade, pra calcular urgência e decidir quando
  // mandar sozinho pra Requisições — sem precisar duplicar essas datas no ItemRequisicao.
  const infoSubatividade = useMemo(() => {
    const mapa = new Map<string, { dataInicio: string; concluida: boolean; temInsumosMateriais: boolean }>();
    for (const a of atividades) {
      for (const s of a.subatividades) {
        const temInsumosMateriais = (s.insumos ?? []).some((i) => ehRequisitavel(i.tipo));
        mapa.set(s.id, { dataInicio: s.dataInicio, concluida: s.concluida, temInsumosMateriais });
      }
    }
    return mapa;
  }, [atividades]);

  // limpa requisições antigas que foram mandadas antes de existir o tipo "parâmetro calculado" —
  // ficaram marcadas como Material só por causa do nome "(calculado)" no final da descrição
  useEffect(() => {
    const antigas = requisicoes.filter((r) => r.tipo !== 'parametro_calculado' && r.descricao.trim().endsWith('(calculado)'));
    for (const r of antigas) deleteRequisicao(r.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requisicoes]);

  // envia sozinho pra Requisições qualquer subatividade com insumos de material/aluguel que entrou
  // na janela de antecedência configurada (e ainda não foi enviada, manual ou automaticamente).
  useEffect(() => {
    const hoje = todayISO();
    const autoEnviadas = carregarAutoEnviadas(obraId);
    const jaTemRequisicao = new Set(requisicoes.map((r) => r.subatividadeId));

    for (const a of atividades) {
      for (const s of a.subatividades) {
        if (s.concluida) continue;
        const insumosMateriais = (s.insumos ?? []).filter((i) => ehRequisitavel(i.tipo));
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

  // mantém as linhas já enviadas em dia com os insumos atuais da subatividade — editou a
  // quantidade/custo na Visão Geral, atualiza aqui também sozinho (linhas já "requisitado" não
  // são tocadas, pra não desfazer uma compra já feita).
  // sub-rotina compartilhada entre o efeito automático e o botão "Atualizar" manual — devolve
  // quantas linhas mexeu, pra dar pra mostrar um feedback visível de que rodou de verdade
  function sincronizarComVisaoGeral(): { atualizadas: number; criadas: number } {
    let atualizadas = 0;
    let criadas = 0;
    for (const a of atividades) {
      for (const s of a.subatividades) {
        if (s.concluida) continue; // já terminou — não precisa mais mandar/atualizar nada pra requisição
        const requisicoesDaSub = requisicoes.filter((r) => r.subatividadeId === s.id);
        if (requisicoesDaSub.length === 0) continue;
        const insumosMateriais = (s.insumos ?? []).filter((i) => ehRequisitavel(i.tipo));
        const { atualizacoes, novos } = sincronizarSubatividade(requisicoesDaSub, insumosMateriais);
        for (const u of atualizacoes) updateRequisicao(u.id, u.patch);
        atualizadas += atualizacoes.length;
        if (novos.length > 0) {
          const now = new Date().toISOString();
          createRequisicoes(
            novos.map((i) => ({
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
          criadas += novos.length;
        }
      }
    }
    return { atualizadas, criadas };
  }

  function handleAtualizarManual() {
    const { atualizadas, criadas } = sincronizarComVisaoGeral();
    if (atualizadas === 0 && criadas === 0) {
      alert('Já está tudo em dia — nenhuma linha precisou mudar. Se algo ainda parece errado, pode ser o preview do navegador desatualizado: recarregue a página.');
    } else {
      alert(`Atualizado: ${criadas} linha(s) nova(s), ${atualizadas} linha(s) com quantidade/custo mudado.`);
    }
  }

  useEffect(() => {
    sincronizarComVisaoGeral();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atividades]);

  const grupos = useMemo(() => agruparPorEtapa(requisicoes), [requisicoes]);
  const requisicoesComEntrada = useMemo(() => new Set(entradas.map((e) => e.requisicaoId).filter(Boolean) as string[]), [entradas]);

  function diasParaInicioDe(r: ItemRequisicao): number | undefined {
    const info = infoSubatividade.get(r.subatividadeId);
    return info ? diffDays(todayISO(), info.dataInicio) : undefined;
  }

  // consolidado: mesmo material pedido em várias subatividades vira 1 grupo só, com o total pra
  // comprar de uma vez e a lista de quem precisa de quanto — ordenado pelo mais urgente primeiro.
  const consolidadoPorMaterial = useMemo(() => {
    const pendentes = requisicoes.filter((r) => ehRequisitavel(r.tipo) && r.status === 'pendente');
    // agrupa só pela descrição — mesmo item lançado com unidade diferente em subatividades
    // diferentes (ex: uma porta como M2 e outra como UN) continua sendo "o mesmo item" pra comprar
    // junto; o total é somado por unidade separadamente, já que M2 e UN não podem virar 1 número só.
    const porDescricao = new Map<string, ItemRequisicao[]>();
    for (const r of pendentes) {
      const chave = r.descricao.trim().toLowerCase();
      const lista = porDescricao.get(chave) ?? [];
      lista.push(r);
      porDescricao.set(chave, lista);
    }
    return [...porDescricao.values()]
      .map((itens) => {
        const comDias = itens
          .map((r) => ({ item: r, dias: diasParaInicioDe(r) }))
          .sort((a, b) => (a.dias ?? Infinity) - (b.dias ?? Infinity));
        const totaisPorUnidade = new Map<string, number>();
        for (const r of itens) totaisPorUnidade.set(r.unidade, (totaisPorUnidade.get(r.unidade) ?? 0) + r.quantidade);
        return {
          descricao: itens[0].descricao,
          totaisPorUnidade: [...totaisPorUnidade.entries()],
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

  async function ignorarGrupo(ids: string[]) {
    if (!confirm(`Tirar essa lista inteira (${ids.length} ${ids.length === 1 ? 'item' : 'itens'}) da requisição? Não volta a aparecer sozinha depois.`)) return;
    for (const id of ids) await updateRequisicao(id, { status: 'ignorado', updatedAt: new Date().toISOString() });
    setSelecionados((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }

  function toggleGrupoAberto(descricao: string) {
    setGruposAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(descricao)) next.delete(descricao); else next.add(descricao);
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
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleAtualizarManual}
          title="Força puxar de novo os insumos atuais de todas as subatividades (não mexe no que já foi marcado requisitado/ignorado)"
        >
          <IconRefresh size={14} /> Atualizar
        </button>
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
                const aberto = gruposAbertos.has(grupo.descricao);
                return (
                  <div key={grupo.descricao} className="requisicoes-material-card">
                    <div className="requisicoes-material-card__header">
                      <button
                        type="button"
                        className="requisicoes-subetapa__toggle"
                        onClick={() => toggleGrupoAberto(grupo.descricao)}
                        aria-label={aberto ? 'Recolher' : 'Expandir'}
                      >
                        {aberto ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                      </button>
                      <strong>{grupo.descricao}</strong>
                      <span className="requisicoes-material-card__total">
                        Total: {grupo.totaisPorUnidade.map(([un, qtd]) => `${formatNumberBR(qtd)} ${un}`).join(' + ')} · {grupo.itens.length} {grupo.itens.length === 1 ? 'item' : 'itens'}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={!algumSelecionado}
                        onClick={() => marcarSelecionadosComoRequisitado(idsDoGrupo.filter((id) => selecionados.has(id)))}
                      >
                        Marcar selecionados como requisitado
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => ignorarGrupo(idsDoGrupo)}
                        title="Tirar TODA essa lista da requisição (ex: material já incluso na empreitada) — não volta a aparecer sozinho"
                      >
                        <IconBan size={14} /> Ignorar tudo
                      </button>
                    </div>
                    {aberto && (
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
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => updateRequisicao(item.id, { status: 'ignorado', updatedAt: new Date().toISOString() })}
                            aria-label="Tirar da requisição"
                            title="Tirar da requisição (ex: material já incluso na empreitada) — não volta a aparecer sozinho"
                          >
                            <IconBan size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                    )}
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
            const materiaisEAlugueis = sub.itens.filter((i) => ehRequisitavel(i.tipo));
            const totalRequisitar = materiaisEAlugueis.filter((i) => i.status !== 'ignorado').reduce((s, i) => s + i.quantidade * i.custoUnitario, 0);
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
                    className="btn btn-ghost"
                    onClick={sincronizarComVisaoGeral}
                    aria-label="Atualizar com a Visão Geral"
                    title="Puxar de novo quantidade/custo/insumos atuais da subatividade (não mexe no que já foi marcado requisitado)"
                  >
                    <IconRefresh size={14} />
                  </button>
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
                            <tr key={i.id} className={`${i.status === 'requisitado' ? 'is-requisitado' : ''} ${i.status === 'ignorado' ? 'is-ignorado' : ''} ${classeUrgencia(dias, antecedenciaDias)}`}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={i.status === 'requisitado'}
                                  disabled={i.status === 'ignorado'}
                                  onChange={() => updateRequisicao(i.id, { status: i.status === 'requisitado' ? 'pendente' : 'requisitado', updatedAt: new Date().toISOString() })}
                                  title="Marcar como requisitado"
                                />
                              </td>
                              <td>{i.tipo === 'aluguel' ? 'Aluguel' : 'Material'}</td>
                              <td>{i.descricao}{i.status === 'ignorado' && <span className="requisicoes-ignorado-badge"> · ignorado</span>}</td>
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
                              <td className="requisicoes-table__acoes">
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  onClick={() => updateRequisicao(i.id, { status: i.status === 'ignorado' ? 'pendente' : 'ignorado', updatedAt: new Date().toISOString() })}
                                  aria-label={i.status === 'ignorado' ? 'Reativar na requisição' : 'Tirar da requisição'}
                                  title={i.status === 'ignorado' ? 'Reativar — voltar a requisitar esse material' : 'Tirar da requisição (ex: material já incluso na empreitada) — não volta a aparecer sozinho'}
                                >
                                  <IconBan size={14} />
                                </button>
                                <button type="button" className="btn btn-ghost" onClick={() => deleteRequisicao(i.id)} aria-label="Excluir a linha" title="Excluir a linha (se o insumo continuar na subatividade, a sincronização pode recriar essa linha)">
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
