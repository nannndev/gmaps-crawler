/* Maps Directory Crawler — Import & Restore Modal Module
 * Mengelola interaksi dropzone, validasi file, dan dialog import / restore database.
 */
(() => {
  const $ = (id) => document.getElementById(id);
  let stagedImport = null;
  let callbacks = {};

  function openImportModal(initialMode = 'merge') {
    stagedImport = null;
    if ($('importFileInput')) $('importFileInput').value = '';
    if ($('importPreview')) $('importPreview').hidden = true;
    if ($('btnDoImport')) $('btnDoImport').disabled = true;

    const radios = document.getElementsByName('importMode');
    for (const r of radios) {
      r.checked = r.value === initialMode;
    }
    if ($('importOverlay')) $('importOverlay').hidden = false;
  }

  function closeImportModal() {
    if ($('importOverlay')) $('importOverlay').hidden = true;
    stagedImport = null;
  }

  function handleImportFile(file) {
    const { parseCSV, parseJSON, validateAndNormalize } = window.MDCImport || {};
    const isEn = callbacks.getLang ? callbacks.getLang() === 'en' : false;
    const showToast = callbacks.showToast || (() => {});

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result;
        const isJson = file.name.endsWith('.json');
        let valid = [];
        let rejected = 0;
        let backupSessions = [];
        let isBackup = false;

        if (isJson) {
          if (!parseJSON) throw new Error('Modul parseJSON tidak tersedia');
          const parsed = parseJSON(text);
          if (parsed.type === 'backup') {
            isBackup = true;
            backupSessions = parsed.sessions || [];
            valid = parsed.rows || [];
          } else {
            valid = parsed.rows || [];
          }
        } else {
          if (!parseCSV || !validateAndNormalize) throw new Error('Modul parseCSV tidak tersedia');
          const raw = parseCSV(text);
          const res = validateAndNormalize(raw);
          valid = res.valid;
          rejected = res.rejected;
        }

        if (!valid.length) {
          showToast(isEn ? 'No valid leads found in this file.' : 'Tidak ditemukan data tempat yang valid di file ini.', 'error');
          return;
        }

        stagedImport = {
          fileName: file.name,
          rows: valid,
          sessions: backupSessions,
          isBackup,
        };

        $('impFileName').textContent = file.name;
        $('impFileType').textContent = isBackup ? 'BACKUP JSON' : (isJson ? 'JSON' : 'CSV');
        $('impValidCount').textContent = valid.length;
        $('impInvalidCount').textContent = rejected;
        $('impInvalidWrap').hidden = rejected === 0;

        // Default jika file backup: sarankan restore
        if (isBackup) {
          const rRestore = document.querySelector('input[name="importMode"][value="restore"]');
          if (rRestore) rRestore.checked = true;
        }

        $('importPreview').hidden = false;
        $('btnDoImport').disabled = false;
      } catch (err) {
        showToast((isEn ? 'Failed to read file: ' : 'Gagal membaca file: ') + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  function initImportModal(cbs = {}) {
    callbacks = cbs;
    const showToast = callbacks.showToast || (() => {});
    const send = callbacks.send || (async () => ({ ok: false }));
    const onRefresh = callbacks.onRefresh || (() => {});

    if ($('btnOpenImport')) $('btnOpenImport').addEventListener('click', () => openImportModal('merge'));
    if ($('btnMenuImport')) $('btnMenuImport').addEventListener('click', () => openImportModal('merge'));
    if ($('btnMenuRestore')) $('btnMenuRestore').addEventListener('click', () => openImportModal('restore'));
    if ($('importClose')) $('importClose').addEventListener('click', closeImportModal);
    if ($('btnCancelImport')) $('btnCancelImport').addEventListener('click', closeImportModal);

    const dropzone = $('importDropzone');
    const fileInput = $('importFileInput');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleImportFile(e.dataTransfer.files[0]);
        }
      });
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleImportFile(e.target.files[0]);
        }
      });
    }

    if ($('btnDoImport')) {
      $('btnDoImport').addEventListener('click', async () => {
        if (!stagedImport || !stagedImport.rows.length) return;
        const isEn = callbacks.getLang ? callbacks.getLang() === 'en' : false;

        const modeRadio = document.querySelector('input[name="importMode"]:checked');
        const selectedMode = modeRadio ? modeRadio.value : 'merge';

        if (selectedMode === 'restore') {
          const confirmMsg = isEn
            ? `This action will REPLACE your entire database with ${stagedImport.rows.length} leads from this file. Continue?`
            : `Tindakan ini akan MENGGANTIKAN seluruh database lama dengan ${stagedImport.rows.length} tempat dari file. Lanjutkan?`;
          if (!confirm(confirmMsg)) return;

          const res = await send({
            type: 'RESTORE_BACKUP',
            rows: stagedImport.rows,
            sessions: stagedImport.sessions,
          });
          if (res.ok) {
            showToast(isEn ? `Restore successful! ${res.rowsCount} leads restored.` : `Restore berhasil! ${res.rowsCount} tempat dipulihkan.`, 'success');
            closeImportModal();
            onRefresh(true);
          } else {
            showToast((isEn ? 'Failed to restore: ' : 'Gagal memulihkan database: ') + res.error, 'error');
          }
        } else {
          const res = await send({
            type: 'IMPORT_ROWS',
            rows: stagedImport.rows,
            sessionLabel: `${isEn ? 'Import' : 'Impor'} (${stagedImport.fileName})`,
          });
          if (res.ok) {
            showToast(
              isEn
                ? `Successfully imported ${stagedImport.rows.length} leads (${res.added} new added).`
                : `Berhasil mengimpor ${stagedImport.rows.length} tempat (${res.added} tempat baru ditambahkan).`,
              'success'
            );
            closeImportModal();
            onRefresh(false);
          } else {
            showToast((isEn ? 'Import failed: ' : 'Gagal mengimpor: ') + res.error, 'error');
          }
        }
      });
    }
  }

  window.MDCImportModal = {
    initImportModal,
    openImportModal,
    closeImportModal,
  };
})();
