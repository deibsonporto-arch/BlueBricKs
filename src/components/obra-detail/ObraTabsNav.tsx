import { NavLink } from 'react-router-dom';
import { OBRA_TABS } from '../../routes/routes';
import './ObraTabsNav.css';

interface ObraTabsNavProps {
  obraId: string;
}

export function ObraTabsNav({ obraId }: ObraTabsNavProps) {
  return (
    <nav className="obra-tabs-nav">
      {OBRA_TABS.map((tab) => (
        <NavLink
          key={tab.path}
          to={`/obras/${obraId}/${tab.path}`}
          className={({ isActive }) => `obra-tabs-nav__link${isActive ? ' is-active' : ''}`}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
