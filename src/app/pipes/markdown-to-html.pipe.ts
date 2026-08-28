import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

@Pipe({
  name: 'markdownToHtml',
  standalone: true,
})
export class MarkdownToHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    if (!value) return '';

    const renderer = new marked.Renderer();

    // Open links in new tab
    renderer.link = ({ href, title, text }: any) => {
      const titleAttr = title ? ` title="${title}"` : '';
      return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
    };

    // Wrap every table in a scrollable div so it doesn't overflow the narrow chat panel
    renderer.table = (token: any) => {
      // Build header row
      const headerCells = token.header
        .map((cell: any) => `<th>${cell.text}</th>`)
        .join('');
      const headerHtml = `<thead><tr>${headerCells}</tr></thead>`;

      // Build body rows
      const bodyRows = token.rows
        .map((row: any) => {
          const cells = row.map((cell: any) => `<td>${cell.text}</td>`).join('');
          return `<tr>${cells}</tr>`;
        })
        .join('');
      const bodyHtml = `<tbody>${bodyRows}</tbody>`;

      return `<div class="table-scroll-wrapper"><table>${headerHtml}${bodyHtml}</table></div>`;
    };

    const html = marked.parse(value, { renderer, async: false }) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
