// ==UserScript==
// @name         Sirum: Mitarbeiter-Anhänge
// @namespace    https://github.com/BAHendrik/tms_tools
// @version      1.2
// @description  Zeigt Mitarbeiter-Anhänge als Karten, öffnet sie inline im Browser statt Download und ermöglicht Drag&Drop-Upload direkt auf die Kacheln.
// @author       BAHendrik
// @match        https://coolerulogistics-production-00220.dolphins.sirum.de/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/BAHendrik/tms_tools/main/Employee_Attachments.user.js
// @downloadURL  https://raw.githubusercontent.com/BAHendrik/tms_tools/main/Employee_Attachments.user.js
// @supportURL   https://github.com/BAHendrik/tms_tools/issues
// ==/UserScript==

(function () {
    'use strict';

    // ===========================================================================
    //  CSS / DESIGN
    // ===========================================================================
    const styleSheet = document.createElement('style');
    styleSheet.innerText = `
        /* ---------- Kanban-Badge (Büroklammer + Anzahl) ---------- */
        .emp-att-badge {
            position: absolute;
            top: 6px; left: 6px;
            z-index: 5;
            display: inline-flex; align-items: center; gap: 4px;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 11px; font-weight: 800; letter-spacing: 0.3px;
            color: #fff !important;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            cursor: default; user-select: none;
            transition: transform 0.2s cubic-bezier(0.175,0.885,0.32,1.275), box-shadow 0.2s;
        }
        .emp-att-badge i { font-size: 11px; }
        .emp-att-badge.has-files  { background: linear-gradient(135deg,#11998e 0%,#38ef7d 100%); border: 1px solid #108c82; }
        .emp-att-badge.zero-files { background: linear-gradient(135deg,#b4b9c4 0%,#8d94a3 100%); border: 1px solid #8d94a3; }
        .emp-att-badge.is-loading { background: linear-gradient(135deg,#f6d365 0%,#fda085 100%); border: 1px solid #d49540; }
        .emp-att-badge.is-uploading { background: linear-gradient(135deg,#a18cd1 0%,#fbc2eb 100%); border: 1px solid #947acb; }

        /* ---------- Drag-Over-Feedback auf der Kachel ---------- */
        .o_kanban_record.emp-drag-over {
            outline: 2px dashed #28a745 !important;
            outline-offset: -3px;
            box-shadow: 0 0 0 4px rgba(40,167,69,0.12) inset !important;
            transition: all 0.15s ease;
        }
        .o_kanban_record.emp-drag-over::after {
            content: "\\f0ee  Datei hier ablegen";
            font-family: "FontAwesome", 'Segoe UI', sans-serif;
            position: absolute; inset: 0;
            display: flex; align-items: center; justify-content: center;
            background: rgba(40,167,69,0.10);
            color: #1e7e34; font-weight: 700; font-size: 13px;
            pointer-events: none; z-index: 10;
            border-radius: 4px;
        }

        /* ---------- Anhänge-Panel im Modal ---------- */
        .emp-att-panel {
            margin-top: 16px;
            border: 1px solid #e3e6f0;
            border-radius: 10px;
            background: linear-gradient(180deg,#ffffff 0%,#f8f9fc 100%);
            box-shadow: 0 2px 10px rgba(0,0,0,0.04);
            overflow: hidden;
            animation: emp-panel-in 0.35s cubic-bezier(0.175,0.885,0.32,1.275);
        }
        @keyframes emp-panel-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .emp-att-panel-head {
            display: flex; align-items: center; justify-content: space-between;
            padding: 10px 14px;
            background: linear-gradient(135deg,#4e73df 0%,#224abe 100%);
            color: #fff;
            font-family: 'Segoe UI', Tahoma, sans-serif;
        }
        .emp-att-panel-head .emp-title { font-size: 14px; font-weight: 700; letter-spacing: 0.3px; display: flex; align-items: center; gap: 8px; }
        .emp-att-panel-head .emp-count {
            background: rgba(255,255,255,0.22); border-radius: 10px;
            padding: 1px 9px; font-size: 12px; font-weight: 800;
        }

        .emp-att-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 10px;
            padding: 14px;
        }

        /* Gedockt über der Button-Leiste: kompakt + eigener Scroll */
        .emp-att-panel--docked {
            margin: 0 16px 0;
            border-radius: 10px 10px 0 0;
            border-bottom: none;
            flex-shrink: 0;
        }
        .emp-att-panel--docked .emp-att-grid {
            max-height: 230px;
            overflow-y: auto;
        }

        /* ---------- Einzelne Anhang-Karte ---------- */
        .emp-att-card {
            position: relative;
            display: flex; flex-direction: column;
            border: 1px solid #e3e6f0; border-radius: 8px;
            background: #fff; overflow: hidden;
            cursor: pointer;
            transition: transform 0.2s cubic-bezier(0.175,0.885,0.32,1.275), box-shadow 0.2s, border-color 0.2s;
            animation: emp-card-in 0.3s ease both;
        }
        @keyframes emp-card-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .emp-att-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 18px rgba(34,74,190,0.18);
            border-color: #4e73df;
        }
        .emp-att-card:active { transform: translateY(-1px) scale(0.99); }

        .emp-att-thumb {
            height: 84px;
            display: flex; align-items: center; justify-content: center;
            background: #f4f5fb;
            position: relative; overflow: hidden;
        }
        .emp-att-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .emp-att-thumb i { font-size: 34px; }

        .emp-att-meta { padding: 8px 10px; }
        .emp-att-name {
            font-size: 12px; font-weight: 600; color: #3a3b45;
            line-height: 1.25;
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
            overflow: hidden; word-break: break-word;
        }
        .emp-att-date { font-size: 10.5px; color: #9aa0ad; margin-top: 4px; }

        /* Hover-Overlay "ansehen" */
        .emp-att-overlay {
            position: absolute; inset: 0 0 auto 0; height: 84px;
            display: flex; align-items: center; justify-content: center;
            background: rgba(34,74,190,0.0);
            color: #fff; opacity: 0;
            transition: opacity 0.2s, background 0.2s;
            pointer-events: none;
            font-size: 13px; font-weight: 700; gap: 6px;
        }
        .emp-att-card:hover .emp-att-overlay { opacity: 1; background: rgba(34,74,190,0.55); }

        /* Lösch-Button auf der Karte */
        .emp-att-del {
            position: absolute; top: 5px; right: 5px; z-index: 6;
            width: 22px; height: 22px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            background: rgba(255,255,255,0.92); color: #e74a3b;
            border: 1px solid #f1d4d0; font-size: 11px;
            opacity: 0; transform: scale(0.8);
            transition: all 0.18s ease; box-shadow: 0 1px 4px rgba(0,0,0,0.15);
        }
        .emp-att-card:hover .emp-att-del { opacity: 1; transform: scale(1); }
        .emp-att-del:hover { background: #e74a3b; color: #fff; }

        /* ---------- Upload-Dropzone im Panel ---------- */
        .emp-att-dropzone {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            min-height: 84px;
            border: 2px dashed #c3cadb; border-radius: 8px;
            background: #fbfcfe; color: #8d94a3;
            cursor: pointer; text-align: center; padding: 10px;
            transition: all 0.18s ease;
        }
        .emp-att-dropzone:hover, .emp-att-dropzone.is-over {
            border-color: #4e73df; background: rgba(78,115,223,0.06); color: #4e73df;
        }
        .emp-att-dropzone i { font-size: 22px; margin-bottom: 4px; }
        .emp-att-dropzone span { font-size: 11px; font-weight: 600; line-height: 1.3; }

        .emp-att-empty { padding: 18px; text-align: center; color: #9aa0ad; font-size: 13px; }

        /* ---------- Inline-Preview-Overlay ---------- */
        #emp-preview-overlay {
            position: fixed; inset: 0; z-index: 10050;
            background: rgba(0,0,0,0.85); backdrop-filter: blur(4px);
            display: none; flex-direction: column; align-items: center; justify-content: center;
            animation: emp-fade 0.2s ease;
        }
        @keyframes emp-fade { from { opacity: 0; } to { opacity: 1; } }
        #emp-preview-head {
            width: 82%; display: flex; justify-content: space-between; align-items: center;
            color: #fff; margin-bottom: 10px; font-family: 'Segoe UI', Tahoma, sans-serif;
        }
        #emp-preview-title { font-size: 1.05em; font-weight: 600; letter-spacing: 0.5px; opacity: 0.92; display: flex; align-items: center; gap: 8px; }
        #emp-preview-actions { display: flex; align-items: center; gap: 14px; }
        #emp-preview-actions a { color: #fff; opacity: 0.85; font-size: 22px; text-decoration: none; transition: opacity 0.2s, color 0.2s; }
        #emp-preview-actions a:hover { opacity: 1; }
        #emp-preview-close { color: #fff; font-size: 34px; cursor: pointer; font-weight: bold; background: none; border: none; line-height: 1; padding: 0; opacity: 0.8; transition: color 0.2s; }
        #emp-preview-close:hover { color: #ff4b2b; opacity: 1; }
        #emp-preview-body {
            width: 82%; height: 84%;
            display: flex; align-items: center; justify-content: center;
            background: #525659; border-radius: 8px; overflow: auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        #emp-preview-body iframe { width: 100%; height: 100%; border: none; background: #525659; }
        #emp-preview-body img { max-width: 100%; max-height: 100%; object-fit: contain; }
        #emp-preview-spinner { color: #fff; font-size: 30px; }

        /* Office-Dokumente im Modal (weiße, scrollbare Fläche) */
        #emp-preview-body.is-doc { background: #e9ebf0; align-items: stretch; }
        .emp-doc-render { width: 100%; height: 100%; overflow: auto; background: #e9ebf0; color: #222; }
        .emp-doc-render .docx-wrapper { background: #e9ebf0; padding: 24px 0; }
        .emp-doc-render .docx-wrapper > section.docx {
            box-shadow: 0 4px 16px rgba(0,0,0,0.25); margin-bottom: 24px; background: #fff;
        }
        .emp-xlsx-render { width: 100%; height: 100%; overflow: auto; background: #fff; color: #222; padding: 16px 20px; }
        .emp-xlsx-render .emp-sheet-title {
            font-family: 'Segoe UI', Tahoma, sans-serif; font-weight: 700; color: #224abe;
            margin: 16px 0 6px; font-size: 14px; display: flex; align-items: center; gap: 6px;
        }
        .emp-xlsx-render .emp-sheet-title:first-child { margin-top: 0; }
        .emp-xlsx-render table { border-collapse: collapse; font-size: 12.5px; font-family: 'Segoe UI', Tahoma, sans-serif; }
        .emp-xlsx-render td, .emp-xlsx-render th { border: 1px solid #d6dae3; padding: 4px 9px; white-space: nowrap; }
        .emp-xlsx-render tr:first-child td { background: #f4f5fb; font-weight: 600; }

        /* Fallback für nicht darstellbare Dateien */
        .emp-doc-fallback {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 14px; color: #fff; text-align: center; padding: 30px;
        }
        .emp-doc-fallback i.big { font-size: 56px; opacity: 0.85; }
        .emp-doc-fallback .fb-name { font-size: 15px; font-weight: 600; word-break: break-word; max-width: 80%; }
        .emp-doc-fallback .fb-note { font-size: 13px; opacity: 0.75; }
        .emp-doc-fallback a.fb-btn {
            margin-top: 6px; background: #4e73df; color: #fff; text-decoration: none;
            padding: 9px 18px; border-radius: 8px; font-weight: 600; font-size: 13px;
            display: inline-flex; align-items: center; gap: 8px; transition: background 0.2s, transform 0.2s;
        }
        .emp-doc-fallback a.fb-btn:hover { background: #224abe; transform: translateY(-1px); }

        /* ---------- Toast ---------- */
        #emp-toast-container {
            position: fixed; top: 20px; left: 20px; z-index: 10060;
            display: flex; flex-direction: column; gap: 10px; pointer-events: none;
        }
        .emp-toast {
            background: linear-gradient(135deg,#11998e 0%,#38ef7d 100%);
            color: #fff; padding: 13px 18px; border-radius: 8px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.25);
            font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 14px; font-weight: 500;
            min-width: 300px; max-width: 460px;
            display: flex; align-items: center; gap: 10px; pointer-events: auto;
            transform: translateX(-110%); opacity: 0;
            transition: transform 0.35s cubic-bezier(0.175,0.885,0.32,1.275), opacity 0.3s;
        }
        .emp-toast.is-visible { transform: translateX(0); opacity: 1; }
        .emp-toast.is-error { background: linear-gradient(135deg,#ff416c 0%,#ff4b2b 100%); }
        .emp-toast.is-info  { background: linear-gradient(135deg,#4e73df 0%,#224abe 100%); }
        .emp-toast i { font-size: 18px; flex-shrink: 0; }
        .emp-toast .msg { flex: 1; line-height: 1.35; word-break: break-word; }
        .emp-toast .close { background: none; border: none; color: rgba(255,255,255,0.85); cursor: pointer; font-size: 18px; line-height: 1; padding: 0; font-weight: bold; }
        .emp-toast .close:hover { color: #fff; }

        @keyframes emp-spin { 100% { transform: rotate(360deg); } }
        .emp-spin { animation: emp-spin 1s linear infinite; }
    `;
    document.head.appendChild(styleSheet);

    // ===========================================================================
    //  HELPER
    // ===========================================================================
    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, c => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    }

    function getCSRFToken() {
        const node = document.querySelector('input[name="csrf_token"]');
        if (node) return node.value;
        if (window.odoo && window.odoo.csrf_token) return window.odoo.csrf_token;
        return '';
    }

    // Mitarbeiter-ID aus einer Bild-URL ziehen (...?model=hr.employee&id=119...)
    function getEmpIdFromImg(img) {
        if (!img || !img.src) return null;
        if (!/model=hr\.employee/.test(img.src)) return null;
        const m = img.src.match(/[?&]id=(\d+)/);
        return m ? parseInt(m[1], 10) : null;
    }

    function iconForMime(mime, name) {
        const n = (name || '').toLowerCase();
        const m = (mime || '').toLowerCase();
        if (m === 'application/pdf' || n.endsWith('.pdf')) return { icon: 'fa-file-pdf-o', color: '#e74a3b' };
        if (m.startsWith('image/')) return { icon: 'fa-file-image-o', color: '#1cc88a' };
        if (m.includes('word') || /\.docx?$/.test(n)) return { icon: 'fa-file-word-o', color: '#2b579a' };
        if (m.includes('sheet') || m.includes('excel') || /\.xlsx?$/.test(n) || n.endsWith('.csv')) return { icon: 'fa-file-excel-o', color: '#1d6f42' };
        if (m.includes('presentation') || /\.pptx?$/.test(n)) return { icon: 'fa-file-powerpoint-o', color: '#d24726' };
        if (m.includes('zip') || /\.(zip|rar|7z)$/.test(n)) return { icon: 'fa-file-archive-o', color: '#f6c23e' };
        if (m.startsWith('text/')) return { icon: 'fa-file-text-o', color: '#5a5c69' };
        return { icon: 'fa-file-o', color: '#858796' };
    }

    function isImage(att) { return (att.mimetype || '').toLowerCase().startsWith('image/'); }
    function isPdf(att) {
        return (att.mimetype || '').toLowerCase() === 'application/pdf' || /\.pdf$/i.test(att.name || '');
    }

    // Dateityp bestimmen, wie er im Modal dargestellt wird
    function classify(att) {
        const m = (att.mimetype || '').toLowerCase();
        const n = (att.name || '').toLowerCase();
        if (isPdf(att)) return 'pdf';
        if (isImage(att)) return 'image';
        if (m.includes('wordprocessingml') || n.endsWith('.docx')) return 'docx';
        if (m.includes('spreadsheetml') || m.includes('ms-excel') || /\.(xlsx|xls|csv)$/.test(n)) return 'xlsx';
        return 'other';
    }

    // --- CDN-Loader (mit jsDelivr -> unpkg Fallback) ---
    function loadScript(urls) {
        return new Promise((resolve, reject) => {
            let i = 0;
            const tryNext = () => {
                if (i >= urls.length) { reject(new Error('Bibliothek konnte nicht geladen werden')); return; }
                const s = document.createElement('script');
                s.src = urls[i++];
                s.onload = () => resolve();
                s.onerror = () => { s.remove(); tryNext(); };
                document.head.appendChild(s);
            };
            tryNext();
        });
    }
    async function ensureDocxPreview() {
        if (window.JSZip && window.docx) return;
        if (!window.JSZip) await loadScript([
            'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
            'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js'
        ]);
        if (!window.docx) await loadScript([
            'https://cdn.jsdelivr.net/npm/docx-preview@0.3.5/dist/docx-preview.min.js',
            'https://unpkg.com/docx-preview@0.3.5/dist/docx-preview.min.js'
        ]);
    }
    async function ensureSheetJS() {
        if (window.XLSX) return;
        await loadScript([
            'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
            'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'
        ]);
    }

    function fmtDate(s) {
        if (!s) return '';
        // Odoo liefert "2026-06-01 11:33:00" (UTC) -> kurz darstellen
        const d = new Date(s.replace(' ', 'T') + 'Z');
        if (isNaN(d)) return '';
        return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
    }

    function showToast(message, { type = 'success', duration = 5000 } = {}) {
        let c = document.getElementById('emp-toast-container');
        if (!c) { c = document.createElement('div'); c.id = 'emp-toast-container'; document.body.appendChild(c); }
        const t = document.createElement('div');
        const iconMap = { success: 'check-circle', error: 'exclamation-triangle', info: 'info-circle' };
        t.className = `emp-toast is-${type}`;
        t.innerHTML = `<i class="fa fa-${iconMap[type] || 'check-circle'}"></i><span class="msg"></span><button class="close" title="Schließen">&times;</button>`;
        t.querySelector('.msg').innerHTML = message;
        c.appendChild(t);
        requestAnimationFrame(() => t.classList.add('is-visible'));
        const remove = () => { t.classList.remove('is-visible'); setTimeout(() => t.remove(), 350); };
        t.querySelector('.close').onclick = remove;
        setTimeout(remove, duration);
    }

    // ===========================================================================
    //  RPC
    // ===========================================================================
    async function searchRead(model, domain, fields) {
        const res = await fetch('/web/dataset/search_read', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0', method: 'call',
                params: { model, domain, fields }
            })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.data ? data.error.data.message : 'RPC-Fehler');
        return (data.result && data.result.records) ? data.result.records : [];
    }

    async function unlinkAttachment(id) {
        const res = await fetch('/web/dataset/call_kw/ir.attachment/unlink', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0', method: 'call',
                params: { args: [[id]], model: 'ir.attachment', method: 'unlink', kwargs: {} }
            })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.data ? data.error.data.message : 'Löschen fehlgeschlagen');
        return true;
    }

    function fetchEmployeeAttachments(empId) {
        return searchRead(
            'ir.attachment',
            [['res_model', '=', 'hr.employee'], ['res_id', '=', empId], ['type', 'in', ['binary', 'url']]],
            ['name', 'mimetype', 'type', 'url', 'create_date', 'write_date']
        );
    }

    // Anzahl Anhänge für viele Mitarbeiter auf einmal (1 Request)
    async function fetchAttachmentCounts(empIds) {
        const counts = {};
        empIds.forEach(id => counts[id] = 0);
        if (empIds.length === 0) return counts;
        const recs = await searchRead(
            'ir.attachment',
            [['res_model', '=', 'hr.employee'], ['res_id', 'in', empIds], ['type', 'in', ['binary', 'url']]],
            ['res_id']
        );
        recs.forEach(r => {
            const rid = Array.isArray(r.res_id) ? r.res_id[0] : r.res_id;
            if (counts[rid] !== undefined) counts[rid]++;
        });
        return counts;
    }

    // ===========================================================================
    //  UPLOAD
    // ===========================================================================
    async function uploadFiles(files, empId) {
        let ok = 0;
        for (const file of files) {
            const fd = new FormData();
            fd.append('csrf_token', getCSRFToken());
            fd.append('callback', 'emp_upload_auto');
            fd.append('ufile', file);
            fd.append('model', 'hr.employee');
            fd.append('id', empId);
            try {
                const r = await fetch('/web/binary/upload_attachment', { method: 'POST', body: fd });
                if (!r.ok) throw new Error(`Status ${r.status}`);
                ok++;
            } catch (err) {
                console.error('Upload-Fehler bei', file.name, err);
                showToast(`Fehler beim Upload von <b>${escapeHtml(file.name)}</b>: ${escapeHtml(err.message)}`, { type: 'error' });
            }
        }
        return ok;
    }

    // ===========================================================================
    //  INLINE-PREVIEW (Blob -> kein Download)
    // ===========================================================================
    let lastObjectUrl = null;
    function initPreviewOverlay() {
        if (document.getElementById('emp-preview-overlay')) return;
        const ov = document.createElement('div');
        ov.id = 'emp-preview-overlay';
        ov.innerHTML = `
            <div id="emp-preview-head">
                <span id="emp-preview-title"></span>
                <div id="emp-preview-actions">
                    <a id="emp-preview-download" title="Auf den PC herunterladen" download><i class="fa fa-download"></i></a>
                    <a id="emp-preview-newtab" title="In neuem Tab öffnen" target="_blank"><i class="fa fa-external-link"></i></a>
                    <button id="emp-preview-close" title="Schließen (ESC)">&times;</button>
                </div>
            </div>
            <div id="emp-preview-body"></div>
        `;
        document.body.appendChild(ov);

        const close = () => {
            ov.style.display = 'none';
            const b = document.getElementById('emp-preview-body');
            b.innerHTML = '';
            b.className = '';
            if (lastObjectUrl) { URL.revokeObjectURL(lastObjectUrl); lastObjectUrl = null; }
        };
        document.getElementById('emp-preview-close').onclick = close;
        ov.onclick = (e) => { if (e.target === ov) close(); };
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && ov.style.display === 'flex') close();
        });
    }

    async function openAttachmentInline(att) {
        initPreviewOverlay();
        const ov = document.getElementById('emp-preview-overlay');
        const body = document.getElementById('emp-preview-body');
        const title = document.getElementById('emp-preview-title');
        const dl = document.getElementById('emp-preview-download');
        const nt = document.getElementById('emp-preview-newtab');

        const ic = iconForMime(att.mimetype, att.name);
        const kind = classify(att);
        title.innerHTML = `<i class="fa ${ic.icon}"></i> ${escapeHtml(att.name)}`;
        dl.href = `/web/content/${att.id}?download=true`;
        dl.download = att.name;
        nt.href = `/web/content/${att.id}`;

        body.className = '';
        body.innerHTML = `<i id="emp-preview-spinner" class="fa fa-spinner emp-spin"></i>`;
        ov.style.display = 'flex';

        try {
            const res = await fetch(`/web/content/${att.id}`);
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const blob = await res.blob();

            if (kind === 'image') {
                if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
                lastObjectUrl = URL.createObjectURL(blob);
                body.innerHTML = `<img src="${lastObjectUrl}" alt="${escapeHtml(att.name)}">`;

            } else if (kind === 'pdf') {
                if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
                lastObjectUrl = URL.createObjectURL(blob);
                body.innerHTML = `<iframe src="${lastObjectUrl}#toolbar=1"></iframe>`;

            } else if (kind === 'docx') {
                await ensureDocxPreview();
                body.className = 'is-doc';
                const container = document.createElement('div');
                container.className = 'emp-doc-render';
                body.innerHTML = '';
                body.appendChild(container);
                await window.docx.renderAsync(blob, container, null, {
                    className: 'docx', inWrapper: true,
                    ignoreWidth: false, ignoreHeight: false, useBase64URL: true
                });

            } else if (kind === 'xlsx') {
                await ensureSheetJS();
                body.className = 'is-doc';
                const ab = await blob.arrayBuffer();
                const wb = window.XLSX.read(ab, { type: 'array' });
                const wrap = document.createElement('div');
                wrap.className = 'emp-xlsx-render';
                wb.SheetNames.forEach(name => {
                    const t = document.createElement('div');
                    t.className = 'emp-sheet-title';
                    t.innerHTML = `<i class="fa fa-table"></i> ${escapeHtml(name)}`;
                    wrap.appendChild(t);
                    const tableHtml = window.XLSX.utils.sheet_to_html(wb.Sheets[name], { editable: false });
                    const div = document.createElement('div');
                    div.innerHTML = tableHtml;
                    wrap.appendChild(div);
                });
                body.innerHTML = '';
                body.appendChild(wrap);

            } else {
                // Nicht im Browser darstellbar (z.B. pptx, .doc, zip)
                body.innerHTML = `
                    <div class="emp-doc-fallback">
                        <i class="fa ${ic.icon} big"></i>
                        <div class="fb-name">${escapeHtml(att.name)}</div>
                        <div class="fb-note">Dieser Dateityp kann nicht direkt im Browser angezeigt werden.</div>
                        <a class="fb-btn" href="/web/content/${att.id}?download=true" download="${escapeHtml(att.name)}">
                            <i class="fa fa-download"></i> Herunterladen
                        </a>
                    </div>`;
            }
        } catch (err) {
            console.error('Preview-Fehler', err);
            body.className = '';
            body.innerHTML = `
                <div class="emp-doc-fallback">
                    <i class="fa fa-exclamation-triangle big"></i>
                    <div class="fb-name">${escapeHtml(att.name)}</div>
                    <div class="fb-note">Konnte Datei nicht laden: ${escapeHtml(err.message)}</div>
                    <a class="fb-btn" href="/web/content/${att.id}?download=true" download="${escapeHtml(att.name)}">
                        <i class="fa fa-download"></i> Herunterladen
                    </a>
                </div>`;
        }
    }

    // ===========================================================================
    //  MODAL-PANEL (schöne Anhang-Anzeige)
    // ===========================================================================
    function buildAttachmentCard(att) {
        const card = document.createElement('div');
        card.className = 'emp-att-card';
        const ic = iconForMime(att.mimetype, att.name);

        const thumbInner = isImage(att)
            ? `<img src="/web/content/${att.id}" alt="" loading="lazy">`
            : `<i class="fa ${ic.icon}" style="color:${ic.color}"></i>`;

        const overlayLabel = 'Ansehen';

        card.innerHTML = `
            <button class="emp-att-del" title="Anhang löschen"><i class="fa fa-trash-o"></i></button>
            <div class="emp-att-thumb">
                ${thumbInner}
                <div class="emp-att-overlay"><i class="fa fa-eye"></i> ${overlayLabel}</div>
            </div>
            <div class="emp-att-meta">
                <div class="emp-att-name" title="${escapeHtml(att.name)}">${escapeHtml(att.name)}</div>
                <div class="emp-att-date">${fmtDate(att.create_date)}</div>
            </div>
        `;

        // Klick auf Karte -> Inline-Preview
        card.addEventListener('click', (e) => {
            if (e.target.closest('.emp-att-del')) return;
            openAttachmentInline(att);
        });

        // Löschen
        card.querySelector('.emp-att-del').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm(`Anhang "${att.name}" wirklich löschen?`)) return;
            try {
                await unlinkAttachment(att.id);
                showToast(`<b>${escapeHtml(att.name)}</b> gelöscht.`, { type: 'info' });
                card.style.transition = 'all 0.25s ease';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                setTimeout(() => card.remove(), 250);
                // Panel-Counter aktualisieren
                const panel = card.closest('.emp-att-panel');
                if (panel) {
                    const remaining = panel.querySelectorAll('.emp-att-card').length - 1;
                    const cEl = panel.querySelector('.emp-count');
                    if (cEl) cEl.textContent = remaining;
                }
            } catch (err) {
                showToast(`Löschen fehlgeschlagen: ${escapeHtml(err.message)}`, { type: 'error' });
            }
        });

        return card;
    }

    function renderPanelGrid(panel, attachments, empId) {
        const grid = panel.querySelector('.emp-att-grid');
        const countEl = panel.querySelector('.emp-count');
        grid.innerHTML = '';
        countEl.textContent = attachments.length;

        attachments
            .slice()
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            .forEach((att, i) => {
                const card = buildAttachmentCard(att);
                card.style.animationDelay = `${Math.min(i * 35, 400)}ms`;
                grid.appendChild(card);
            });

        // Upload-Dropzone immer am Ende
        const dz = document.createElement('div');
        dz.className = 'emp-att-dropzone';
        dz.innerHTML = `<i class="fa fa-cloud-upload"></i><span>Datei hier ablegen<br>oder klicken</span>`;
        const fileInput = document.createElement('input');
        fileInput.type = 'file'; fileInput.multiple = true; fileInput.style.display = 'none';
        dz.appendChild(fileInput);

        dz.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) doPanelUpload(panel, fileInput.files, empId);
        });
        dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('is-over'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('is-over'));
        dz.addEventListener('drop', (e) => {
            e.preventDefault(); dz.classList.remove('is-over');
            if (e.dataTransfer.files.length) doPanelUpload(panel, e.dataTransfer.files, empId);
        });

        grid.appendChild(dz);
    }

    async function doPanelUpload(panel, files, empId) {
        showToast(`Lade ${files.length} Datei(en) hoch …`, { type: 'info', duration: 2500 });
        const ok = await uploadFiles(files, empId);
        if (ok > 0) {
            showToast(`${ok} Datei(en) zum Mitarbeiter hinzugefügt.`, { type: 'success' });
            try {
                const fresh = await fetchEmployeeAttachments(empId);
                renderPanelGrid(panel, fresh, empId);
            } catch (e) { console.warn('Refresh nach Upload fehlgeschlagen', e); }
        }
    }

    async function processEmployeeModal() {
        const forms = document.querySelectorAll('.o_form_view');
        for (const form of forms) {
            const img = form.querySelector('img[name="image"]')
                     || form.querySelector('img[src*="model=hr.employee"]');
            const empId = getEmpIdFromImg(img);
            if (!empId) continue; // kein Mitarbeiter-Formular

            // Stabiler Host: die modal-content wird beim Form-Re-Render NICHT angefasst.
            const modal = form.closest('.modal-content');
            const host = modal || form.closest('.modal-body') || form;

            // Ist für genau diesen Mitarbeiter schon ein Panel da? -> nichts tun.
            const existing = host.querySelector('.emp-att-panel');
            if (existing) {
                if (existing.dataset.empId === String(empId)) continue;
                existing.remove(); // anderer Mitarbeiter (Pager) -> altes Panel weg
            }

            const panel = document.createElement('div');
            panel.className = 'emp-att-panel';
            panel.dataset.empId = String(empId);
            panel.innerHTML = `
                <div class="emp-att-panel-head">
                    <span class="emp-title"><i class="fa fa-paperclip"></i> Anhänge</span>
                    <span class="emp-count">…</span>
                </div>
                <div class="emp-att-grid">
                    <div class="emp-att-empty"><i class="fa fa-spinner emp-spin"></i> Lade Anhänge …</div>
                </div>
            `;

            // Bevorzugt: über der Button-Leiste (modal-footer) einhängen -> überlebt Re-Render.
            const footer = modal ? modal.querySelector('.modal-footer') : null;
            if (footer && footer.parentNode) {
                panel.classList.add('emp-att-panel--docked');
                footer.parentNode.insertBefore(panel, footer);
            } else {
                // Fallback (kein Modal): ans Ende der Form-Sheet
                const sheet = form.querySelector('.o_form_sheet');
                (sheet || form).appendChild(panel);
            }

            try {
                const attachments = await fetchEmployeeAttachments(empId);
                renderPanelGrid(panel, attachments, empId);
                if (attachments.length === 0) {
                    // Hinweis vor die Dropzone setzen
                    const grid = panel.querySelector('.emp-att-grid');
                    const hint = document.createElement('div');
                    hint.className = 'emp-att-empty';
                    hint.style.gridColumn = '1 / -1';
                    hint.textContent = 'Noch keine Anhänge — Datei unten ablegen.';
                    grid.insertBefore(hint, grid.firstChild);
                }
            } catch (err) {
                panel.querySelector('.emp-att-grid').innerHTML =
                    `<div class="emp-att-empty">Fehler: ${escapeHtml(err.message)}</div>`;
            }
        }
    }

    // ===========================================================================
    //  KANBAN (Badge + Drag&Drop auf Kacheln)
    // ===========================================================================
    function bindCardDragDrop(card, empId, badge) {
        if (card.classList.contains('emp-dnd-bound')) return;
        card.classList.add('emp-dnd-bound');

        card.addEventListener('dragover', (e) => {
            // Nur wenn Dateien gezogen werden
            if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
                e.preventDefault();
                card.classList.add('emp-drag-over');
            }
        });
        card.addEventListener('dragleave', (e) => {
            if (!card.contains(e.relatedTarget)) card.classList.remove('emp-drag-over');
        });
        card.addEventListener('drop', async (e) => {
            if (!e.dataTransfer || !e.dataTransfer.files.length) return;
            e.preventDefault(); e.stopPropagation();
            card.classList.remove('emp-drag-over');

            const files = e.dataTransfer.files;
            const oldClass = badge.className;
            const oldHtml = badge.innerHTML;
            badge.className = 'emp-att-badge is-uploading';
            badge.innerHTML = `<i class="fa fa-cloud-upload emp-spin"></i> …`;

            const ok = await uploadFiles(files, empId);
            if (ok > 0) {
                showToast(`${ok} Datei(en) zum Mitarbeiter hinzugefügt.`, { type: 'success' });
            }
            // Anzahl neu laden
            try {
                const counts = await fetchAttachmentCounts([empId]);
                applyBadgeCount(badge, counts[empId] || 0);
            } catch (err) {
                badge.className = oldClass; badge.innerHTML = oldHtml;
            }
        });
    }

    function applyBadgeCount(badge, count) {
        badge.classList.remove('is-loading', 'is-uploading', 'has-files', 'zero-files');
        if (count > 0) {
            badge.classList.add('has-files');
            badge.innerHTML = `<i class="fa fa-paperclip"></i> ${count}`;
            badge.title = `${count} Anhang/Anhänge — Dateien per Drag&Drop hinzufügen`;
        } else {
            badge.classList.add('zero-files');
            badge.innerHTML = `<i class="fa fa-paperclip"></i> 0`;
            badge.title = 'Keine Anhänge — Dateien per Drag&Drop hinzufügen';
        }
    }

    let kanbanBusy = false;
    async function processKanbanCards() {
        if (kanbanBusy) return;
        const cards = document.querySelectorAll('.o_kanban_record:not(.emp-att-card-done)');
        if (cards.length === 0) return;

        kanbanBusy = true;
        const pending = [];

        cards.forEach(card => {
            const img = card.querySelector('img[src*="model=hr.employee"]');
            const empId = getEmpIdFromImg(img);
            if (!empId) { card.classList.add('emp-att-card-done'); return; }

            card.classList.add('emp-att-card-done');

            // Badge anlegen (Position relativ zum Bild-Container)
            const imgWrap = card.querySelector('.o_kanban_image') || card;
            if (getComputedStyle(card).position === 'static') card.style.position = 'relative';

            const badge = document.createElement('div');
            badge.className = 'emp-att-badge is-loading';
            badge.innerHTML = `<i class="fa fa-paperclip"></i>`;
            (imgWrap === card ? card : imgWrap).appendChild(badge);

            bindCardDragDrop(card, empId, badge);
            pending.push({ empId, badge });
        });

        if (pending.length) {
            try {
                const counts = await fetchAttachmentCounts(pending.map(p => p.empId));
                pending.forEach(p => applyBadgeCount(p.badge, counts[p.empId] || 0));
            } catch (err) {
                console.error('Anhang-Counts fehlgeschlagen', err);
                pending.forEach(p => applyBadgeCount(p.badge, 0));
            }
        }
        kanbanBusy = false;
    }

    // ===========================================================================
    //  OBSERVER / START
    // ===========================================================================
    let timeout;
    const observer = new MutationObserver(() => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            processKanbanCards();
            processEmployeeModal();
        }, 150);
    });

    function start() {
        // body, nicht .o_content: Bootstrap-Modals hängen außerhalb von .o_content
        // direkt am body -> sonst wird das Öffnen des Mitarbeiter-Modals nie erkannt.
        observer.observe(document.body, { childList: true, subtree: true });
        processKanbanCards();
        processEmployeeModal();
    }

    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start);
})();
