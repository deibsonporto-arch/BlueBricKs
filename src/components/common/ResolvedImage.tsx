import { useEffect, useState } from 'react';
import { loadAnexoDataUrl } from '../../utils/attachmentStore';
import './ResolvedImage.css';

interface ResolvedImageProps {
  item: { id: string; dataUrl: string; nome: string };
  className?: string;
  onClick?: () => void;
  title?: string;
}

/** Renderiza uma foto que pode estar embutida (dataUrl antigo) ou apontando pro IndexedDB (dataUrl vazio). */
export function ResolvedImage({ item, className, onClick, title }: ResolvedImageProps) {
  const [src, setSrc] = useState<string | undefined>(item.dataUrl || undefined);

  useEffect(() => {
    if (item.dataUrl) {
      setSrc(item.dataUrl);
      return;
    }
    let cancelled = false;
    setSrc(undefined);
    loadAnexoDataUrl(item).then((url) => {
      if (!cancelled) setSrc(url || undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [item.id, item.dataUrl]);

  if (!src) {
    return <div className={`resolved-image-loading ${className ?? ''}`} title={title} />;
  }
  return <img src={src} alt={item.nome} className={className} onClick={onClick} title={title} />;
}
