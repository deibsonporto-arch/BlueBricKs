import type { UnidadeMedida } from '../../types/domain';
import type { ItemExtraido, NotaFiscalExtraida } from './types';

const UNIDADE_MAP: Record<string, UnidadeMedida> = {
  UN: 'un', UND: 'un', UNID: 'un', PC: 'pç', 'PÇ': 'pç', PCT: 'pç',
  KG: 'kg', KGM: 'kg',
  M: 'm', MT: 'm',
  M2: 'm2', 'M²': 'm2',
  M3: 'm3', 'M³': 'm3',
  SC: 'saco', SAC: 'saco',
  L: 'l', LT: 'l', LTS: 'l',
  CX: 'cx',
  VB: 'verba', VERBA: 'verba',
};

function mapUnidade(bruto: string | undefined): UnidadeMedida {
  if (!bruto) return 'un';
  return UNIDADE_MAP[bruto.trim().toUpperCase()] ?? 'un';
}

function digitos(texto: string | undefined): string | undefined {
  const d = texto?.replace(/\D/g, '');
  return d ? d : undefined;
}

function textoDaTag(el: Document | Element, tag: string): string | undefined {
  const encontrada = el.getElementsByTagName(tag)[0];
  const t = encontrada?.textContent?.trim();
  return t || undefined;
}

function numero(valor: string | undefined): number | undefined {
  if (!valor) return undefined;
  const n = Number(valor);
  return Number.isFinite(n) ? n : undefined;
}

/** Acha o texto da primeira tag cujo nome local bate com algum candidato, em qualquer nível — usado pra tolerar variações de layout (NF-e padrão x NFS-e municipal). */
function buscarPorTags(doc: Document, candidatos: string[]): string | undefined {
  const alvo = new Set(candidatos.map((c) => c.toLowerCase()));
  const todos = doc.getElementsByTagName('*');
  for (let i = 0; i < todos.length; i++) {
    const el = todos[i];
    if (alvo.has(el.localName.toLowerCase())) {
      const t = el.textContent?.trim();
      if (t) return t;
    }
  }
  return undefined;
}

function parseItensNFe(doc: Document): ItemExtraido[] {
  const dets = doc.getElementsByTagName('det');
  const itens: ItemExtraido[] = [];
  for (let i = 0; i < dets.length; i++) {
    const prod = dets[i].getElementsByTagName('prod')[0];
    if (!prod) continue;
    const descricao = textoDaTag(prod, 'xProd');
    if (!descricao) continue;
    itens.push({
      descricao,
      quantidade: numero(textoDaTag(prod, 'qCom')),
      unidade: mapUnidade(textoDaTag(prod, 'uCom')),
      valorUnitario: numero(textoDaTag(prod, 'vUnCom')),
      valorTotal: numero(textoDaTag(prod, 'vProd')),
    });
  }
  return itens;
}

/**
 * NF-e modelo 55 (produto/mercadoria) tem layout nacional único (<det>/<prod>), então dá
 * pra extrair itens com confiança alta. NFS-e (serviço) não tem padrão nacional — cada
 * prefeitura define seu próprio XML — então aqui é só um chute best-effort por nomes de
 * tag comuns entre elas, com confiança mais baixa.
 */
export async function parseNFeXml(file: File): Promise<NotaFiscalExtraida> {
  const xmlTexto = await file.text();
  const doc = new DOMParser().parseFromString(xmlTexto, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return { categoriaDetectada: 'indeterminado', itens: [], confianca: 'baixa' };
  }

  const itensMaterial = parseItensNFe(doc);
  const fornecedorNome = buscarPorTags(doc, ['xNome', 'RazaoSocial', 'razaoSocial']);
  const fornecedorDocumento = digitos(buscarPorTags(doc, ['CNPJ', 'Cnpj', 'CPF', 'Cpf']));
  const numeroNF = buscarPorTags(doc, ['nNF', 'Numero', 'numero']);
  const dataBruta = buscarPorTags(doc, ['dhEmi', 'dEmi', 'DataEmissao', 'dataEmissao']);
  const data = dataBruta ? dataBruta.slice(0, 10) : undefined;
  const valorTotal = numero(buscarPorTags(doc, ['vNF', 'ValorServicos', 'valorServicos', 'ValorLiquidoNfse']));

  if (itensMaterial.length > 0) {
    return { fornecedorNome, fornecedorDocumento, numeroNF, data, categoriaDetectada: 'material', itens: itensMaterial, valorTotal, confianca: 'alta' };
  }

  const descricaoServico = buscarPorTags(doc, ['Discriminacao', 'discriminacao', 'DiscriminacaoServicos', 'Descricao', 'descricao']);
  const temIndicioDeServico = !!descricaoServico || !!buscarPorTags(doc, ['ValorServicos', 'valorServicos']);

  return {
    fornecedorNome,
    fornecedorDocumento,
    numeroNF,
    data,
    categoriaDetectada: temIndicioDeServico ? 'servico' : 'indeterminado',
    itens: descricaoServico ? [{ descricao: descricaoServico, valorTotal, quantidade: 1, unidade: 'verba' }] : [],
    valorTotal,
    confianca: temIndicioDeServico ? 'media' : 'baixa',
  };
}
