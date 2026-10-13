const ALLOWED_TAGS = new Set(['A','B','BLOCKQUOTE','BR','CODE','DEL','DETAILS','DIV','EM','H1','H2','H3','HR','I','IMG','INPUT','LI','OL','P','PRE','S','SPAN','STRONG','SUB','SUMMARY','SUP','TABLE','TBODY','TD','TH','THEAD','TR','U','UL']);
const SAFE_COLORS = /^(#[\da-f]{3,8}|rgba?\([\d.%\s,]+\)|hsla?\([\d.%\s,deg]+\)|[a-z]{3,20})$/i;

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
      const src = child.tagName === 'IMG' ? child.getAttribute('src') : null;
      const alt = child.tagName === 'IMG' ? (child.getAttribute('alt') || '').slice(0,160) : '';
      const style = child.getAttribute('style') || '';
      const alignment = /text-align\s*:\s*(left|center|right|justify)/i.exec(style)?.[1]?.toLowerCase();
      const color = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(style)?.[1]?.trim();
      const background = /(?:^|;)\s*background-color\s*:\s*([^;]+)/i.exec(style)?.[1]?.trim();
      const inputType = child.tagName === 'INPUT' ? child.getAttribute('type') : null;
      const inputChecked = child.tagName === 'INPUT' && child.hasAttribute('checked');
      for (const attribute of [...child.attributes]) child.removeAttribute(attribute.name);
      const safeStyles = [];
      if (alignment && ['P','DIV','H1','H2','H3','BLOCKQUOTE','PRE'].includes(child.tagName)) safeStyles.push(`text-align:${alignment}`);
      if (color && SAFE_COLORS.test(color)) safeStyles.push(`color:${color}`);
      if (background && SAFE_COLORS.test(background)) safeStyles.push(`background-color:${background}`);
      if (safeStyles.length) child.setAttribute('style', safeStyles.join(';'));
      if (child.tagName === 'A' && href && /^(https?:\/\/|mailto:)/i.test(href)) {
        child.setAttribute('href', href);
        child.setAttribute('target', '_blank');
        child.setAttribute('rel', 'noopener noreferrer');
      }
      if (child.tagName === 'IMG' && src && /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z\d+/=]+$/i.test(src) && src.length <= 100000) {
        child.setAttribute('src', src);
        child.setAttribute('alt', alt);
        child.setAttribute('loading', 'lazy');
      } else if (child.tagName === 'IMG') {
        child.replaceWith(document.createTextNode(alt ? `[Image: ${alt}]` : '[Image removed]'));
        continue;
      }
      if (child.tagName === 'INPUT') {
        if (inputType !== 'checkbox') { child.replaceWith(document.createTextNode('')); continue; }
        child.setAttribute('type','checkbox');
        child.disabled = false;
        child.contentEditable = 'false';
        if (inputChecked) child.setAttribute('checked','');
      }
      clean(child);
    }
  };
  clean(parsed.body);
  return parsed.body.innerHTML;
}
