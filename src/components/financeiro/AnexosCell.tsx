import { useState } from 'react';
import { IconPaperclip } from '@tabler/icons-react';
import type { Anexo } from '../../types/domain';
import { downloadAnexo } from '../../utils/attachmentStore';
import './AnexosCell.css';

interface AnexosCellProps {
  anexos: Anexo[];
}

export function AnexosCell({ anexos }: AnexosCellProps) {
  const [showList, setShowList] = useState(false);

  if (anexos.length === 0) {
    return <span className="lancamentos-table__muted">—</span>;
  }

  function handleClick() {
    if (anexos.length === 1) {
      downloadAnexo(anexos[0]);
    } else {
      setShowList((s) => !s);
    }
  }

  return (
    <div className="anexos-cell">
      <button type="button" className="lancamentos-table__anexos" onClick={handleClick} title="Baixar anexo">
        <IconPaperclip size={13} /> {anexos.length}
      </button>
      {showList && anexos.length > 1 && (
        <ul className="anexos-cell__list">
          {anexos.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => { downloadAnexo(a); setShowList(false); }}>
                {a.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
