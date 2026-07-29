const SESSION_KEY = 'brics:sessao_usuario_id';

export function getSessaoUsuarioId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setSessaoUsuarioId(id: string): void {
  localStorage.setItem(SESSION_KEY, id);
}

export function clearSessao(): void {
  localStorage.removeItem(SESSION_KEY);
}
