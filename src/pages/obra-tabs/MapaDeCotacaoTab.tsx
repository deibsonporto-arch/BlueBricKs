import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconPlus } from '@tabler/icons-react';
import { useAtividades } from '../../hooks/useAtividades';
import { useCotacoes, melhorFornecedor } from '../../hooks/useCotacoes';
import { useEmpresaConfig } from '../../hooks/useEmpresaConfig';
import { CotacoesTable } from '../../components/mapa-cotacao/CotacoesTable';
import { CotacaoFormModal } from '../../components/mapa-cotacao/CotacaoFormModal';
import { EmptyState } from '../../components/common/EmptyState';
import type { Cotacao } from '../../types/domain';
import { formatBRL } from '../../utils/currency';
import { formatDate, todayISO } from '../../utils/dateUtils';
import { downloadHtmlAsWord } from '../../utils/wordExport';
import type { Atividade } from '../../types/domain';
import { getCurrentUserName } from '../../utils/currentUser';
import './MapaDeCotacaoTab.css';

const STATUS_LABEL: Record<Cotacao['status'], string> = {
  em_cotacao: 'Em cotação',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovado',
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildCotacaoWordBodyHtml(cotacao: Cotacao, atividade: Atividade | undefined, nomeEmpresa: string): string {
  const melhor = melhorFornecedor(cotacao);
  const totalPrevisto = !cotacao.naoPrevisto ? cotacao.quantidade * cotacao.valorUnitarioPrevisto : 0;

  const linhasFornecedores = cotacao.fornecedores.length
    ? cotacao.fornecedores
        .map((f) => {
          const isMelhor = f.id === melhor?.id;
          return `<tr>
            <td>${escapeHtml(f.nome)}${isMelhor ? '<span class="badge">Melhor opção</span>' : ''}</td>
            <td>${escapeHtml(f.tipo)}</td>
            <td>${escapeHtml(f.documento || '—')}</td>
            <td>${escapeHtml(f.contato || '—')}</td>
            <td>${escapeHtml(f.marca || '—')}</td>
            <td>${escapeHtml(f.numeroOrcamento || '—')}</td>
            <td>${escapeHtml(formatBRL(f.valor))}</td>
            <td>${escapeHtml(f.condicoesPagamento || '—')}</td>
            <td>${escapeHtml(f.prazoEntrega || '—')}</td>
            <td>${f.emiteNF ? 'Sim' : 'Não'}</td>
            <td>${escapeHtml(f.observacao || '—')}</td>
          </tr>`;
        })
        .join('')
    : '<tr><td colspan="11" class="muted">Nenhum fornecedor cadastrado.</td></tr>';

  const secoes: string[] = [];
  if (cotacao.descricaoServico) {
    secoes.push(`<h3>Descrição do escopo</h3><p>${escapeHtml(cotacao.descricaoServico)}</p>`);
  }
  secoes.push(
    `<h3>Quantitativo previsto</h3><p>${cotacao.quantidade} ${escapeHtml(cotacao.unidade)}${
      !cotacao.naoPrevisto
        ? ` × ${escapeHtml(formatBRL(cotacao.valorUnitarioPrevisto))} = <strong>${escapeHtml(formatBRL(totalPrevisto))}</strong>`
        : '<span class="muted"> (valor não previsto)</span>'
    }</p>`,
  );
  secoes.push(`<h3>Fornecedores</h3><table><thead><tr>
    <th>Fornecedor</th><th>Tipo</th><th>CNPJ/CPF</th><th>Contato</th><th>Marca</th>
    <th>Nº orçamento</th><th>Valor</th><th>Condições</th><th>Prazo</th><th>NF</th><th>Observação</th>
  </tr></thead><tbody>${linhasFornecedores}</tbody></table>`);

  if (cotacao.condicoesPagamentoGerais) {
    secoes.push(`<h3>Condições de pagamento (gerais)</h3><p>${escapeHtml(cotacao.condicoesPagamentoGerais)}</p>`);
  }
  if (cotacao.servicosNaoInclusos) {
    secoes.push(`<h3>Serviços não inclusos</h3><p>${escapeHtml(cotacao.servicosNaoInclusos)}</p>`);
  }
  if (cotacao.melhorOpcaoObservacao) {
    secoes.push(`<h3>Melhor opção</h3><p>${escapeHtml(cotacao.melhorOpcaoObservacao)}</p>`);
  }
  if (cotacao.observacoesGerais) {
    secoes.push(`<h3>Observações gerais</h3><p>${escapeHtml(cotacao.observacoesGerais)}</p>`);
  }

  return `
    <div>${escapeHtml(nomeEmpresa || 'Nome da empresa')}</div>
    <h2>Cotação de fornecedores</h2>
    <p>
      <strong>Item / serviço:</strong> ${escapeHtml(cotacao.itemServico)}<br/>
      <strong>Atividade vinculada:</strong> ${escapeHtml(atividade?.nome ?? '—')}<br/>
      <strong>Responsável:</strong> ${escapeHtml(cotacao.responsavel || '—')}<br/>
      <strong>Data:</strong> ${formatDate(cotacao.data)}<br/>
      <strong>Status:</strong> ${STATUS_LABEL[cotacao.status]}<br/>
      <strong>Gerado em:</strong> ${formatDate(todayISO())}
    </p>
    ${secoes.join('\n')}
  `;
}

export function MapaDeCotacaoTab() {
  const { id } = useParams<{ id: string }>();
  const obraId = id!;
  const { atividades } = useAtividades(obraId);
  const { cotacoes, updateCotacao, deleteCotacao, refresh } = useCotacoes(obraId);
  const { nomeEmpresa } = useEmpresaConfig();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingCotacao, setEditingCotacao] = useState<Cotacao | undefined>(undefined);
  const [duplicarDeCotacao, setDuplicarDeCotacao] = useState<Cotacao | undefined>(undefined);
  const [filtroAtividade, setFiltroAtividade] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'' | Cotacao['status']>('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [cotacaoImprimindo, setCotacaoImprimindo] = useState<Cotacao | undefined>(undefined);

  const cotacoesFiltradas = useMemo(
    () =>
      cotacoes
        .filter((c) => {
          if (filtroAtividade && c.atividadeId !== filtroAtividade) return false;
          if (filtroStatus && c.status !== filtroStatus) return false;
          if (filtroDataInicio && c.data < filtroDataInicio) return false;
          if (filtroDataFim && c.data > filtroDataFim) return false;
          return true;
        })
        .sort((a, b) => {
          const aAprovada = a.status === 'aprovado' ? 1 : 0;
          const bAprovada = b.status === 'aprovado' ? 1 : 0;
          if (aAprovada !== bAprovada) return aAprovada - bAprovada;
          return b.data.localeCompare(a.data);
        }),
    [cotacoes, filtroAtividade, filtroStatus, filtroDataInicio, filtroDataFim],
  );

  function openCreate() {
    setModalMode('create');
    setEditingCotacao(undefined);
    setDuplicarDeCotacao(undefined);
    setModalOpen(true);
  }

  function openEdit(cotacao: Cotacao) {
    setModalMode('edit');
    setEditingCotacao(cotacao);
    setDuplicarDeCotacao(undefined);
    setModalOpen(true);
  }

  function openDuplicar(cotacao: Cotacao) {
    setModalMode('create');
    setEditingCotacao(undefined);
    setDuplicarDeCotacao(cotacao);
    setModalOpen(true);
  }

  function handleDelete(id: string) {
    if (confirm('Excluir esta cotação? Essa ação não pode ser desfeita.')) deleteCotacao(id);
  }

  function handleAlterarStatus(cotacao: Cotacao, novoStatus: Cotacao['status']) {
    if (novoStatus === cotacao.status) return;
    const now = new Date().toISOString();
    const historico = [
      ...(cotacao.historico ?? []),
      { data: now, usuario: getCurrentUserName(), resumo: `Status alterado de ${STATUS_LABEL[cotacao.status]} para ${STATUS_LABEL[novoStatus]}` },
    ];
    updateCotacao(cotacao.id, { status: novoStatus, historico, updatedAt: now });
  }

  function handleImprimir(cotacao: Cotacao) {
    setCotacaoImprimindo(cotacao);
    requestAnimationFrame(() => window.print());
  }

  function handleBaixarWord(cotacao: Cotacao) {
    const atividade = atividades.find((a) => a.id === cotacao.atividadeId);
    const bodyHtml = buildCotacaoWordBodyHtml(cotacao, atividade, nomeEmpresa);
    const nomeArquivo = `Cotacao - ${cotacao.itemServico || 'sem nome'}`.slice(0, 120);
    downloadHtmlAsWord(nomeArquivo, 'Cotação de fornecedores', bodyHtml);
  }

  const atividadeImprimindo = cotacaoImprimindo ? atividades.find((a) => a.id === cotacaoImprimindo.atividadeId) : undefined;
  const melhorImprimindo = cotacaoImprimindo ? melhorFornecedor(cotacaoImprimindo) : undefined;
  const totalPrevistoImprimindo =
    cotacaoImprimindo && !cotacaoImprimindo.naoPrevisto ? cotacaoImprimindo.quantidade * cotacaoImprimindo.valorUnitarioPrevisto : 0;

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="mapa-cotacao-header">
        <div className="mapa-cotacao-filters-group">
          <div className="mapa-cotacao-filter">
            <label>Filtrar por atividade</label>
            <select value={filtroAtividade} onChange={(e) => setFiltroAtividade(e.target.value)}>
              <option value="">Todas</option>
              {atividades.map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
          </div>
          <div className="mapa-cotacao-filter">
            <label>Status</label>
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as '' | Cotacao['status'])}>
              <option value="">Todos</option>
              <option value="em_cotacao">Em cotação</option>
              <option value="aguardando_aprovacao">Aguardando aprovação</option>
              <option value="aprovado">Aprovado</option>
            </select>
          </div>
          <div className="mapa-cotacao-filter">
            <label>De</label>
            <input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} />
          </div>
          <div className="mapa-cotacao-filter">
            <label>Até</label>
            <input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} />
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <IconPlus size={16} /> Nova cotação
        </button>
      </div>

      <div className="mapa-cotacao-card">
        {cotacoesFiltradas.length === 0 ? (
          <EmptyState
            title="Nenhuma cotação encontrada"
            description="Cadastre uma nova cotação e compare valores de diferentes fornecedores para cada item ou serviço."
          />
        ) : (
          <CotacoesTable
            cotacoes={cotacoesFiltradas}
            atividades={atividades}
            onAlterarStatus={handleAlterarStatus}
            onFiltrarPorAtividade={setFiltroAtividade}
            onEdit={openEdit}
            onDuplicar={openDuplicar}
            onDelete={handleDelete}
            onImprimir={handleImprimir}
            onBaixarWord={handleBaixarWord}
          />
        )}
      </div>

      {cotacaoImprimindo && (
        <div className="cotacao-print-view">
          <div className="cotacao-print-header">
            <div className="cotacao-print-header__empresa">{nomeEmpresa || 'Nome da empresa'}</div>
            <h2>Cotação de fornecedores</h2>
            <div className="cotacao-print-header__grid">
              <span><strong>Item / serviço:</strong> {cotacaoImprimindo.itemServico}</span>
              <span><strong>Atividade vinculada:</strong> {atividadeImprimindo?.nome ?? '—'}</span>
              <span><strong>Responsável:</strong> {cotacaoImprimindo.responsavel || '—'}</span>
              <span><strong>Data:</strong> {formatDate(cotacaoImprimindo.data)}</span>
              <span><strong>Status:</strong> {STATUS_LABEL[cotacaoImprimindo.status]}</span>
              <span><strong>Gerado em:</strong> {formatDate(todayISO())}</span>
            </div>
          </div>

          {cotacaoImprimindo.descricaoServico && (
            <div className="cotacao-print-section">
              <h3>Descrição do escopo</h3>
              <p>{cotacaoImprimindo.descricaoServico}</p>
            </div>
          )}

          <div className="cotacao-print-section">
            <h3>Quantitativo previsto</h3>
            <p>
              {cotacaoImprimindo.quantidade} {cotacaoImprimindo.unidade}
              {!cotacaoImprimindo.naoPrevisto && (
                <> × {formatBRL(cotacaoImprimindo.valorUnitarioPrevisto)} = <strong>{formatBRL(totalPrevistoImprimindo)}</strong></>
              )}
              {cotacaoImprimindo.naoPrevisto && <span className="cotacao-print-muted"> (valor não previsto)</span>}
            </p>
          </div>

          <table className="cotacao-print-table">
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Tipo</th>
                <th>CNPJ/CPF</th>
                <th>Contato</th>
                <th>Marca</th>
                <th>Nº orçamento</th>
                <th>Valor</th>
                <th>Condições</th>
                <th>Prazo</th>
                <th>NF</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {cotacaoImprimindo.fornecedores.map((f) => (
                <tr key={f.id} className={f.id === melhorImprimindo?.id ? 'is-melhor' : ''}>
                  <td>{f.nome}{f.id === melhorImprimindo?.id && <span className="cotacao-print-badge">Melhor opção</span>}</td>
                  <td>{f.tipo}</td>
                  <td>{f.documento || '—'}</td>
                  <td>{f.contato || '—'}</td>
                  <td>{f.marca || '—'}</td>
                  <td>{f.numeroOrcamento || '—'}</td>
                  <td>{formatBRL(f.valor)}</td>
                  <td>{f.condicoesPagamento || '—'}</td>
                  <td>{f.prazoEntrega || '—'}</td>
                  <td>{f.emiteNF ? 'Sim' : 'Não'}</td>
                  <td>{f.observacao || '—'}</td>
                </tr>
              ))}
              {cotacaoImprimindo.fornecedores.length === 0 && (
                <tr><td colSpan={11} className="cotacao-print-muted">Nenhum fornecedor cadastrado.</td></tr>
              )}
            </tbody>
          </table>

          {cotacaoImprimindo.condicoesPagamentoGerais && (
            <div className="cotacao-print-section">
              <h3>Condições de pagamento (gerais)</h3>
              <p>{cotacaoImprimindo.condicoesPagamentoGerais}</p>
            </div>
          )}
          {cotacaoImprimindo.servicosNaoInclusos && (
            <div className="cotacao-print-section">
              <h3>Serviços não inclusos</h3>
              <p>{cotacaoImprimindo.servicosNaoInclusos}</p>
            </div>
          )}
          {cotacaoImprimindo.melhorOpcaoObservacao && (
            <div className="cotacao-print-section">
              <h3>Melhor opção</h3>
              <p>{cotacaoImprimindo.melhorOpcaoObservacao}</p>
            </div>
          )}
          {cotacaoImprimindo.observacoesGerais && (
            <div className="cotacao-print-section">
              <h3>Observações gerais</h3>
              <p>{cotacaoImprimindo.observacoesGerais}</p>
            </div>
          )}
        </div>
      )}

      <CotacaoFormModal
        open={modalOpen}
        mode={modalMode}
        obraId={obraId}
        atividades={atividades}
        cotacao={editingCotacao}
        duplicarDe={duplicarDeCotacao}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          refresh();
        }}
      />
    </div>
  );
}
