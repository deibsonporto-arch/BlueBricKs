import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconCamera, IconChevronDown, IconChevronUp, IconDownload, IconPlus, IconPrinter, IconTrash } from '@tabler/icons-react';
import { useAtividades } from '../../hooks/useAtividades';
import { useDiarioEntries } from '../../hooks/useDiarioEntries';
import { useObras } from '../../hooks/useObras';
import { useEmpresaConfig } from '../../hooks/useEmpresaConfig';
import { useFornecedores } from '../../hooks/useFornecedores';
import { useEquipes } from '../../hooks/useEquipes';
import { useEmpreitadas } from '../../hooks/useEmpreitadas';
import { Modal } from '../../components/common/Modal';
import { EquipesListModal } from '../../components/diario/EquipesListModal';
import type { DiarioEmpreitadoRow, DiarioEntry, DiarioFoto, DiarioRegistro, Fornecedor, StatusAtividade } from '../../types/domain';
import { generateId } from '../../utils/id';
import { formatDate, monthKey, monthLabel, todayISO } from '../../utils/dateUtils';
import { formatBRL } from '../../utils/currency';
import { compressImageToDataUrl } from '../../utils/imageCompression';
import { downloadAnexo, deleteBlob, loadAnexoDataUrl, storeAnexo } from '../../utils/attachmentStore';
import { ResolvedImage } from '../../components/common/ResolvedImage';
import { custoMaoDeObraDoDia, entriesNoPeriodo, quinzenaFim, resumirPeriodo, resumirPorTrabalhador } from '../../utils/diarioRelatorio';
import { calcularMedicao, usaCobrancaPorUnidade } from '../../utils/empreitada';
import './DiarioDeObraTab.css';

const MAX_FOTOS_POR_DIA = 6;

const STATUS_OPTIONS: { value: StatusAtividade; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluida', label: 'Concluída' },
];

interface ColaboradorExtraRow {
  id: string;
  funcao: string;
  quantidade: number;
  valorDiaria: number;
}

interface MaoDeObraRow {
  id: string;
  nome: string;
  funcao: string;
  valorDiaria: number;
}

const FUNCAO_OPTIONS = ['Mestre de obra', 'Pedreiro', 'Ajudante', 'Carpinteiro', 'Eletricista', 'Encanador'];

function NomeColaboradorInput({
  fornecedores,
  value,
  onChange,
}: {
  fornecedores: Fornecedor[];
  value: string;
  onChange: (nome: string) => void;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const sugestoes = useMemo(() => {
    if (!value.trim()) return [];
    const q = value.trim().toLowerCase();
    const nomes = new Set<string>();
    for (const f of fornecedores) {
      if (f.nome.toLowerCase().includes(q) && f.nome.toLowerCase() !== q) nomes.add(f.nome);
    }
    return Array.from(nomes).slice(0, 8);
  }, [fornecedores, value]);

  return (
    <div className="diario-nome-combobox">
      <input
        placeholder="Nome"
        value={value}
        onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
      />
      {showSuggestions && sugestoes.length > 0 && (
        <ul className="diario-nome-combobox__suggestions">
          {sugestoes.map((nome) => (
            <li key={nome}>
              <button type="button" onMouseDown={() => { onChange(nome); setShowSuggestions(false); }}>{nome}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function emptyForm(data: string): {
  etapaAtual: string;
  mestreDeObra: string;
  atividadesExecutadas: string;
  observacoes: string;
  pedreiros: number;
  serventes: number;
  carpinteiros: number;
  valorDiariaMestre: number;
  valorDiariaPedreiro: number;
  valorDiariaServente: number;
  valorDiariaCarpinteiro: number;
  marmitasQuantidade: number;
  marmitasValorUnitario: number;
  colaboradoresExtra: ColaboradorExtraRow[];
  maoDeObra: MaoDeObraRow[];
  empreitados: DiarioEmpreitadoRow[];
  registros: DiarioRegistro[];
  fotos: DiarioFoto[];
  data: string;
} {
  return {
    etapaAtual: '', mestreDeObra: '', atividadesExecutadas: '', observacoes: '',
    pedreiros: 0, serventes: 0, carpinteiros: 0,
    valorDiariaMestre: 0, valorDiariaPedreiro: 0, valorDiariaServente: 0, valorDiariaCarpinteiro: 0,
    marmitasQuantidade: 0, marmitasValorUnitario: 0,
    colaboradoresExtra: [], maoDeObra: [], empreitados: [], registros: [], fotos: [], data,
  };
}

function equipeResumo(e: DiarioEntry): string {
  const partes = [
    ...(e.maoDeObra ?? []).map((m) => (m.nome && m.funcao ? `${m.nome} (${m.funcao})` : m.nome || m.funcao)),
    e.mestreDeObra ? '1 mestre de obras' : null,
    e.pedreiros ? `${e.pedreiros} pedreiro(s)` : null,
    e.serventes ? `${e.serventes} servente(s)` : null,
    e.carpinteiros ? `${e.carpinteiros} carpinteiro(s)` : null,
    ...(e.colaboradoresExtra ?? []).filter((c) => c.quantidade > 0).map((c) => `${c.quantidade} ${c.funcao}`),
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(', ') : 'Não informado';
}

export function DiarioDeObraTab() {
  const { id } = useParams<{ id: string }>();
  const obraId = id!;
  const { obras } = useObras();
  const obra = obras.find((o) => o.id === obraId);
  const { atividades } = useAtividades(obraId);
  const { entries, getByData, saveEntry, deleteEntry } = useDiarioEntries(obraId);
  const { nomeEmpresa } = useEmpresaConfig();
  const { fornecedores } = useFornecedores();
  const { equipes } = useEquipes();
  const { empreitadas, registrarMedicoes, atualizarMedicao } = useEmpreitadas(obraId);

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [form, setForm] = useState(() => emptyForm(todayISO()));
  const [expandedObs, setExpandedObs] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState<DiarioFoto | null>(null);
  const [fotoErro, setFotoErro] = useState('');
  const [customFuncaoRows, setCustomFuncaoRows] = useState<Set<string>>(new Set());
  const [equipesModalOpen, setEquipesModalOpen] = useState(false);

  const [relatorioTipo, setRelatorioTipo] = useState<'completo' | 'resumo'>('completo');
  const [relatorioEscopo, setRelatorioEscopo] = useState<'tudo' | 'mao_de_obra' | 'marmitas'>('tudo');
  const [relatorioInicio, setRelatorioInicio] = useState(todayISO());
  const [relatorioFim, setRelatorioFim] = useState(todayISO());
  const [relatorioAtivo, setRelatorioAtivo] = useState<{ tipo: 'completo' | 'resumo'; escopo: 'tudo' | 'mao_de_obra' | 'marmitas'; inicio: string; fim: string; entries: DiarioEntry[] } | null>(null);
  const [fotosResolvidas, setFotosResolvidas] = useState<Record<string, string>>({});
  const [resolvendoRelatorio, setResolvendoRelatorio] = useState(false);

  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => new Set([monthKey(todayISO())]));

  const etapas = useMemo(() => Array.from(new Set(atividades.map((a) => a.etapa))), [atividades]);

  const entriesPorMes = useMemo(() => {
    const groups: { key: string; label: string; entries: DiarioEntry[] }[] = [];
    const indexByKey = new Map<string, number>();
    for (const e of entries) {
      const key = monthKey(e.data);
      if (!indexByKey.has(key)) {
        indexByKey.set(key, groups.length);
        groups.push({ key, label: monthLabel(e.data), entries: [] });
      }
      groups[indexByKey.get(key)!].entries.push(e);
    }
    return groups;
  }, [entries]);

  function toggleMonth(key: string) {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleDeleteEntry(entry: DiarioEntry) {
    if (!confirm(`Excluir o diário de ${formatDate(entry.data)}? Essa ação não pode ser desfeita.`)) return;
    deleteEntry(entry.id).then(() => {
      if (entry.data === selectedDate) setForm(emptyForm(selectedDate));
    });
  }

  const latestRef = useRef({ form, selectedDate, getByData });
  useEffect(() => {
    latestRef.current = { form, selectedDate, getByData };
  });

  useEffect(() => {
    const existing = getByData(selectedDate);
    if (existing) {
      setForm({
        etapaAtual: existing.etapaAtual,
        mestreDeObra: existing.mestreDeObra,
        atividadesExecutadas: existing.atividadesExecutadas,
        observacoes: existing.observacoes ?? '',
        pedreiros: existing.pedreiros,
        serventes: existing.serventes,
        carpinteiros: existing.carpinteiros,
        valorDiariaMestre: existing.valorDiariaMestre ?? 0,
        valorDiariaPedreiro: existing.valorDiariaPedreiro ?? 0,
        valorDiariaServente: existing.valorDiariaServente ?? 0,
        valorDiariaCarpinteiro: existing.valorDiariaCarpinteiro ?? 0,
        marmitasQuantidade: existing.marmitasQuantidade ?? 0,
        marmitasValorUnitario: existing.marmitasValorUnitario ?? 0,
        colaboradoresExtra: existing.colaboradoresExtra ?? [],
        maoDeObra: existing.maoDeObra ?? [],
        empreitados: existing.empreitados,
        registros: existing.registros,
        fotos: existing.fotos,
        data: existing.data,
      });
    } else {
      setForm(emptyForm(selectedDate));
    }
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Mantém o período do relatório acompanhando a data que está sendo preenchida, para não gerar um relatório
  // "vazio" só porque o usuário esqueceu de ajustar o período depois de trocar o dia do registro.
  useEffect(() => {
    setRelatorioInicio(selectedDate);
    setRelatorioFim(selectedDate);
  }, [selectedDate]);

  function update<K extends keyof ReturnType<typeof emptyForm>>(key: K, value: ReturnType<typeof emptyForm>[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const totalColaboradores =
    (form.mestreDeObra.trim() ? 1 : 0) +
    form.pedreiros + form.serventes + form.carpinteiros +
    form.colaboradoresExtra.reduce((s, c) => s + c.quantidade, 0) +
    form.empreitados.reduce((s, e) => s + e.quantidade, 0) +
    form.maoDeObra.length;

  const custoMaoDeObraDia =
    (form.mestreDeObra.trim() ? form.valorDiariaMestre : 0) +
    form.pedreiros * form.valorDiariaPedreiro +
    form.serventes * form.valorDiariaServente +
    form.carpinteiros * form.valorDiariaCarpinteiro +
    form.colaboradoresExtra.reduce((s, c) => s + c.quantidade * c.valorDiaria, 0) +
    form.maoDeObra.reduce((s, m) => s + m.valorDiaria, 0);

  const custoMarmitasDia = form.marmitasQuantidade * form.marmitasValorUnitario;

  function buildEntry(fotos: DiarioFoto[]): DiarioEntry {
    const { form: f, selectedDate: data, getByData: lookup } = latestRef.current;
    const now = new Date().toISOString();
    const existing = lookup(data);
    return {
      id: existing?.id ?? generateId(),
      obraId,
      data,
      etapaAtual: f.etapaAtual,
      mestreDeObra: f.mestreDeObra,
      atividadesExecutadas: f.atividadesExecutadas,
      observacoes: f.observacoes || undefined,
      pedreiros: f.pedreiros,
      serventes: f.serventes,
      carpinteiros: f.carpinteiros,
      valorDiariaMestre: f.valorDiariaMestre,
      valorDiariaPedreiro: f.valorDiariaPedreiro,
      valorDiariaServente: f.valorDiariaServente,
      valorDiariaCarpinteiro: f.valorDiariaCarpinteiro,
      marmitasQuantidade: f.marmitasQuantidade,
      marmitasValorUnitario: f.marmitasValorUnitario,
      colaboradoresExtra: f.colaboradoresExtra,
      maoDeObra: f.maoDeObra,
      empreitados: f.empreitados,
      registros: f.registros,
      fotos,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    e.target.value = '';
    setFotoErro('');

    const vagas = MAX_FOTOS_POR_DIA - latestRef.current.form.fotos.length;
    if (vagas <= 0) {
      setFotoErro(`Máximo de ${MAX_FOTOS_POR_DIA} fotos por dia atingido. Remova uma foto para adicionar outra.`);
      return;
    }
    const aceitas = fileList.slice(0, vagas);
    if (fileList.length > aceitas.length) {
      setFotoErro(`Só é possível anexar até ${MAX_FOTOS_POR_DIA} fotos por dia — ${fileList.length - aceitas.length} foto(s) não foram adicionadas.`);
    }

    Promise.all(
      aceitas.map((file) =>
        compressImageToDataUrl(file)
          .then((dataUrl) => ({ id: generateId(), nome: file.name, dataUrl }) as DiarioFoto)
          .then(storeAnexo),
      ),
    )
      .then((novasFotos) => persistFotos([...latestRef.current.form.fotos, ...novasFotos]))
      .catch((err) => {
        console.error('Erro ao processar fotos do diário:', err);
        setFotoErro('Não foi possível processar uma das fotos. Tente novamente com uma foto por vez.');
      });
  }

  function removePhoto(fid: string) {
    deleteBlob(fid).catch((err) => console.error('Erro ao remover anexo do armazenamento:', err));
    persistFotos(form.fotos.filter((p) => p.id !== fid));
  }

  function persistFotos(novasFotos: DiarioFoto[]) {
    setForm((f) => ({ ...f, fotos: novasFotos }));
    saveEntry(buildEntry(novasFotos)).catch((err) => {
      console.error('Erro ao salvar fotos do diário:', err);
      setFotoErro('Não foi possível salvar as fotos — o armazenamento local do navegador está cheio. Remova fotos antigas de outros dias ou fotos deste dia e tente novamente.');
    });
  }

  function toggleObs(registroId: string) {
    setExpandedObs((prev) => {
      const next = new Set(prev);
      if (next.has(registroId)) next.delete(registroId);
      else next.add(registroId);
      return next;
    });
  }

  function addRegistro() {
    update('registros', [
      ...form.registros,
      { id: generateId(), responsavel: '', servicoExecutado: '', status: 'em_andamento' as StatusAtividade, observacoes: '' },
    ]);
  }

  function updateRegistro(id: string, patch: Partial<DiarioRegistro>) {
    update('registros', form.registros.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRegistro(id: string) {
    update('registros', form.registros.filter((r) => r.id !== id));
  }

  function addMaoDeObra() {
    update('maoDeObra', [...form.maoDeObra, { id: generateId(), nome: '', funcao: '', valorDiaria: 0 }]);
  }

  function aplicarEquipe(equipeId: string) {
    const equipe = equipes.find((eq) => eq.id === equipeId);
    if (!equipe) return;
    const novasLinhas = equipe.membros.map((m) => ({ id: generateId(), nome: m.nome, funcao: m.funcao, valorDiaria: m.valorDiaria }));
    update('maoDeObra', [...form.maoDeObra, ...novasLinhas]);
  }

  function updateMaoDeObra(id: string, patch: Partial<MaoDeObraRow>) {
    update('maoDeObra', form.maoDeObra.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function removeMaoDeObra(id: string) {
    update('maoDeObra', form.maoDeObra.filter((m) => m.id !== id));
    setCustomFuncaoRows((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }

  function handleFuncaoSelect(id: string, v: string) {
    if (v === 'Outro') {
      setCustomFuncaoRows((prev) => new Set(prev).add(id));
      updateMaoDeObra(id, { funcao: '' });
    } else {
      setCustomFuncaoRows((prev) => { const n = new Set(prev); n.delete(id); return n; });
      updateMaoDeObra(id, { funcao: v });
    }
  }

  function addEmpreitado() {
    update('empreitados', [...form.empreitados, { id: generateId(), descricao: '', quantidade: 1 }]);
  }

  function updateEmpreitado(id: string, patch: Partial<DiarioEmpreitadoRow>) {
    update('empreitados', form.empreitados.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function removeEmpreitado(id: string) {
    update('empreitados', form.empreitados.filter((e) => e.id !== id));
  }

  async function handleSave() {
    try {
      const empreitadosProcessados = [...form.empreitados];
      // Agrupa por empreitada: todas as etapas novas medidas neste mesmo dia (mesma visita)
      // viram uma única medição (mesmo nº de sequência), em vez de uma sequência por etapa.
      const novasPorEmpreitada = new Map<
        string,
        { index: number; dados: { data: string; itemId?: string; descricaoServico: string; percentualExecutado: number; quantidadeExecutada?: number; valor: number } }[]
      >();

      for (let index = 0; index < form.empreitados.length; index++) {
        const row = form.empreitados[index];
        if (!row.empreitadaId || (row.percentualExecutado == null && row.quantidadeExecutada == null)) continue;
        const alvo = empreitadas.find((e) => e.id === row.empreitadaId);
        if (!alvo) continue;
        const item = row.itemId ? alvo.itens.find((i) => i.id === row.itemId) : undefined;
        const base = item
          ? { valor: item.valor, quantidade: item.quantidade, valorUnitario: item.valorUnitario }
          : { valor: alvo.valorContrato, quantidade: alvo.quantidadeContratada, valorUnitario: alvo.valorUnitario };
        const { percentualExecutado, valor, quantidadeExecutada } = calcularMedicao(base, {
          percentualExecutado: row.percentualExecutado,
          quantidadeExecutada: row.quantidadeExecutada,
        });
        const descricaoServico = item?.nome ?? alvo.servico;

        if (row.medicaoId) {
          await atualizarMedicao(row.empreitadaId, row.medicaoId, { percentualExecutado, quantidadeExecutada, valor, itemId: row.itemId, descricaoServico, data: selectedDate });
          continue;
        }

        const dados = { data: selectedDate, itemId: row.itemId, descricaoServico, percentualExecutado, quantidadeExecutada, valor };
        const lista = novasPorEmpreitada.get(row.empreitadaId) ?? [];
        lista.push({ index, dados });
        novasPorEmpreitada.set(row.empreitadaId, lista);
      }

      for (const [empreitadaId, itens] of novasPorEmpreitada) {
        const novasMedicoes = await registrarMedicoes(empreitadaId, itens.map((i) => i.dados));
        itens.forEach(({ index }, i) => {
          empreitadosProcessados[index] = { ...empreitadosProcessados[index], medicaoId: novasMedicoes[i].id };
        });
      }

      const formAtualizado = { ...form, empreitados: empreitadosProcessados };
      setForm(formAtualizado);
      latestRef.current = { ...latestRef.current, form: formAtualizado };

      await saveEntry(buildEntry(form.fotos));
      setSaved(true);
      setFotoErro('');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Erro ao salvar diário:', err);
      setFotoErro('Não foi possível salvar — o armazenamento local do navegador está cheio. Remova fotos antigas para liberar espaço.');
    }
  }

  async function handleGerarRelatorio() {
    const filtradas = entriesNoPeriodo(entries, relatorioInicio, relatorioFim);
    let mapa: Record<string, string> = {};

    if (relatorioTipo === 'completo') {
      setResolvendoRelatorio(true);
      const pares = await Promise.all(
        filtradas.flatMap((e) => e.fotos.map((f) => loadAnexoDataUrl(f).then((url) => [f.id, url] as const))),
      );
      mapa = Object.fromEntries(pares);
    }

    setResolvendoRelatorio(false);
    setFotosResolvidas(mapa);
    setRelatorioAtivo({ tipo: relatorioTipo, escopo: relatorioEscopo, inicio: relatorioInicio, fim: relatorioFim, entries: filtradas });
    requestAnimationFrame(() => window.print());
  }

  if (!obra) return null;

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="diario-layout">
        <div className="diario-form-card">
          <div className="form-field" style={{ marginBottom: 16, maxWidth: 220 }}>
            <label>Data do registro</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>Etapa atual</label>
              <select value={form.etapaAtual} onChange={(e) => update('etapaAtual', e.target.value)}>
                <option value="">Selecione</option>
                {etapas.map((et) => (
                  <option key={et} value={et}>{et}</option>
                ))}
              </select>
            </div>

            <div className="form-field form-field--full">
              <label>Atividades executadas no dia</label>
              <textarea value={form.atividadesExecutadas} onChange={(e) => update('atividadesExecutadas', e.target.value)} />
            </div>

            <div className="form-field form-field--full">
              <label>Colaboradores</label>

              <div className="diario-maodeobra">
                <div className="diario-maodeobra__header">
                  <span>Mão de obra</span>
                  <div className="diario-maodeobra__header-actions">
                    <select value="" onChange={(e) => { if (e.target.value) aplicarEquipe(e.target.value); e.target.value = ''; }}>
                      <option value="">Aplicar equipe...</option>
                      {equipes.map((eq) => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
                    </select>
                    <button type="button" className="btn btn-ghost" onClick={() => setEquipesModalOpen(true)}>
                      Gerenciar equipes
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={addMaoDeObra}>
                      <IconPlus size={14} /> Adicionar colaborador
                    </button>
                  </div>
                </div>
                {form.maoDeObra.length === 0 && (
                  <p className="diario-maodeobra__empty">Nenhum colaborador adicionado neste dia.</p>
                )}
                {form.maoDeObra.map((m) => {
                  const showCustomFuncao = customFuncaoRows.has(m.id) || (m.funcao !== '' && !FUNCAO_OPTIONS.includes(m.funcao));
                  return (
                    <div className="diario-maodeobra__row" key={m.id}>
                      <NomeColaboradorInput
                        fornecedores={fornecedores}
                        value={m.nome}
                        onChange={(nome) => updateMaoDeObra(m.id, { nome })}
                      />
                      {showCustomFuncao ? (
                        <input
                          placeholder="Função"
                          value={m.funcao}
                          onChange={(e) => updateMaoDeObra(m.id, { funcao: e.target.value })}
                          style={{ width: 150 }}
                        />
                      ) : (
                        <select value={m.funcao} onChange={(e) => handleFuncaoSelect(m.id, e.target.value)} style={{ width: 150 }}>
                          <option value="">Função</option>
                          {FUNCAO_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                          <option value="Outro">Outro...</option>
                        </select>
                      )}
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Valor diária (R$)"
                        value={m.valorDiaria}
                        onChange={(e) => updateMaoDeObra(m.id, { valorDiaria: Number(e.target.value) })}
                        style={{ width: 130 }}
                      />
                      <button type="button" className="btn btn-ghost" onClick={() => removeMaoDeObra(m.id)} aria-label="Remover colaborador">
                        <IconTrash size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="diario-empreitados">
                <div className="diario-empreitados__header">
                  <span>Empreitados</span>
                  <button type="button" className="btn btn-ghost" onClick={addEmpreitado}>
                    <IconPlus size={14} /> Adicionar
                  </button>
                </div>
                {form.empreitados.map((emp) => {
                  const empreitadaSelecionada = emp.empreitadaId ? empreitadas.find((e) => e.id === emp.empreitadaId) : undefined;
                  return (
                    <div className="diario-empreitados__row" key={emp.id}>
                      <select
                        value={emp.empreitadaId ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) {
                            updateEmpreitado(emp.id, { empreitadaId: undefined, itemId: undefined, percentualExecutado: undefined, medicaoId: undefined });
                          } else {
                            const alvo = empreitadas.find((x) => x.id === val);
                            updateEmpreitado(emp.id, { empreitadaId: val, descricao: alvo?.servico ?? '', itemId: undefined, percentualExecutado: undefined, medicaoId: undefined });
                          }
                        }}
                      >
                        <option value="">Texto livre</option>
                        {empreitadas.map((e2) => (
                          <option key={e2.id} value={e2.id}>
                            {fornecedores.find((f) => f.id === e2.fornecedorId)?.nome ?? 'Sem fornecedor'} — {e2.servico}
                          </option>
                        ))}
                      </select>

                      {empreitadaSelecionada ? (
                        <>
                          {empreitadaSelecionada.itens.length > 0 && (
                            <select
                              value={emp.itemId ?? ''}
                              onChange={(e) => updateEmpreitado(emp.id, { itemId: e.target.value || undefined, percentualExecutado: undefined, quantidadeExecutada: undefined })}
                            >
                              <option value="">Etapa</option>
                              {empreitadaSelecionada.itens.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
                            </select>
                          )}
                          {(() => {
                            const itemDaLinha = emp.itemId ? empreitadaSelecionada.itens.find((i) => i.id === emp.itemId) : undefined;
                            const baseLinha = itemDaLinha
                              ? { valor: itemDaLinha.valor, quantidade: itemDaLinha.quantidade, valorUnitario: itemDaLinha.valorUnitario }
                              : { valor: empreitadaSelecionada.valorContrato, quantidade: empreitadaSelecionada.quantidadeContratada, valorUnitario: empreitadaSelecionada.valorUnitario };
                            const unidadeLinha = itemDaLinha?.unidade ?? empreitadaSelecionada.unidadeContratada;
                            return usaCobrancaPorUnidade(baseLinha) ? (
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder={`Qtd. executada (${unidadeLinha})`}
                                value={emp.quantidadeExecutada ?? ''}
                                onChange={(e) => updateEmpreitado(emp.id, { quantidadeExecutada: e.target.value === '' ? undefined : Number(e.target.value) })}
                                style={{ width: 150 }}
                              />
                            ) : (
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.1"
                                placeholder="% medido no dia"
                                value={emp.percentualExecutado ?? ''}
                                onChange={(e) => updateEmpreitado(emp.id, { percentualExecutado: e.target.value === '' ? undefined : Number(e.target.value) })}
                                style={{ width: 130 }}
                              />
                            );
                          })()}
                        </>
                      ) : (
                        <>
                          <input placeholder="Serviço (ex: instalação de piso)" value={emp.descricao} onChange={(e) => updateEmpreitado(emp.id, { descricao: e.target.value })} />
                          <input type="number" min={0} placeholder="Qtd" value={emp.quantidade} onChange={(e) => updateEmpreitado(emp.id, { quantidade: Number(e.target.value) })} style={{ width: 70 }} />
                        </>
                      )}

                      <button type="button" className="btn btn-ghost" onClick={() => removeEmpreitado(emp.id)} aria-label="Remover">
                        <IconTrash size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="diario-total-colaboradores">Total de colaboradores no dia: <strong>{totalColaboradores}</strong></div>
              <div className="diario-total-colaboradores">Custo com diárias no dia: <strong>{formatBRL(custoMaoDeObraDia)}</strong></div>
            </div>

            <div className="form-field form-field--full">
              <label>Marmitas</label>
              <div className="diario-marmitas-row">
                <div>
                  <label>Quantidade de marmitas</label>
                  <input type="number" min={0} value={form.marmitasQuantidade} onChange={(e) => update('marmitasQuantidade', Number(e.target.value))} />
                </div>
                <div>
                  <label>Valor unitário (R$)</label>
                  <input type="number" min={0} step="0.01" value={form.marmitasValorUnitario} onChange={(e) => update('marmitasValorUnitario', Number(e.target.value))} />
                </div>
                <div className="diario-marmitas-row__total">Total: <strong>{formatBRL(custoMarmitasDia)}</strong></div>
              </div>
            </div>

            <div className="form-field form-field--full">
              <label>Detalhamento por responsável / empreiteiro</label>
              {form.registros.map((r) => (
                <div className="diario-registro-row" key={r.id}>
                  <div className="diario-registro-row__main">
                    <input placeholder="Responsável/Empreiteiro" value={r.responsavel} onChange={(e) => updateRegistro(r.id, { responsavel: e.target.value })} />
                    <input placeholder="Serviço executado" value={r.servicoExecutado} onChange={(e) => updateRegistro(r.id, { servicoExecutado: e.target.value })} />
                    <select value={r.status} onChange={(e) => updateRegistro(r.id, { status: e.target.value as StatusAtividade })}>
                      {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <button type="button" className="btn btn-ghost" onClick={() => toggleObs(r.id)}>
                      {expandedObs.has(r.id) ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />} Observação
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => removeRegistro(r.id)} aria-label="Remover registro">
                      <IconTrash size={14} />
                    </button>
                  </div>
                  {expandedObs.has(r.id) && (
                    <textarea
                      className="diario-registro-row__obs"
                      placeholder="Observação sobre esse registro..."
                      value={r.observacoes ?? ''}
                      onChange={(e) => updateRegistro(r.id, { observacoes: e.target.value })}
                    />
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-secondary" onClick={addRegistro} style={{ marginTop: 8 }}>
                <IconPlus size={14} /> Adicionar registro
              </button>
            </div>

            <div className="form-field form-field--full">
              <label>Observações / ocorrências gerais</label>
              <textarea value={form.observacoes} onChange={(e) => update('observacoes', e.target.value)} />
            </div>

            <div className="form-field form-field--full">
              <label>Fotos <span className="diario-fotos-contador">({form.fotos.length}/{MAX_FOTOS_POR_DIA})</span></label>
              <label className="btn btn-secondary diario-photo-btn">
                <IconCamera size={16} /> Tirar foto / Anexar imagem
                <input type="file" accept="image/*" capture="environment" multiple onChange={handlePhotoChange} hidden />
              </label>
              {fotoErro && <p className="diario-foto-erro">{fotoErro}</p>}
              {form.fotos.length > 0 && (
                <div className="diario-fotos-grid">
                  {form.fotos.map((f) => (
                    <div className="diario-foto-thumb" key={f.id}>
                      <ResolvedImage item={f} onClick={() => setFotoAmpliada(f)} title="Clique para ampliar" />
                      <button type="button" onClick={() => removePhoto(f.id)} aria-label="Remover foto">
                        <IconTrash size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button type="button" className="btn btn-primary" onClick={handleSave} style={{ marginTop: 16 }}>
            {saved ? 'Salvo!' : 'Salvar diário'}
          </button>
        </div>

        <div className="diario-history-card">
          <h3>Histórico</h3>
          {entries.length === 0 ? (
            <p className="diario-history-empty">Nenhum diário registrado ainda.</p>
          ) : (
            <div className="diario-history-months">
              {entriesPorMes.map((grupo) => {
                const isExpanded = expandedMonths.has(grupo.key);
                return (
                  <div className="diario-history-month" key={grupo.key}>
                    <button type="button" className="diario-history-month__header" onClick={() => toggleMonth(grupo.key)}>
                      {isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                      <span>{grupo.label}</span>
                      <span className="diario-history-month__count">{grupo.entries.length}</span>
                    </button>
                    {isExpanded && (
                      <ul className="diario-history-list">
                        {grupo.entries.map((e) => (
                          <li key={e.id} className="diario-history-list__item">
                            <button type="button" className={e.data === selectedDate ? 'is-active' : ''} onClick={() => setSelectedDate(e.data)}>
                              {formatDate(e.data)}
                              <span>{e.etapaAtual || 'Sem etapa'}</span>
                            </button>
                            <button
                              type="button"
                              className="diario-history-list__delete"
                              onClick={() => handleDeleteEntry(e)}
                              aria-label={`Excluir diário de ${formatDate(e.data)}`}
                              title="Excluir diário deste dia"
                            >
                              <IconTrash size={14} />
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
        </div>
      </div>

      <div className="diario-relatorio-card">
        <h3>Imprimir relatório</h3>
        <p className="diario-relatorio-card__hint">
          Escolha um período (independente da data do registro acima) para gerar um relatório para impressão.
        </p>
        <div className="diario-relatorio-row">
          <label>
            Tipo de relatório
            <select value={relatorioTipo} onChange={(e) => setRelatorioTipo(e.target.value as 'completo' | 'resumo')}>
              <option value="completo">Completo (dia a dia, com fotos)</option>
              <option value="resumo">Resumo do período (quantitativo)</option>
            </select>
          </label>
          <label>
            Escopo de custos
            <select value={relatorioEscopo} onChange={(e) => setRelatorioEscopo(e.target.value as 'tudo' | 'mao_de_obra' | 'marmitas')}>
              <option value="tudo">Total (mão de obra + marmitas)</option>
              <option value="mao_de_obra">Apenas mão de obra</option>
              <option value="marmitas">Apenas marmitas</option>
            </select>
          </label>
          <label>
            Início do período
            <input type="date" value={relatorioInicio} onChange={(e) => setRelatorioInicio(e.target.value)} />
          </label>
          <label>
            Fim do período
            <input type="date" value={relatorioFim} onChange={(e) => setRelatorioFim(e.target.value)} />
          </label>
          <button type="button" className="btn btn-ghost" onClick={() => setRelatorioFim(quinzenaFim(relatorioInicio))}>
            Quinzena (15 dias) a partir do início
          </button>
          <button type="button" className="btn btn-primary" onClick={handleGerarRelatorio} disabled={resolvendoRelatorio}>
            <IconPrinter size={16} /> {resolvendoRelatorio ? 'Preparando fotos...' : 'Gerar e imprimir'}
          </button>
        </div>
      </div>

      <Modal
        open={!!fotoAmpliada}
        title={fotoAmpliada?.nome ?? 'Foto'}
        onClose={() => setFotoAmpliada(null)}
        width={800}
        footer={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fotoAmpliada && downloadAnexo(fotoAmpliada)}
          >
            <IconDownload size={16} /> Baixar
          </button>
        }
      >
        {fotoAmpliada && <ResolvedImage item={fotoAmpliada} className="diario-foto-ampliada" />}
      </Modal>

      <EquipesListModal open={equipesModalOpen} onClose={() => setEquipesModalOpen(false)} />

      {relatorioAtivo && (
        <div className="diario-print-view">
          <div className="diario-print-header">
            <div className="diario-print-header__empresa">{nomeEmpresa || 'Nome da empresa'}</div>
            <h2>{relatorioAtivo.tipo === 'completo' ? 'Relatório dia a dia da obra' : 'Resumo do período'}</h2>
            <div className="diario-print-header__grid">
              <span><strong>Obra:</strong> {obra.nome}</span>
              <span><strong>Engenheiro responsável:</strong> {obra.responsavelTecnico}</span>
              <span><strong>Período:</strong> {formatDate(relatorioAtivo.inicio)} – {formatDate(relatorioAtivo.fim)}</span>
              {relatorioAtivo.escopo !== 'tudo' && (
                <span><strong>Escopo:</strong> {relatorioAtivo.escopo === 'mao_de_obra' ? 'Apenas mão de obra' : 'Apenas marmitas'}</span>
              )}
            </div>
          </div>

          {relatorioAtivo.tipo === 'completo' ? (
            relatorioAtivo.entries.length === 0 ? (
              <p>Nenhum registro no período selecionado.</p>
            ) : (
              relatorioAtivo.entries.map((e) => (
                <div className="diario-print-dia" key={e.id}>
                  <div className="diario-print-dia__header">
                    <strong>{formatDate(e.data)}</strong>
                    {e.mestreDeObra && <span>{e.mestreDeObra}</span>}
                  </div>
                  {e.etapaAtual && <p className="diario-print-dia__etapa">Etapa: {e.etapaAtual}</p>}
                  <p className="diario-print-dia__atividades-titulo">Atividades executadas no dia</p>
                  <p>{e.atividadesExecutadas || 'Sem descrição de atividades.'}</p>
                  <p className="diario-print-dia__equipe">Equipe: {equipeResumo(e)}</p>
                  {e.empreitados.filter((emp) => emp.quantidade > 0 || emp.descricao).length > 0 && (
                    <div className="diario-print-dia__empreitada">
                      <p className="diario-print-dia__empreitada-titulo">Empreitada(s)</p>
                      {e.empreitados.filter((emp) => emp.quantidade > 0 || emp.descricao).map((emp) => (
                        <p key={emp.id} className="diario-print-dia__empreitada-item">
                          {emp.descricao}
                          {emp.percentualExecutado != null && ` — ${emp.percentualExecutado}% executado no dia`}
                          {emp.quantidadeExecutada != null && ` (${emp.quantidadeExecutada})`}
                        </p>
                      ))}
                    </div>
                  )}
                  {relatorioAtivo.escopo !== 'marmitas' && custoMaoDeObraDoDia(e) > 0 && (
                    <p className="diario-print-dia__maodeobra">
                      Custo com mão de obra: {formatBRL(custoMaoDeObraDoDia(e))}
                    </p>
                  )}
                  {relatorioAtivo.escopo !== 'mao_de_obra' && (e.marmitasQuantidade ?? 0) > 0 && (
                    <p className="diario-print-dia__marmitas">
                      Marmitas: {e.marmitasQuantidade} × {formatBRL(e.marmitasValorUnitario ?? 0)} = {formatBRL((e.marmitasQuantidade ?? 0) * (e.marmitasValorUnitario ?? 0))}
                    </p>
                  )}
                  {e.observacoes && <p className="diario-print-dia__obs"><em>Observações: {e.observacoes}</em></p>}
                  {e.fotos.length > 0 && (
                    <div className="diario-print-fotos">
                      {e.fotos.map((f) => (
                        <img key={f.id} src={fotosResolvidas[f.id] ?? f.dataUrl} alt={f.nome} />
                      ))}
                    </div>
                  )}
                </div>
              ))
            )
          ) : (
            (() => {
              const r = resumirPeriodo(relatorioAtivo.entries);
              const trabalhadores = resumirPorTrabalhador(relatorioAtivo.entries);
              const totalGeralTrabalhadores = trabalhadores.reduce((s, t) => s + t.total, 0);
              const totalGeralDiarias = trabalhadores.reduce((s, t) => s + t.qtdDiarias, 0);
              const mostrarMaoDeObra = relatorioAtivo.escopo !== 'marmitas';
              const mostrarMarmitas = relatorioAtivo.escopo !== 'mao_de_obra';
              return (
                <>
                  {mostrarMaoDeObra && trabalhadores.length > 0 && (
                    <>
                      <h3 className="diario-print-secao-titulo">Controle de diárias por colaborador</h3>
                      <table className="diario-print-trabalhadores-table">
                        <thead>
                          <tr>
                            <th>Prestador</th>
                            <th>Função</th>
                            <th className="col-num">Diária (R$)</th>
                            <th className="col-num">Qtd. diárias</th>
                            <th className="col-num">Total (R$)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trabalhadores.map((t) => (
                            <tr key={`${t.nome}-${t.funcao}`}>
                              <td>{t.nome}</td>
                              <td>{t.funcao}</td>
                              <td className="col-num">{formatBRL(t.valorDiariaMedia)}</td>
                              <td className="col-num">{t.qtdDiarias}</td>
                              <td className="col-num">{formatBRL(t.total)}</td>
                            </tr>
                          ))}
                          <tr className="is-total">
                            <td colSpan={3}>Total do período</td>
                            <td className="col-num">{totalGeralDiarias}</td>
                            <td className="col-num">{formatBRL(totalGeralTrabalhadores)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </>
                  )}

                  {mostrarMarmitas && relatorioAtivo.entries.some((e) => (e.marmitasQuantidade ?? 0) > 0) && (
                    <>
                      <h3 className="diario-print-secao-titulo">Marmitas por dia</h3>
                      <table className="diario-print-trabalhadores-table">
                        <thead>
                          <tr>
                            <th>Data</th>
                            <th className="col-num">Qtd.</th>
                            <th className="col-num">Valor unit. (R$)</th>
                            <th className="col-num">Total (R$)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatorioAtivo.entries
                            .filter((e) => (e.marmitasQuantidade ?? 0) > 0)
                            .map((e) => (
                              <tr key={e.id}>
                                <td>{formatDate(e.data)}</td>
                                <td className="col-num">{e.marmitasQuantidade}</td>
                                <td className="col-num">{formatBRL(e.marmitasValorUnitario ?? 0)}</td>
                                <td className="col-num">{formatBRL((e.marmitasQuantidade ?? 0) * (e.marmitasValorUnitario ?? 0))}</td>
                              </tr>
                            ))}
                          <tr className="is-total">
                            <td>Total do período</td>
                            <td className="col-num">{r.totalMarmitas}</td>
                            <td className="col-num">—</td>
                            <td className="col-num">{formatBRL(r.custoTotalMarmitas)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </>
                  )}

                  <h3 className="diario-print-secao-titulo">Resumo geral</h3>
                  <table className="diario-print-resumo-table">
                    <thead>
                      <tr><th>Item</th><th>Qtd.</th><th>Valor (R$)</th></tr>
                    </thead>
                    <tbody>
                      <tr><td>Dias registrados</td><td>{r.totalDias}</td><td>—</td></tr>
                      {mostrarMaoDeObra && r.totalMestre > 0 && <tr><td>Mestre de obra (dias presentes)</td><td>{r.totalMestre}</td><td>{formatBRL(r.custoMestre)}</td></tr>}
                      {mostrarMaoDeObra && r.totalPedreiros > 0 && <tr><td>Pedreiros (soma diária)</td><td>{r.totalPedreiros}</td><td>{formatBRL(r.custoPedreiros)}</td></tr>}
                      {mostrarMaoDeObra && r.totalServentes > 0 && <tr><td>Serventes (soma diária)</td><td>{r.totalServentes}</td><td>{formatBRL(r.custoServentes)}</td></tr>}
                      {mostrarMaoDeObra && r.totalCarpinteiros > 0 && <tr><td>Carpinteiros (soma diária)</td><td>{r.totalCarpinteiros}</td><td>{formatBRL(r.custoCarpinteiros)}</td></tr>}
                      {mostrarMaoDeObra && r.totalMaoDeObra > 0 && <tr><td>Mão de obra (soma diária)</td><td>{r.totalMaoDeObra}</td><td>{formatBRL(r.custoMaoDeObraLivre)}</td></tr>}
                      {mostrarMaoDeObra && (
                        <tr className="is-total"><td>Total de colaboradores-dia</td><td>{r.totalColaboradoresDia}</td><td>{formatBRL(r.custoTotalMaoDeObra)}</td></tr>
                      )}
                      {mostrarMaoDeObra && r.totalEmpreitados > 0 && <tr><td>Empreitados (soma diária, não entra no total acima)</td><td>{r.totalEmpreitados}</td><td>—</td></tr>}
                      <tr className="is-total">
                        <td colSpan={2}>
                          {relatorioAtivo.escopo === 'tudo' ? 'Total geral (mão de obra + marmitas)' : relatorioAtivo.escopo === 'mao_de_obra' ? 'Total geral (mão de obra)' : 'Total geral (marmitas)'}
                        </td>
                        <td>{formatBRL((mostrarMaoDeObra ? r.custoTotalMaoDeObra : 0) + (mostrarMarmitas ? r.custoTotalMarmitas : 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}
