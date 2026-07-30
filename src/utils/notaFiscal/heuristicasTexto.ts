import type { NotaFiscalExtraida } from './types';

// Pontuação obrigatória (não opcional) — sem isso, qualquer sequência de 14 dígitos em
// campos vizinhos (chave de acesso, protocolo de autorização) casa por coincidência e
// arrasta um nome de fornecedor errado junto.
const REGEX_CNPJ = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;
const REGEX_DATA = /\b(\d{2})\/(\d{2})\/(\d{4})\b/;
const REGEX_VALOR = /R?\$?\s?(\d{1,3}(?:\.\d{3})*,\d{2})/g;
const REGEX_NUMERO_NF = /N[ºo°.]{0,3}\s*(\d{2,3}(?:\.\d{3}){0,3})/i;

const PALAVRAS_SERVICO = ['serviço', 'servico', 'nfs-e', 'prestação de serviços', 'prestacao de servicos', 'discriminação dos serviços', 'discriminacao dos servicos'];
const PALAVRAS_MATERIAL = ['produto', 'mercadoria', 'nf-e', 'danfe', 'venda ao consumidor', 'cupom fiscal'];

// Linhas que contêm alguma dessas palavras são rótulo/endereço/cabeçalho, não nome de empresa.
const PALAVRAS_LINHA_IGNORAR = [
  'AV.', 'AVENIDA', 'RUA ', 'ROD.', 'RODOVIA', 'CEP', 'FONE', 'TELEFONE', 'FAX',
  'INSCRICAO', 'INSCRIÇÃO', 'MUNICIPIO', 'MUNICÍPIO', 'BAIRRO', 'DISTRITO', 'NATUREZA',
  'DESTINAT', 'REMETENTE', 'ENDERECO', 'ENDEREÇO', 'DANFE', 'DOCUMENTO AUXILIAR',
  'CHAVE DE ACESSO', 'PROTOCOLO', 'CONSULTA DE AUTENTICIDADE', 'ENTRADA', 'SAIDA', 'SAÍDA', 'SÉRIE', 'SERIE',
];

function paraNumeroBR(valorTexto: string): number {
  return Number(valorTexto.replace(/\./g, '').replace(',', '.'));
}

function paraIsoData(dia: string, mes: string, ano: string): string {
  return `${ano}-${mes}-${dia}`;
}

function contemAlguma(textoBaixo: string, palavras: string[]): boolean {
  return palavras.some((p) => textoBaixo.includes(p));
}

/**
 * Nota fiscal padrão (DANFE) tem o nome do emitente escrito algumas linhas acima do CNPJ
 * dele, não colado — então em vez de pegar "palavras logo antes do CNPJ" no texto corrido,
 * sobe linha por linha a partir da linha do CNPJ até achar uma que pareça nome de empresa
 * (não é endereço/rótulo/só números).
 */
function acharNomeFornecedor(linhas: string[]): string | undefined {
  for (let i = 0; i < linhas.length; i++) {
    if (!REGEX_CNPJ.test(linhas[i])) continue;
    for (let j = i; j >= 0 && j >= i - 6; j--) {
      const candidata = linhas[j].replace(REGEX_CNPJ, '').trim();
      if (candidata.length < 4) continue;
      const candidataMaiusc = candidata.toUpperCase();
      if (PALAVRAS_LINHA_IGNORAR.some((p) => candidataMaiusc.includes(p))) continue;
      if (/^[\d./\- ]+$/.test(candidata)) continue; // só números/pontuação, não é nome
      return candidata;
    }
    return undefined;
  }
  return undefined;
}

/**
 * Extração best-effort de campos de cabeçalho a partir das linhas de texto de um PDF/OCR —
 * confiável o bastante pra CNPJ/data/valor total/número da nota; nome do fornecedor e
 * categoria são só um chute, sempre revisável na tela de confirmação.
 */
export function extrairCamposPorTexto(linhas: string[]): Omit<NotaFiscalExtraida, 'confianca'> {
  const textoBruto = linhas.join('\n');
  const textoBaixo = textoBruto.toLowerCase();

  const matchCnpj = textoBruto.match(REGEX_CNPJ);
  const fornecedorDocumento = matchCnpj ? matchCnpj[0].replace(/\D/g, '') : undefined;
  const fornecedorNome = acharNomeFornecedor(linhas);

  const matchData = textoBruto.match(REGEX_DATA);
  const data = matchData ? paraIsoData(matchData[1], matchData[2], matchData[3]) : undefined;

  const valores = Array.from(textoBruto.matchAll(REGEX_VALOR)).map((m) => paraNumeroBR(m[1]));
  const valorTotal = valores.length > 0 ? Math.max(...valores) : undefined;

  const matchNumeroNF = textoBruto.match(REGEX_NUMERO_NF);
  const numeroNF = matchNumeroNF ? matchNumeroNF[1] : undefined;

  const categoriaDetectada = contemAlguma(textoBaixo, PALAVRAS_SERVICO)
    ? 'servico'
    : contemAlguma(textoBaixo, PALAVRAS_MATERIAL)
      ? 'material'
      : 'indeterminado';

  return { fornecedorNome, fornecedorDocumento, numeroNF, data, categoriaDetectada, itens: [], valorTotal };
}
