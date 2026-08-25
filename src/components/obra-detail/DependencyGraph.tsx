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
import { businessDaysBetween, durationDays, endDateFromDuration, endDateFromDurationUteis } from '../../utils/dateUtils';
import { computeNiveis, corDaEtapa } from '../../utils/dependencyGraph';
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
  dependeDe: string[];
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
    out.push({
      id: a.id,
      path: { atividadeId: a.id },
      kind: 'atividade',
      numero: getTaskNumber(atividades, a.id),
      nome: a.nome,
      faseNome: a.nome,
      dependeDe: a.dependeDe,
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
        dependeDe: s.dependeDe,
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
          dependeDe: n.dependeDe,
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

interface ItemNodeData extends Record<string, unknown> {
  numero: string;
  nome: string;
  faseNome: string;
  mostrarFase: boolean;
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
        <AtividadeStatusBadge status={d.status} />
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const NODE_TYPES = { item: ItemNode };

interface NiveisVisiveis {
  atividade: boolean;
  subatividade: boolean;
  neto: boolean;
}

export function DependencyGraph({ obraId, atividades, onUpdateAtividade, onUpdateSubatividade, onUpdateSubSubatividade, onOpenPanel, onNovaFase }: DependencyGraphProps) {
  const [visiveis, setVisiveis] = useState<NiveisVisiveis>({ atividade: true, subatividade: true, neto: true });
  const posicoesSalvasRef = useMemo(() => carregarPosicoes(obraId), [obraId]);

  const flatNodes = useMemo(() => buildFlatNodes(atividades), [atividades]);
  const flatById = useMemo(() => new Map(flatNodes.map((n) => [n.id, n])), [flatNodes]);

  function aplicarPatch(n: FlatNode, patch: Partial<Subatividade> | Partial<Atividade>) {
    if (n.kind === 'neto') onUpdateSubSubatividade(n.path.atividadeId, n.path.subatividadeId!, n.path.netoId!, patch as Partial<Subatividade>);
    else if (n.kind === 'subatividade') onUpdateSubatividade(n.path.atividadeId, n.path.subatividadeId!, patch as Partial<Subatividade>);
    else onUpdateAtividade(n.path.atividadeId, patch as Partial<Atividade>);
  }

  const { rfNodes, rfEdges } = useMemo(() => {
    const visibleNodes = flatNodes.filter((n) => visiveis[n.kind]);
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const niveis = computeNiveis(visibleNodes.map((n) => ({ id: n.id, dependeDe: n.dependeDe })));

    const contadorPorNivel = new Map<number, number>();
    const nodes: Node[] = [];

    for (const n of visibleNodes) {
      const nivel = niveis.get(n.id) ?? 0;
      const indice = contadorPorNivel.get(nivel) ?? 0;
      contadorPorNivel.set(nivel, indice + 1);

      // busca o item real pra recalcular data de fim ao editar dias, sem precisar guardar tudo no FlatNode
      const atividade = atividades.find((a) => a.id === n.path.atividadeId)!;
      const subatividade = n.path.subatividadeId ? atividade.subatividades.find((s) => s.id === n.path.subatividadeId) : undefined;
      const item: Subatividade | undefined = n.path.netoId ? (subatividade?.subatividades ?? []).find((x) => x.id === n.path.netoId) : subatividade;

      nodes.push({
        id: n.id,
        type: 'item',
        position: posicoesSalvasRef[n.id] ?? { x: nivel * COL_WIDTH, y: indice * ROW_HEIGHT },
        data: {
          numero: n.numero,
          nome: n.nome,
          faseNome: n.faseNome,
          mostrarFase: n.kind !== 'atividade',
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

    const edges: Edge[] = visibleNodes.flatMap((n) =>
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

    return { rfNodes: nodes, rfEdges: edges };
  }, [flatNodes, visiveis, atividades]);

  // Estado controlado do React Flow: sem isso, arrastar um card não fica — o RF precisa que a gente
  // aplique as mudanças de posição/seleção via onNodesChange/onEdgesChange. Ao recalcular o layout
  // (edição em qualquer card muda `atividades`), preserva a posição que o usuário já arrastou pra
  // cada nó, e só usa a posição calculada por nível pra nós novos.
  const [nodes, setNodes] = useState<Node[]>(rfNodes);
  const [edges, setEdges] = useState<Edge[]>(rfEdges);

  useEffect(() => {
    setNodes((atual) => {
      const posicaoAtual = new Map(atual.map((n) => [n.id, n.position]));
      return rfNodes.map((n) => (posicaoAtual.has(n.id) ? { ...n, position: posicaoAtual.get(n.id)! } : n));
    });
    setEdges(rfEdges);
  }, [rfNodes, rfEdges]);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  // Guarda a posição no localStorage assim que o usuário solta o arraste, pra sobreviver a sair e
  // voltar da aba (o layout automático por nível só é usado como ponto de partida, na 1ª vez).
  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node) => salvarPosicao(obraId, node.id, node.position),
    [obraId],
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
