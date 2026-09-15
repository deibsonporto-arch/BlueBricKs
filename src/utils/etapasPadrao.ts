/** Lista padrão de etapas de obra na sequência de execução real do canteiro (EAP simplificada,
 * do início ao "habite-se") e as regras que classificam o "grupo" de uma composição SINAPI numa
 * dessas etapas — usado pra priorizar a busca de composição pela etapa da atividade/subatividade atual. */
export interface EtapaPadrao {
  nome: string;
  descricao: string;
  /** Subatividades pré-cadastradas dessa etapa, na ordem em que normalmente são executadas —
   * cada uma entra dependendo da anterior (a 1ª segue a predecessora da própria etapa/atividade). */
  subitens?: string[];
}

export const ETAPAS_PADRAO: EtapaPadrao[] = [
  {
    nome: 'Serviços Preliminares',
    descricao: 'Limpeza do terreno, canteiro de obras, ligações provisórias e locação da obra',
    subitens: ['Limpeza e preparação do terreno', 'Instalação do canteiro de obras', 'Ligações provisórias', 'Locação da obra'],
  },
  {
    nome: 'Movimento de Terra',
    descricao: 'Escavação, transporte de material, aterro/reaterro e compactação',
    subitens: ['Escavação de valas e fundações', 'Transporte e retirada de material', 'Aterro e reaterro', 'Compactação do solo'],
  },
  {
    nome: 'Infraestrutura',
    descricao: 'Fundações, baldrames, impermeabilização e reaterro das fundações',
    subitens: ['Execução das fundações', 'Baldrames', 'Impermeabilização de fundações', 'Reaterro das fundações'],
  },
  {
    nome: 'Supraestrutura',
    descricao: 'Pilares, vigas, lajes e escadas',
    subitens: ['Pilares', 'Vigas', 'Lajes', 'Escadas'],
  },
  {
    nome: 'Paredes e Painéis',
    descricao: 'Alvenaria de vedação, vergas, contravergas e encunhamento',
    subitens: ['Alvenaria de vedação', 'Vergas e contravergas', 'Encunhamento', 'Fechamentos e complementos'],
  },
  {
    nome: 'Cobertura',
    descricao: 'Estrutura do telhado, telhamento, calhas e condutores de águas pluviais',
    subitens: ['Estrutura da cobertura', 'Telhamento', 'Calhas e rufos', 'Condutores de águas pluviais'],
  },
  {
    nome: 'Instalações Hidrossanitárias',
    descricao: 'Água fria, água quente, esgoto, águas pluviais e reservatórios',
    subitens: ['Instalação de água fria', 'Instalação de água quente', 'Instalação de esgoto', 'Instalação de águas pluviais', 'Reservatórios'],
  },
  {
    nome: 'Instalações Elétricas e Telecomunicações',
    descricao: 'Eletrodutos, caixas, quadros, cabeamento, telefonia/dados e aterramento',
    subitens: ['Rasgos para instalações', 'Instalação de eletrodutos/conduítes', 'Instalação de caixas elétricas', 'Quadros elétricos', 'Cabeamento elétrico', 'Telefonia e dados', 'Sistema de aterramento'],
  },
  {
    nome: 'Impermeabilizações',
    descricao: 'Áreas molhadas, lajes e reservatórios',
    subitens: ['Impermeabilização de áreas molhadas', 'Impermeabilização de lajes', 'Impermeabilização de reservatórios'],
  },
  {
    nome: 'Esquadrias',
    descricao: 'Portas, janelas e esquadrias metálicas',
    subitens: ['Instalação de portas', 'Instalação de janelas', 'Esquadrias metálicas'],
  },
  {
    nome: 'Revestimentos Internos',
    descricao: 'Chapisco, emboço/reboco, cerâmica e porcelanato',
    subitens: ['Chapisco', 'Emboço/reboco', 'Regularização de paredes', 'Revestimento cerâmico', 'Porcelanato de paredes'],
  },
  {
    nome: 'Revestimentos Externos',
    descricao: 'Chapisco, emboço/reboco e textura externa',
    subitens: ['Chapisco externo', 'Emboço/reboco externo', 'Textura/revestimento externo'],
  },
  {
    nome: 'Forros',
    descricao: 'Estrutura, drywall/gesso e arremates',
    subitens: ['Estrutura para forro', 'Forro de drywall/gesso', 'Tabicas, sancas e arremates'],
  },
  {
    nome: 'Pisos',
    descricao: 'Contrapiso, cerâmica, porcelanato e pisos externos',
    subitens: ['Contrapiso', 'Regularização de piso', 'Piso cerâmico', 'Porcelanato', 'Pisos externos'],
  },
  {
    nome: 'Marmoraria',
    descricao: 'Soleiras, peitoris, bancadas, nichos e rodabancas',
    subitens: ['Soleiras', 'Peitoris', 'Bancadas', 'Nichos', 'Rodabancas'],
  },
  {
    nome: 'Vidros e Espelhos',
    descricao: 'Instalação de vidros e espelhos',
    subitens: ['Instalação de vidros', 'Instalação de espelhos'],
  },
  {
    nome: 'Pintura',
    descricao: 'Selador, massa corrida, lixamento e pintura interna/externa',
    subitens: ['Selador', 'Massa corrida', 'Lixamento', 'Pintura interna', 'Pintura externa'],
  },
  {
    nome: 'Louças, Metais e Acessórios',
    descricao: 'Louças, metais, torneiras e acessórios de banheiro',
    subitens: ['Instalação de louças sanitárias', 'Instalação de metais sanitários', 'Torneiras e registros', 'Acessórios de banheiro'],
  },
  {
    nome: 'Instalações e Equipamentos Finais',
    descricao: 'Tomadas, interruptores, luminárias, equipamentos elétricos e bombas',
    subitens: ['Tomadas e interruptores', 'Luminárias', 'Equipamentos elétricos', 'Bombas e equipamentos hidráulicos'],
  },
  {
    nome: 'Áreas Externas e Urbanização',
    descricao: 'Calçadas, pavimentação, muros, portões e drenagem externa',
    subitens: ['Calçadas', 'Pavimentação externa', 'Muros e gradis', 'Portões', 'Drenagem externa'],
  },
  {
    nome: 'Acabamentos e Complementos',
    descricao: 'Rodapés, calafetações e arremates finais',
    subitens: ['Rodapés', 'Calafetações', 'Arremates e remates finais', 'Correções de acabamento'],
  },
  {
    nome: 'Testes e Comissionamento',
    descricao: 'Testes das instalações hidráulicas, elétricas e equipamentos',
    subitens: ['Teste das instalações hidráulicas', 'Teste das instalações elétricas', 'Teste de esgoto e águas pluviais', 'Teste dos equipamentos'],
  },
  {
    nome: 'Limpeza Final',
    descricao: 'Limpeza grossa, fina e de vidros/esquadrias',
    subitens: ['Limpeza grossa', 'Limpeza fina', 'Limpeza de vidros e esquadrias'],
  },
  {
    nome: 'Vistoria e Entrega',
    descricao: 'Vistoria final, levantamento/correção de pendências e entrega da obra',
    subitens: ['Vistoria final', 'Levantamento de pendências', 'Correção das pendências', 'Entrega da obra'],
  },
];

const REGRAS_CLASSIFICACAO: { etapa: string; padroes: string[] }[] = [
  { etapa: 'Serviços Preliminares', padroes: ['canteiro', 'locação de obras', 'limpeza de obra', 'mobilização e desmobilização', 'demoliç', 'supressão vegetal', 'equipamentos de proteção coletiva'] },
  { etapa: 'Movimento de Terra', padroes: ['escavação vertical', 'escavação de valas', 'escavação horizontal', 'escavação em material', 'escoramento e preparo de fundo', 'esgotamento de vala', 'aterro e reaterro de valas'] },
  { etapa: 'Infraestrutura', padroes: ['estaca', 'tubulões', 'tubulão', 'fundações rasas'] },
  { etapa: 'Supraestrutura', padroes: ['fôrmas para estruturas', 'fôrmas curvas', 'fôrmas para pilares', 'armação para estruturas', 'concretagem para estruturas', 'lajes pré-moldadas', 'escadas', 'estruturas pré-fabricadas', 'paredes de concreto', 'concreto protendido', 'concreto projetado', 'produção de concreto', 'graute e armação'] },
  { etapa: 'Paredes e Painéis', padroes: ['alvenaria', 'drywall', 'vergas, contravergas'] },
  { etapa: 'Cobertura', padroes: ['cobertura', 'estruturas de madeira'] },
  { etapa: 'Instalações Hidrossanitárias', padroes: ['hidráulic', 'instalações prediais de água', 'em pex', 'em ppr', 'em cobre', 'válvulas e registros', 'ar condicionado', 'dutos para ar condicionado', 'instalações de gás', 'bombas hidráulicas', 'quadros de automação de bombas', 'caixas de água', 'tubulação flangeada', 'assentamento de tubos de pvc e metálicos em redes de água', 'esgoto', 'águas pluviais', 'fossas e sumidouros', 'caixas enterradas', 'poços de visita', 'galerias', 'canaletas, grelhas', 'drenos', 'ligações prediais de água e esgoto', 'válvulas para redes de saneamento', 'assentamento de tubos de esgoto', 'redes de água e esgoto em pead'] },
  { etapa: 'Instalações Elétricas e Telecomunicações', padroes: ['elétric', 'lógica, telefonia', 'spda', 'iluminação', 'luminárias', 'transformadores', 'detecção de incêndio', 'sistemas de medição', 'redes enterradas de distribuição elétrica'] },
  { etapa: 'Impermeabilizações', padroes: ['impermeabiliza', 'geocompostos'] },
  { etapa: 'Esquadrias', padroes: ['esquadrias', 'guarda-corpo', 'brises', 'peitoris e chapins'] },
  { etapa: 'Revestimentos Internos', padroes: ['revestimentos cerâmicos internos', 'massa única interna', 'chapisco', 'gesso'] },
  { etapa: 'Revestimentos Externos', padroes: ['revestimentos cerâmicos externos', 'massa única externa', 'monocapa', 'fachadas com placas'] },
  { etapa: 'Forros', padroes: ['forros'] },
  { etapa: 'Pisos', padroes: ['pisos', 'contrapiso', 'pavimento intertravado', 'radier, piso de concreto', 'passeios de concreto', 'pavimentações diversas', 'pavimento rígido', 'lastro'] },
  { etapa: 'Vidros e Espelhos', padroes: ['vidros e espelhos', 'pele de vidro'] },
  { etapa: 'Pintura', padroes: ['pintura'] },
  { etapa: 'Louças, Metais e Acessórios', padroes: ['louças e metais'] },
  { etapa: 'Acabamentos e Complementos', padroes: ['rasgos e fixações', 'tratamentos superficiais'] },
  { etapa: 'Limpeza Final', padroes: ['remoção de entulho', 'limpeza'] },
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

/** Ordena atividades pela sequência das etapas padrão (Serviços Preliminares → ... → Vistoria e Entrega).
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
