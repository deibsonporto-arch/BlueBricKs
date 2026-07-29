import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconAlertTriangle, IconChevronDown, IconChevronUp, IconCircleCheck, IconTrash } from '@tabler/icons-react';
import { useObras } from '../../hooks/useObras';
import { useAtividades } from '../../hooks/useAtividades';
import { useOrcamentoConfig } from '../../hooks/useOrcamentoConfig';
import type { Atividade, EtapaOrcamentoConfig, Subatividade } from '../../types/domain';
import { generateId } from '../../utils/id';
import { formatBRL, formatNumberBR, parseNumberBR } from '../../utils/currency';
import { endDateFromDuration } from '../../utils/dateUtils';
import { getOrderedSubatividades } from '../../utils/subatividades';
import { ETAPAS_TECNICAS_SUBATIVIDADES } from '../../data/etapasTecnicasSubatividades';
import './OrcamentoTab.css';

export function OrcamentoTab() {
  const { id } = useParams<{ id: string }>();
  const obraId = id!;
  const { obras, updateObra } = useObras();
  const obra = obras.find((o) => o.id === obraId);
  const { atividades, createAtividade, updateAtividade, deleteAtividade, createSubatividade, updateSubatividade } = useAtividades(obraId);
  const { modelos, removeEtapa } = useOrcamentoConfig();

  const [fonteEtapas, setFonteEtapas] = useState<'modelo' | 'atividades'>('modelo');
  const [modeloId, setModeloId] = useState('');
  const [areaInput, setAreaInput] = useState('');
  const [cubInput, setCubInput] = useState('');
  const [ccuInput, setCcuInput] = useState('0');
  const [bdiInput, setBdiInput] = useState('0');
  const [valores, setValores] = useState<Record<string, number>>({});
  const [valorDraft, setValorDraft] = useState<Record<string, string>>({});
  const [pctDraft, setPctDraft] = useState<Record<string, string>>({});
  const [materialDraft, setMaterialDraft] = useState<Record<string, string>>({});
  const [maoDeObraDraft, setMaoDeObraDraft] = useState<Record<string, string>>({});
  const [ajustesAbertos, setAjustesAbertos] = useState(true);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (!obra) return;
    setAreaInput(obra.areaConstruida != null ? String(obra.areaConstruida) : '');
    setCubInput(obra.cubPorM2 != null ? String(obra.cubPorM2) : '');
    setCcuInput(String(obra.ccuPercentual ?? 0));
    setBdiInput(String(obra.bdiPercentual ?? 0));
    setFonteEtapas(obra.orcamentoFonteEtapas ?? 'modelo');
    setModeloId(obra.orcamentoModeloId ?? modelos[0]?.id ?? '');
    setValores({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obra?.id]);

  if (!obra) return null;

  const modelo = modelos.find((m) => m.id === modeloId) ?? modelos[0];
  const usaAtividades = fonteEtapas === 'atividades';
  const etapasOrdenadas = modelo ? [...modelo.etapas].sort((a, b) => a.ordem - b.ordem) : [];
  const valorTecnico = parseNumberBR(areaInput) * parseNumberBR(cubInput);

  function getValorEtapa(etapa: EtapaOrcamentoConfig): number {
    if (valores[etapa.id] != null) return valores[etapa.id];
    const linked = atividades.find((a) => a.etapaOrcamentoConfigId === etapa.id);
    if (linked) return linked.custoMaterial + linked.custoMaoDeObra + linked.custoAluguel;
    return valorTecnico * (etapa.percentualPadrao / 100);
  }

  // no modo "atividades", cada atividade de topo do cronograma vira uma linha — não há % padrão/faixa
  // esperada pra comparar (essas faixas são referências de construção nova), então só mostramos o valor
  interface LinhaEtapa {
    etapaId?: string;
    atividadeId?: string;
    nome: string;
    valor: number;
    custoMaterial?: number;
    custoMaoDeObra?: number;
    percentualTotal: number;
    faixa?: { min: number; max: number };
    dentroFaixa: boolean;
  }

  const etapasComIndicador: LinhaEtapa[] = usaAtividades
    ? atividades.map((a) => {
        const valor = a.custoMaterial + a.custoMaoDeObra + a.custoAluguel;
        const percentualTotal = valorTecnico > 0 ? (valor / valorTecnico) * 100 : 0;
        return { atividadeId: a.id, nome: a.nome, valor, custoMaterial: a.custoMaterial, custoMaoDeObra: a.custoMaoDeObra, percentualTotal, dentroFaixa: true };
      })
    : etapasOrdenadas.map((etapa) => {
        const valor = getValorEtapa(etapa);
        const percentualTotal = valorTecnico > 0 ? (valor / valorTecnico) * 100 : 0;
        const dentroFaixa = percentualTotal >= etapa.percentualMin && percentualTotal <= etapa.percentualMax;
        return { etapaId: etapa.id, nome: etapa.nome, valor, percentualTotal, faixa: { min: etapa.percentualMin, max: etapa.percentualMax }, dentroFaixa };
      });
  const todasDentro = etapasComIndicador.every((e) => e.dentroFaixa);
  const foraDaFaixa = etapasComIndicador.filter((e) => !e.dentroFaixa);
  // soma real dos valores das etapas (pode ter sido editada manualmente linha a linha, ficando diferente
  // do valor técnico teórico de área × CUB) — é essa soma, não o teórico, que serve de base pro BDI/CCU
  const somaValores = etapasComIndicador.reduce((s, e) => s + e.valor, 0);
  const somaPercentual = etapasComIndicador.reduce((s, e) => s + e.percentualTotal, 0);

  const ccuNum = parseNumberBR(ccuInput);
  const bdiNum = parseNumberBR(bdiInput);
  const totalAjustes = somaValores * ((ccuNum + bdiNum) / 100);
  const valorFinalCliente = somaValores + totalAjustes;

  function handleValorEtapaChange(etapaId: string, raw: string) {
    setValorDraft((d) => ({ ...d, [etapaId]: raw }));
    setValores((v) => ({ ...v, [etapaId]: parseNumberBR(raw) }));
  }

  function handlePctEtapaChange(etapaId: string, raw: string) {
    setPctDraft((d) => ({ ...d, [etapaId]: raw }));
    const pct = parseNumberBR(raw);
    setValores((v) => ({ ...v, [etapaId]: valorTecnico * (pct / 100) }));
  }

  function handleMaterialAtividadeChange(atividadeId: string, raw: string) {
    setMaterialDraft((d) => ({ ...d, [atividadeId]: raw }));
  }

  function commitMaterialAtividade(atividadeId: string) {
    const raw = materialDraft[atividadeId];
    if (raw == null) return;
    updateAtividade(atividadeId, { custoMaterial: parseNumberBR(raw), updatedAt: new Date().toISOString() });
    setMaterialDraft((d) => { const n = { ...d }; delete n[atividadeId]; return n; });
  }

  function handleMaoDeObraAtividadeChange(atividadeId: string, raw: string) {
    setMaoDeObraDraft((d) => ({ ...d, [atividadeId]: raw }));
  }

  function commitMaoDeObraAtividade(atividadeId: string) {
    const raw = maoDeObraDraft[atividadeId];
    if (raw == null) return;
    updateAtividade(atividadeId, { custoMaoDeObra: parseNumberBR(raw), updatedAt: new Date().toISOString() });
    setMaoDeObraDraft((d) => { const n = { ...d }; delete n[atividadeId]; return n; });
  }

  function handleRemoverEtapa(etapa: EtapaOrcamentoConfig) {
    if (!modelo) return;
    const vinculada = atividades.find((a) => a.etapaOrcamentoConfigId === etapa.id);
    const aviso = vinculada
      ? `Excluir a etapa "${etapa.nome}" do modelo "${modelo.nome}"? Ela vale para todas as obras que usam esse modelo (Configurações). A atividade "${vinculada.nome}" já criada nesta obra também será excluída, com suas subatividades.`
      : `Excluir a etapa "${etapa.nome}" do modelo "${modelo.nome}"? Ela vale para todas as obras que usam esse modelo (Configurações).`;
    if (!confirm(aviso)) return;
    removeEtapa(modelo.id, etapa.id);
    if (vinculada) deleteAtividade(vinculada.id);
  }

  async function handleSalvar() {
    const obraAtual = obra!;
    const areaNum = parseNumberBR(areaInput);
    const cubNum = parseNumberBR(cubInput);
    const now = new Date().toISOString();

    await updateObra(obraId, {
      areaConstruida: areaNum,
      cubPorM2: cubNum,
      ccuPercentual: ccuNum,
      bdiPercentual: bdiNum,
      orcamentoTotal: valorFinalCliente,
      orcamentoFonteEtapas: fonteEtapas,
      orcamentoModeloId: modelo?.id,
      updatedAt: now,
    });

    // no modo "atividades" o cronograma já é a fonte da verdade — só salva os totais da obra, sem reescrever
    // os custos das atividades (que o usuário já editou diretamente em Visão Geral)
    if (usaAtividades || !modelo) {
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
      return;
    }

    // distribui o ajuste comercial (CCU + BDI) proporcionalmente em cada etapa, senão a soma dos custos
    // das atividades (usada na Curva S e no "Custo real por etapa") fica presa no valor técnico, sem bater
    // com o orçamento total salvo na obra (que já inclui o ajuste)
    const fatorAjuste = 1 + (ccuNum + bdiNum) / 100;

    let atividadeAnteriorId: string | undefined;
    let subatividadeAnteriorId: string | undefined;
    for (let i = 0; i < etapasOrdenadas.length; i++) {
      const etapa = etapasOrdenadas[i];
      const valor = getValorEtapa(etapa) * fatorAjuste;
      const custoMaterial = valor * (modelo.materialPercentual / 100);
      const custoMaoDeObra = valor * (modelo.maoDeObraPercentual / 100);
      const existente = atividades.find((a) => a.etapaOrcamentoConfigId === etapa.id);
      const nomesSubatividades = ETAPAS_TECNICAS_SUBATIVIDADES[i] ?? [];

      if (existente) {
        if (existente.subatividades.length === 0) {
          await updateAtividade(existente.id, { custoMaterial, custoMaoDeObra, updatedAt: now });
        } else {
          const n = existente.subatividades.length;
          const custoMaterialPorSub = custoMaterial / n;
          const custoMaoDeObraPorSub = custoMaoDeObra / n;
          for (const sub of existente.subatividades) {
            await updateSubatividade(existente.id, sub.id, { custoMaterial: custoMaterialPorSub, custoMaoDeObra: custoMaoDeObraPorSub });
          }
        }
        atividadeAnteriorId = existente.id;
        const ultimaSub = getOrderedSubatividades(existente.subatividades).at(-1)?.subatividade;
        if (ultimaSub) subatividadeAnteriorId = ultimaSub.id;
        continue;
      }

      const novaId = generateId();
      const nova: Atividade = {
        id: novaId,
        obraId,
        nome: etapa.nome,
        etapa: etapa.nome,
        dependeDe: atividadeAnteriorId ? [atividadeAnteriorId] : [],
        dataInicio: obraAtual.dataInicio,
        dataFim: obraAtual.dataInicio,
        duracaoSemanas: 1,
        dataAutomatica: true,
        etapaOrcamentoConfigId: etapa.id,
        status: 'pendente',
        concluida: false,
        custoMaoDeObra,
        custoMaterial,
        custoAluguel: 0,
        materiaisNecessarios: [],
        maoDeObraNecessaria: [],
        equipamentosAluguel: [],
        subatividades: [],
        createdAt: now,
        updatedAt: now,
      };
      await createAtividade(nova);

      let prevSubId = subatividadeAnteriorId;
      const custoMaterialPorSub = nomesSubatividades.length > 0 ? custoMaterial / nomesSubatividades.length : 0;
      const custoMaoDeObraPorSub = nomesSubatividades.length > 0 ? custoMaoDeObra / nomesSubatividades.length : 0;
      for (let si = 0; si < nomesSubatividades.length; si++) {
        const novaSub: Subatividade = {
          id: generateId(),
          nome: nomesSubatividades[si],
          concluida: false,
          status: 'pendente',
          dataInicio: obraAtual.dataInicio,
          dataFim: endDateFromDuration(obraAtual.dataInicio, 7),
          dependeDe: prevSubId ? [prevSubId] : [],
          diasEsperaAposPredecessora: 0,
          dataAutomatica: true,
          contagemDias: 'uteis',
          ordem: si,
          iniciada: false,
          custoMaoDeObra: custoMaoDeObraPorSub,
          custoMaterial: custoMaterialPorSub,
          custoAluguel: 0,
          materiaisNecessarios: [],
          maoDeObraNecessaria: [],
          equipamentosAluguel: [],
        };
        await createSubatividade(novaId, novaSub);
        prevSubId = novaSub.id;
      }

      subatividadeAnteriorId = prevSubId;
      atividadeAnteriorId = novaId;
    }

    setSalvo(true);
    setTimeout(() => setSalvo(false), 3000);
  }

  return (
    <div className="orcamento-tab">
      <div className="orcamento-info">
        A distribuição técnica considera apenas o valor de construção. Preencha a área e o CUB por m² para calcular automaticamente.
      </div>

      <div className="orcamento-header-fields">
        <div className="form-field">
          <label>Área construída (m²)</label>
          <input type="text" inputMode="decimal" placeholder="0,00" value={areaInput} onChange={(e) => setAreaInput(e.target.value)} />
        </div>
        <div className="form-field">
          <label>CUB por m² (R$)</label>
          <input type="text" inputMode="decimal" placeholder="0,00" value={cubInput} onChange={(e) => setCubInput(e.target.value)} />
        </div>
        <div className="form-field">
          <label>Valor técnico total</label>
          <p className="orcamento-valor-calculado">{formatBRL(valorTecnico)}</p>
        </div>
      </div>

      <div className="orcamento-card orcamento-fonte-card">
        <h3>Fonte das etapas</h3>
        <div className="orcamento-fonte-opcoes">
          <label>
            <input type="radio" checked={!usaAtividades} onChange={() => setFonteEtapas('modelo')} />
            Modelo pré-definido
          </label>
          {!usaAtividades && (
            <select value={modeloId} onChange={(e) => setModeloId(e.target.value)}>
              {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          )}
          <label>
            <input type="radio" checked={usaAtividades} onChange={() => setFonteEtapas('atividades')} />
            Atividades já cadastradas nesta obra
          </label>
        </div>
        {usaAtividades ? (
          <p className="orcamento-fonte-hint">Usa as atividades já criadas em Visão Geral como etapas — os valores vêm de lá (edite os custos nas próprias atividades).</p>
        ) : (
          <p className="orcamento-fonte-hint">Modelos de etapas e faixas esperadas são gerenciados em Configurações.</p>
        )}
      </div>

      <div className="orcamento-grid">
        <div className="orcamento-card">
          <h3>Etapas Técnicas</h3>
          <div className="scroll-x">
            <table className="orcamento-etapas-table">
              <thead>
                <tr>
                  <th>Etapa</th>
                  {usaAtividades && <th>Material (R$)</th>}
                  {usaAtividades && <th>Mão de obra (R$)</th>}
                  <th>Valor (R$)</th>
                  <th>% Total</th>
                  {!usaAtividades && <th>Faixa Esperada</th>}
                  {!usaAtividades && <th>Indicador</th>}
                  {!usaAtividades && <th></th>}
                </tr>
              </thead>
              <tbody>
                {etapasComIndicador.map((linha) => (
                  <tr key={linha.etapaId ?? linha.atividadeId}>
                    <td>{linha.nome}</td>
                    {usaAtividades && (
                      <td>
                        <input
                          type="text" inputMode="decimal"
                          value={materialDraft[linha.atividadeId!] ?? formatNumberBR(linha.custoMaterial ?? 0)}
                          onChange={(e) => handleMaterialAtividadeChange(linha.atividadeId!, e.target.value)}
                          onFocus={(e) => setMaterialDraft((d) => ({ ...d, [linha.atividadeId!]: d[linha.atividadeId!] ?? e.target.value }))}
                          onBlur={() => commitMaterialAtividade(linha.atividadeId!)}
                        />
                      </td>
                    )}
                    {usaAtividades && (
                      <td>
                        <input
                          type="text" inputMode="decimal"
                          value={maoDeObraDraft[linha.atividadeId!] ?? formatNumberBR(linha.custoMaoDeObra ?? 0)}
                          onChange={(e) => handleMaoDeObraAtividadeChange(linha.atividadeId!, e.target.value)}
                          onFocus={(e) => setMaoDeObraDraft((d) => ({ ...d, [linha.atividadeId!]: d[linha.atividadeId!] ?? e.target.value }))}
                          onBlur={() => commitMaoDeObraAtividade(linha.atividadeId!)}
                        />
                      </td>
                    )}
                    <td>
                      {usaAtividades ? (
                        formatBRL(linha.valor)
                      ) : (
                        <input
                          type="text" inputMode="decimal"
                          value={valorDraft[linha.etapaId!] ?? formatNumberBR(linha.valor)}
                          onChange={(e) => handleValorEtapaChange(linha.etapaId!, e.target.value)}
                          onFocus={(e) => setValorDraft((d) => ({ ...d, [linha.etapaId!]: d[linha.etapaId!] ?? e.target.value }))}
                          onBlur={() => setValorDraft((d) => { const n = { ...d }; delete n[linha.etapaId!]; return n; })}
                        />
                      )}
                    </td>
                    <td>
                      {usaAtividades ? (
                        `${linha.percentualTotal.toFixed(1)}%`
                      ) : (
                        <>
                          <input
                            className="orcamento-pct-input"
                            type="text" inputMode="decimal"
                            value={pctDraft[linha.etapaId!] ?? linha.percentualTotal.toFixed(1).replace('.', ',')}
                            onChange={(e) => handlePctEtapaChange(linha.etapaId!, e.target.value)}
                            onFocus={(e) => setPctDraft((d) => ({ ...d, [linha.etapaId!]: d[linha.etapaId!] ?? e.target.value }))}
                            onBlur={() => setPctDraft((d) => { const n = { ...d }; delete n[linha.etapaId!]; return n; })}
                          />
                          %
                        </>
                      )}
                    </td>
                    {!usaAtividades && <td>{linha.faixa!.min}–{linha.faixa!.max}%</td>}
                    {!usaAtividades && (
                      <td>
                        {linha.dentroFaixa ? (
                          <span className="orcamento-indicador orcamento-indicador--ok"><IconCircleCheck size={14} /> Dentro do esperado</span>
                        ) : (
                          <span className="orcamento-indicador orcamento-indicador--aviso"><IconAlertTriangle size={14} /> Fora da faixa</span>
                        )}
                      </td>
                    )}
                    {!usaAtividades && (
                      <td>
                        <button type="button" className="btn btn-ghost" onClick={() => handleRemoverEtapa(modelo!.etapas.find((e) => e.id === linha.etapaId)!)} aria-label="Excluir etapa">
                          <IconTrash size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {etapasComIndicador.length === 0 && (
                  <tr>
                    <td colSpan={usaAtividades ? 5 : 6} className="config-etapas-table__empty">
                      {usaAtividades ? 'Nenhuma atividade cadastrada nesta obra ainda.' : 'Nenhuma etapa cadastrada neste modelo.'}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total Técnico</td>
                  {usaAtividades && <td>{formatBRL(etapasComIndicador.reduce((s, e) => s + (e.custoMaterial ?? 0), 0))}</td>}
                  {usaAtividades && <td>{formatBRL(etapasComIndicador.reduce((s, e) => s + (e.custoMaoDeObra ?? 0), 0))}</td>}
                  <td>{formatBRL(somaValores)}</td>
                  <td>{somaPercentual.toFixed(1)}%</td>
                  {!usaAtividades && <td></td>}
                  {!usaAtividades && <td></td>}
                  {!usaAtividades && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="orcamento-side">
          {!usaAtividades && (
            <div className="orcamento-card">
              <h3>Observações</h3>
              {todasDentro ? (
                <p className="orcamento-obs orcamento-obs--ok"><IconCircleCheck size={16} /> Distribuição dentro dos parâmetros de referência.</p>
              ) : (
                <p className="orcamento-obs orcamento-obs--aviso">
                  <IconAlertTriangle size={16} /> Fora da faixa: {foraDaFaixa.map((e) => e.nome).join(', ')}
                </p>
              )}
              <p className="orcamento-obs-hint">Faixas são referências. Pequenas variações são normais conforme projeto e acabamento.</p>
            </div>
          )}

          <div className="orcamento-card">
            <button type="button" className="orcamento-ajustes-toggle" onClick={() => setAjustesAbertos((v) => !v)}>
              % Ajustes Comerciais {ajustesAbertos ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </button>
            {ajustesAbertos && (
              <div className="orcamento-ajustes">
                <div className="orcamento-ajustes__linha">
                  <span>Ajuste CCU (%)</span>
                  <input type="text" inputMode="decimal" value={ccuInput} onChange={(e) => setCcuInput(e.target.value)} />
                  <span className="is-success">+{formatBRL(somaValores * (ccuNum / 100))}</span>
                </div>
                <div className="orcamento-ajustes__linha">
                  <span>BDI (%)</span>
                  <input type="text" inputMode="decimal" value={bdiInput} onChange={(e) => setBdiInput(e.target.value)} />
                  <span className="is-success">+{formatBRL(somaValores * (bdiNum / 100))}</span>
                </div>
                <div className="orcamento-ajustes__linha orcamento-ajustes__linha--total">
                  <span>Total Ajustes</span>
                  <span></span>
                  <span className="is-success">+{formatBRL(totalAjustes)}</span>
                </div>
                <div className="orcamento-valor-final">
                  <span>Valor Final Cliente</span>
                  <strong>{formatBRL(valorFinalCliente)}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="orcamento-card">
            <h3>Fechamento</h3>
            <div className="orcamento-fechamento">
              <div><span>Total Técnico</span><span>{formatBRL(somaValores)}</span></div>
              <div><span>Total de Ajustes</span><span>+{formatBRL(totalAjustes)}</span></div>
              <div className="orcamento-fechamento__total"><span>Valor Final ao Cliente</span><strong>{formatBRL(valorFinalCliente)}</strong></div>
            </div>
          </div>

          <button type="button" className="btn btn-primary orcamento-salvar-btn" onClick={handleSalvar}>
            Salvar e sincronizar cronograma
          </button>
          {salvo && <p className="orcamento-salvo-msg">Orçamento salvo e etapas sincronizadas na Visão Geral.</p>}
        </div>
      </div>
    </div>
  );
}
