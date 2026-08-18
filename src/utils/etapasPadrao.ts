/** Lista padrão de etapas de obra (mesma curadoria usada no app de referência de orçamento) e as
 * regras que classificam o "grupo" de uma composição SINAPI numa dessas etapas — usado pra priorizar
 * a busca de composição pela etapa da atividade/subatividade atual. */
export const ETAPAS_PADRAO: { nome: string; descricao: string }[] = [
  { nome: 'Serviços Preliminares', descricao: 'Barracão+lig. provisórias (água/luz)+projetos/aprovs.' },
  { nome: 'Infraestrutura', descricao: 'Estacas, brocas, baldrames, sapatas' },
  { nome: 'Supraestrutura', descricao: 'Vigas, pilares, cintas, escadas' },
  { nome: 'Paredes e Painéis', descricao: '' },
  { nome: 'Esquadrias', descricao: '' },
  { nome: 'Vidros e Plásticos', descricao: '' },
  { nome: 'Coberturas', descricao: 'Estrutura e telhas' },
  { nome: 'Impermeabilizações', descricao: '' },
  { nome: 'Revestimentos Internos', descricao: '' },
  { nome: 'Forros', descricao: '' },
  { nome: 'Revestimentos Externos', descricao: '' },
  { nome: 'Pinturas', descricao: '' },
  { nome: 'Pisos', descricao: '' },
  { nome: 'Acabamentos', descricao: 'Soleiras, rodapés, peitoril etc.' },
  { nome: 'Instalações Elétricas e Telefônicas', descricao: '' },
  { nome: 'Instalações Hidráulicas', descricao: '' },
  { nome: 'Instalações: Esgoto e Águas Pluviais', descricao: '' },
  { nome: 'Louças e Metais', descricao: '' },
  { nome: 'Complementos', descricao: 'Limpeza final e calafete' },
  { nome: 'Outros', descricao: 'Discriminar em Serviços Adicionais, abaixo' },
];

const REGRAS_CLASSIFICACAO: { etapa: string; padroes: string[] }[] = [
  { etapa: 'Serviços Preliminares', padroes: ['canteiro', 'locação de obras', 'limpeza de obra', 'mobilização e desmobilização', 'demoliç', 'supressão vegetal', 'equipamentos de proteção coletiva'] },
  { etapa: 'Infraestrutura', padroes: ['estaca', 'tubulões', 'tubulão', 'fundações rasas', 'escavação vertical', 'escavação de valas', 'escavação horizontal', 'escavação em material', 'escoramento e preparo de fundo', 'esgotamento de vala', 'aterro e reaterro de valas'] },
  { etapa: 'Supraestrutura', padroes: ['fôrmas para estruturas', 'fôrmas curvas', 'fôrmas para pilares', 'armação para estruturas', 'concretagem para estruturas', 'lajes pré-moldadas', 'escadas', 'estruturas pré-fabricadas', 'paredes de concreto', 'concreto protendido', 'concreto projetado', 'produção de concreto', 'graute e armação'] },
  { etapa: 'Paredes e Painéis', padroes: ['alvenaria', 'drywall', 'vergas, contravergas'] },
  { etapa: 'Esquadrias', padroes: ['esquadrias', 'guarda-corpo', 'brises', 'peitoris e chapins'] },
  { etapa: 'Vidros e Plásticos', padroes: ['vidros e espelhos', 'pele de vidro'] },
  { etapa: 'Coberturas', padroes: ['cobertura', 'estruturas de madeira'] },
  { etapa: 'Impermeabilizações', padroes: ['impermeabiliza', 'geocompostos'] },
  { etapa: 'Revestimentos Internos', padroes: ['revestimentos cerâmicos internos', 'massa única interna', 'chapisco', 'gesso'] },
  { etapa: 'Forros', padroes: ['forros'] },
  { etapa: 'Revestimentos Externos', padroes: ['revestimentos cerâmicos externos', 'massa única externa', 'monocapa', 'fachadas com placas'] },
  { etapa: 'Pinturas', padroes: ['pintura'] },
  { etapa: 'Pisos', padroes: ['pisos', 'contrapiso', 'pavimento intertravado', 'radier, piso de concreto', 'passeios de concreto', 'pavimentações diversas', 'pavimento rígido', 'lastro'] },
  { etapa: 'Acabamentos', padroes: ['rasgos e fixações', 'tratamentos superficiais'] },
  { etapa: 'Instalações Elétricas e Telefônicas', padroes: ['elétric', 'lógica, telefonia', 'spda', 'iluminação', 'luminárias', 'transformadores', 'detecção de incêndio', 'sistemas de medição', 'redes enterradas de distribuição elétrica'] },
  { etapa: 'Instalações Hidráulicas', padroes: ['hidráulic', 'instalações prediais de água', 'em pex', 'em ppr', 'em cobre', 'válvulas e registros', 'ar condicionado', 'dutos para ar condicionado', 'instalações de gás', 'bombas hidráulicas', 'quadros de automação de bombas', 'caixas de água', 'tubulação flangeada', 'assentamento de tubos de pvc e metálicos em redes de água'] },
  { etapa: 'Instalações: Esgoto e Águas Pluviais', padroes: ['esgoto', 'águas pluviais', 'fossas e sumidouros', 'caixas enterradas', 'poços de visita', 'galerias', 'canaletas, grelhas', 'drenos', 'ligações prediais de água e esgoto', 'válvulas para redes de saneamento', 'assentamento de tubos de esgoto', 'redes de água e esgoto em pead'] },
  { etapa: 'Louças e Metais', padroes: ['louças e metais'] },
  { etapa: 'Complementos', padroes: ['remoção de entulho', 'limpeza'] },
];

function normaliza(s: string | null | undefined): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const REGRAS_NORM = REGRAS_CLASSIFICACAO.map((r) => ({ etapa: r.etapa, padroes: r.padroes.map(normaliza) }));

/** Classifica o "grupo" de uma composição SINAPI numa das etapas padrão — usado pra priorizar a busca. */
export function classificarGrupo(grupo: string | null | undefined): string {
  const grupoNorm = normaliza(grupo);
  for (const regra of REGRAS_NORM) {
    if (regra.padroes.some((p) => grupoNorm.includes(p))) return regra.etapa;
  }
  return 'Outros';
}

const INDICE_PADRAO = new Map(ETAPAS_PADRAO.map((e, i) => [e.nome.trim().toLowerCase(), i]));

/** Ordena atividades pela sequência das etapas padrão (Serviços Preliminares → ... → Outros).
 * Atividades com nome fora da lista padrão mantêm a posição relativa entre si, intercaladas
 * pela posição que já tinham em relação às atividades padrão vizinhas. */
export function ordenarPorSequenciaPadrao<T extends { id: string; nome: string }>(atividades: T[]): T[] {
  return [...atividades]
    .map((a, i) => ({ a, i, ordem: INDICE_PADRAO.get(a.nome.trim().toLowerCase()) ?? Infinity }))
    .sort((x, y) => (x.ordem !== y.ordem ? x.ordem - y.ordem : x.i - y.i))
    .map((x) => x.a);
}

/** Reordena resultados de busca de composição colocando primeiro os que pertencem à etapa atual. */
export function priorizarPorEtapa<T extends { grupo: string | null }>(resultados: T[], etapaAtual: string): T[] {
  if (!etapaAtual) return resultados;
  const daEtapa: T[] = [];
  const outros: T[] = [];
  for (const r of resultados) {
    (classificarGrupo(r.grupo) === etapaAtual ? daEtapa : outros).push(r);
  }
  return [...daEtapa, ...outros];
}
