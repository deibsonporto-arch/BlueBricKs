import { useState } from 'react';

const KEY = 'brics_empresa_nome';

export function useEmpresaConfig() {
  const [nomeEmpresa, setNomeEmpresaState] = useState(() => localStorage.getItem(KEY) ?? '');

  function setNomeEmpresa(value: string) {
    localStorage.setItem(KEY, value);
    setNomeEmpresaState(value);
  }

  return { nomeEmpresa, setNomeEmpresa };
}
