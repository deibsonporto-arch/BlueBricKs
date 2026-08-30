export interface Usuario {
  id: string;
  nomeUsuario: string; // login
  nomeExibicao: string; // nome mostrado no app e nos registros/histórico
  senhaHash: string; // hash SHA-256 — ver aviso em utils/auth.ts
  createdAt: string;
}

export type TipoObra = 'casa' | 'galpao' | 'condominio' | 'comercial';

export type StatusObra =
  | 'nao_iniciada'
  | 'em_andamento'
  | 'concluida'
  | 'atrasada'
  | 'paralisada';

export type StatusAtividade = 'pendente' | 'em_andamento' | 'concluida';

export type UnidadeMedida = 'un' | 'kg' | 'm' | 'm2' | 'm3' | 'saco' | 'l' | 'cx' | 'pç' | 'verba';

export interface Material {
  id: string;
  nome: string;
  quantidade: number;
  unidade: UnidadeMedida;
  custoUnitario?: number;
  marca?: string;
}

export interface MaoDeObra {
  id: string;
  tipo: string;
  quantidadePessoas: number;
  custoDiaria?: number;
}

export interface Equipamento {
  id: string;
  nome: string;
  dias: number;
  valorDia: number;
}

export type TipoInsumoAtividade = 'material' | 'mao_de_obra' | 'aluguel';

/** Um insumo (material, mão de obra ou aluguel/equipamento) decomposto de uma composição SINAPI
 * e vinculado a uma Atividade — ou lançado manualmente. Editável linha a linha, independente da
 * composição de origem: trocar a composição substitui todos os insumos de uma vez ("recompor"),
 * mas depois de trocada o usuário pode ajustar/remover/adicionar itens livremente. */
export interface ItemInsumoAtividade {
  id: string;
  sinapiCodigo?: number; // ausente = item lançado manualmente
  descricao: string;
  unidade: string;
  quantidade: number;
  custoUnitario: number;
  tipo: TipoInsumoAtividade;
  origemCalculo?: string; // tag ("alvenaria", "reboco-parede", "eletrica:<id>"...) usada pra atualizar esta mesma linha ao clicar "Aplicar" de novo nas Medidas do ambiente — ausente = linha lançada à mão, nunca sobrescrita pelo cálculo
}

/** Uma abertura na parede (porta ou janela) — desconta da área líquida de alvenaria/reboco. */
export interface AberturaAmbiente {
  id: string;
  largura: number; // m
  altura: number; // m
  quantidade: number;
}

export interface PontoEletricoAmbiente {
  id: string;
  descricao: string; // ex: "Interruptor simples com tomada", "Luminária"
  quantidade: number;
}

/** Medidas de um ambiente (cômodo), preenchidas na subatividade pra calcular sozinho m² de
 * alvenaria/reboco/porcelanato e quantidade de pontos elétricos — puramente auxiliar: o usuário
 * decide se aplica o valor calculado aos insumos ou prefere digitar manualmente. */
/** Uma parede individual (trecho de metro linear x altura) dentro de um item de parede — dá pra
 * detalhar parede por parede quando elas têm comprimentos e/ou alturas diferentes, em vez de somar
 * tudo num único metro linear. As áreas de todas as paredes do item são somadas no resumo. */
export interface SegmentoParede {
  id: string;
  metroLinear: number; // m
  altura: number; // m
}

/** Ajuste específico de um item do resumo calculado — cada campo ausente cai pro valor do ambiente
 * como um todo (largura/comprimento/pé-direito), então só precisa preencher o que for diferente
 * pra aquele item (ex: o porcelanato de parede só vai até 1,5m de altura, ou tem uma abertura a mais
 * que as outras partes não têm). */
export interface ConfigItemAmbiente {
  areaDireta?: number; // m² — quando já sabe a metragem pronta, digita direto aqui e ignora todo o resto do cálculo (metro linear/altura, largura/comprimento, aberturas)
  segmentos?: SegmentoParede[]; // só pros itens de parede (alvenaria, reboco, porcelanato-parede, pintura) — 1 linha por parede, cada uma com seu metro linear x altura
  largura?: number; // m — só pros itens "planos" (porcelanato-piso, forro): largura x comprimento = m²
  comprimento?: number; // m — idem
  aberturas?: number; // m² a descontar — sobrescreve o total de portas/janelas do ambiente só pra este item
}

export interface MedidasAmbiente {
  largura?: number; // m
  comprimento?: number; // m
  peDireito?: number; // altura da parede, m — padrão pros itens abaixo quando não têm largura/comprimento/altura próprios
  portas: AberturaAmbiente[];
  janelas: AberturaAmbiente[];
  pontosEletricos: PontoEletricoAmbiente[];
  configAlvenaria?: ConfigItemAmbiente;
  configReboco?: ConfigItemAmbiente;
  configPorcelanatoPiso?: ConfigItemAmbiente;
  configPorcelanatoParede?: ConfigItemAmbiente;
  configPintura?: ConfigItemAmbiente;
  configForro?: ConfigItemAmbiente;
}

/** Snapshot reaproveitável de uma subatividade (nome + custos + insumos decompostos), salva pelo
 * usuário a partir de uma subatividade já editada/ajustada — pra não ter que buscar e decompor a
 * mesma composição de novo em obras futuras. Cópia independente: editar depois não afeta o modelo. */
export interface ModeloSubatividade {
  id: string;
  nome: string;
  etapaSugerida?: string; // nome da Atividade-etapa de origem, usado pra priorizar a busca (mesma lógica de classificarGrupo)
  custoMaoDeObra: number;
  custoMaterial: number;
  custoAluguel: number;
  insumos: ItemInsumoAtividade[];
  createdAt: string;
}

// ---------- Catálogo de materiais e listas ----------

export interface MaterialCatalogItem {
  id: string;
  nome: string;
  categoria: string;
  unidade: UnidadeMedida;
  custoUnitario?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListaDeMateriaisItem {
  materialId: string; // referencia MaterialCatalogItem.id
  quantidade: number;
}

export interface ListaDeMateriais {
  id: string;
  nome: string;
  itens: ListaDeMateriaisItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Subatividade {
  id: string;
  nome: string;
  concluida: boolean;
  status: StatusAtividade;
  dataInicio: string;
  dataFim: string;
  dataInicioOriginal?: string; // data de início planejada antes do 1º reagendamento por atraso — preservada como registro histórico
  dependeDe: string[]; // até 2 ids de outras subatividades/atividades (mesmo pai ou não) — [] se nenhuma; com 2, espera a que terminar por último
  diasEsperaAposPredecessora: number; // dias de espera/cura após o fim da predecessora antes de poder iniciar
  dataAutomatica: boolean; // true = data de início calculada automaticamente pela predecessora; false = usuário travou uma data manual
  contagemDias: 'corridos' | 'uteis'; // como a duração em dias vira data de fim: dias corridos (conta fds) ou dias úteis (pula sáb/dom)
  ordem: number;
  iniciada: boolean;
  custoMaoDeObra: number;
  custoMaterial: number;
  custoAluguel: number;
  materiaisNecessarios: Material[];
  maoDeObraNecessaria: MaoDeObra[];
  equipamentosAluguel: Equipamento[];
  insumos?: ItemInsumoAtividade[]; // decomposição SINAPI da subatividade (material/mão de obra/aluguel linha a linha) — quando presente, dirige os totais de custoMaterial/custoMaoDeObra/custoAluguel
  subatividades?: Subatividade[]; // 3º nível (subatividade dentro de subatividade) — quando presente, datas/custos/status desta subatividade são derivados dos filhos, igual a Atividade deriva de subatividades
  faseMapa?: number; // coluna manual (0..10) no Mapa de Dependências — 0 = "Fase 0 (livre)"; usuário arrasta o card pra dentro da coluna
  medidasAmbiente?: MedidasAmbiente; // opcional — largura/comprimento/pé-direito, portas, janelas e pontos elétricos do cômodo, pra calcular m² de alvenaria/reboco/porcelanato e pontos
}

export interface Atividade {
  id: string;
  obraId: string;
  nome: string;
  etapa: string;
  dependeDe: string[];
  dataInicio: string;
  dataFim: string;
  dataInicioOriginal?: string; // data de início planejada antes do 1º reagendamento por atraso — preservada como registro histórico
  duracaoSemanas?: number; // duração alvo em semanas — motor do cronograma quando não há subatividades
  duracaoDias?: number; // duração alvo em dias corridos — alternativa mais granular a duracaoSemanas; quando definida, tem prioridade
  dataAutomatica?: boolean; // default true (undefined = true); false = usuário travou a data manualmente, mesmo padrão da Subatividade
  etapaOrcamentoConfigId?: string; // vínculo com a EtapaOrcamentoConfig de origem, quando criada/sincronizada pelo Orçamento
  status: StatusAtividade;
  concluida: boolean;
  custoMaoDeObra: number;
  custoMaterial: number;
  custoAluguel: number;
  materiaisNecessarios: Material[];
  maoDeObraNecessaria: MaoDeObra[];
  equipamentosAluguel: Equipamento[];
  insumos?: ItemInsumoAtividade[]; // decomposição SINAPI da atividade (material/mão de obra/aluguel linha a linha) — quando presente, dirige os totais de custoMaterial/custoMaoDeObra/custoAluguel
  subatividades: Subatividade[];
  createdAt: string;
  updatedAt: string;
}

export interface Endereco {
  logradouro: string;
  numero?: string;
  bairro?: string;
  cidade: string;
  estado: string;
  cep?: string;
}

export interface Obra {
  id: string;
  codigo: string;
  nome: string;
  tipo: TipoObra;
  endereco: Endereco;
  responsavelTecnico: string;
  dataInicio: string;
  previsaoEntrega: string;
  orcamentoTotal: number;
  contratoAssinado?: number;
  descricao?: string;
  areaConstruida?: number; // m²
  cubPorM2?: number; // R$/m²
  ccuPercentual?: number; // ajuste comercial CCU, default 0
  bdiPercentual?: number; // ajuste comercial BDI, default 0
  orcamentoFonteEtapas?: 'modelo' | 'atividades' | 'analitico'; // de onde vem a lista de "Etapas Técnicas" do Orçamento — default 'modelo'
  orcamentoModeloId?: string; // qual OrcamentoModelo esta obra usa, quando orcamentoFonteEtapas === 'modelo'
  status: StatusObra;
  gastoReal: number;
  colaboradoresAtivos: number;
  progressoFisico: number;
  progressoFisicoPrevisto?: number;
  templateOrigemId?: string;
  isModelo?: boolean;
  antecedenciaRequisicaoDias?: number; // dias antes do início da tarefa em que os insumos dela vão sozinhos pra Requisições — default 7
  createdAt: string;
  updatedAt: string;
}

export interface TemplateSubatividade {
  tempId: string;
  nome: string;
  dependeDeTempId?: string; // tempId de outra TemplateSubatividade (mesmo "pai" ou não)
  offsetDiasInicio: number; // relativo à data de início da obra
  duracaoDias: number;
  diasEsperaAposPredecessora?: number;
  dataAutomatica?: boolean;
  contagemDias?: 'corridos' | 'uteis';
  custoMaoDeObra: number;
  custoMaterial: number;
  custoAluguel: number;
  materiaisNecessarios: Material[];
  maoDeObraNecessaria: MaoDeObra[];
  equipamentosAluguel: Equipamento[];
  subatividades?: TemplateSubatividade[]; // 3º nível (item dentro da subatividade), espelhando Subatividade.subatividades
}

export interface TemplateAtividade {
  tempId: string;
  nome: string;
  etapa: string;
  dependeDeTempId?: string; // tempId de outra TemplateAtividade
  subatividades: TemplateSubatividade[];
}

export interface ObraTemplate {
  id: string;
  tipo: TipoObra;
  nome: string;
  orcamentoBase: number;
  atividades: TemplateAtividade[];
  createdAt: string;
}

// ---------- Orçamento por CUB/m² ----------

export interface EtapaOrcamentoConfig {
  id: string;
  nome: string;
  percentualPadrao: number; // % usado para preencher o valor inicial da etapa
  percentualMin: number; // faixa esperada — mínimo
  percentualMax: number; // faixa esperada — máximo
  ordem: number;
}

/** Um modelo/preset de orçamento nomeado (ex: "Construção nova", "Reforma") — cadastrado em Configurações,
 * reutilizável por qualquer obra. Substitui o antigo config único e global. */
export interface OrcamentoModelo {
  id: string;
  nome: string;
  etapas: EtapaOrcamentoConfig[];
  materialPercentual: number; // default 45.5
  maoDeObraPercentual: number; // default 54.5
}

// ---------- Orçamento Analítico (SINAPI) ----------

export type SinapiDesoneracao = 'SD' | 'CD'; // SD = sem desoneração ("não desonerado"), CD = com desoneração

/** Uma linha do orçamento analítico: uma composição SINAPI aplicada a uma quantidade medida no
 * projeto. Guarda um snapshot da descrição/custo do momento do lançamento (não referencia a base
 * SINAPI ao vivo), pra não quebrar caso a composição saia da base num mês seguinte. */
export interface ItemOrcamentoAnalitico {
  id: string;
  obraId: string;
  atividadeId?: string; // Atividade sincronizada (cronograma/Curva S), quando o orçamento é salvo
  composicaoCodigo: number;
  composicaoDescricao: string;
  grupo?: string;
  unidade: string;
  quantidade: number;
  uf: string;
  mesReferencia: string; // "2026-07"
  desoneracao: SinapiDesoneracao;
  custoUnitarioSinapi: number;
  custoUnitarioReal?: number; // sobrescrita manual, quando o custo real difere do SINAPI
  custoTotal: number; // quantidade × (custoUnitarioReal ?? custoUnitarioSinapi)
  createdAt: string;
  updatedAt: string;
}

/** Ajuste do usuário sobre uma linha da Lista de Materiais consolidada (que por padrão é só
 * calculada ao vivo a partir das composições SINAPI, nunca persistida). Vale só para esta obra —
 * não altera a base SINAPI. Duas formas:
 * - `insumoCodigo` presente: sobrescreve um insumo que já apareceu no cálculo (ex: "Pedreiro" saiu
 *   R$14.351,86 pelo SINAPI, mas o usuário negociou R$15.000 — `custoReal` guarda o valor real,
 *   o SINAPI continua sendo mostrado do lado como referência).
 * - `insumoCodigo` ausente: linha adicionada manualmente, fora da base SINAPI.
 * `excluido`: "removido" pelo usuário, mas a linha continua visível (riscada) — só sai do total. */
export interface ItemMaterialOrcamento {
  id: string;
  obraId: string;
  insumoCodigo?: number;
  descricao: string;
  unidade: string;
  custoReal?: number;
  excluido: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------- Módulo 3 — PMO Mensal ----------

export interface PmoEntry {
  id: string;
  obraId: string;
  atividadeId: string; // atividade pai, só para agrupar
  subatividadeId: string; // subatividade rastreada nesta linha
  mes: string; // "2026-08"
  percentualReal: number; // 0-100
  percentualPrevisto?: number; // override manual do % previsto calculado automaticamente pelas datas
  checklistSemanal: boolean[]; // um booleano por semana real do mês
  observacoes?: string; // dobra como "Pendências", igual à planilha de referência
  equipe?: string; // override editável — quando ausente, exibe o texto calculado a partir da mão de obra da subatividade
  material?: string; // nota livre — usada quando a subatividade não tem materiais/equipamentos cadastrados
  updatedAt: string;
}

// ---------- Diário de Obra ----------

export interface DiarioRegistro {
  id: string;
  responsavel: string;
  servicoExecutado: string;
  status: StatusAtividade;
  observacoes?: string;
}

export interface DiarioFoto {
  id: string;
  nome: string;
  dataUrl: string;
}

export interface DiarioEntry {
  id: string;
  obraId: string;
  data: string; // ISO date
  etapaAtual: string;
  mestreDeObra: string;
  atividadesExecutadas: string;
  observacoes?: string;
  pedreiros: number;
  serventes: number;
  carpinteiros: number;
  valorDiariaMestre?: number;
  valorDiariaPedreiro?: number;
  valorDiariaServente?: number;
  valorDiariaCarpinteiro?: number;
  marmitasQuantidade?: number;
  marmitasValorUnitario?: number;
  colaboradoresExtra?: { id: string; funcao: string; quantidade: number; valorDiaria: number }[];
  maoDeObra?: { id: string; nome: string; funcao: string; valorDiaria: number }[];
  empreitados: DiarioEmpreitadoRow[];
  registros: DiarioRegistro[];
  fotos: DiarioFoto[];
  createdAt: string;
  updatedAt: string;
}

export interface DiarioEmpreitadoRow {
  id: string;
  empreitadaId?: string; // vínculo com Empreitada cadastrada — ausente em registros antigos (texto livre)
  descricao: string; // cópia do nome no momento (compat com registros antigos e impressão)
  quantidade: number; // mantido só para compat com registros antigos sem empreitadaId
  itemId?: string; // etapa selecionada, se a empreitada tiver itens
  percentualExecutado?: number; // % informado neste dia
  quantidadeExecutada?: number; // quantidade (na unidade do item/contrato) informada neste dia, quando cobrança é por unidade
  medicaoId?: string; // id da MedicaoEmpreitada gerada — evita duplicar ao resalvar o dia
}

// ---------- Equipes reutilizáveis (Diário de Obra) ----------

export interface EquipeMembro {
  id: string;
  nome: string;
  funcao: string;
  valorDiaria: number;
}

export interface Equipe {
  id: string;
  nome: string;
  membros: EquipeMembro[];
  createdAt: string;
  updatedAt: string;
}

// ---------- Empreitada (contrato de empreitada + medições) ----------

export interface EmpreitadaItem {
  id: string;
  nome: string;
  valor: number;
  quantidade?: number; // cobrança por unidade (ex: metro linear) — opcional
  unidade?: UnidadeMedida;
  valorUnitario?: number; // valor = quantidade * valorUnitario quando informado
  atividadeId?: string; // etapa/atividade específica desse item — se vazio, herda o atividadeId da empreitada
}

export interface MedicaoEmpreitada {
  id: string;
  sequencia: number;
  data: string; // ISO date
  itemId?: string;
  descricaoServico: string;
  percentualExecutado: number;
  quantidadeExecutada?: number; // quando o item/contrato é cobrado por unidade
  valor: number;
  lancamentoId?: string;
  observacoes?: string;
  descontoEntrada?: number; // valor (R$) da entrada descontado manualmente nesta parcela (alternativa manual à diluição automática)
}

export type StatusEmpreitada = 'em_andamento' | 'concluida' | 'cancelada';

export interface Empreitada {
  id: string;
  obraId: string;
  fornecedorId: string;
  responsavelTecnico?: string;
  servico: string;
  resumo?: string; // rótulo curto pra lista/card (ex: "Pintura total do galpão") — quando o serviço é uma descrição longa do escopo
  atividadeId?: string;
  valorContrato: number;
  valorEntrada?: number; // valor de entrada (paga ou a pagar) — como ela é abatida depende de entradaDiluicao
  entradaLancamentoId?: string; // vínculo com o lançamento financeiro que paga/pagou a entrada
  entradaDiluicao?: 'total' | 'parcelas'; // 'total' (padrão): abate tudo de uma vez do valorContrato antes de medir; 'parcelas': dilui o valor da entrada no valor lançado das primeiras medições
  entradaDiluicaoParcelas?: number; // quantidade de medições em que a entrada é diluída, quando entradaDiluicao === 'parcelas'
  desconto?: number; // valor abatido do saldo a medir (ex: material que a empresa acabou não fornecendo)
  observacoes?: string; // nota livre (ex: motivo do desconto)
  anexos: Anexo[]; // contrato, comprovantes de pagamento etc.
  quantidadeContratada?: number; // cobrança por unidade (ex: 92,54 metros) — opcional, só quando não há itens
  unidadeContratada?: UnidadeMedida;
  valorUnitario?: number; // valorContrato = quantidadeContratada * valorUnitario quando informado
  retencaoPercentual?: number;
  itens: EmpreitadaItem[];
  medicoes: MedicaoEmpreitada[];
  status: StatusEmpreitada;
  createdAt: string;
  updatedAt: string;
}

// ---------- Módulo 5 — Mapa de Cotação ----------

export type TipoFornecedorCotacao = 'PJ' | 'Informal';
export type StatusCotacao = 'em_cotacao' | 'aguardando_aprovacao' | 'aprovado';

export interface FornecedorCotacao {
  id: string;
  nome: string;
  documento: string; // CNPJ ou CPF
  tipo: TipoFornecedorCotacao;
  marca?: string;
  numeroOrcamento?: string; // nº do orçamento/pedido dado pelo fornecedor
  contato?: string;
  valor: number;
  condicoesPagamento: string;
  prazoEntrega: string;
  emiteNF: boolean;
  observacao?: string;
  orcamentoAnexo?: Anexo; // arquivo do orçamento enviado por esse fornecedor
}

export interface Cotacao {
  id: string;
  obraId: string;
  atividadeId?: string;
  responsavel: string;
  data: string; // ISO date
  itemServico: string;
  descricaoServico?: string;
  quantidade: number;
  unidade: UnidadeMedida;
  valorUnitarioPrevisto: number;
  naoPrevisto?: boolean;
  servicosNaoInclusos?: string;
  condicoesPagamentoGerais?: string;
  melhorOpcaoObservacao?: string;
  observacoesGerais?: string;
  fornecedores: FornecedorCotacao[];
  melhorFornecedorId?: string; // escolha manual; se ausente, usa o de menor valor
  status: StatusCotacao;
  historico?: HistoricoEntry[]; // registros antigos podem não ter
  createdAt: string;
  updatedAt: string;
}

// ---------- Módulo — Requisições ----------

export type StatusRequisicao = 'pendente' | 'requisitado';

/** Um insumo (material, mão de obra ou aluguel) enviado da lista de insumos de uma subatividade pra
 * fila de requisições — quem faz a compra/locação vê tudo já agrupado por etapa/subetapa, sem
 * precisar abrir cada subatividade. Snapshot: editar os insumos da subatividade depois não altera
 * o que já foi enviado pra cá. */
export interface ItemRequisicao {
  id: string;
  obraId: string;
  atividadeId: string;
  atividadeNome: string;
  subatividadeId: string;
  subatividadeNome: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  custoUnitario: number;
  tipo: TipoInsumoAtividade;
  status: StatusRequisicao;
  createdAt: string;
  updatedAt: string;
}

// ---------- Módulo — Almoxarifado ----------

/** Um recebimento de material no almoxarifado da obra, vinculado a nota fiscal. O `codigo` identifica
 * o material de forma estável — várias entradas do mesmo material usam o mesmo código, e é por ele
 * que o saldo em estoque é calculado (soma das entradas menos soma das saídas). */
export interface EntradaEstoque {
  id: string;
  obraId: string;
  data: string; // ISO date
  codigo: string; // ex: "MAT-1042" — gerado automaticamente na 1ª entrada de um material novo
  material: string;
  marca?: string;
  quantidade: number;
  unidade: string;
  custoUnitario?: number;
  medidas?: string;
  fornecedor: string;
  notaFiscal?: string;
  localizacao?: string;
  atividadeId?: string; // vínculo com a Atividade/etapa da obra que vai consumir esse material
  subatividadeId?: string; // vínculo com a subetapa específica
  etapaNome?: string; // snapshot do nome da etapa no momento da entrada
  subetapaNome?: string; // snapshot do nome da subetapa no momento da entrada
  requisicaoId?: string; // se essa entrada veio de uma requisição atendida, o id do ItemRequisicao de origem
  createdAt: string;
  updatedAt: string;
}

/** Uma retirada de material do estoque, sempre vinculada a uma etapa (Atividade) da obra — é o que
 * permite ver quanto de cada material foi consumido em cada etapa, e reduz automaticamente o saldo
 * calculado do `codigo` correspondente. */
export interface SaidaEstoque {
  id: string;
  obraId: string;
  codigo: string; // código do material retirado — deve corresponder a uma EntradaEstoque já lançada
  data: string;
  material: string;
  marca?: string;
  quantidade: number;
  unidade: string;
  medidas?: string;
  responsavel: string;
  atividadeId?: string; // vínculo com a Atividade/etapa da obra
  etapaNome?: string; // snapshot do nome da etapa no momento da saída — sobrevive se a atividade for renomeada/excluída depois
  etapaServico?: string; // descrição livre do serviço específico dentro da etapa
  local: string;
  utilizacaoPara?: string;
  observacao?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Módulo 4 — Próxima Semana ----------

export interface ItemProvidenciado {
  id: string;
  obraId: string;
  itemKey: string;
  providenciado: boolean;
}

// ---------- Módulo 6 — Financeiro ----------

export type TipoFornecedor = 'PJ' | 'PF' | 'Informal';

export interface Fornecedor {
  id: string;
  codigo: string;
  nome: string;
  nomeFantasia?: string;
  documento: string;
  tipo: TipoFornecedor;
  porte?: string;
  dataAbertura?: string; // ISO
  contato?: string;
  telefone?: string;
  email?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  cidade?: string;
  uf?: string;
  situacaoCadastral?: string;
  dataSituacaoCadastral?: string; // ISO
  banco?: string;
  agencia?: string;
  conta?: string;
  pix?: string;
  observacoes?: string;
  createdAt: string;
  updatedAt: string;
}

export type CategoriaLancamento = 'sem_categoria' | 'mao_de_obra' | 'material' | 'aluguel' | 'alimentacao' | 'servico' | 'taxa' | 'empreitada' | 'projetos' | 'sondagem';
export type StatusLancamento = 'pendente' | 'pago' | 'atrasado';
export type FormaPagamento = 'pix' | 'boleto' | 'transferencia' | 'dinheiro' | 'cartao';
export type LancadoTipo = 'nao_lancado' | 'com_adiantamento' | 'com_nf' | 'sem_nf';

export interface Anexo {
  id: string;
  nome: string;
  tipo: string; // mime type
  dataUrl: string;
}

export interface HistoricoEntry {
  data: string;
  usuario: string;
  resumo: string;
}

// ---------- Histórico de Preços (banco de preços material/serviço) ----------

export type OrigemHistoricoPreco = 'nfe_xml' | 'pdf_texto' | 'ocr_imagem' | 'manual';
export type TipoHistoricoPreco = 'material' | 'servico';

/**
 * Registro de compra/contratação real (material ou serviço), usado pra sugerir preço e
 * fornecedor em obras futuras. Global entre obras — obraId é só rastro de origem, nunca
 * filtro: cimento ou mão de obra de hidráulica custam o mesmo independente da obra.
 */
export interface HistoricoPrecoItem {
  id: string;
  tipo: TipoHistoricoPreco;
  nome: string;
  materialCatalogId?: string; // vínculo com MaterialCatalogItem quando tipo === 'material'
  descricao?: string;
  unidade: UnidadeMedida;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  fornecedorId?: string;
  fornecedorNomeDetectado?: string; // nome bruto extraído da nota, antes de casar com Fornecedor
  data: string; // ISO date da nota/compra
  obraId?: string;
  origemLancamentoId?: string;
  origemAnexoId?: string;
  origem: OrigemHistoricoPreco;
  createdAt: string;
}

export interface Pagamento {
  id: string;
  data: string; // data em que esse pagamento foi feito
  valor: number;
  comprovante?: Anexo;
}

/** Plano de parcelas definido na criação do lançamento — cada uma com seu próprio vencimento. */
export interface ParcelaLancamento {
  id: string;
  numero: number; // 1-based entre as parcelas normais; 0 quando ehEntrada
  ehEntrada?: boolean; // marca a linha de entrada (adiantamento), separada da contagem de parcelas
  valor: number;
  vencimento: string; // ISO
  pago: boolean;
  dataPagamento?: string;
  pagamentoId?: string; // vincula ao registro correspondente em LancamentoFinanceiro.pagamentos, quando pago
}

export interface DadosPagamento {
  pixChave?: string;
  pixFavorecido?: string;
  pixBanco?: string;
  boletoLinhaDigitavel?: string;
  boletoCodigoBarras?: string;
  boletoBancoEmissor?: string;
  transferenciaBanco?: string;
  transferenciaAgencia?: string;
  transferenciaConta?: string;
  transferenciaTipoConta?: string;
}

export interface LancamentoFinanceiro {
  id: string;
  obraId: string;
  data: string;
  dataVencimento: string;
  fornecedorId?: string;
  atividadeId?: string;
  descricao: string;
  categoria: CategoriaLancamento;
  valorPrevisto: number;
  naoPrevisto?: boolean;
  valorPago: number;
  formaPagamento: FormaPagamento;
  dadosPagamento?: DadosPagamento;
  nf: boolean;
  numeroNF?: string;
  observacoes?: string;
  lancado?: boolean; // legado — mantido só para compatibilidade com registros antigos; usar lancadoTipo
  lancadoTipo?: LancadoTipo; // status do lançamento em outro sistema/contabilidade, independente do status de pagamento
  lancadoNumero?: string; // número do lançamento nesse outro sistema (ex: 746, 749, 3402)
  status: StatusLancamento;
  anexos: Anexo[];
  pagamentos?: Pagamento[]; // ledger de pagamentos confirmados (novo, opcional — registros antigos não têm)
  parcelaTotal?: number; // nº total de parcelas, se informado (mostra "1/2")
  parcelas?: ParcelaLancamento[]; // plano de parcelas com vencimento definido na criação (opcional — lançamentos antigos usam só parcelaTotal/pagamentos reativamente)
  createdBy: string;
  updatedBy: string;
  historico: HistoricoEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface LocacaoItem {
  id: string;
  descricao: string;
  patrimonio?: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface Locacao {
  id: string;
  obraId: string;
  lancamentoId?: string; // lançamento financeiro de origem, se veio de um lançamento categoria "aluguel"
  fornecedorId?: string; // locador
  numeroContrato?: string;
  numeroFatura?: string;
  dataInicio: string;
  dataFim: string;
  itens: LocacaoItem[];
  valorLocacao: number;
  valorFrete: number;
  valorTotal: number;
  enderecoObra?: string;
  entregue?: boolean;
  dataEntrega?: string;
  createdBy: string;
  updatedBy: string;
  historico: HistoricoEntry[];
  createdAt: string;
  updatedAt: string;
}

// ---------- Lembretes rápidos por obra ----------

export interface Lembrete {
  id: string;
  obraId: string;
  texto: string;
  data: string; // ISO date — quando o lembrete deve chamar atenção
  concluido: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------- Ferramentas (equipamento próprio, controlado por obra) ----------

export interface FerramentaMovimentacao {
  id: string;
  data: string; // ISO date do envio
  obraOrigemId: string;
  obraDestinoId: string;
  quantidade: number; // quantidade movida nesta transferência
  observacao?: string;
}

export interface Ferramenta {
  id: string;
  obraId: string; // obra onde está atualmente
  nome: string;
  quantidade: number;
  unidade: UnidadeMedida;
  observacoes?: string;
  movimentacoes: FerramentaMovimentacao[];
  createdAt: string;
  updatedAt: string;
}

// Catálogo global de nomes de ferramentas — mantém o nome padronizado entre obras
// (evita "Carrinho de mão" numa obra e "Carrinho" em outra).
export interface FerramentaCatalogItem {
  id: string;
  nome: string;
  createdAt: string;
  updatedAt: string;
}

// Local de armazenamento de ferramentas que não é uma obra (ex: "CD - Rua 16").
// Serve como origem/destino de envio de ferramentas, sem entrar na lista de obras
// nem ganhar cronograma/financeiro/etc. Ferramenta.obraId pode apontar tanto para
// uma Obra quanto para um LocalFerramentas — é só uma chave de localização.
export interface LocalFerramentas {
  id: string;
  nome: string;
  createdAt: string;
  updatedAt: string;
}
