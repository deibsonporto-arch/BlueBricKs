import { obraRepository } from './repositories/obraRepository';
import { atividadeRepository } from './repositories/atividadeRepository';
import { templateRepository } from './repositories/templateRepository';
import { ferramentaCatalogRepository } from './repositories/ferramentaCatalogRepository';
import { seedObras } from '../mock/seedObras';
import { seedAtividades } from '../mock/seedAtividades';
import { seedTemplates } from '../mock/seedTemplates';
import { generateId } from '../utils/id';

export function ensureSeeded(): void {
  if (obraRepository.list().length > 0) return;
  seedObras.forEach((o) => obraRepository.create(o));
  seedAtividades.forEach((a) => atividadeRepository.create(a));
  seedTemplates.forEach((t) => templateRepository.create(t));
}

// Nomes de ferramentas mais usuais em obra, para o catálogo já começar preenchido
// (independe de ensureSeeded — roda mesmo em bases já existentes, não só no primeiro boot).
const FERRAMENTAS_PADRAO = [
  'Carrinho de mão',
  'Martelo',
  'Alicate turquesa',
  'Alicate universal',
  'Nível de mão',
  'Nível alemão',
  'Nível a laser',
  'Prumo',
  'Régua de alumínio',
  'Trena',
  'Trena a laser',
  'Betoneira',
  'Furadeira',
  'Furadeira de impacto',
  'Parafusadeira',
  'Esmerilhadeira (Maquita)',
  'Serra circular',
  'Serra mármore',
  'Marreta',
  'Talhadeira',
  'Ponteira',
  'Pá',
  'Enxada',
  'Picareta',
  'Colher de pedreiro',
  'Desempenadeira',
  'Desempenadeira de PVC',
  'Espátula',
  'Broxa',
  'Rolo de pintura',
  'Trincha',
  'Escada',
  'Andaime',
  'Extensão elétrica',
  'Gerador',
  'Compactador de solo (sapo)',
  'Vibrador de concreto',
  'Chave de fenda',
  'Chave phillips',
  'Jogo de chaves de boca',
  'Chave inglesa',
  'Alicate de pressão',
  'Serrote',
  'Arco de serra',
  'Lixadeira',
  'Mangueira de nível',
  'Fio de prumo',
  'Esquadro',
  'Cavalete',
  'Carrinho plataforma',
];

export function ensureFerramentasCatalogSeed(): void {
  if (ferramentaCatalogRepository.list().length > 0) return;
  const now = new Date().toISOString();
  FERRAMENTAS_PADRAO.forEach((nome) =>
    ferramentaCatalogRepository.create({ id: generateId(), nome, createdAt: now, updatedAt: now }),
  );
}
