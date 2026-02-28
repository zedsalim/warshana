(function () {
  'use strict';

  // ── Wait for quranData to be ready ──────────────────────────────────────
  // script.js loads data asynchronously, so we poll until it's available.

  let _qData = []; // local flat copy of quranData
  let _ready = false;

  function tryInit() {
    if (
      typeof state !== 'undefined' &&
      state.quranData &&
      state.quranData.length > 0
    ) {
      _qData = state.quranData;
      _ready = true;
      buildSuraDropdown();
      buildPageDropdown();
    } else {
      setTimeout(tryInit, 300);
    }
  }
  tryInit();

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** Unique sorted list of sura objects [{sura_no, sura_name_ar}] */
  function getSuras() {
    const seen = new Set();
    return _qData
      .filter((a) => {
        if (seen.has(a.sura_no)) return false;
        seen.add(a.sura_no);
        return true;
      })
      .map((a) => ({ no: a.sura_no, name: a.sura_name_ar }));
  }

  /** All pages that belong to a sura (sorted) */
  function getPagesForSura(suraNo) {
    const pages = new Set();
    _qData
      .filter((a) => a.sura_no === suraNo)
      .forEach((a) =>
        String(a.page)
          .split('-')
          .forEach((p) => pages.add(parseInt(p.trim()))),
      );
    return [...pages].sort((a, b) => a - b);
  }

  /** All ayahs for a sura on a specific page */
  function getAyahsForSuraOnPage(suraNo, pageNo) {
    return _qData
      .filter((a) => {
        const pages = String(a.page)
          .split('-')
          .map((p) => parseInt(p.trim()));
        return a.sura_no === suraNo && pages.includes(pageNo);
      })
      .map((a) => a.aya_no)
      .sort((a, b) => a - b);
  }

  /** First sura on a given page */
  function getFirstSuraOnPage(pageNo) {
    const hit = _qData.find((a) => {
      const pages = String(a.page)
        .split('-')
        .map((p) => parseInt(p.trim()));
      return pages.includes(pageNo);
    });
    return hit ? hit.sura_no : null;
  }

  /** First page of a sura */
  function getFirstPageOfSura(suraNo) {
    const hit = _qData.find((a) => a.sura_no === suraNo);
    return hit ? parseInt(String(hit.page).split('-')[0]) : null;
  }

  /** First ayah of a sura on a page */
  function getFirstAyahOfSuraOnPage(suraNo, pageNo) {
    const list = getAyahsForSuraOnPage(suraNo, pageNo);
    return list.length > 0 ? list[0] : 1;
  }

  // ── Populate helpers ────────────────────────────────────────────────────

  function buildSuraDropdown() {
    const sel = document.getElementById('r-sura-ar');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="" disabled>اختر السورة...</option>';
    getSuras().forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.no;
      opt.textContent = `${s.no}. ${s.name}`;
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
    // try to restore previous value, else leave blank
    if (cur && [...sel.options].some((o) => o.value === String(cur)))
      sel.value = cur;
  }

  function buildAyahDropdown(suraNo, pageNo) {
    const sel = document.getElementById('r-aya');
    if (!sel) return;
    sel.innerHTML = '<option value="" disabled>اختر الآية...</option>';
    if (!suraNo || !pageNo) return;

    const ayahs = getAyahsForSuraOnPage(suraNo, pageNo);
    if (ayahs.length === 0) {
      // fallback: all ayahs of sura
      _qData
        .filter((a) => a.sura_no === suraNo)
        .map((a) => a.aya_no)
        .forEach((n) => {
          const opt = document.createElement('option');
          opt.value = n;
          opt.textContent = `آية ${n}`;
          sel.appendChild(opt);
        });
    } else {
      ayahs.forEach((n) => {
        const opt = document.createElement('option');
        opt.value = n;
        opt.textContent = `آية ${n}`;
        sel.appendChild(opt);
      });
    }
  }

  // ── Cross-link change events ─────────────────────────────────────────────

  // When SURA changes → update page list, set first page, update ayahs
  document.getElementById('r-sura-ar').addEventListener('change', function () {
    const suraNo = parseInt(this.value);
    clearFieldError('r-sura-ar');

    const firstPage = getFirstPageOfSura(suraNo);
    buildPageDropdown(suraNo);
    if (firstPage) document.getElementById('r-page').value = firstPage;
    clearFieldError('r-page');

    const pg = parseInt(document.getElementById('r-page').value);
    buildAyahDropdown(suraNo, pg);
    const firstAyah = getFirstAyahOfSuraOnPage(suraNo, pg);
    if (firstAyah) document.getElementById('r-aya').value = firstAyah;
    clearFieldError('r-aya');
  });

  // When PAGE changes → find first sura on that page, rebuild ayahs
  document.getElementById('r-page').addEventListener('change', function () {
    const pageNo = parseInt(this.value);
    clearFieldError('r-page');

    const curSura = parseInt(document.getElementById('r-sura-ar').value);

    // If currently selected sura exists on this page, keep it; otherwise switch to first sura of page
    const suraOnPage = _qData.some((a) => {
      const pages = String(a.page)
        .split('-')
        .map((p) => parseInt(p.trim()));
      return a.sura_no === curSura && pages.includes(pageNo);
    });

    let targetSura = curSura;
    if (!suraOnPage) {
      targetSura = getFirstSuraOnPage(pageNo);
      if (targetSura) {
        document.getElementById('r-sura-ar').value = targetSura;
        clearFieldError('r-sura-ar');
      }
    }

    buildAyahDropdown(targetSura, pageNo);
    const firstAyah = getFirstAyahOfSuraOnPage(targetSura, pageNo);
    if (firstAyah) document.getElementById('r-aya').value = firstAyah;
    clearFieldError('r-aya');
  });

  // When AYA changes → just clear error
  document.getElementById('r-aya').addEventListener('change', function () {
    clearFieldError('r-aya');
  });

  // ── Pre-fill from state ──────────────────────────────────────────────────

  window.prefillReportModal = function () {
    if (!_ready) {
      setTimeout(window.prefillReportModal, 300);
      return;
    }

    try {
      const s = typeof state !== 'undefined' ? state : null;
      const ayah = s && s.currentAyah ? s.currentAyah : null;

      const suraNo = ayah
        ? ayah.sura_no
        : parseInt(localStorage.getItem('currentSura')) || null;
      const ayaNo = ayah
        ? ayah.aya_no
        : parseInt(localStorage.getItem('currentAyah')) || null;
      const pageNo = ayah
        ? parseInt(String(ayah.page).split('-')[0])
        : parseInt(localStorage.getItem('currentPage')) || null;

      if (!suraNo) return;

      // 0. Set riwaya from state
      const riwaya =
        (typeof state !== 'undefined' && state.currentRiwaya) ||
        localStorage.getItem('riwaya') ||
        null;
      if (riwaya) {
        document.getElementById('r-riwaya').value = riwaya;
        clearFieldError('r-riwaya');
      }

      // 1. Set sura
      document.getElementById('r-sura-ar').value = suraNo;
      clearFieldError('r-sura-ar');

      // 2. Rebuild page dropdown for this sura, then set page
      buildPageDropdown(suraNo);
      if (pageNo) {
        document.getElementById('r-page').value = pageNo;
        clearFieldError('r-page');
      }

      // 3. Rebuild ayah dropdown, then set ayah
      const pg = pageNo || getFirstPageOfSura(suraNo);
      buildAyahDropdown(suraNo, pg);
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

  // Live validation on text/email/textarea fields only
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
      const status = document.getElementById('r-status');
      status.style.display = 'none';
      status.className = 'report-status';
      // Rebuild dropdowns to initial state
      if (_ready) {
        buildPageDropdown();
        document.getElementById('r-aya').innerHTML =
          '<option value="" disabled selected>اختر الآية...</option>';
      }
    });

  // ── Form submission ──────────────────────────────────────────────────────

  const REPORT_SCRIPT_URL =
    'https://script.google.com/macros/s/AKfycbz0a0HARrBElD6zDXmfGLNTxwxLQT4YCw_HQ-mDKocRfwrogIy3cdBH9UQ2eFwlNbdcEA/exec';

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
        // Resolve sura_name_ar from selected sura_no
        const suraNo = parseInt(document.getElementById('r-sura-ar').value);
        const suraData = _qData.find((a) => a.sura_no === suraNo);
        const suraAr = suraData ? suraData.sura_name_ar : String(suraNo);

        const payload = {
          email: document.getElementById('r-email').value.trim(),
          message_type: document.getElementById('r-type').value,
          subject_title: document.getElementById('r-subject').value.trim(),
          message_details: document.getElementById('r-details').value.trim(),
          riwaya: document.getElementById('r-riwaya').value,
          sura_name_ar: suraAr,
          aya_no: document.getElementById('r-aya').value,
          page: document.getElementById('r-page').value,
        };

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
