import type { ApiFieldError } from '@/lib/api/mutator';

// Maps the API's field paths to BidPartInputs keys, per part type.
export function serverErrors(
  fields: ApiFieldError[],
  replacementPart?: string,
): Record<string, Record<string, string>> {
  const byPart: Record<string, Record<string, string>> = {};
  const put = (part: string, key: string, code: string) => {
    byPart[part] = { ...byPart[part], [key]: code };
  };
  for (const { field, code } of fields) {
    let m = /^(?:files)\[([a-z_]+)\]\[([^\]]+)\]$/.exec(field);
    if (m) put(m[1], `file:${m[2]}`, code);
    else if ((m = /^languages\[([a-z_]+)\]\[([^\]]+)\]$/.exec(field)))
      put(m[1], `language:${m[2]}`, code);
    else if (replacementPart && (m = /^(files|languages)\[([^\]]+)\]$/.exec(field)))
      put(replacementPart, `${m[1] === 'files' ? 'file' : 'language'}:${m[2]}`, code);
    else if ((m = /^answers\.([a-z_]+)\.(.+)$/.exec(field))) put(m[1], m[2], code);
    else if ((m = /(?:^|\.)legalInformation\.(.+)$/.exec(field)))
      put('legal_information', m[1], code);
  }
  return byPart;
}
