/** Gera um arquivo .doc (HTML compatível com Word) e dispara o download. */
export function downloadHtmlAsWord(filename: string, title: string, bodyHtml: string) {
  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${title}</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1a1a1a; }
  h2 { font-size: 16pt; margin-bottom: 4px; }
  h3 { font-size: 12pt; margin: 14px 0 4px; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; font-size: 10pt; }
  th { background: #f2f2f2; }
  .muted { color: #666; }
  .badge { color: #0a7a3d; font-weight: 700; font-size: 9pt; margin-left: 6px; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.doc') ? filename : `${filename}.doc`;
  link.click();
  URL.revokeObjectURL(url);
}
