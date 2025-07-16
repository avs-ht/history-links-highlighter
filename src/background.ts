// Функция нормализации URL
const normalizeUrl = (url: string): string => {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
};

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.type === "GET_HISTORY") {
    const { startTime = 0, endTime = Date.now() } = message;
    chrome.history.search(
      {
        text: "",
        startTime: startTime,
        endTime: endTime,
        maxResults: 10000,
      },
      (results) => {
        const visitedUrls = results
          .map((entry) => entry.url)
          .filter((url): url is string => !!url)
          .map(normalizeUrl);
        sendResponse({ urls: visitedUrls });
      }
    );
    return true;
  }
});

function fetchAndStoreHistoryWithFilters() {
  // Получаем сохраненные фильтры
  chrome.storage.local.get(
    ["start", "end", "domainFilter", "highlightColor"],
    (data) => {
      let startTime = 0;
      let endTime = Date.now();

      // Применяем фильтры по датам если они есть
      if (data.start) {
        const parsedStart = new Date(data.start).getTime();
        if (!isNaN(parsedStart)) {
          startTime = parsedStart;
        }
      }

      if (data.end) {
        const parsedEnd = new Date(data.end).getTime();
        if (!isNaN(parsedEnd)) {
          endTime = parsedEnd;
        }
      }

      // Загружаем историю с учетом фильтров
      chrome.history.search(
        {
          text: "",
          maxResults: 10000,
          startTime: startTime,
          endTime: endTime,
        },
        (results) => {
          const urls = results
            .map((entry) => entry.url)
            .filter((url): url is string => !!url)
            .map(normalizeUrl);

          chrome.storage.local.set({ visitedUrls: urls });
        }
      );
    }
  );
}

// Функция для загрузки всей истории (без фильтров)
function fetchAndStoreAllHistory() {
  chrome.history.search(
    { text: "", maxResults: 10000, startTime: 0 },
    (results) => {
      const urls = results
        .map((entry) => entry.url)
        .filter((url): url is string => !!url)
        .map(normalizeUrl);
      chrome.storage.local.set({ visitedUrls: urls });
    }
  );
}

chrome.runtime.onInstalled.addListener(() => {
  // При первой установке загружаем всю историю
  fetchAndStoreAllHistory();
});

chrome.runtime.onStartup.addListener(() => {
  // При запуске браузера загружаем историю с учетом сохраненных фильтров
  fetchAndStoreHistoryWithFilters();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        chrome.runtime.sendMessage({ type: "UPDATE_HIGHLIGHT" });
      },
    });
  }
});
