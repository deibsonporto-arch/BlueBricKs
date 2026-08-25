import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Atividade, Subatividade, StatusAtividade } from '../../types/domain';
import { AtividadeStatusBadge } from '../common/StatusBadge';
import {
  deriveParentStatus,
  getSubatividadeDisplayStatus,
  getTaskNumber,
  isAtrasado,
  temNetos,
} from '../../utils/subatividades';
import { businessDaysBetween, durationDays, endDateFromDuration, endDateFromDurationUteis, formatDateShort } from '../../utils/dateUtils';
import { corDaEtapa } from '../../utils/dependencyGraph';
import type { ItemPath } from './NoDetalhePanel';
import './DependencyGraph.css';

interface DependencyGraphProps {
  obraId: string;
  atividades: Atividade[];
  onUpdateAtividade: (id: string, patch: Partial<Atividade>) => void;
  onUpdateSubatividade: (atividadeId: string, subatividadeId: string, patch: Partial<Subatividade>) => void;
  onUpdateSubSubatividade: (atividadeId: string, subatividadeId: string, subSubatividadeId: string, patch: Partial<Subatividade>) => void;
  onOpenPanel: (path: ItemPath) => void;
  onNovaFase?: () => void;
}

type PosicoesSalvas = Record<string, { x: number; y: number }>;

function chavePosicoes(obraId: string): string {
  return `brics:mapaDependenciasPos:${obraId}`;
}

function carregarPosicoes(obraId: string): PosicoesSalvas {
  try {
    const raw = localStorage.getItem(chavePosicoes(obraId));
    return raw ? (JSON.parse(raw) as PosicoesSalvas) : {};
  } catch {
    return {};
  }
}

function salvarPosicao(obraId: string, nodeId: string, posicao: { x: number; y: number }) {
  const atuais = carregarPosicoes(obraId);
  atuais[nodeId] = posicao;
  localStorage.setItem(chavePosicoes(obraId), JSON.stringify(atuais));
}

type NodeKind = 'atividade' | 'subatividade' | 'neto';

interface FlatNode {
  id: string;
  path: ItemPath;
  kind: NodeKind;
  numero: string;
  nome: string;
  faseNome: string;
  faseCol: number;
  paiId?: string;
  dependeDe: string[];
  dataInicio: string;
  dataFim: string;
  dias: number;
  editavel: boolean;
  temFilhos: boolean;
  filhosCount: number;
  status: StatusAtividade | 'atrasada';
  concluida: boolean;
  cor: string;
}

function isAtividadeConcluida(a: Atividade): boolean {
  return a.subatividades.length > 0 ? (deriveParentStatus(a.subatividades)?.concluida ?? a.concluida) : a.concluida;
}

/** Duração em dias de um item com filhos (soma recursiva) ou folha (a partir das próprias datas). */
function duracaoDias(item: { dataInicio: string; dataFim: string; contagemDias?: 'corridos' | 'uteis'; subatividades?: Subatividade[] }): number {
  if (item.subatividades && item.subatividades.length > 0) {
    return item.subatividades.reduce((soma, filho) => soma + duracaoDias(filho), 0);
  }
  return item.contagemDias === 'uteis' ? businessDaysBetween(item.dataInicio, item.dataFim) : durationDays(item.dataInicio, item.dataFim);
}

function buildFlatNodes(atividades: Atividade[]): FlatNode[] {
  const out: FlatNode[] = [];
  atividades.forEach((a, ai) => {
    const cor = corDaEtapa(ai);
    const aTemFilhos = a.subatividades.length > 0;
    const faseCol = faseDe(a);
    out.push({
      id: a.id,
      path: { atividadeId: a.id },
      kind: 'atividade',
      numero: getTaskNumber(atividades, a.id),
      nome: a.nome,
      faseNome: a.nome,
      faseCol,
      dependeDe: a.dependeDe,
      dataInicio: a.dataInicio,
      dataFim: a.dataFim,
      dias: duracaoDias(a),
      editavel: false,
      temFilhos: aTemFilhos,
      filhosCount: a.subatividades.length,
      status: aTemFilhos ? (deriveParentStatus(a.subatividades)?.status ?? a.status) : (isAtrasado({ dataFim: a.dataFim, concluida: a.concluida }) ? 'atrasada' : a.status),
      concluida: isAtividadeConcluida(a),
      cor,
    });

    a.subatividades.forEach((s) => {
      const sTemFilhos = temNetos(s);
      out.push({
        id: s.id,
        path: { atividadeId: a.id, subatividadeId: s.id },
        kind: 'subatividade',
        numero: getTaskNumber(atividades, s.id),
        nome: s.nome,
        faseNome: a.nome,
        faseCol,
        paiId: a.id,
        dependeDe: s.dependeDe,
        dataInicio: s.dataInicio,
        dataFim: s.dataFim,
        dias: duracaoDias(s),
        editavel: !sTemFilhos,
        temFilhos: sTemFilhos,
        filhosCount: s.subatividades?.length ?? 0,
        status: sTemFilhos ? (deriveParentStatus(s.subatividades ?? [])?.status ?? s.status) : getSubatividadeDisplayStatus(s),
        concluida: sTemFilhos ? (deriveParentStatus(s.subatividades ?? [])?.concluida ?? s.concluida) : s.concluida,
        cor,
      });

      (s.subatividades ?? []).forEach((n) => {
        out.push({
          id: n.id,
          path: { atividadeId: a.id, subatividadeId: s.id, netoId: n.id },
          kind: 'neto',
          numero: getTaskNumber(atividades, n.id),
          nome: n.nome,
          faseNome: a.nome,
          faseCol,
          paiId: s.id,
          dependeDe: n.dependeDe,
          dataInicio: n.dataInicio,
          dataFim: n.dataFim,
          dias: duracaoDias(n),
          editavel: true,
          temFilhos: false,
          filhosCount: 0,
          status: getSubatividadeDisplayStatus(n),
          concluida: n.concluida,
          cor,
        });
      });
    });
  });
  return out;
}

const COL_WIDTH = 260;
const ROW_HEIGHT = 96;
const MAX_FASE = 10;

function faseDe(a: Atividade): number {
  return Math.min(MAX_FASE, Math.max(0, a.faseMapa ?? 0));
}

interface ItemNodeData extends Record<string, unknown> {
  numero: string;
  nome: string;
  faseNome: string;
  mostrarFase: boolean;
  dataInicio: string;
  dataFim: string;
  dias: number;
  editavel: boolean;
  temFilhos: boolean;
  filhosCount: number;
  status: StatusAtividade | 'atrasada';
  concluida: boolean;
  cor: string;
  onOpenPanel: () => void;
  onEditDias: (novoValor: number) => void;
}

function ItemNode({ data }: NodeProps) {
  const d = data as ItemNodeData;
  return (
    <div className={`dep-node${d.concluida ? ' dep-node--concluida' : ''}${d.status === 'atrasada' ? ' dep-node--atrasada' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="dep-node__header" style={{ background: d.cor }}>
        <span>{d.numero}</span>
        {d.mostrarFase && <span className="dep-node__header-fase" title={d.faseNome}>{d.faseNome}</span>}
      </div>
      <div className="dep-node__body" onClick={d.onOpenPanel}>
        <div className="dep-node__nome" title={d.nome}>{d.nome}</div>
        <div className="dep-node__meta">
          {d.editavel ? (
            <input
              type="number"
              min={1}
              className="dep-node__dias-input"
              defaultValue={d.dias}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => d.onEditDias(Math.max(1, Number(e.target.value) || 1))}
            />
          ) : (
            <span className="dep-node__dias">{d.dias}d</span>
          )}
          {d.temFilhos && <span className="dep-node__filhos-count">({d.filhosCount})</span>}
        </div>
        <div className="dep-node__datas">{formatDateShort(d.dataInicio)} — {formatDateShort(d.dataFim)}</div>
        <AtividadeStatusBadge status={d.status} />
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function FaseLabelNode({ data }: NodeProps) {
  return <div className="dep-fase-label">{(data as { label: string }).label}</div>;
}

const NODE_TYPES = { item: ItemNode, faseLabel: FaseLabelNode };

interface NiveisVisiveis {
  atividade: boolean;
  subatividade: boolean;
  neto: boolean;
}

export function DependencyGraph({ obraId, atividades, onUpdateAtividade, onUpdateSubatividade, onUpdateSubSubatividade, onOpenPanel, onNovaFase }: DependencyGraphProps) {
  const [visiveis, setVisiveis] = useState<NiveisVisiveis>({ atividade: true, subatividade: true, neto: true });
  const [busca, setBusca] = useState('');
  const [nivelFiltro, setNivelFiltro] = useState('');
  const posicoesSalvasRef = useMemo(() => carregarPosicoes(obraId), [obraId]);

  const flatNodes = useMemo(() => buildFlatNodes(atividades), [atividades]);
  const flatById = useMemo(() => new Map(flatNodes.map((n) => [n.id, n])), [flatNodes]);

  function aplicarPatch(n: FlatNode, patch: Partial<Subatividade> | Partial<Atividade>) {
    if (n.kind === 'neto') onUpdateSubSubatividade(n.path.atividadeId, n.path.subatividadeId!, n.path.netoId!, patch as Partial<Subatividade>);
    else if (n.kind === 'subatividade') onUpdateSubatividade(n.path.atividadeId, n.path.subatividadeId!, patch as Partial<Subatividade>);
    else onUpdateAtividade(n.path.atividadeId, patch as Partial<Atividade>);
  }

  const { rfNodes, rfEdges } = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let visibleNodes = flatNodes.filter((n) => visiveis[n.kind]);
    if (termo) {
      visibleNodes = visibleNodes.filter(
        (n) => n.nome.toLowerCase().includes(termo) || n.faseNome.toLowerCase().includes(termo) || n.numero.toLowerCase().includes(termo),
      );
    }
    if (nivelFiltro !== '') {
      const faseAlvo = Number(nivelFiltro);
      visibleNodes = visibleNodes.filter((n) => n.faseCol === faseAlvo);
    }
    const visibleIds = new Set(visibleNodes.map((n) => n.id));

    // Cada coluna (0..MAX_FASE) é uma fase manual. Dentro da coluna, empilha os itens verticalmente
    // na ordem em que aparecem (atividade, depois suas subatividades/netos, depois a próxima
    // atividade da mesma fase...) — arrastar um card de atividade pra outra coluna muda sua fase.
    const contadorPorColuna = new Map<number, number>();
    const nodes: Node[] = [];

    for (const n of visibleNodes) {
      const indice = contadorPorColuna.get(n.faseCol) ?? 0;
      contadorPorColuna.set(n.faseCol, indice + 1);
      const posicaoPadrao = { x: n.faseCol * COL_WIDTH, y: indice * ROW_HEIGHT };

      // Posição de atividade sempre reflete a fase atual (não fica "presa" numa posição arrastada
      // antiga); subatividades/netos podem ter ajuste fino salvo pelo usuário.
      const posicaoSalva = n.kind === 'atividade' ? undefined : posicoesSalvasRef[n.id];

      // busca o item real pra recalcular data de fim ao editar dias, sem precisar guardar tudo no FlatNode
      const atividade = atividades.find((a) => a.id === n.path.atividadeId)!;
      const subatividade = n.path.subatividadeId ? atividade.subatividades.find((s) => s.id === n.path.subatividadeId) : undefined;
      const item: Subatividade | undefined = n.path.netoId ? (subatividade?.subatividades ?? []).find((x) => x.id === n.path.netoId) : subatividade;

      nodes.push({
        id: n.id,
        type: 'item',
        position: posicaoSalva ?? posicaoPadrao,
        data: {
          numero: n.numero,
          nome: n.nome,
          faseNome: n.faseNome,
          mostrarFase: n.kind !== 'atividade',
          dataInicio: n.dataInicio,
          dataFim: n.dataFim,
          dias: n.dias,
          editavel: n.editavel,
          temFilhos: n.temFilhos,
          filhosCount: n.filhosCount,
          status: n.status,
          concluida: n.concluida,
          cor: n.cor,
          onOpenPanel: () => onOpenPanel(n.path),
          onEditDias: (novoValor: number) => {
            if (!item) return;
            const dataFim = item.contagemDias === 'uteis' ? endDateFromDurationUteis(item.dataInicio, novoValor) : endDateFromDuration(item.dataInicio, novoValor);
            aplicarPatch(n, { dataFim });
          },
        } satisfies ItemNodeData,
      });
    }

    for (let fase = 0; fase <= MAX_FASE; fase++) {
      if (nivelFiltro !== '' && Number(nivelFiltro) !== fase) continue;
      nodes.push({
        id: `fase-label-${fase}`,
        type: 'faseLabel',
        position: { x: fase * COL_WIDTH, y: -70 },
        data: { label: fase === 0 ? 'Fase 0 (livre)' : `Fase ${fase}` },
        draggable: false,
        selectable: false,
      });
    }

    const edgesDependencia: Edge[] = visibleNodes.flatMap((n) =>
      n.dependeDe
        .filter((predId) => visibleIds.has(predId))
        .map((predId) => ({
          id: `${predId}->${n.id}`,
          source: predId,
          target: n.id,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: n.cor },
        })),
    );

    // liga visualmente a atividade/subatividade-mãe aos seus filhos diretos, pra dar a ideia de
    // árvore (hierarquia) além das setas de dependência entre tarefas.
    const edgesVinculo: Edge[] = visibleNodes
      .filter((n) => n.paiId && visibleIds.has(n.paiId))
      .map((n) => ({
        id: `pai:${n.paiId}->${n.id}`,
        source: n.paiId!,
        target: n.id,
        type: 'straight',
        style: { stroke: 'var(--color-border)', strokeDasharray: '3 3' },
      }));

    return { rfNodes: nodes, rfEdges: [...edgesVinculo, ...edgesDependencia] };
  }, [flatNodes, visiveis, atividades, busca, nivelFiltro]);

  // Estado controlado do React Flow: sem isso, arrastar um card não fica — o RF precisa que a gente
  // aplique as mudanças de posição/seleção via onNodesChange/onEdgesChange. Ao recalcular o layout
  // (edição em qualquer card muda `atividades`), preserva a posição que o usuário já arrastou pra
  // cada nó, e só usa a posição calculada por nível pra nós novos.
  const [nodes, setNodes] = useState<Node[]>(rfNodes);
  const [edges, setEdges] = useState<Edge[]>(rfEdges);

  useEffect(() => {
    setNodes((atual) => {
      const anteriores = new Map(atual.map((n) => [n.id, n]));
      return rfNodes.map((n) => {
        const anterior = anteriores.get(n.id);
        // atividade (fase) sempre usa a posição recém-calculada pra coluna/ordem atual — nunca fica
        // "presa" no pixel exato de um arraste antigo; subatividade/neto preserva o ajuste fino.
        const ehFase = n.type === 'item' && (n.data as ItemNodeData).mostrarFase === false;
        if (anterior && !ehFase) return { ...n, position: anterior.position };
        return n;
      });
    });
    setEdges(rfEdges);
  }, [rfNodes, rfEdges]);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  // Ao soltar o arraste: se for um card de atividade (fase), a coluna onde ele caiu vira a nova
  // fase do item — arrastar "joga" a atividade pra dentro daquela fase. Pra subatividade/neto,
  // guarda o ajuste fino de posição no localStorage, como antes.
  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      const flat = flatById.get(node.id);
      if (flat?.kind === 'atividade') {
        const novaFase = Math.min(MAX_FASE, Math.max(0, Math.round(node.position.x / COL_WIDTH)));
        onUpdateAtividade(node.id, { faseMapa: novaFase });
      } else {
        salvarPosicao(obraId, node.id, node.position);
      }
    },
    [obraId, flatById, onUpdateAtividade],
  );

  function onConnect(connection: Connection) {
    const { source, target } = connection;
    if (!source || !target || source === target) return;
    const targetNode = flatById.get(target);
    if (!targetNode) return;
    const novaDependeDe = targetNode.dependeDe.includes(source)
      ? targetNode.dependeDe
      : targetNode.dependeDe.length >= 2
        ? [targetNode.dependeDe[0], source]
        : [...targetNode.dependeDe, source];
    aplicarPatch(targetNode, { dependeDe: novaDependeDe });
  }

  function onEdgesDelete(edges: Edge[]) {
    for (const e of edges) {
      const targetNode = flatById.get(e.target);
      if (!targetNode) continue;
      aplicarPatch(targetNode, { dependeDe: targetNode.dependeDe.filter((id) => id !== e.source) });
    }
  }

  return (
    <div className="dep-graph-card">
      <div className="dep-graph-card__toolbar">
        <h3>Mapa de Dependências</h3>
        <div className="dep-graph-card__toolbar-right">
        <div className="dep-graph-card__filtros">
          <input
            type="text"
            placeholder="Buscar fase, atividade ou item..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select value={nivelFiltro} onChange={(e) => setNivelFiltro(e.target.value)}>
            <option value="">Todas as fases</option>
            {Array.from({ length: MAX_FASE + 1 }, (_, fase) => (
              <option key={fase} value={fase}>{fase === 0 ? 'Fase 0 (livre)' : `Fase ${fase}`}</option>
            ))}
          </select>
        </div>
        {onNovaFase && (
          <button type="button" className="btn btn-secondary" onClick={onNovaFase}>
            + Nova fase
          </button>
        )}
        <div className="dep-graph-card__toggles">
          <label>
            <input type="checkbox" checked={visiveis.atividade} onChange={(e) => setVisiveis((v) => ({ ...v, atividade: e.target.checked }))} />
            Fases
          </label>
          <label>
            <input type="checkbox" checked={visiveis.subatividade} onChange={(e) => setVisiveis((v) => ({ ...v, subatividade: e.target.checked }))} />
            Subfases
          </label>
          <label>
            <input type="checkbox" checked={visiveis.neto} onChange={(e) => setVisiveis((v) => ({ ...v, neto: e.target.checked }))} />
            Serviços
          </label>
        </div>
        </div>
      </div>
      <div className="dep-graph-card__canvas">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            fitView
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}
