// Remove acentos e normaliza caixa para buscas mais tolerantes (ex: "nivel" encontra "Nível").
// Evita regex com escapes unicode no código-fonte: filtra direto pelo intervalo de
// caracteres de acentuação combinante (0x0300-0x036f) que o normalize('NFD') separa.
export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x0300 || code > 0x036f;
    })
    .join('')
    .toLowerCase();
}
