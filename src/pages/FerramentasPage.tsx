import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconEdit, IconExternalLink, IconPlus, IconTrash } from '@tabler/icons-react';
import { AppHeader } from '../components/layout/AppHeader';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { FerramentaCatalogFormModal } from '../components/ferramenta/FerramentaCatalogFormModal';
import { LocalFerramentasFormModal } from '../components/ferramenta/LocalFerramentasFormModal';
import { useTodasFerramentas } from '../hooks/useFerramentas';
import { useFerramentasCatalogo } from '../hooks/useFerramentasCatalogo';
import { useLocaisFerramentas } from '../hooks/useLocaisFerramentas';
import { useObras } from '../hooks/useObras';
import type { FerramentaCatalogItem, LocalFerramentas } from '../types/domain';
import { ROUTES } from '../routes/routes';
import './FerramentasPage.css';

export function FerramentasPage() {
  const { ferramentas } = useTodasFerramentas();
  const { catalogo, deleteItem: deleteCatalogoItem, refresh: refreshCatalogo } = useFerramentasCatalogo();
  const { locais, deleteLocal, refresh: refreshLocais } = useLocaisFerramentas();
  const { obras } = useObras();

  const [catalogoModalOpen, setCatalogoModalOpen] = useState(false);
  const [catalogoModalMode, setCatalogoModalMode] = useState<'create' | 'edit'>('create');
  const [editingCatalogoItem, setEditingCatalogoItem] = useState<FerramentaCatalogItem | undefined>(undefined);
  const [deletingCatalogoItem, setDeletingCatalogoItem] = useState<FerramentaCatalogItem | undefined>(undefined);

  const [localModalOpen, setLocalModalOpen] = useState(false);
  const [localModalMode, setLocalModalMode] = useState<'create' | 'edit'>('create');
  const [editingLocal, setEditingLocal] = useState<LocalFerramentas | undefined>(undefined);
  const [deletingLocal, setDeletingLocal] = useState<LocalFerramentas | undefined>(undefined);

  function openCreateCatalogoItem() {
    setCatalogoModalMode('create');
    setEditingCatalogoItem(undefined);
    setCatalogoModalOpen(true);
  }
  function openEditCatalogoItem(item: FerramentaCatalogItem) {
    setCatalogoModalMode('edit');
    setEditingCatalogoItem(item);
    setCatalogoModalOpen(true);
  }

  function openCreateLocal() {
    setLocalModalMode('create');
    setEditingLocal(undefined);
    setLocalModalOpen(true);
  }
  function openEditLocal(item: LocalFerramentas) {
    setLocalModalMode('edit');
    setEditingLocal(item);
    setLocalModalOpen(true);
  }

  const catalogoOrdenado = useMemo(() => [...catalogo].sort((a, b) => a.nome.localeCompare(b.nome)), [catalogo]);
  const locaisOrdenados = useMemo(() => [...locais].sort((a, b) => a.nome.localeCompare(b.nome)), [locais]);

  const localizacoes = useMemo(
    () => [
      ...obras.filter((o) => !o.isModelo).map((o) => ({ id: o.id, nome: o.nome, rota: ROUTES.obraFerramentas(o.id) })),
      ...locais.map((l) => ({ id: l.id, nome: l.nome, rota: ROUTES.localFerramentas(l.id) })),
    ],
    [obras, locais],
  );

  const porLocalizacao = useMemo(() => {
    const grupos = new Map<string, Map<string, { nome: string; unidade: string; quantidade: number }>>();
    for (const f of ferramentas) {
      if (!grupos.has(f.obraId)) grupos.set(f.obraId, new Map());
      const porNome = grupos.get(f.obraId)!;
      const chave = `${f.nome}__${f.unidade}`;
      const existente = porNome.get(chave);
      if (existente) existente.quantidade += f.quantidade;
      else porNome.set(chave, { nome: f.nome, unidade: f.unidade, quantidade: f.quantidade });
    }
    return localizacoes
      .map((loc) => ({
        loc,
        itens: Array.from(grupos.get(loc.id)?.values() ?? []).sort((a, b) => a.nome.localeCompare(b.nome)),
      }))
      .filter((g) => g.itens.length > 0)
      .sort((a, b) => a.loc.nome.localeCompare(b.loc.nome));
  }, [ferramentas, localizacoes]);

  return (
    <div>
      <AppHeader />
      <div className="container">
        <div className="ferramentas-page-header">
          <div>
            <h1 className="ferramentas-page-title">Ferramentas</h1>
            <p className="ferramentas-page-subtitle">Inventário de ferramentas e equipamentos de todas as obras e locais, para ver rapidamente o que tem onde. Para adicionar, editar ou enviar uma ferramenta, use a aba "Ferramentas" dentro da obra, ou clique num local abaixo.</p>
          </div>
        </div>

        <div className="ferramentas-page-section">
          <div className="ferramentas-page-section__header">
            <h2>Nomes de ferramentas</h2>
            <button type="button" className="btn btn-primary" onClick={openCreateCatalogoItem}>
              <IconPlus size={16} /> Novo nome
            </button>
          </div>
          <p className="ferramentas-page-section__hint">
            Nomes cadastrados aqui aparecem como sugestão ao cadastrar uma ferramenta em qualquer obra, mantendo o nome padronizado (ex: sempre "Carrinho de mão", nunca "Carrinho" numa obra e "Carrinho de mão" em outra).
          </p>

          {catalogoOrdenado.length === 0 ? (
            <p className="ferramentas-page-empty">Nenhum nome cadastrado ainda — os nomes também são cadastrados automaticamente na primeira vez que você usa um nome novo ao criar uma ferramenta.</p>
          ) : (
            <div className="ferramentas-page-catalogo-grid">
              {catalogoOrdenado.map((c) => (
                <div className="ferramenta-catalogo-card" key={c.id}>
                  <span>{c.nome}</span>
                  <div className="ferramenta-catalogo-card__actions">
                    <button type="button" className="btn btn-ghost" onClick={() => openEditCatalogoItem(c)} aria-label="Editar nome">
                      <IconEdit size={14} />
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setDeletingCatalogoItem(c)} aria-label="Excluir nome">
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ferramentas-page-section">
          <div className="ferramentas-page-section__header">
            <h2>Locais (depósitos)</h2>
            <button type="button" className="btn btn-primary" onClick={openCreateLocal}>
              <IconPlus size={16} /> Novo local
            </button>
          </div>
          <p className="ferramentas-page-section__hint">
            Um local não é uma obra — serve só para guardar e mover ferramentas (ex: "CD - Rua 16"). Dá pra enviar ferramentas de uma obra para um local, e de um local para qualquer obra.
          </p>

          {locaisOrdenados.length === 0 ? (
            <p className="ferramentas-page-empty">Nenhum local cadastrado ainda.</p>
          ) : (
            <div className="ferramentas-page-catalogo-grid">
              {locaisOrdenados.map((l) => (
                <div className="ferramenta-catalogo-card" key={l.id}>
                  <Link to={ROUTES.localFerramentas(l.id)} className="ferramentas-page-local-link">
                    {l.nome} <IconExternalLink size={12} />
                  </Link>
                  <div className="ferramenta-catalogo-card__actions">
                    <button type="button" className="btn btn-ghost" onClick={() => openEditLocal(l)} aria-label="Editar local">
                      <IconEdit size={14} />
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setDeletingLocal(l)} aria-label="Excluir local">
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {porLocalizacao.length === 0 ? (
          <p className="ferramentas-page-empty">Nenhuma ferramenta cadastrada em nenhuma obra ou local ainda.</p>
        ) : (
          porLocalizacao.map(({ loc, itens }) => (
            <div className="ferramentas-page-obra" key={loc.id}>
              <h2><Link to={loc.rota}>{loc.nome}</Link></h2>
              <table className="ferramentas-page-table">
                <thead>
                  <tr><th>Ferramenta</th><th>Quantidade</th><th>Unidade</th></tr>
                </thead>
                <tbody>
                  {itens.map((f) => (
                    <tr key={`${f.nome}__${f.unidade}`}>
                      <td>{f.nome}</td>
                      <td>{f.quantidade}</td>
                      <td>{f.unidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      <FerramentaCatalogFormModal
        open={catalogoModalOpen}
        mode={catalogoModalMode}
        item={editingCatalogoItem}
        onClose={() => setCatalogoModalOpen(false)}
        onSaved={() => { setCatalogoModalOpen(false); refreshCatalogo(); }}
      />

      <LocalFerramentasFormModal
        open={localModalOpen}
        mode={localModalMode}
        item={editingLocal}
        onClose={() => setLocalModalOpen(false)}
        onSaved={() => { setLocalModalOpen(false); refreshLocais(); }}
      />

      <ConfirmDialog
        open={!!deletingCatalogoItem}
        title="Excluir nome de ferramenta"
        message={`Tem certeza que deseja excluir "${deletingCatalogoItem?.nome}" do catálogo de nomes? Isso não afeta ferramentas já cadastradas com esse nome.`}
        confirmLabel="Excluir"
        danger
        onCancel={() => setDeletingCatalogoItem(undefined)}
        onConfirm={async () => {
          if (deletingCatalogoItem) await deleteCatalogoItem(deletingCatalogoItem.id);
          setDeletingCatalogoItem(undefined);
        }}
      />

      <ConfirmDialog
        open={!!deletingLocal}
        title="Excluir local"
        message={`Tem certeza que deseja excluir o local "${deletingLocal?.nome}"? Ferramentas já cadastradas nele não serão excluídas, mas ficarão sem um local visível — mova-as antes, se possível.`}
        confirmLabel="Excluir"
        danger
        onCancel={() => setDeletingLocal(undefined)}
        onConfirm={async () => {
          if (deletingLocal) await deleteLocal(deletingLocal.id);
          setDeletingLocal(undefined);
        }}
      />
    </div>
  );
}
