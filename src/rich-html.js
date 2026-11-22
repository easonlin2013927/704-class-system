import DOMPurify from 'dompurify';

export function stripHtml(html) {
  const node = DOMPurify.sanitize(html,{RETURN_DOM_FRAGMENT:true,ALLOWED_TAGS:[],ALLOWED_ATTR:[]});
  return node.textContent || "";
}

export function sanitizeHtml(html = "") {
  const template = document.createElement("template");
  const allowed = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "MARK", "UL", "OL", "LI", "H2", "H3", "BLOCKQUOTE", "A", "SPAN", "FONT", "IMG"]);
  template.content.append(DOMPurify.sanitize(html,{RETURN_DOM_FRAGMENT:true,ALLOWED_TAGS:[...allowed],ALLOWED_ATTR:["href","src","alt","style"]}));

  template.content.querySelectorAll("*").forEach((element) => {
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED"].includes(element.tagName)) {
      element.remove();
      return;
    }
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }

    const imageSource = element.tagName === "IMG" ? element.getAttribute("src") : null;
    const imageAlt = element.getAttribute("alt") || "公告圖片";
    const highlight = element.style.backgroundColor;
    const href = element.tagName === "A" ? element.getAttribute("href") : null;
    [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));

    if (element.tagName === "IMG") {
      if (!imageSource || imageSource.length > 100000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(imageSource)) { element.remove(); return; }
      element.setAttribute("src", imageSource);
      element.setAttribute("alt", imageAlt);
      element.setAttribute("loading", "lazy");
    }

    if (highlight) element.style.backgroundColor = highlight;
    if (element.tagName === "A" && href) {
      try {
        const url = new URL(href, window.location.origin);
        if (["http:", "https:", "mailto:"].includes(url.protocol)) {
          element.setAttribute("href", url.href);
          element.setAttribute("target", "_blank");
          element.setAttribute("rel", "noopener noreferrer");
        }
      } catch {
        // Invalid links remain plain text.
      }
    }
  });
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) if (!walker.currentNode.parentElement?.closest("a")) textNodes.push(walker.currentNode);
  for (const node of textNodes) {
    const pattern = /https?:\/\/[^\s<>"'，。！？；、（）【】]+/g;
    const fragment = document.createDocumentFragment();
    let last = 0, match;
    while ((match = pattern.exec(node.textContent))) {
      const url = match[0].replace(/[.,!?;:)\]}]+$/, "");
      fragment.append(document.createTextNode(node.textContent.slice(last, match.index)));
      const link = document.createElement("a");
      link.href = url; link.textContent = url; link.target = "_blank"; link.rel = "noopener noreferrer";
      fragment.append(link); last = match.index + url.length;
    }
    if (last) { fragment.append(document.createTextNode(node.textContent.slice(last))); node.replaceWith(fragment); }
  }
  return DOMPurify.sanitize(template.innerHTML,{ALLOWED_TAGS:[...allowed],ALLOWED_ATTR:['href','target','rel','src','alt','loading','style']});
}
