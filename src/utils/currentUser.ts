let nomeUsuarioAtual = '';

/** Nome do usuário logado no momento, usado em registros/histórico. */
export function getCurrentUserName(): string {
  return nomeUsuarioAtual || 'Desconhecido';
}

export function setCurrentUserName(nome: string): void {
  nomeUsuarioAtual = nome;
}
