import { useMemo, useState } from 'react';
import { IconChevronDown, IconChevronRight, IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { AppHeader } from '../components/layout/AppHeader';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { MaterialCatalogFormModal } from '../components/materiais/MaterialCatalogFormModal';
import { ListaDeMateriaisFormModal } from '../components/materiais/ListaDeMateriaisFormModal';
import { useMateriaisCatalogo } from '../hooks/useMateriaisCatalogo';
import { useListasDeMateriais } from '../hooks/useListasDeMateriais';
import { formatBRL } from '../utils/currency';
import type { ListaDeMateriais, MaterialCatalogItem } from '../types/domain';
import './MateriaisPage.css';

export function MateriaisPage() {
  const { materiais, deleteMaterial, refresh: refreshMateriais } = useMateriaisCatalogo();
  const { listas, deleteLista, refresh: refreshListas } = useListasDeMateriais();

  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [materialModalMode, setMaterialModalMode] = useState<'create' | 'edit'>('create');
  const [editingMaterial, setEditingMaterial] = useState<MaterialCatalogItem | undefined>(undefined);
  const [deletingMaterial, setDeletingMaterial] = useState<MaterialCatalogItem | undefined>(undefined);

  const [categoriasColapsadas, setCategoriasColapsadas] = useState<Set<string>>(new Set());

  const [listaModalOpen, setListaModalOpen] = useState(false);
  const [listaModalMode, setListaModalMode] = useState<'create' | 'edit'>('create');
  const [editingLista, setEditingLista] = useState<ListaDeMateriais | undefined>(undefined);
  const [deletingLista, setDeletingLista] = useState<ListaDeMateriais | undefined>(undefined);

  const categoriasExistentes = useMemo(
    () => Array.from(new Set(materiais.map((m) => m.categoria))).sort(),
    [materiais],
  );

  const materiaisPorCategoria = useMemo(() => {
    const grupos = new Map<string, MaterialCatalogItem[]>();
    for (const m of materiais) {
      if (!grupos.has(m.categoria)) grupos.set(m.categoria, []);
      grupos.get(m.categoria)!.push(m);
    }
    return Array.from(grupos.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [materiais]);

  function openCreateMaterial() {
    setMaterialModalMode('create');
    setEditingMaterial(undefined);
    setMaterialModalOpen(true);
  }
  function openEditMaterial(m: MaterialCatalogItem) {
    setMaterialModalMode('edit');
    setEditingMaterial(m);
    setMaterialModalOpen(true);
  }

  function toggleCategoria(categoria: string) {
    setCategoriasColapsadas((prev) => {
      const next = new Set(prev);
      if (next.has(categoria)) next.delete(categoria);
      else next.add(categoria);
      return next;
    });
  }

  function openCreateLista() {
    setListaModalMode('create');
    setEditingLista(undefined);
    setListaModalOpen(true);
  }
  function openEditLista(l: ListaDeMateriais) {
    setListaModalMode('edit');
    setEditingLista(l);
    setListaModalOpen(true);
  }

  return (
    <div>
      <AppHeader />
      <div className="container">
        <div className="materiais-header">
          <div>
            <h1 className="materiais-title">Materiais</h1>
            <p className="materiais-subtitle">Cadastre o catálogo de materiais uma vez e monte listas prontas (ex: lista para Fundação) para aplicar rapidamente numa subtarefa.</p>
          </div>
        </div>

        <div className="materiais-section">
          <div className="materiais-section__header">
            <h2>Catálogo de materiais</h2>
            <button type="button" className="btn btn-primary" onClick={openCreateMaterial}>
              <IconPlus size={16} /> Novo material
            </button>
          </div>

          {materiais.length === 0 ? (
            <p className="materiais-empty">Nenhum material cadastrado ainda.</p>
          ) : (
            materiaisPorCategoria.map(([categoria, itens]) => {
              const colapsada = categoriasColapsadas.has(categoria);
              return (
                <div className="materiais-categoria" key={categoria}>
                  <button type="button" className="materiais-categoria__header" onClick={() => toggleCategoria(categoria)}>
                    {colapsada ? <IconChevronRight size={16} /> : <IconChevronDown size={16} />}
                    <h3>{categoria}</h3>
                    <span className="materiais-categoria__count">{itens.length}</span>
                  </button>
                  {!colapsada && (
                    <div className="materiais-catalogo-grid">
                      {itens.map((m) => (
                        <div className="material-catalogo-card" key={m.id}>
                          <div>
                            <strong>{m.nome}</strong>
                            <div className="material-catalogo-card__sub">
                              {m.unidade}{m.custoUnitario ? ` · ${formatBRL(m.custoUnitario)}` : ''}
                            </div>
                          </div>
                          <div className="material-catalogo-card__actions">
                            <button type="button" className="btn btn-ghost" onClick={() => openEditMaterial(m)} aria-label="Editar material">
                              <IconEdit size={14} />
                            </button>
                            <button type="button" className="btn btn-ghost" onClick={() => setDeletingMaterial(m)} aria-label="Excluir material">
                              <IconTrash size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="materiais-section">
          <div className="materiais-section__header">
            <h2>Listas de materiais</h2>
            <button type="button" className="btn btn-primary" onClick={openCreateLista}>
              <IconPlus size={16} /> Nova lista
            </button>
          </div>

          {listas.length === 0 ? (
            <p className="materiais-empty">Nenhuma lista salva ainda.</p>
          ) : (
            <div className="listas-grid">
              {listas.map((l) => (
                <div className="lista-card" key={l.id}>
                  <h3>{l.nome}</h3>
                  <span className="lista-card__stat">{l.itens.length} {l.itens.length === 1 ? 'item' : 'itens'}</span>
                  <div className="lista-card__actions">
                    <button type="button" className="btn btn-secondary" onClick={() => openEditLista(l)}>
                      <IconEdit size={14} /> Editar
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setDeletingLista(l)} aria-label="Excluir lista">
                      <IconTrash size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <MaterialCatalogFormModal
        open={materialModalOpen}
        mode={materialModalMode}
        material={editingMaterial}
        categoriasExistentes={categoriasExistentes}
        onClose={() => setMaterialModalOpen(false)}
        onSaved={() => { setMaterialModalOpen(false); refreshMateriais(); }}
      />
      <ListaDeMateriaisFormModal
        open={listaModalOpen}
        mode={listaModalMode}
        lista={editingLista}
        catalogo={materiais}
        onClose={() => setListaModalOpen(false)}
        onSaved={() => { setListaModalOpen(false); refreshListas(); }}
      />

      <ConfirmDialog
        open={!!deletingMaterial}
        title="Excluir material"
        message={`Tem certeza que deseja excluir "${deletingMaterial?.nome}" do catálogo? Isso não afeta materiais já usados em obras.`}
        confirmLabel="Excluir"
        danger
        onCancel={() => setDeletingMaterial(undefined)}
        onConfirm={async () => {
          if (deletingMaterial) await deleteMaterial(deletingMaterial.id);
          setDeletingMaterial(undefined);
        }}
      />
      <ConfirmDialog
        open={!!deletingLista}
        title="Excluir lista"
        message={`Tem certeza que deseja excluir a lista "${deletingLista?.nome}"?`}
        confirmLabel="Excluir"
        danger
        onCancel={() => setDeletingLista(undefined)}
        onConfirm={async () => {
          if (deletingLista) await deleteLista(deletingLista.id);
          setDeletingLista(undefined);
        }}
      />
    </div>
  );
}
