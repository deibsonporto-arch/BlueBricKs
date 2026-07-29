import type { NotaFiscalExtraida } from './types';

const REGEX_CNPJ = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;
const REGEX_DATA = /\b(\d{2})\/(\d{2})\/(\d{4})\b/;
const REGEX_VALOR = /R?\$?\s?(\d{1,3}(?:\.\d{3})*,\d{2})/g;
const REGEX_NUMERO_NF = /\bN[ºo°.]{0,2}\s*(\d{3,9})\b/i;

const PALAVRAS_SERVICO = ['serviço', 'servico', 'nfs-e', 'prestação de serviços', 'prestacao de servicos', 'discriminação dos serviços', 'discriminacao dos servicos'];
const PALAVRAS_MATERIAL = ['produto', 'mercadoria', 'nf-e', 'venda ao consumidor', 'cupom fiscal'];

function paraNumeroBR(valorTexto: string): number {
  return Number(valorTexto.replace(/\./g, '').replace(',', '.'));
}

function paraIsoData(dia: string, mes: string, ano: string): string {
  return `${ano}-${mes}-${dia}`;
}

function contemAlguma(textoBaixo: string, palavras: string[]): boolean {
  return palavras.some((p) => textoBaixo.includes(p));
}

/** Palavras "limpas" (sem dígito, com mais de 1 letra) logo antes de um índice — chute de nome de fornecedor perto do CNPJ na nota. */
function candidatoNomeAntesDe(textoBruto: string, indice: number): string | undefined {
  const trecho = textoBruto.slice(Math.max(0, indice - 80), indice);
  const palavras = trecho.split(/\s+/).filter((p) => p && !/\d/.test(p) && p.length > 1);
  const candidato = palavras.slice(-6).join(' ').trim();
  return candidato || undefined;
}

/**
 * Extração best-effort de campos de cabeçalho a partir de texto corrido (PDF com texto
 * selecionável ou saída de OCR) — sem informação de layout, então não dá pra separar itens
 * de linha com confiança; só CNPJ/nome aproximado/data/valor total/categoria.
 */
export function extrairCamposPorTexto(textoBruto: string): Omit<NotaFiscalExtraida, 'confianca'> {
  const textoBaixo = textoBruto.toLowerCase();

  const matchCnpj = textoBruto.match(REGEX_CNPJ);
  const fornecedorDocumento = matchCnpj ? matchCnpj[0].replace(/\D/g, '') : undefined;
  const fornecedorNome = matchCnpj && matchCnpj.index !== undefined ? candidatoNomeAntesDe(textoBruto, matchCnpj.index) : undefined;

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
