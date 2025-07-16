// Функция нормализации URL
const normalizeUrl = (url: string): string => {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
};

let highlightEnabled = false;
let visitedSet = new Set<string>();
let domainFilter = "";
let highlightColor = "#ffff99";
let isInitialized = false;

// Инициализация
chrome.storage.local.get(
  ["highlightEnabled", "visitedUrls", "domainFilter", "highlightColor"],
  (data) => {
    highlightEnabled = data.highlightEnabled ?? false;
    visitedSet = new Set((data.visitedUrls ?? []).map(normalizeUrl));
    domainFilter = data.domainFilter ?? "";
    highlightColor = data.highlightColor ?? "#ffff99";
    isInitialized = true;

    updateHighlighting();
  }
);

chrome.storage.onChanged.addListener((changes) => {
  if ("highlightEnabled" in changes) {
    highlightEnabled = changes.highlightEnabled.newValue;
  }
  if ("visitedUrls" in changes) {
    visitedSet = new Set(
      (changes.visitedUrls.newValue ?? []).map(normalizeUrl)
    );
  }
  if ("domainFilter" in changes) {
    domainFilter = changes.domainFilter.newValue ?? "";
  }
  if ("highlightColor" in changes) {
    highlightColor = changes.highlightColor.newValue ?? "#ffff99";
  }

  if (isInitialized) {
    updateHighlighting();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "ENABLE_HIGHLIGHT") {
    highlightEnabled = true;
    if (message.color) highlightColor = message.color;
    updateHighlighting();
  }

  if (message.type === "DISABLE_HIGHLIGHT") {
    highlightEnabled = false;
    updateHighlighting();
  }

  if (message.type === "UPDATE_HIGHLIGHT_COLOR") {
    highlightColor = message.color ?? "#ffff99";
    updateHighlighting();
  }

  if (message.type === "UPDATE_VISITED_URLS") {
    visitedSet = new Set((message.urls ?? []).map(normalizeUrl));
    if (message.color) highlightColor = message.color;
    updateHighlighting();
  }

  if (message.type === "UPDATE_HIGHLIGHT") {
    updateHighlighting();
  }
});

function updateHighlighting() {
  if (!isInitialized) return;

  removeHighlight();

  if (highlightEnabled && domainMatches(domainFilter)) {
    highlightLinks();
  }
}

function highlightLinks() {
  const links = document.querySelectorAll<HTMLAnchorElement>("a[href]");
  links.forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
      return;
    }

    try {
      const normalizedHref = normalizeUrl(link.href);
      if (visitedSet.has(normalizedHref)) {
        link.style.backgroundColor = highlightColor;
        link.style.borderBottom = `2px solid ${highlightColor}`;
      }
    } catch (e) {
      console.debug("Skipping invalid URL", link.href);
    }
  });
}

function removeHighlight() {
  const links = document.querySelectorAll<HTMLAnchorElement>("a[href]");
  links.forEach((link) => {
    link.style.backgroundColor = "";
    link.style.borderBottom = "";
  });
}

function domainMatches(filter: string): boolean {
  if (!filter) return true;

  try {
    const currentHost = window.location.hostname;
    const escaped = filter.replace(/\./g, "\\.").replace(/\*/g, ".*");
    const re = new RegExp(`^${escaped}$`, "i");
    return re.test(currentHost);
  } catch {
    return false;
  }
}
