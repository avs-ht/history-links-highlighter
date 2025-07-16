import React, { useState, useEffect, useCallback, useRef } from "react";
import "../styles/tailwind.css";

// Функция нормализации URL
const normalizeUrl = (url: string): string => {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
};

const LabelInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <label className="block mb-4">
    <span className="text-gray-700 font-medium mb-1 block">{label}</span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
    />
  </label>
);

const LabelDatetime: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => {
  const now = new Date();
  const maxDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  return (
    <label className="block mb-4">
      <span className="text-gray-700 font-medium mb-1 block">{label}</span>
      <input
        type="datetime-local"
        value={value}
        max={maxDate}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
    </label>
  );
};

const LabelColor: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <label className="block mb-4">
    <span className="text-gray-700 font-medium mb-1 block">{label}</span>
    <div className="flex items-center">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 p-1 border border-gray-300 rounded mr-3"
      />
      <span className="text-sm text-gray-600">{value}</span>
    </div>
  </label>
);

export const Popup: React.FC = () => {
  const [highlightEnabled, setHighlightEnabled] = useState(false);
  const [highlightColor, setHighlightColor] = useState("#00aaff");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [status, setStatus] = useState("");
  const isMounted = useRef(false);
  const initialLoadDone = useRef(false);

  // Загрузка сохраненных настроек
  useEffect(() => {
    chrome.storage.local.get(
      ["highlightEnabled", "highlightColor", "start", "end", "domainFilter"],
      (data) => {
        setHighlightEnabled(Boolean(data.highlightEnabled));
        setHighlightColor(data.highlightColor ?? "#00aaff");
        setStart(data.start ?? "");
        setEnd(data.end ?? "");
        setDomainFilter(data.domainFilter ?? "");
        isMounted.current = true;
      }
    );
  }, []);

  // Автоматическое применение фильтров при первом открытии попапа
  useEffect(() => {
    if (isMounted.current && !initialLoadDone.current) {
      initialLoadDone.current = true;

      // Если есть сохраненные фильтры - применяем их
      if (start || end || domainFilter) {
        handleApplyFilter();
      }
      // Если фильтров нет - загружаем всю историю
      else {
        handleApplyFilterWithNoDates();
      }
    }
  }, [start, end, domainFilter]);

  const handleToggle = () => {
    const newValue = !highlightEnabled;
    setHighlightEnabled(newValue);
    chrome.storage.local.set({ highlightEnabled: newValue });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: newValue ? "ENABLE_HIGHLIGHT" : "DISABLE_HIGHLIGHT",
          color: highlightColor,
        });
      }
    });
  };

  const handleColorChange = (color: string) => {
    setHighlightColor(color);
    chrome.storage.local.set({ highlightColor: color });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "UPDATE_HIGHLIGHT_COLOR",
          color,
        });
      }
    });
  };

  // Функция для загрузки всей истории без фильтров по датам
  const handleApplyFilterWithNoDates = useCallback(() => {
    setStatus("Получаю историю...");

    chrome.runtime.sendMessage(
      {
        type: "GET_HISTORY",
        startTime: 0,
        endTime: Date.now(),
      },
      (response) => {
        if (!response || !Array.isArray(response.urls)) {
          setStatus("Ошибка получения истории");
          return;
        }

        const normalizedUrls = response.urls
          .map((url: any) => normalizeUrl(url))
          .filter(Boolean) as string[];

        chrome.storage.local.set(
          {
            visitedUrls: normalizedUrls,
            start: "",
            end: "",
            domainFilter,
            highlightColor,
          },
          () => {
            setStatus(`Найдено: ${normalizedUrls.length} ссылок`);

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                  type: "UPDATE_VISITED_URLS",
                  urls: normalizedUrls,
                  color: highlightColor,
                });
              }
            });
          }
        );
      }
    );
  }, [domainFilter, highlightColor]);

  const handleApplyFilter = useCallback(() => {
    let startTime = 0;
    let endTime = Date.now();

    if (start) {
      startTime = new Date(start).getTime();
      if (isNaN(startTime)) {
        setStatus("Неверный формат даты начала");
        return;
      }
    }

    if (end) {
      endTime = new Date(end).getTime();
      if (isNaN(endTime)) {
        setStatus("Неверный формат даты конца");
        return;
      }
    }

    if (startTime > endTime) {
      setStatus("Дата начала должна быть меньше даты конца");
      return;
    }

    setStatus("Получаю историю...");

    chrome.runtime.sendMessage(
      {
        type: "GET_HISTORY",
        startTime,
        endTime,
      },
      (response) => {
        if (!response || !Array.isArray(response.urls)) {
          setStatus("Ошибка получения истории");
          return;
        }

        const normalizedUrls = response.urls
          .map((url: any) => normalizeUrl(url))
          .filter(Boolean) as string[];

        chrome.storage.local.set(
          {
            visitedUrls: normalizedUrls,
            start: start || "",
            end: end || "",
            domainFilter,
            highlightColor,
          },
          () => {
            setStatus(`Найдено: ${normalizedUrls.length} ссылок`);

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                  type: "UPDATE_VISITED_URLS",
                  urls: normalizedUrls,
                  color: highlightColor,
                });
              }
            });
          }
        );
      }
    );
  }, [start, end, domainFilter, highlightColor]);

  return (
    <div className="p-6 w-80 bg-white rounded-lg shadow-lg font-sans">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">
        Подсветка ссылок
      </h2>

      <label className="flex items-center space-x-3 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={highlightEnabled}
          onChange={handleToggle}
          className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
        />
        <span className="text-gray-700 select-none">Включить подсветку</span>
      </label>

      <LabelColor
        label="Цвет подсветки:"
        value={highlightColor}
        onChange={handleColorChange}
      />

      <hr className="my-4 border-gray-300" />

      <LabelInput
        label="Домен (например, *.crm.com):"
        value={domainFilter}
        onChange={setDomainFilter}
        placeholder="*.crm.com"
      />

      <LabelDatetime label="С:" value={start} onChange={setStart} />
      <LabelDatetime label="По:" value={end} onChange={setEnd} />

      <button
        onClick={handleApplyFilter}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-md shadow-md transition-colors duration-300"
      >
        Обновить ссылки
      </button>

      {status && (
        <div className="mt-4 text-sm text-gray-600 min-h-[1.5em]">{status}</div>
      )}
    </div>
  );
};
