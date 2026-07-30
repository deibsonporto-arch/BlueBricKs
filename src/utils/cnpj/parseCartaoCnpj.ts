import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface CartaoCnpjExtraido {
  documento?: string;
  nome?: string;
  nomeFantasia?: string;
  porte?: string;
  dataAbertura?: string; // ISO
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  cidade?: string;
  uf?: string;
  telefone?: string;
  email?: string;
  situacaoCadastral?: string;
  dataSituacaoCadastral?: string; // ISO
}

function normalizar(s: string): string {
  return s.trim().toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/**
 * O "Comprovante de Inscrição e de Situação Cadastral" (cartão CNPJ) da Receita Federal é um
 * modelo nacional fixo — o pdf.js devolve o texto na ordem de leitura certa (rótulo seguido do
 * valor logo em seguida), então basta achar o rótulo exato e pegar o próximo item como valor.
 */
function valorApos(linhas: string[], rotulo: string): string | undefined {
  const idx = linhas.findIndex((l) => normalizar(l) === normalizar(rotulo));
  const valor = idx >= 0 ? linhas[idx + 1]?.trim() : undefined;
  return valor || undefined;
}

function paraIso(dataBr: string | undefined): string | undefined {
  const m = dataBr?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
}

const REGEX_CNPJ = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;

export async function parseCartaoCnpj(file: File): Promise<CartaoCnpjExtraido> {
  try {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pagina = await pdf.getPage(1);
    const conteudo = await pagina.getTextContent();
    const linhas = conteudo.items
      .filter((item): item is { str: string } & typeof item => 'str' in item)
      .map((item) => item.str.trim())
      .filter(Boolean);

    const documentoBruto = valorApos(linhas, 'NÚMERO DE INSCRIÇÃO');
    const documento = documentoBruto && REGEX_CNPJ.test(documentoBruto) ? documentoBruto : undefined;

    return {
      documento,
      nome: valorApos(linhas, 'NOME EMPRESARIAL'),
      nomeFantasia: valorApos(linhas, 'TÍTULO DO ESTABELECIMENTO (NOME DE FANTASIA)'),
      porte: valorApos(linhas, 'PORTE'),
      dataAbertura: paraIso(valorApos(linhas, 'DATA DE ABERTURA')),
      logradouro: valorApos(linhas, 'LOGRADOURO'),
      numero: valorApos(linhas, 'NÚMERO'),
      complemento: valorApos(linhas, 'COMPLEMENTO'),
      bairro: valorApos(linhas, 'BAIRRO/DISTRITO'),
      cep: valorApos(linhas, 'CEP'),
      cidade: valorApos(linhas, 'MUNICÍPIO'),
      uf: valorApos(linhas, 'UF'),
      telefone: valorApos(linhas, 'TELEFONE'),
      email: valorApos(linhas, 'ENDEREÇO ELETRÔNICO'),
      situacaoCadastral: valorApos(linhas, 'SITUAÇÃO CADASTRAL'),
      dataSituacaoCadastral: paraIso(valorApos(linhas, 'DATA DA SITUAÇÃO CADASTRAL')),
    };
  } catch {
    return {};
  }
}
