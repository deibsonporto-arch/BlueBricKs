import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconBell, IconChevronDown, IconDatabaseExport, IconUserCircle } from '@tabler/icons-react';
import { useAuth } from '../../hooks/useAuth';
import { BackupModal } from './BackupModal';
import './AppHeader.css';

export function AppHeader() {
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { usuarioAtual, logout } = useAuth();

  return (
    <header className="app-header">
      <Link to="/obras" className="app-header__logo">
        <img src="/favicon.svg" alt="" className="app-header__logo-icon" />
        <span className="app-header__logo-text">
          <strong>BlueBRICKs</strong>
          <small>Inteligência Construtiva</small>
        </span>
      </Link>
      <div className="app-header__right">
        <Link to="/modelos" className="app-header__nav-link">
          Modelos
        </Link>
        <Link to="/materiais" className="app-header__nav-link">
          Materiais
        </Link>
        <Link to="/ferramentas" className="app-header__nav-link">
          Ferramentas
        </Link>
        <Link to="/configuracoes" className="app-header__nav-link">
          Configurações
        </Link>
        <button type="button" className="app-header__nav-link app-header__nav-link--btn" onClick={() => setBackupModalOpen(true)}>
          <IconDatabaseExport size={16} /> Backup
        </button>
        <button type="button" className="app-header__icon-btn" aria-label="Notificações">
          <IconBell size={20} stroke={1.75} />
        </button>
        <div className="app-header__user-menu">
          <button
            type="button"
            className="app-header__user"
            onClick={() => setUserMenuOpen((v) => !v)}
            onBlur={() => setTimeout(() => setUserMenuOpen(false), 150)}
          >
            <IconUserCircle size={24} stroke={1.5} />
            <span>{usuarioAtual?.nomeExibicao ?? 'Usuário'}</span>
            <IconChevronDown size={14} />
          </button>
          {userMenuOpen && (
            <div className="app-header__user-dropdown">
              <Link to="/usuarios" className="app-header__user-dropdown-item" onMouseDown={() => setUserMenuOpen(false)}>
                Gerenciar usuários
              </Link>
              <button type="button" className="app-header__user-dropdown-item" onMouseDown={logout}>
                Sair
              </button>
            </div>
          )}
        </div>
      </div>

      <BackupModal open={backupModalOpen} onClose={() => setBackupModalOpen(false)} />
    </header>
  );
}
