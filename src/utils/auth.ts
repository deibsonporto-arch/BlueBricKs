/**
 * Hash da senha (SHA-256) calculado no navegador antes de qualquer envio/armazenamento.
 * O backend recebe e compara só o hash, nunca a senha em texto puro — mas o hash em si
 * ainda funciona como "segredo equivalente" (não usa salt nem é lento como bcrypt), então
 * isso não é proteção de nível produção contra um invasor com acesso ao banco. Serve para
 * controle de acesso básico e para registrar quem fez cada ação.
 */
export async function hashSenha(senha: string): Promise<string> {
  const bytes = new TextEncoder().encode(senha);
  const buffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
