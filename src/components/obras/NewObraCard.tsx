import { IconPlus } from '@tabler/icons-react';
import './NewObraCard.css';

interface NewObraCardProps {
  onClick: () => void;
}

export function NewObraCard({ onClick }: NewObraCardProps) {
  return (
    <button type="button" className="new-obra-card" onClick={onClick}>
      <IconPlus size={28} stroke={1.75} />
      <span>Nova obra</span>
    </button>
  );
}
