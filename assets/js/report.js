(function () {
  'use strict';

  // ── Wait for quranIndex to be ready ─────────────────────────────────────
  // script.js loads the index asynchronously; poll until available.

  let _ready = false;

  function tryInit() {
    if (typeof state !== 'undefined' && state.quranIndex) {
      _ready = true;
      buildSuraDropdown();
      buildPageDropdown();
    } else {
      setTimeout(tryInit, 300);
    }
  }
  tryInit();

  // ── Index helpers ────────────────────────────────────────────────────────

  /** [{no, name}] for all 114 suras, in order */
  function getSuras() {
    const info = state.quranIndex?.sura_info || {};
    return Object.keys(info)
      .map(Number)
      .sort((a, b) => a - b)
      .map((no) => ({ no, name: info[no].name_ar }));
  }

  /** First (and canonical) page of a sura — from the index directly */
  function getFirstPageOfSura(suraNo) {
    return parseInt(state.quranIndex?.sura_to_page?.[String(suraNo)]) || null;
  }

  /** All pages that contain a given sura.
   *  page_to_suras is a map of pageNo → [suraNo, ...], so we invert it. */
  function getPagesForSura(suraNo) {
    const p2s = state.quranIndex?.page_to_suras || {};
    return Object.keys(p2s)
      .map(Number)
      .filter((pg) => p2s[pg].includes(suraNo))
      .sort((a, b) => a - b);
  }

  /** Sura numbers present on a given page */
  function getSurasOnPage(pageNo) {
    return state.quranIndex?.page_to_suras?.[String(pageNo)] || [];
  }

  /** Total ayah count for a sura (from index — no fetch needed) */
  function getAyahCountForSura(suraNo) {
    return state.quranIndex?.sura_info?.[String(suraNo)]?.ayah_count || 0;
  }

  // ── Async helpers (need page chunk) ──────────────────────────────────────

  /** Ayah numbers for a sura on a specific page — fetches the chunk if needed */
  async function getAyahsForSuraOnPage(suraNo, pageNo) {
    const ayahs = await loadPageChunk(pageNo); // loadPageChunk is global in script.js
    return ayahs
      .filter((a) => a.sura_no === suraNo)
      .map((a) => a.aya_no)
      .sort((a, b) => a - b);
  }

  /** First ayah of a sura on a page — fetches chunk; falls back to 1 */
  async function getFirstAyahOfSuraOnPage(suraNo, pageNo) {
    const list = await getAyahsForSuraOnPage(suraNo, pageNo);
    return list.length > 0 ? list[0] : 1;
  }

  // ── Populate helpers ─────────────────────────────────────────────────────

  function buildSuraDropdown() {
    const sel = document.getElementById('r-sura-ar');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="" disabled>اختر السورة...</option>';
    getSuras().forEach(({ no, name }) => {
      const opt = document.createElement('option');
      opt.value = no;
      opt.textContent = `${no}. ${name}`;
      sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
  }

  function buildPageDropdown(suraNo) {
    const sel = document.getElementById('r-page');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="" disabled>اختر الصفحة...</option>';

    const pages = suraNo
      ? getPagesForSura(suraNo)
      : Array.from({ length: 604 }, (_, i) => i + 1);

    pages.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = `صفحة ${p}`;
      sel.appendChild(opt);
    });
    if (cur && [...sel.options].some((o) => o.value === String(cur)))
      sel.value = cur;
  }

  async function buildAyahDropdown(suraNo, pageNo) {
    const sel = document.getElementById('r-aya');
    if (!sel) return;
    sel.innerHTML = '<option value="" disabled>اختر الآية...</option>';
    if (!suraNo || !pageNo) return;

    let ayahs = await getAyahsForSuraOnPage(suraNo, pageNo);

    // Fallback: if the chunk had none for this sura (shouldn't happen), use full count
    if (ayahs.length === 0) {
      const count = getAyahCountForSura(suraNo);
      ayahs = Array.from({ length: count }, (_, i) => i + 1);
    }

    ayahs.forEach((n) => {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = `آية ${n}`;
      sel.appendChild(opt);
    });
  }

  // ── Cross-link change events ─────────────────────────────────────────────

  // SURA changes → update page list, set first page, update ayahs
  document
    .getElementById('r-sura-ar')
    .addEventListener('change', async function () {
      const suraNo = parseInt(this.value);
      clearFieldError('r-sura-ar');

      const firstPage = getFirstPageOfSura(suraNo);
      buildPageDropdown(suraNo);
      if (firstPage) document.getElementById('r-page').value = firstPage;
      clearFieldError('r-page');

      const pg = parseInt(document.getElementById('r-page').value);
      await buildAyahDropdown(suraNo, pg);
      const firstAyah = await getFirstAyahOfSuraOnPage(suraNo, pg);
      if (firstAyah) document.getElementById('r-aya').value = firstAyah;
      clearFieldError('r-aya');
    });

  // PAGE changes → keep sura if it's on this page, else switch to first sura of page
  document
    .getElementById('r-page')
    .addEventListener('change', async function () {
      const pageNo = parseInt(this.value);
      clearFieldError('r-page');

      const curSura = parseInt(document.getElementById('r-sura-ar').value);
      const surasOnPage = getSurasOnPage(pageNo);

      let targetSura = curSura;
      if (!surasOnPage.includes(curSura)) {
        targetSura = surasOnPage[0] || curSura;
        if (targetSura) {
          document.getElementById('r-sura-ar').value = targetSura;
          clearFieldError('r-sura-ar');
        }
      }

      await buildAyahDropdown(targetSura, pageNo);
      const firstAyah = await getFirstAyahOfSuraOnPage(targetSura, pageNo);
      if (firstAyah) document.getElementById('r-aya').value = firstAyah;
      clearFieldError('r-aya');
    });

  // AYA changes → just clear error
  document.getElementById('r-aya').addEventListener('change', function () {
    clearFieldError('r-aya');
  });

  // ── Pre-fill from state ──────────────────────────────────────────────────

  window.prefillReportModal = async function () {
    if (!_ready) {
      setTimeout(window.prefillReportModal, 300);
      return;
    }

    try {
      const s = typeof state !== 'undefined' ? state : null;
      const ayah = s?.currentAyah || null;

      const suraNo =
        ayah?.sura_no ?? parseInt(localStorage.getItem('currentSura')) ?? null;
      const ayaNo =
        ayah?.aya_no ?? parseInt(localStorage.getItem('currentAyah')) ?? null;
      // ayah.page is stored as zero-padded string ("001") after lazy migration
      const pageNo = ayah?.page
        ? parseInt(ayah.page)
        : (parseInt(localStorage.getItem('currentPage')) ?? null);

      if (!suraNo) return;

      // 0. Riwaya
      const riwaya = s?.currentRiwaya || localStorage.getItem('riwaya') || null;
      if (riwaya) {
        document.getElementById('r-riwaya').value = riwaya;
        clearFieldError('r-riwaya');
      }

      // 1. Sura
      document.getElementById('r-sura-ar').value = suraNo;
      clearFieldError('r-sura-ar');

      // 2. Page dropdown for this sura, then set page
      buildPageDropdown(suraNo);
      const targetPage = pageNo || getFirstPageOfSura(suraNo);
      if (targetPage) {
        document.getElementById('r-page').value = targetPage;
        clearFieldError('r-page');
      }

      // 3. Ayah dropdown, then set ayah
      const pg = targetPage || getFirstPageOfSura(suraNo);
      await buildAyahDropdown(suraNo, pg);
      if (ayaNo) {
        document.getElementById('r-aya').value = ayaNo;
        clearFieldError('r-aya');
      }
    } catch (e) {
      // Silently fail — user can select manually
    }
  };

  // ── Inline Validation ────────────────────────────────────────────────────

  const FIELD_ERRORS = {
    'r-email': 'err-email',
    'r-captcha-token': 'err-captcha',
    'r-type': 'err-type',
    'r-subject': 'err-subject',
    'r-riwaya': 'err-riwaya',
    'r-sura-ar': 'err-sura-ar',
    'r-page': 'err-page',
    'r-aya': 'err-aya',
    'r-details': 'err-details',
  };

  const FIELD_MESSAGES = {
    'r-email': {
      empty: 'البريد الإلكتروني مطلوب.',
      invalid: 'أدخل بريداً إلكترونياً صحيحاً.',
    },
    'r-captcha-token': {
      empty: 'يرجى إكمال التحقق الأمني.',
    },
    'r-type': { empty: 'يرجى اختيار نوع الرسالة.' },
    'r-subject': { empty: 'عنوان الموضوع مطلوب.' },
    'r-riwaya': { empty: 'يرجى اختيار الرواية.' },
    'r-sura-ar': { empty: 'يرجى اختيار السورة.' },
    'r-page': { empty: 'يرجى اختيار الصفحة.' },
    'r-aya': { empty: 'يرجى اختيار الآية.' },
    'r-details': { empty: 'تفاصيل الرسالة مطلوبة.' },
  };

  function showFieldError(fieldId, msg) {
    const errEl = document.getElementById(FIELD_ERRORS[fieldId]);
    const input = document.getElementById(fieldId);
    if (errEl) errEl.textContent = msg;
    if (input) input.classList.add('report-input--error');
  }

  function clearFieldError(fieldId) {
    const errEl = document.getElementById(FIELD_ERRORS[fieldId]);
    const input = document.getElementById(fieldId);
    if (errEl) errEl.textContent = '';
    if (input) input.classList.remove('report-input--error');
  }

  function validateField(fieldId) {
    const el = document.getElementById(fieldId);
    const msg = FIELD_MESSAGES[fieldId];
    if (!el || !msg) return true;
    const val = el.value.trim();
    if (!val) {
      showFieldError(fieldId, msg.empty);
      return false;
    }
    if (fieldId === 'r-email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        showFieldError(fieldId, msg.invalid);
        return false;
      }
    }
    clearFieldError(fieldId);
    return true;
  }

  // Live validation on text/email/textarea
  ['r-email', 'r-subject', 'r-details'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('blur', () => validateField(id));
      el.addEventListener('input', () => {
        if (el.classList.contains('report-input--error')) validateField(id);
      });
    }
  });
  ['r-type', 'r-riwaya'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => validateField(id));
  });

  // Reset on modal close
  document
    .getElementById('reportModal')
    .addEventListener('hidden.bs.modal', () => {
      document.getElementById('reportForm').reset();
      Object.keys(FIELD_ERRORS).forEach((id) => clearFieldError(id));
      resetTurnstileWidget();
      const status = document.getElementById('r-status');
      status.style.display = 'none';
      status.className = 'report-status';
      if (_ready) {
        buildPageDropdown();
        document.getElementById('r-aya').innerHTML =
          '<option value="" disabled selected>اختر الآية...</option>';
      }
    });

  // ── Form submission ──────────────────────────────────────────────────────

  const TURNSTILE_SITE_KEY = 'YOUR_CLOUDFLARE_TURNSTILE_SITE_KEY';
  const TURNSTILE_WIDGET_CONTAINER_ID = 'r-turnstile';
  const TURNSTILE_SCRIPT_SRC =
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&hl=ar';
  let turnstileWidgetId = null;

  const REPORT_SCRIPT_URL =
    'https://script.google.com/macros/s/AKfycbz0a0HARrBElD6zDXmfGLNTxwxLQT4YCw_HQ-mDKocRfwrogIy3cdBH9UQ2eFwlNbdcEA/exec';

  function getCaptchaToken() {
    const input = document.getElementById('r-captcha-token');
    return input ? input.value.trim() : '';
  }

  function setCaptchaToken(token) {
    const input = document.getElementById('r-captcha-token');
    if (input) input.value = token || '';
    if (token) clearFieldError('r-captcha-token');
  }

  function ensureTurnstileMarkup() {
    if (
      document.getElementById(TURNSTILE_WIDGET_CONTAINER_ID) &&
      document.getElementById('r-captcha-token')
    ) {
      return;
    }

    const form = document.getElementById('reportForm');
    const statusEl = document.getElementById('r-status');
    if (!form || !statusEl) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'mb-4';
    wrapper.innerHTML =
      '<div id="r-turnstile" class="report-turnstile"></div>' +
      '<input type="hidden" id="r-captcha-token" />' +
      '<div class="report-field-error" id="err-captcha"></div>';

    form.insertBefore(wrapper, statusEl);
  }

  function loadTurnstileScript() {
    return new Promise((resolve, reject) => {
      if (window.turnstile) {
        resolve();
        return;
      }

      const existingScript = document.querySelector(
        'script[src^="https://challenges.cloudflare.com/turnstile/"]',
      );
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Turnstile script failed to load.')), {
          once: true,
        });
        return;
      }

      const script = document.createElement('script');
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Turnstile script failed to load.'));
      document.head.appendChild(script);
    });
  }

  function resetTurnstileWidget() {
    setCaptchaToken('');
    if (window.turnstile && turnstileWidgetId !== null) {
      window.turnstile.reset(turnstileWidgetId);
    }
  }

  function renderTurnstileWidget() {
    const container = document.getElementById(TURNSTILE_WIDGET_CONTAINER_ID);
    if (
      !container ||
      turnstileWidgetId !== null ||
      !window.turnstile ||
      !TURNSTILE_SITE_KEY ||
      TURNSTILE_SITE_KEY.startsWith('YOUR_')
    ) {
      return;
    }

    turnstileWidgetId = window.turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      language: 'ar',
      theme: document.body.classList.contains('light-mode') ? 'light' : 'dark',
      callback: (token) => {
        setCaptchaToken(token);
      },
      'expired-callback': () => {
        setCaptchaToken('');
        showFieldError(
          'r-captcha-token',
          'انتهت صلاحية التحقق الأمني. يرجى المحاولة مرة أخرى.',
        );
      },
      'error-callback': () => {
        setCaptchaToken('');
        showFieldError(
          'r-captcha-token',
          'تعذر تحميل التحقق الأمني. يرجى إعادة المحاولة.',
        );
      },
    });
  }

  function ensureTurnstileWidget() {
    if (turnstileWidgetId !== null) return;

    ensureTurnstileMarkup();
    loadTurnstileScript()
      .then(() => {
        renderTurnstileWidget();
      })
      .catch((error) => {
        console.error(error);
        showFieldError(
          'r-captcha-token',
          'تعذر تحميل التحقق الأمني. يرجى إعادة المحاولة.',
        );
      });
  }

  document
    .getElementById('reportModal')
    .addEventListener('shown.bs.modal', ensureTurnstileWidget);

  ensureTurnstileWidget();

  const getBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        let encoded = reader.result.toString().replace(/^data:(.*,)?/, '');
        if (encoded.length % 4 > 0)
          encoded += '='.repeat(4 - (encoded.length % 4));
        resolve(encoded);
      };
      reader.onerror = (err) => reject(err);
    });

  document
    .getElementById('reportForm')
    .addEventListener('submit', async (e) => {
      e.preventDefault();

      const allValid = Object.keys(FIELD_ERRORS)
        .map((id) => validateField(id))
        .every(Boolean);
      if (!allValid) return;

      const btn = document.getElementById('r-submit-btn');
      const status = document.getElementById('r-status');

      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span>جارٍ المعالجة...';
      status.style.display = 'none';
      status.className = 'report-status';

      try {
        // Resolve sura_name_ar from index (no quranData scan needed)
        const suraNo = parseInt(document.getElementById('r-sura-ar').value);
        const suraAr =
          state.quranIndex?.sura_info?.[String(suraNo)]?.name_ar ||
          String(suraNo);

        const payload = {
          email: document.getElementById('r-email').value.trim(),
          message_type: document.getElementById('r-type').value,
          subject_title: document.getElementById('r-subject').value.trim(),
          message_details: document.getElementById('r-details').value.trim(),
          riwaya: document.getElementById('r-riwaya').value,
          sura_name_ar: suraAr,
          aya_no: document.getElementById('r-aya').value,
          page: document.getElementById('r-page').value,
          turnstile_token: getCaptchaToken(),
        };

        if (!payload.turnstile_token) {
          showFieldError('r-captcha-token', 'يرجى إكمال التحقق الأمني.');
          return;
        }

        const fileInput = document.getElementById('r-upload');
        const filesArray = [];

        if (fileInput.files.length > 0) {
          btn.innerHTML =
            '<span class="spinner-border spinner-border-sm me-2"></span>جارٍ معالجة الملفات...';
          for (let i = 0; i < fileInput.files.length; i++) {
            const file = fileInput.files[i];
            if (
              !file.type.startsWith('image/') &&
              file.type !== 'application/pdf'
            ) {
              throw new Error(
                `"${file.name}" غير مقبول. الملفات المسموح بها: صور وPDF فقط.`,
              );
            }
            filesArray.push({
              fileName: file.name,
              mimeType: file.type,
              fileData: await getBase64(file),
            });
          }
        }

        payload.files = filesArray;
        btn.innerHTML =
          '<span class="spinner-border spinner-border-sm me-2"></span>جارٍ الإرسال...';

        const response = await fetch(REPORT_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (result.status === 'success') {
          const count = filesArray.length;
          status.className = 'report-status report-status--success';
          status.textContent =
            count > 0
              ? `تم إرسال التقرير بنجاح مع ${count} مرفق! شكراً لك.`
              : 'تم إرسال التقرير بنجاح! شكراً لك على مساهمتك.';
          status.style.display = 'block';
        } else {
          throw new Error(result.message || 'أعاد الخادم خطأً غير متوقع.');
        }
      } catch (error) {
        console.error(error);
        status.className = 'report-status report-status--error';
        status.textContent =
          error.message || 'فشل إرسال التقرير. يرجى المحاولة مرة أخرى.';
        status.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-send-fill me-2"></i>إرسال التقرير';
      }
    });
})();
