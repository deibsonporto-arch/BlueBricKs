/**
 * As 12 Etapas Técnicas padrão (nome + subatividades), fonte única usada tanto pelo Orçamento
 * (useOrcamentoConfig.ts, ao seedar os nomes das etapas) quanto pelos templates de obra
 * (seedTemplates.ts) e pela sincronização do cronograma (OrcamentoTab.tsx). O casamento entre o
 * Orçamento e essas subatividades é sempre por posição (índice), não pelo nome — assim continua
 * funcionando mesmo que o usuário renomeie uma etapa em Configurações.
 */
export interface EtapaTecnicaOutline {
  nome: string;
  subatividades: string[];
}

export const ETAPAS_TECNICAS: EtapaTecnicaOutline[] = [
  { nome: 'Preparação do Terreno', subatividades: ['Limpeza do Terreno', 'Locação da Obra', 'Instalação de Tapumes e Proteções', 'Instalações Provisórias'] },
  { nome: 'Fundações', subatividades: ['Escavação das Fundações', 'Montagem das Armaduras', 'Execução das Formas', 'Concretagem das Fundações', 'Impermeabilização das Fundações'] },
  { nome: 'Estrutura', subatividades: ['Montagem das Armaduras Estruturais', 'Execução das Formas Estruturais', 'Escoramento Estrutural', 'Concretagem da Estrutura', 'Execução da Laje'] },
  { nome: 'Alvenaria e Vedação', subatividades: ['Elevação da Alvenaria', 'Assentamento de Blocos Cerâmicos', 'Preparação e Aplicação de Argamassa', 'Execução de Vergas e Contravergas'] },
  { nome: 'Cobertura', subatividades: ['Montagem da Estrutura Metálica', 'Instalação do Telhamento', 'Instalação de Calhas e Rufos', 'Instalação de Cumeeiras'] },
  { nome: 'Instalações Hidrossanitárias', subatividades: ['Rede de Água Fria', 'Rede de Esgoto Sanitário', 'Execução dos Pontos Hidráulicos', 'Instalação dos Reservatórios', 'Testes e Comissionamento Hidráulico'] },
  { nome: 'Instalações Elétricas', subatividades: ['Infraestrutura Elétrica (Tubulações)', 'Lançamento de Cabos e Fiação', 'Execução dos Pontos Elétricos', 'Instalação dos Quadros de Distribuição', 'Sistema de Aterramento e Proteção', 'Testes e Energização'] },
  { nome: 'Revestimentos e Regularizações', subatividades: ['Chapisco Interno', 'Reboco Interno', 'Reboco Externo', 'Execução do Contrapiso'] },
  { nome: 'Pisos e Revestimentos', subatividades: ['Assentamento de Piso Cerâmico/Porcelanato', 'Rejuntamento', 'Revestimento Cerâmico de Áreas Molhadas', 'Instalação de Soleiras e Peitoris'] },
  { nome: 'Pintura', subatividades: ['Aplicação de Massa Corrida PVA', 'Pintura Interna', 'Pintura Externa'] },
  { nome: 'Esquadrias e Acabamentos Finais', subatividades: ['Instalação de Portas Internas', 'Instalação de Portas Externas', 'Instalação de Janelas', 'Instalação de Louças Sanitárias', 'Instalação de Metais Sanitários', 'Instalação de Vidros'] },
  { nome: 'Entrega da Obra', subatividades: ['Limpeza Final', 'Comissionamento dos Sistemas', 'Documentação e Entrega Técnica', 'Habite-se e Encerramento da Obra'] },
];

/** Só as listas de subatividades, na mesma ordem — usado pelo casamento por posição no OrcamentoTab. */
export const ETAPAS_TECNICAS_SUBATIVIDADES: string[][] = ETAPAS_TECNICAS.map((e) => e.subatividades);
