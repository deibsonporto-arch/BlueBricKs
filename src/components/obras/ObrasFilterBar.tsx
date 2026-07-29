import { IconSearch } from '@tabler/icons-react';
import type { StatusObra } from '../../types/domain';
import { OBRA_STATUS_LABEL } from '../../utils/obraStatus';
import './ObrasFilterBar.css';

interface ObrasFilterBarProps {
  statusFilter: StatusObra | 'todos';
  onStatusFilterChange: (status: StatusObra | 'todos') => void;
  search: string;
  onSearchChange: (value: string) => void;
}

const STATUS_OPTIONS: (StatusObra | 'todos')[] = [
  'todos',
  'em_andamento',
  'atrasada',
  'paralisada',
  'nao_iniciada',
  'concluida',
];

export function ObrasFilterBar({ statusFilter, onStatusFilterChange, search, onSearchChange }: ObrasFilterBarProps) {
  return (
    <div className="obras-filter-bar">
      <div className="obras-filter-bar__search">
        <IconSearch size={16} stroke={1.75} />
        <input
          type="text"
          placeholder="Buscar por nome ou local..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="obras-filter-bar__status">
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            type="button"
            className={`obras-filter-chip${statusFilter === status ? ' is-active' : ''}`}
            onClick={() => onStatusFilterChange(status)}
          >
            {status === 'todos' ? 'Todos' : OBRA_STATUS_LABEL[status]}
          </button>
        ))}
      </div>
    </div>
  );
}
