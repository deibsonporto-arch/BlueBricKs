/**
 * Hash SHA-256 (via Web Crypto) — não é um hash de senha "forte" (sem salt, sem custo
 * computacional), mas mantém o mesmo padrão usado antes da migração pro Supabase: a
 * senha nunca fica em texto puro no armazenamento nem trafega assim pela rede.
 */
export async function hashSenha(senha: string): Promise<string> {
  const bytes = new TextEncoder().encode(senha);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
