const ALLOWED_TAGS = new Set(['A','B','BLOCKQUOTE','BR','CODE','DIV','EM','H1','H2','H3','HR','I','LI','OL','P','PRE','SPAN','STRONG','U','UL']);

export function sanitizeNoteHtml(html) {
  const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const clean = node => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      if (!ALLOWED_TAGS.has(child.tagName)) {
        child.replaceWith(document.createTextNode(child.textContent || ''));
        continue;
      }
      const href = child.tagName === 'A' ? child.getAttribute('href') : null;
      for (const attribute of [...child.attributes]) child.removeAttribute(attribute.name);
      if (child.tagName === 'A' && href && /^(https?:\/\/|mailto:)/i.test(href)) {
        child.setAttribute('href', href);
        child.setAttribute('target', '_blank');
        child.setAttribute('rel', 'noopener noreferrer');
      }
      clean(child);
    }
  };
  clean(parsed.body);
  return parsed.body.innerHTML;
}
