/* ============================================================
   Общая логика сайта и всех инструментов.
   Никаких библиотек: только браузерные API.
   ============================================================ */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const tool = document.body.dataset.tool || '';

  /* ---------- Тема ---------- */
  function safeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function safeSet(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }

  const savedTheme = safeGet('ot-theme');
  if (savedTheme === 'dark' || savedTheme === 'light') {
    document.documentElement.dataset.theme = savedTheme;
  }
  const themeBtn = $('[data-theme-toggle]');
  function updateThemeIcon() {
    if (!themeBtn) return;
    themeBtn.textContent = document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙';
    themeBtn.setAttribute('aria-label', 'Переключить тёмную тему');
  }
  updateThemeIcon();
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      safeSet('ot-theme', next);
      updateThemeIcon();
    });
  }

  /* ---------- Уведомления ---------- */
  let toastTimer;
  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function setStatus(message, type) {
    const el = $('#status');
    if (!el) return;
    el.textContent = message || '';
    el.className = 'status' + (type ? ' ' + type : '');
  }

  /* ---------- Копирование / очистка ---------- */
  function getSourceText(el) {
    if (!el) return '';
    if (typeof el.value === 'string') return el.value;
    return el.textContent || '';
  }

  $$('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const text = getSourceText(document.getElementById(btn.dataset.copy));
      if (!text) { toast('Нечего копировать'); return; }
      try {
        await navigator.clipboard.writeText(text);
        toast('Скопировано в буфер обмена');
      } catch (e) {
        const tmp = document.createElement('textarea');
        tmp.value = text;
        tmp.style.position = 'fixed';
        tmp.style.opacity = '0';
        document.body.appendChild(tmp);
        tmp.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
        tmp.remove();
        toast(ok ? 'Скопировано в буфер обмена' : 'Не удалось скопировать — выделите текст вручную');
      }
    });
  });

  $$('[data-clear]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.dataset.clear.split(/\s+/).forEach(function (id) {
        const el = document.getElementById(id);
        if (!el) return;
        if (typeof el.value === 'string') el.value = '';
        else el.textContent = '';
      });
      setStatus('');
      toast('Поля очищены');
    });
  });

  /* ---------- Вспомогательные функции ---------- */
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(2) + ' МБ';
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function updateStats(el, text) { if (el) el.textContent = text; }

  /* ============================================================
     1. Конвертер изображений
     ============================================================ */
  function initImage() {
    const fileInput = $('#img-file');
    const drop = $('#img-drop');
    const preview = $('#img-preview');
    const previewWrap = $('#img-preview-wrap');
    const fmt = $('#img-format');
    const qualityField = $('#img-quality-field');
    const bgField = $('#img-bg-field');
    const widthInput = $('#img-width');
    const heightInput = $('#img-height');
    const keepRatio = $('#img-keep-ratio');
    const downloadBtn = $('#img-download');
    const state = { img: null, blob: null, url: null, name: 'image' };

    if (!fileInput || !drop) return;

    function clearUrl() { if (state.url) { URL.revokeObjectURL(state.url); state.url = null; } }

    function loadFile(file) {
      if (!file) return;
      if (!file.type || file.type.indexOf('image/') !== 0) {
        setStatus('Это не изображение. Выберите PNG, JPG, WebP, GIF или BMP.', 'error');
        return;
      }
      clearUrl();
      state.blob = null;
      state.img = null;
      downloadBtn.disabled = true;
      setStatus('Загружаем изображение…');

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        state.url = url;
        state.img = img;
        state.name = (file.name || 'image').replace(/\.[^.]+$/, '');
        preview.src = url;
        previewWrap.hidden = false;
        widthInput.value = img.naturalWidth;
        heightInput.value = img.naturalHeight;
        $('#img-original').textContent = img.naturalWidth + ' × ' + img.naturalHeight + ' · ' + formatBytes(file.size);
        $('#img-result').textContent = 'Нажмите «Преобразовать», чтобы получить файл';
        setStatus('Изображение загружено', 'ok');
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        setStatus('Не удалось прочитать изображение. Попробуйте другой файл.', 'error');
      };
      img.src = url;
    }

    fileInput.addEventListener('change', function (e) { loadFile(e.target.files[0]); });

    drop.addEventListener('click', function () { fileInput.click(); });
    drop.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });
    ['dragenter', 'dragover'].forEach(function (type) {
      drop.addEventListener(type, function (e) { e.preventDefault(); drop.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(function (type) {
      drop.addEventListener(type, function (e) { e.preventDefault(); drop.classList.remove('dragover'); });
    });
    drop.addEventListener('drop', function (e) { loadFile(e.target.files && e.target.files[0]); });

    function syncRatio(source) {
      if (!keepRatio.checked || !state.img) return;
      const ratio = state.img.naturalWidth / state.img.naturalHeight;
      if (source === 'width' && widthInput.value) {
        heightInput.value = Math.max(1, Math.round(Number(widthInput.value) / ratio));
      } else if (source === 'height' && heightInput.value) {
        widthInput.value = Math.max(1, Math.round(Number(heightInput.value) * ratio));
      }
    }
    widthInput.addEventListener('input', function () { syncRatio('width'); });
    heightInput.addEventListener('input', function () { syncRatio('height'); });

    function toggleFormatFields() {
      const value = fmt.value;
      qualityField.classList.toggle('hidden', value === 'png');
      bgField.classList.toggle('hidden', value === 'png');
    }
    fmt.addEventListener('change', toggleFormatFields);
    toggleFormatFields();
    $('#img-quality').addEventListener('input', function () {
      $('#img-quality-val').textContent = $('#img-quality').value;
    });

    $('#img-convert').addEventListener('click', function () {
      if (!state.img) { setStatus('Сначала выберите изображение', 'error'); return; }
      const format = fmt.value;
      const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[format];
      let w = parseInt(widthInput.value, 10);
      let h = parseInt(heightInput.value, 10);
      if (!w || !h || w < 1 || h < 1) { setStatus('Укажите корректные размеры', 'error'); return; }
      w = Math.min(w, 16384); h = Math.min(h, 16384);

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (format !== 'png') {
        ctx.fillStyle = $('#img-bg').value || '#ffffff';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(state.img, 0, 0, w, h);

      const quality = Number($('#img-quality').value) / 100;
      function finish(blob, usedMime, ext) {
        if (!blob) { setStatus('Браузер не смог создать файл этого формата', 'error'); return; }
        state.blob = blob;
        downloadBtn.disabled = false;
        $('#img-result').textContent = ext.toUpperCase() + ' · ' + w + ' × ' + h + ' · ' + formatBytes(blob.size);
        setStatus('Готово! Файл можно скачать', 'ok');
        state.ext = ext;
        state.mime = usedMime;
      }
      try {
        canvas.toBlob(function (blob) { finish(blob, mime, format === 'jpeg' ? 'jpg' : format); }, mime, quality);
      } catch (e) {
        // Некоторые браузеры не поддерживают WebP — пробуем PNG
        canvas.toBlob(function (blob) { finish(blob, 'image/png', 'png'); }, 'image/png');
      }
    });

    downloadBtn.addEventListener('click', function () {
      if (!state.blob) return;
      const link = document.createElement('a');
      const url = URL.createObjectURL(state.blob);
      link.href = url;
      link.download = state.name + '-converted.' + (state.ext || 'png');
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    });
  }

  /* ============================================================
     2. Форматтер JSON
     ============================================================ */
  function initJson() {
    const input = $('#json-input');
    const output = $('#json-output');
    const indent = $('#json-indent');

    function indentValue() { return indent.value === 'tab' ? '\t' : Number(indent.value); }

    function process(minify) {
      try {
        const data = JSON.parse(input.value);
        output.value = minify ? JSON.stringify(data) : JSON.stringify(data, null, indentValue());
        setStatus(minify ? 'JSON минифицирован' : 'JSON отформатирован', 'ok');
        updateStats($('#json-stats'), output.value.length.toLocaleString('ru-RU') + ' символов · ' +
          output.value.split('\n').length + ' строк');
      } catch (e) {
        setStatus('Ошибка JSON: ' + e.message, 'error');
      }
    }

    $('#json-format').addEventListener('click', function () { process(false); });
    $('#json-minify').addEventListener('click', function () { process(true); });
    $('#json-validate').addEventListener('click', function () {
      try { JSON.parse(input.value); setStatus('JSON корректен ✓', 'ok'); }
      catch (e) { setStatus('Ошибка: ' + e.message, 'error'); }
    });
    $('#json-sample').addEventListener('click', function () {
      input.value = JSON.stringify({
        название: 'Пример', активен: true, количество: 3,
        теги: ['работа', 'json'], пользователь: { имя: 'Анна', возраст: 30 }
      }, null, 2);
      setStatus('Пример загружен', 'ok');
    });
    $('#json-swap').addEventListener('click', function () {
      if (!output.value) { toast('Сначала отформатируйте JSON'); return; }
      const tmp = input.value; input.value = output.value; output.value = tmp;
    });
  }

  /* ============================================================
     3. CSV ↔ JSON
     ============================================================ */
  function initCsvJson() {
    const input = $('#csv-input');
    const output = $('#csv-output');
    const direction = $('#csv-direction');
    const delimiterSelect = $('#csv-delimiter');

    function delimiter() {
      const v = delimiterSelect.value;
      return v === 'tab' ? '\t' : v;
    }

    function parseCSV(text, delim) {
      text = text.replace(/^\uFEFF/, '');
      const rows = []; let row = []; let field = ''; let quoted = false;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
          if (c === '"') {
            if (text[i + 1] === '"') { field += '"'; i++; }
            else quoted = false;
          } else field += c;
        } else if (c === '"') {
          quoted = true;
        } else if (c === delim) {
          row.push(field); field = '';
        } else if (c === '\n' || c === '\r') {
          if (c === '\r' && text[i + 1] === '\n') i++;
          row.push(field); rows.push(row); row = []; field = '';
        } else {
          field += c;
        }
      }
      if (field !== '' || row.length) { row.push(field); rows.push(row); }
      while (rows.length && rows[rows.length - 1].every(function (v) { return v === ''; })) rows.pop();
      return rows;
    }

    function csvCell(value, delim) {
      let v = value == null ? '' : String(value);
      if (typeof value === 'object' && value !== null) v = JSON.stringify(value);
      if (v.indexOf('"') >= 0 || v.indexOf('\n') >= 0 || v.indexOf('\r') >= 0 || v.indexOf(delim) >= 0) {
        return '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    }

    function convert() {
      const delim = delimiter();
      try {
        if (direction.value === 'csv-to-json') {
          const rows = parseCSV(input.value, delim);
          if (!rows.length) throw new Error('Таблица пуста');
          let result;
          if ($('#csv-header').checked) {
            const headers = rows[0].map(function (h, i) { return h.trim() || ('колонка_' + (i + 1)); });
            result = rows.slice(1).map(function (r) {
              const obj = {};
              headers.forEach(function (h, i) { obj[h] = r[i] == null ? '' : r[i]; });
              return obj;
            });
          } else {
            result = rows;
          }
          output.value = JSON.stringify(result, null, 2);
          setStatus('Преобразовано строк: ' + result.length, 'ok');
        } else {
          const data = JSON.parse(input.value);
          if (!Array.isArray(data)) throw new Error('Ожидается JSON-массив');
          let headers = [], records;
          if (data.length && typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0])) {
            headers = [];
            data.forEach(function (obj) {
              Object.keys(obj || {}).forEach(function (key) { if (headers.indexOf(key) < 0) headers.push(key); });
            });
            records = data.map(function (obj) { return headers.map(function (h) { return obj ? obj[h] : ''; }); });
          } else {
            records = data.map(function (r) { return Array.isArray(r) ? r : [r]; });
          }
          const lines = [];
          if (headers.length) lines.push(headers.map(function (h) { return csvCell(h, delim); }).join(delim));
          records.forEach(function (r) { lines.push(r.map(function (v) { return csvCell(v, delim); }).join(delim)); });
          output.value = lines.join('\r\n');
          setStatus('Преобразовано записей: ' + records.length, 'ok');
        }
      } catch (e) {
        setStatus('Ошибка: ' + e.message, 'error');
      }
    }

    $('#csv-convert').addEventListener('click', convert);
    $('#csv-sample').addEventListener('click', function () {
      direction.value = 'csv-to-json';
      input.value = 'имя;возраст;город\nАнна;30;Москва\nИван;25;Казань\nМария;41;Санкт-Петербург';
      setStatus('Пример загружен', 'ok');
    });
    $('#csv-direction').addEventListener('change', function () {
      $('#csv-header-field').classList.toggle('hidden', direction.value !== 'csv-to-json');
    });
    $('#csv-header-field').classList.toggle('hidden', direction.value !== 'csv-to-json');
  }

  /* ============================================================
     4. Base64
     ============================================================ */
  function initBase64() {
    const input = $('#b64-input');
    const output = $('#b64-output');
    const mode = $('#b64-mode');

    function encode(text) {
      const bytes = new TextEncoder().encode(text);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    }
    function decode(text) {
      const clean = text.replace(/\s/g, '');
      const binary = atob(clean);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    }

    function convert() {
      try {
        output.value = mode.value === 'encode' ? encode(input.value) : decode(input.value);
        setStatus('Готово', 'ok');
      } catch (e) {
        setStatus('Ошибка: строка не является корректным Base64', 'error');
      }
    }
    $('#b64-convert').addEventListener('click', convert);
    $('#b64-swap').addEventListener('click', function () {
      if (!output.value) { toast('Сначала выполните преобразование'); return; }
      const tmp = input.value; input.value = output.value; output.value = tmp;
      mode.value = mode.value === 'encode' ? 'decode' : 'encode';
    });
    $('#b64-sample').addEventListener('click', function () {
      mode.value = 'encode'; input.value = 'Привет, мир! Это текст на русском 🙌';
      setStatus('Пример загружен', 'ok');
    });
  }

  /* ============================================================
     5. URL-кодирование
     ============================================================ */
  function initUrl() {
    const input = $('#url-input');
    const output = $('#url-output');
    const mode = $('#url-mode');
    const plus = $('#url-plus');

    function convert() {
      try {
        if (mode.value === 'encode') {
          let result = encodeURIComponent(input.value);
          if (plus.checked) result = result.replace(/%20/g, '+');
          output.value = result;
        } else {
          let source = input.value.replace(/\+/g, plus.checked ? ' ' : '+');
          output.value = decodeURIComponent(source);
        }
        setStatus('Готово', 'ok');
      } catch (e) {
        setStatus('Ошибка: некорректная URL-строка', 'error');
      }
    }
    $('#url-convert').addEventListener('click', convert);
    $('#url-sample').addEventListener('click', function () {
      mode.value = 'encode';
      input.value = 'https://online-tools.pengu1n10998.workers.dev/search?q=кофе и чай&sort=по цене';
      setStatus('Пример загружен', 'ok');
    });
    $('#url-swap').addEventListener('click', function () {
      if (!output.value) { toast('Сначала выполните преобразование'); return; }
      const tmp = input.value; input.value = output.value; output.value = tmp;
      mode.value = mode.value === 'encode' ? 'decode' : 'encode';
    });
  }

  /* ============================================================
     6. Текстовые утилиты
     ============================================================ */
  function initText() {
    const input = $('#text-input');
    const output = $('#text-output');

    function words(s) { const m = s.trim().match(/[^\s]+/g); return m ? m.length : 0; }
    function lines(s) { return s === '' ? 0 : s.split(/\r\n|\r|\n/).length; }
    function chars(s) { return Array.from(s).length; }

    function refreshStats(s) {
      updateStats($('#text-stats'),
        chars(s) + ' символов · ' +
        chars(s.replace(/\s/g, '')) + ' без пробелов · ' +
        words(s) + ' слов · ' + lines(s) + ' строк');
    }
    input.addEventListener('input', function () { refreshStats(input.value); });
    refreshStats(input.value);

    const transforms = {
      upper: function (s) { return s.toLocaleUpperCase('ru-RU'); },
      lower: function (s) { return s.toLocaleLowerCase('ru-RU'); },
      title: function (s) {
        return s.replace(/\S+/g, function (w) {
          const chars = Array.from(w);
          return chars[0].toLocaleUpperCase('ru-RU') + chars.slice(1).join('').toLocaleLowerCase('ru-RU');
        });
      },
      sentence: function (s) {
        return s.toLocaleLowerCase('ru-RU').replace(/(^|[.!?]\s+)([\s\S])/g, function (_, prefix, ch) {
          return prefix + ch.toLocaleUpperCase('ru-RU');
        });
      },
      reverse: function (s) { return Array.from(s).reverse().join(''); },
      reverselines: function (s) { return s.split(/\r\n|\r|\n/).reverse().join('\n'); },
      trim: function (s) { return s.replace(/[ \t]+/g, ' ').replace(/ *$/gm, '').replace(/^\s+|\s+$/g, ''); },
      emptylines: function (s) { return s.split(/\r\n|\r|\n/).filter(function (l) { return l.trim() !== ''; }).join('\n'); },
      number: function (s) {
        return s.split(/\r\n|\r|\n/).map(function (l, i) { return (i + 1) + '. ' + l; }).join('\n');
      },
      unique: function (s) {
        const seen = new Set();
        return s.split(/\r\n|\r|\n/).filter(function (l) {
          if (seen.has(l)) return false; seen.add(l); return true;
        }).join('\n');
      }
    };

    $$('[data-transform]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const fn = transforms[btn.dataset.transform];
        if (!fn) return;
        output.value = fn(input.value);
        setStatus('Готово: ' + btn.textContent.trim(), 'ok');
      });
    });
    $('#text-to-input').addEventListener('click', function () {
      if (!output.value) { toast('Сначала выберите операцию'); return; }
      input.value = output.value;
      refreshStats(input.value);
    });
    $('#text-sample').addEventListener('click', function () {
      input.value = '  привет   мир\nэтот текст\nнужно отформатировать  \n\nэтот текст';
      refreshStats(input.value);
    });
  }

  /* ============================================================
     7. Конвертер цветов
     ============================================================ */
  function initColor() {
    const picker = $('#color-picker');
    const hexInput = $('#color-hex');
    const rSlider = $('#color-r'), gSlider = $('#color-g'), bSlider = $('#color-b');
    const hSlider = $('#color-h'), sSlider = $('#color-s'), lSlider = $('#color-l');

    function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
    function rgbToHex(r, g, b) {
      return '#' + [r, g, b].map(function (n) { return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0'); }).join('');
    }
    function hexToRgb(hex) {
      let v = hex.trim().replace(/^#/, '');
      if (v.length === 3) v = v.split('').map(function (c) { return c + c; }).join('');
      if (!/^[\da-f]{6}$/i.test(v)) return null;
      return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
    }
    function rgbToHsl(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0; const l = (max + min) / 2;
      const d = max - min;
      if (d !== 0) {
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
      }
      return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
    }
    function hslToRgb(h, s, l) {
      h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = l - c / 2;
      let rgb;
      if (h < 60) rgb = [c, x, 0];
      else if (h < 120) rgb = [x, c, 0];
      else if (h < 180) rgb = [0, c, x];
      else if (h < 240) rgb = [0, x, c];
      else if (h < 300) rgb = [x, 0, c];
      else rgb = [c, 0, x];
      return rgb.map(function (v) { return Math.round((v + m) * 255); });
    }
    function rgbToHsv(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      let h = 0;
      if (d !== 0) {
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
      }
      return [Math.round(h), max === 0 ? 0 : Math.round(d / max * 100), Math.round(max * 100)];
    }

    function render(r, g, b, hslOverride) {
      r = clamp(Math.round(r), 0, 255); g = clamp(Math.round(g), 0, 255); b = clamp(Math.round(b), 0, 255);
      const hex = rgbToHex(r, g, b);
      const hsl = hslOverride || rgbToHsl(r, g, b);
      const hsv = rgbToHsv(r, g, b);

      picker.value = hex;
      hexInput.value = hex;
      [[rSlider, r, '#color-r-val'], [gSlider, g, '#color-g-val'], [bSlider, b, '#color-b-val']].forEach(function (item) {
        item[0].value = item[1]; $(item[2]).textContent = item[1];
      });
      [[hSlider, hsl[0], '#color-h-val'], [sSlider, hsl[1], '#color-s-val'], [lSlider, hsl[2], '#color-l-val']].forEach(function (item) {
        item[0].value = item[1]; $(item[2]).textContent = item[1];
      });
      $('#color-preview').style.background = hex;
      $('#out-hex').textContent = hex.toUpperCase();
      $('#out-rgb').textContent = 'rgb(' + r + ', ' + g + ', ' + b + ')';
      $('#out-hsl').textContent = 'hsl(' + hsl[0] + ', ' + hsl[1] + '%, ' + hsl[2] + '%)';
      $('#out-hsv').textContent = 'hsv(' + hsv[0] + ', ' + hsv[1] + '%, ' + hsv[2] + '%)';
      setStatus('');
    }

    picker.addEventListener('input', function () {
      const rgb = hexToRgb(picker.value);
      if (rgb) render(rgb[0], rgb[1], rgb[2]);
    });
    hexInput.addEventListener('input', function () {
      const rgb = hexToRgb(hexInput.value);
      if (rgb) render(rgb[0], rgb[1], rgb[2]);
      else setStatus('Введите HEX вида #4F46E5', 'error');
    });
    [rSlider, gSlider, bSlider].forEach(function (slider) {
      slider.addEventListener('input', function () {
        render(Number(rSlider.value), Number(gSlider.value), Number(bSlider.value));
      });
    });
    [hSlider, sSlider, lSlider].forEach(function (slider) {
      slider.addEventListener('input', function () {
        const hsl = [Number(hSlider.value), Number(sSlider.value), Number(lSlider.value)];
        const rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
        render(rgb[0], rgb[1], rgb[2], hsl);
      });
    });
    $('#color-random').addEventListener('click', function () {
      render(Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256));
    });
    render(79, 70, 229);
  }

  /* ============================================================
     8. Генератор хешей
     ============================================================ */
  function initHash() {
    const input = $('#hash-input');
    const output = $('#hash-output');
    const algo = $('#hash-algo');
    let timer;

    async function compute() {
      if (!window.crypto || !crypto.subtle) {
        setStatus('Web Crypto недоступен. Откройте сайт по HTTPS или через localhost.', 'error');
        return;
      }
      try {
        const bytes = new TextEncoder().encode(input.value);
        const digest = await crypto.subtle.digest(algo.value, bytes);
        const hex = Array.from(new Uint8Array(digest)).map(function (b) {
          return b.toString(16).padStart(2, '0');
        }).join('');
        output.value = hex;
        updateStats($('#hash-stats'), (hex.length / 2) + ' байт · ' + algo.value);
        setStatus('Готово', 'ok');
      } catch (e) {
        setStatus('Ошибка вычисления: ' + e.message, 'error');
      }
    }
    $('#hash-go').addEventListener('click', compute);
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(compute, 300); });
    algo.addEventListener('change', compute);
    $('#hash-sample').addEventListener('click', function () { input.value = 'Привет, мир!'; compute(); });
  }

  /* ============================================================
     9. Системы счисления
     ============================================================ */
  function initNumberBase() {
    const input = $('#nb-input');
    const from = $('#nb-from');
    const output = $('#nb-output');

    function parseValue(text, base) {
      let s = text.trim().toLowerCase().replace(/[\s_']/g, '');
      let negative = false;
      if (s[0] === '-') { negative = true; s = s.slice(1); }
      else if (s[0] === '+') s = s.slice(1);
      if (s.indexOf('0x') === 0 && base === '16') s = s.slice(2);
      if (s.indexOf('0b') === 0 && base === '2') s = s.slice(2);
      if (s.indexOf('0o') === 0 && base === '8') s = s.slice(2);
      if (!s) throw new Error('Введите число');
      const b = BigInt(base);
      let n = 0n;
      for (const ch of s) {
        const digit = parseInt(ch, 36);
        if (!isFinite(digit) || digit >= Number(base)) {
          throw new Error('Цифра «' + ch + '» не подходит для основания ' + base);
        }
        n = n * b + BigInt(digit);
      }
      return negative ? -n : n;
    }

    function toBase(value, base) {
      const b = BigInt(base);
      if (value === 0n) return '0';
      const negative = value < 0n;
      let n = negative ? -value : value;
      const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
      let result = '';
      while (n > 0n) {
        result = digits[Number(n % b)] + result;
        n /= b;
      }
      return (negative ? '-' : '') + result;
    }

    function convert() {
      try {
        const value = parseValue(input.value, from.value);
        const bases = ['2', '8', '10', '16'];
        let html = '';
        bases.forEach(function (base) {
          const label = { '2': 'Двоичная', '8': 'Восьмеричная', '10': 'Десятичная', '16': 'Шестнадцатеричная' }[base];
          html += '<div class="color-result"><span>' + label + ' (' + base + ')</span><code data-copy-text="' +
            escapeHtml(toBase(value, base)) + '">' + escapeHtml(toBase(value, base)) + '</code>' +
            '<button type="button" class="btn btn-sm" data-copy-inline="' + escapeHtml(toBase(value, base)) + '">Копировать</button></div>';
        });
        output.innerHTML = html;
        setStatus('Готово', 'ok');
        bindInlineCopy(output);
      } catch (e) {
        setStatus('Ошибка: ' + e.message, 'error');
      }
    }

    function bindInlineCopy(root) {
      $$('[data-copy-inline]', root).forEach(function (btn) {
        btn.addEventListener('click', async function () {
          const text = btn.dataset.copyInline;
          try { await navigator.clipboard.writeText(text); toast('Скопировано'); }
          catch (e) { toast('Не удалось скопировать'); }
        });
      });
    }

    $('#nb-convert').addEventListener('click', convert);
    $('#nb-sample').addEventListener('click', function () { input.value = '255'; from.value = '10'; convert(); });
  }

  /* ============================================================
     10. Unix-время
     ============================================================ */
  function initTimestamp() {
    const unix = $('#ts-unix');
    const unit = $('#ts-unit');
    const local = $('#ts-local');
    const utc = $('#ts-utc');
    const iso = $('#ts-iso');
    const dateInput = $('#ts-date');
    const pad = function (n) { return String(n).padStart(2, '0'); };

    function render(date) {
      local.textContent = date.toLocaleString('ru-RU');
      utc.textContent = date.toUTCString();
      iso.textContent = date.toISOString();
      dateInput.value = date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
        'T' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
      setStatus('Готово', 'ok');
    }

    function fromUnix() {
      const raw = unix.value.trim();
      if (!/^-?\d+(\.\d+)?$/.test(raw)) { setStatus('Введите число — метку времени', 'error'); return; }
      let ms = Number(raw);
      if (unit.value === 's') ms *= 1000;
      const d = new Date(ms);
      if (isNaN(d.getTime())) { setStatus('Некорректная метка времени', 'error'); return; }
      render(d);
    }

    function toUnix() {
      if (!dateInput.value) { setStatus('Выберите дату и время', 'error'); return; }
      const d = new Date(dateInput.value);
      if (isNaN(d.getTime())) { setStatus('Некорректная дата', 'error'); return; }
      unix.value = unit.value === 's' ? Math.floor(d.getTime() / 1000) : d.getTime();
      render(d);
    }

    $('#ts-from-unix').addEventListener('click', fromUnix);
    $('#ts-to-unix').addEventListener('click', toUnix);
    $('#ts-now').addEventListener('click', function () {
      const d = new Date();
      unix.value = unit.value === 's' ? Math.floor(d.getTime() / 1000) : d.getTime();
      render(d);
    });
    unit.addEventListener('change', function () {
      if (unix.value) fromUnix();
    });
    $('#ts-now').click();
  }

  /* ---------- Запуск нужного инструмента ---------- */
  const initializers = {
    image: initImage,
    json: initJson,
    csvjson: initCsvJson,
    base64: initBase64,
    url: initUrl,
    text: initText,
    color: initColor,
    hash: initHash,
    numberbase: initNumberBase,
    timestamp: initTimestamp
  };
  if (initializers[tool]) initializers[tool]();
})();
