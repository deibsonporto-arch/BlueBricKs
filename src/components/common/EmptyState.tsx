import type { ReactNode } from 'react';
import { IconClockHour4 } from '@tabler/icons-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
}

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '80px 24px',
        color: 'var(--color-text-muted)',
        textAlign: 'center',
      }}
    >
      {icon ?? <IconClockHour4 size={40} stroke={1.5} />}
      <h3 style={{ margin: 0, color: 'var(--color-text)' }}>{title}</h3>
      {description && <p style={{ margin: 0, maxWidth: 420 }}>{description}</p>}
    </div>
  );
}
