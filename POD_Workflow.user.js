// ==UserScript==
// @name         Sirum: POD Workflow
// @namespace    https://github.com/BAHendrik/tms_tools
// @version      12.8
// @description  Quick Tag, Originale löschen, POD-Versand + Status-Anzeige.
// @author       Hendrik
// @match        https://coolerulogistics-production-00220.dolphins.sirum.de/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/BAHendrik/tms_tools/main/POD_Workflow.user.js
// @downloadURL  https://raw.githubusercontent.com/BAHendrik/tms_tools/main/POD_Workflow.user.js
// @supportURL   https://github.com/BAHendrik/tms_tools/issues
// ==/UserScript==

(function() {
    'use strict';

    const POD_ORDER_2_DIRECTORY_ID = 85325;
    const DONE_TAG_ID = 48; // ID für "Lieferschein erledigt"
    const POD_MAIL_TEMPLATE_ID = 20; // Mail-Template "Auftragsabschluss/POD"

    // CSS Design
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        .tms-action-container {
            display: inline-flex;
            align-items: center;
            margin-right: 15px;
            vertical-align: middle;
        }

        .tms-action-container.in-modal {
            font-size: 14px;
            margin-left: 10px;
            margin-right: 0;
            display: inline-flex;
            float: left;
        }

        /* Standard Buttons (Lupe, Tag, Mülleimer) */
        .tms-action-btn {
            display: inline-flex; align-items: center; justify-content: center;
            background: #ffffff; color: #5a5c69; border-radius: 50%;
            width: 28px; height: 28px;
            margin-left: 8px;
            font-size: 0.95em;
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            border: 1px solid #e3e6f0;
            box-shadow: 0 2px 5px rgba(0,0,0,0.08);
            flex-shrink: 0;
        }
        .tms-action-container.in-modal .tms-action-btn { width: 30px; height: 30px; font-size: 1em; }

        .tms-action-btn:hover { transform: scale(1.15) translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,0.15); }
        .tms-action-btn:active { transform: scale(0.95); }

        /* Spezifisch für Lupe (Vorschau) */
        .tms-preview-btn:hover { background: #4e73df; color: #ffffff; border-color: #4e73df; box-shadow: 0 4px 10px rgba(78, 115, 223, 0.3); }
        .tms-preview-btn.is-empty { opacity: 0.5; background: #f8f9fa; cursor: not-allowed; box-shadow: none; }
        .tms-preview-btn.is-empty:hover { transform: none; background: #f8f9fa; color: #e63950; border-color: #e3e6f0; }

        /* Spezifisch für Tag-Button (Häkchen) */
        .tms-tag-btn { color: #28a745; }
        .tms-tag-btn:hover { background: #28a745; color: #ffffff; border-color: #28a745; box-shadow: 0 4px 10px rgba(40, 167, 69, 0.3); }
        .tms-tag-btn.is-success { background: #28a745; color: #ffffff; border-color: #28a745; box-shadow: none; pointer-events: none; opacity: 1; }

        /* NEU: Spezifisch für Löschen-Button (Mülleimer) */
        .tms-delete-btn { color: #e74a3b; }
        .tms-delete-btn:hover { background: #e74a3b; color: #ffffff; border-color: #e74a3b; box-shadow: 0 4px 10px rgba(231, 74, 59, 0.3); }
        .tms-delete-btn.is-success { background: #1cc88a; color: #ffffff; border-color: #1cc88a; pointer-events: none; }

        /* NEU: Spezifisch für Mail-Button (Briefumschlag) */
        .tms-mail-btn { color: #f39c12; }
        .tms-mail-btn:hover { background: #f39c12; color: #ffffff; border-color: #f39c12; box-shadow: 0 4px 10px rgba(243, 156, 18, 0.3); }
        .tms-mail-btn.is-success { background: #1cc88a; color: #ffffff; border-color: #1cc88a; pointer-events: none; }
        .tms-mail-btn.is-disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
        /* Bereits gesendet (orange gefüllt, aber wiederklickbar) */
        .tms-mail-btn.is-sent {
            background: #f39c12; color: #ffffff; border-color: #e67e22;
            box-shadow: 0 2px 6px rgba(243, 156, 18, 0.35);
        }
        .tms-mail-btn.is-sent:hover {
            background: #e67e22; color: #ffffff;
            box-shadow: 0 4px 12px rgba(230, 126, 34, 0.5);
        }

        /* Das Badge (links) */
        .tms-attachment-badge {
            display: inline-flex; align-items: center; justify-content: center;
            color: white !important; border-radius: 12px; padding: 4px 10px;
            font-size: 0.85em; font-weight: 900;
            box-shadow: 0 2px 5px rgba(0,0,0,0.25);
            white-space: nowrap; cursor: pointer; transition: all 0.2s ease-in-out;
            letter-spacing: 0.5px; flex-shrink: 0;
            min-width: 45px;
        }
        .tms-attachment-badge:hover { transform: scale(1.08); box-shadow: 0 4px 8px rgba(0,0,0,0.4); }
        .tms-attachment-badge:active { transform: scale(0.95); }

        /* Zustände */
        .tms-attachment-badge.is-fetching { background: linear-gradient(135deg, #e2e2e2 0%, #cfcfcf 100%); border: 1px solid #c0c0c0; color: #6c757d !important; cursor: wait; box-shadow: none; }
        .tms-action-btn.is-fetching { opacity: 0.5; background: #f8f9fa; cursor: wait; box-shadow: none; pointer-events: none; }

        .tms-attachment-badge.has-attachments { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); border: 1px solid #108c82; text-shadow: 1px 1px 1px rgba(0,0,0,0.2); }
        .tms-attachment-badge.is-merged { background: linear-gradient(135deg, #007bff 0%, #00c6ff 100%); border: 1px solid #007bff; text-shadow: 1px 1px 1px rgba(0,0,0,0.2); }
        .tms-attachment-badge.zero-attachments { background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%); border: 1px solid #e63950; text-shadow: 1px 1px 1px rgba(0,0,0,0.2); cursor: default; }
        .tms-attachment-badge.is-loading { background: linear-gradient(135deg, #f6d365 0%, #fda085 100%); border: 1px solid #d49540; pointer-events: none; cursor: wait; }
        .tms-attachment-badge.is-uploading { background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%); border: 1px solid #947acb; pointer-events: none; cursor: wait; }

        .tms-attachment-badge i { margin-right: 5px; font-size: 1.1em; }
        .tms-attachment-badge.is-fetching i { margin-right: 0; }

        @keyframes spin { 100% { transform: rotate(360deg); } }
        .fa-spin-fast { animation: spin 1s linear infinite; }

        /* Preview Modal */
        #sirum-pdf-modal {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.85); z-index: 10000;
            display: none; justify-content: center; align-items: center; flex-direction: column;
            backdrop-filter: blur(4px);
        }

        #sirum-pdf-modal-header {
            width: 80%; display: flex; justify-content: space-between; align-items: center;
            color: white; margin-bottom: 10px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        #sirum-pdf-modal-title { font-size: 1.1em; font-weight: 600; letter-spacing: 0.5px; opacity: 0.9; }
        #sirum-pdf-modal-close {
            color: white; font-size: 35px; cursor: pointer; font-weight: bold; background: none; border: none;
            transition: color 0.2s; line-height: 1; padding: 0; opacity: 0.8;
        }
        #sirum-pdf-modal-close:hover { color: #ff4b2b; opacity: 1; }

        #sirum-pdf-modal iframe {
            width: 80%; height: 85%; border: none; border-radius: 8px;
            background: #525659; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }

        /* POD-Mail Toast (oben links) */
        #sirum-toast-container {
            position: fixed; top: 20px; left: 20px; z-index: 10002;
            display: flex; flex-direction: column; gap: 10px;
            pointer-events: none;
        }
        .sirum-toast {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
            color: #ffffff; padding: 14px 20px; border-radius: 8px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.25);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px; font-weight: 500;
            min-width: 320px; max-width: 480px;
            display: flex; align-items: center; gap: 10px;
            pointer-events: auto;
            transform: translateX(-110%); opacity: 0;
            transition: transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s;
        }
        .sirum-toast.is-visible { transform: translateX(0); opacity: 1; }
        .sirum-toast.is-error { background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%); }
        .sirum-toast.is-info  { background: linear-gradient(135deg, #4e73df 0%, #224abe 100%); }
        .sirum-toast i { font-size: 18px; flex-shrink: 0; }
        .sirum-toast .sirum-toast-msg { flex: 1; line-height: 1.35; word-break: break-word; }
        .sirum-toast .sirum-toast-close {
            background: none; border: none; color: rgba(255,255,255,0.85);
            cursor: pointer; font-size: 18px; line-height: 1; padding: 0;
            font-weight: bold; flex-shrink: 0;
        }
        .sirum-toast .sirum-toast-close:hover { color: #ffffff; }
    `;
    document.head.appendChild(styleSheet);

    let isFetchingTable = false;
    let isFetchingModal = false;

    // --- INIT ---
    function initPdfModal() {
        if (!document.getElementById('sirum-pdf-modal')) {
            const modal = document.createElement('div');
            modal.id = 'sirum-pdf-modal';
            modal.innerHTML = `
                <div id="sirum-pdf-modal-header">
                    <span id="sirum-pdf-modal-title">Dokumenten-Vorschau</span>
                    <button id="sirum-pdf-modal-close" title="Schließen (ESC)">&times;</button>
                </div>
                <iframe id="sirum-pdf-iframe"></iframe>
            `;
            document.body.appendChild(modal);

            const closeModal = () => {
                modal.style.display = 'none';
                document.getElementById('sirum-pdf-iframe').src = '';
            };

            document.getElementById('sirum-pdf-modal-close').onclick = closeModal;
            modal.onclick = (e) => { if (e.target === modal) closeModal(); };

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.style.display === 'flex') {
                    closeModal();
                }
            });
        }
    }

    function showPdfPreview(urlOrBlob, fileName) {
        initPdfModal();
        const iframe = document.getElementById('sirum-pdf-iframe');
        const titleEl = document.getElementById('sirum-pdf-modal-title');
        titleEl.innerHTML = `<i class="fa fa-file-pdf-o"></i> Vorschau: <b>${fileName}</b>`;

        if (urlOrBlob instanceof Blob) iframe.src = URL.createObjectURL(urlOrBlob);
        else iframe.src = urlOrBlob;

        document.getElementById('sirum-pdf-modal').style.display = 'flex';
    }

    async function loadPDFLib() {
        if (window.PDFLib) return window.PDFLib;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
            script.onload = () => resolve(window.PDFLib);
            script.onerror = () => {
                const fallbackScript = document.createElement('script');
                fallbackScript.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
                fallbackScript.onload = () => resolve(window.PDFLib);
                fallbackScript.onerror = () => reject(new Error("Konnte PDF-Tool nicht laden."));
                document.head.appendChild(fallbackScript);
            };
            document.head.appendChild(script);
        });
    }

    function getCSRFToken() {
        const tokenNode = document.querySelector('input[name="csrf_token"]');
        if (tokenNode) return tokenNode.value;
        if (window.odoo && window.odoo.csrf_token) return window.odoo.csrf_token;
        return "";
    }

    function triggerLocalDownload(url, filename) {
        const link = document.createElement('a');
        link.href = url; link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function generateCleanFileName(docNo, referenceText) {
        let cleanRef = referenceText.replace(/[\/\\:*?"<>|]/g, '-').replace(/\s+/g, '_');
        cleanRef = cleanRef.replace(/^_+|_+$/g, '');
        return cleanRef ? `${docNo}_PODs_${cleanRef}.pdf` : `${docNo}_POD.pdf`;
    }

    // --- API & DATA ---
    async function createMergedPdfDocument(docNo, attachments) {
        const lib = await loadPDFLib();
        const { PDFDocument } = lib;
        const mergedPdf = await PDFDocument.create();
        let mergedCount = 0;

        attachments.sort((a, b) => a.name.localeCompare(b.name));

        for (const att of attachments) {
            if (att.name.includes(`${docNo}_POD`)) continue;

            const res = await fetch(`/web/content/${att.id}?download=true`);
            if (!res.ok) continue;

            const arrayBuffer = await res.arrayBuffer();
            if (arrayBuffer.byteLength === 0) continue;

            try {
                if (att.mimetype === 'application/pdf' || att.name.toLowerCase().endsWith('.pdf')) {
                    const pdf = await PDFDocument.load(arrayBuffer);
                    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                    copiedPages.forEach((page) => mergedPdf.addPage(page));
                    mergedCount++;
                }
                else if (att.mimetype.startsWith('image/')) {
                    let image;
                    if (att.mimetype === 'image/jpeg' || att.name.toLowerCase().endsWith('.jpg')) {
                        image = await mergedPdf.embedJpg(arrayBuffer);
                    } else if (att.mimetype === 'image/png' || att.name.toLowerCase().endsWith('.png')) {
                        image = await mergedPdf.embedPng(arrayBuffer);
                    }
                    if (image) {
                        const page = mergedPdf.addPage([image.width, image.height]);
                        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
                        mergedCount++;
                    }
                }
            } catch (parseError) {
                console.error(`Fehler bei Datei ${att.name}:`, parseError);
            }
        }

        if (mergedCount === 0) throw new Error("Keine kompatiblen Dokumente zum Zusammenfügen gefunden.");
        return mergedPdf;
    }

    async function fetchAttachmentData(docNos) {
        try {
            const orderRes = await fetch('/web/dataset/search_read', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: "2.0", method: "call",
                    params: { model: "tms.order", domain: [["document_no", "in", docNos]], fields: ["id", "document_no", "category_ids"] }
                })
            });
            const orderData = await orderRes.json();
            if (orderData.error) throw new Error(orderData.error.data.message);

            const orderDataMap = {};
            const realIds = [];
            const idToDocNo = {};

            if (orderData.result && orderData.result.records) {
                orderData.result.records.forEach(record => {
                    realIds.push(record.id);
                    idToDocNo[record.id] = record.document_no;
                    orderDataMap[record.document_no] = {
                        realId: record.id,
                        files: [],
                        tags: record.category_ids || [],
                        podMailSent: false
                    };
                });

                if (realIds.length > 0) {
                    // Parallel laden: Anhänge + POD-Mail-Status
                    const [attachData, mailData] = await Promise.all([
                        fetch('/web/dataset/search_read', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                jsonrpc: "2.0", method: "call",
                                params: { model: "ir.attachment", domain: [["res_model", "=", "tms.order"], ["res_id", "in", realIds]], fields: ["res_id", "id", "name", "mimetype"] }
                            })
                        }).then(r => r.json()),
                        // POD-Mail-Erkennung: mail.mail-Records vom Abschluss-Template (Subject-Pattern + state=sent)
                        fetch('/web/dataset/search_read', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                jsonrpc: "2.0", method: "call",
                                params: {
                                    model: "mail.mail",
                                    domain: [
                                        ["model", "=", "tms.order"],
                                        ["res_id", "in", realIds],
                                        ["subject", "ilike", "Benachrichtigung über den Abschluss"]
                                    ],
                                    fields: ["res_id", "subject", "state", "date"]
                                }
                            })
                        }).then(r => r.json())
                    ]);

                    if (attachData.result && attachData.result.records) {
                        attachData.result.records.forEach(att => {
                            const resId = Array.isArray(att.res_id) ? att.res_id[0] : att.res_id;
                            orderDataMap[idToDocNo[resId]].files.push({ id: att.id, name: att.name, mimetype: att.mimetype });
                        });
                    }

                    if (mailData.result && mailData.result.records) {
                        mailData.result.records.forEach(msg => {
                            const resId = Array.isArray(msg.res_id) ? msg.res_id[0] : msg.res_id;
                            const docNo = idToDocNo[resId];
                            if (docNo && orderDataMap[docNo]) {
                                orderDataMap[docNo].podMailSent = true;
                            }
                        });
                    }
                }
            }
            return orderDataMap;
        } catch (err) { console.error(err); return {}; }
    }

    // --- QUICK TAG ---
    // Rendert die category_ids-Zelle einer Zeile mit den echten Tag-Daten (Name + Farbe) neu
    async function refreshRowTags(row, realId) {
        try {
            // 1) Aktuelle category_ids vom Auftrag holen
            const orderRes = await fetch('/web/dataset/call_kw/tms.order/read', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: "2.0", method: "call",
                    params: {
                        args: [[realId], ["category_ids"]],
                        model: "tms.order", method: "read", kwargs: {}
                    }
                })
            });
            const orderData = await orderRes.json();
            if (orderData.error || !orderData.result || !orderData.result[0]) return false;
            const categoryIds = orderData.result[0].category_ids || [];

            // 2) Tag-Details (Name + Farbe) für alle Category-IDs laden
            let categories = [];
            if (categoryIds.length > 0) {
                const catRes = await fetch('/web/dataset/call_kw/tms.order.category/read', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: "2.0", method: "call",
                        params: {
                            args: [categoryIds, ["display_name", "color"]],
                            model: "tms.order.category", method: "read", kwargs: {}
                        }
                    })
                });
                const catData = await catRes.json();
                if (catData.result) categories = catData.result;
            }

            // 3) category_ids-Zelle der Zeile neu rendern
            const tagCell = row.querySelector('[name="category_ids"]');
            if (!tagCell) return false;

            // Den inneren Many2Many-Container suchen (Odoo-typischer Aufbau)
            let container = tagCell.querySelector('.o_field_many2manytags');
            if (!container) {
                container = document.createElement('div');
                container.className = 'o_field_many2manytags';
                tagCell.innerHTML = '';
                tagCell.appendChild(container);
            } else {
                container.innerHTML = '';
            }

            // Tags wie Odoo sie rendert (span.badge mit o_tag_color_X)
            categories.forEach(cat => {
                const tagEl = document.createElement('span');
                tagEl.className = `badge badge-pill o_tag_color_${cat.color || 0}`;
                tagEl.setAttribute('data-id', cat.id);
                tagEl.innerText = cat.display_name || '';
                container.appendChild(tagEl);
            });

            return true;
        } catch (err) {
            console.error('refreshRowTags fehlgeschlagen:', err);
            return false;
        }
    }

    async function addQuickTag(realId, btnEl, row) {
        const originalHtml = btnEl.innerHTML;
        btnEl.innerHTML = '<i class="fa fa-spinner fa-spin-fast"></i>';
        btnEl.style.pointerEvents = 'none';

        try {
            const payload = {
                jsonrpc: "2.0",
                method: "call",
                params: {
                    args: [[realId], { category_ids: [[4, DONE_TAG_ID, false]] }],
                    model: "tms.order",
                    method: "write",
                    kwargs: { context: {} }
                }
            };

            const res = await fetch('/web/dataset/call_kw/tms.order/write', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error.data.message);

            // Nach dem Write: Tag-Zelle mit frischen Daten aus Odoo komplett neu rendern
            if (row) {
                await refreshRowTags(row, realId);
            }

            btnEl.innerHTML = '<i class="fa fa-check"></i>';
            btnEl.classList.add('is-success');
            btnEl.title = "Lieferschein erledigt!";
        } catch (error) {
            console.error(error);
            alert(`Tag konnte nicht gesetzt werden:\n\n${error.message}`);
            btnEl.innerHTML = originalHtml;
            btnEl.style.pointerEvents = 'auto';
        }
    }

    // --- NEU: ORIGINALE LÖSCHEN ---
    async function deleteOriginalAttachments(attachmentIds, btnEl) {
        if (!confirm(`Möchtest du wirklich ${attachmentIds.length} Originaldatei(en) unwiderruflich löschen?`)) {
            return false;
        }

        const originalHtml = btnEl.innerHTML;
        btnEl.innerHTML = '<i class="fa fa-spinner fa-spin-fast"></i>';
        btnEl.style.pointerEvents = 'none';

        try {
            const payload = {
                jsonrpc: "2.0",
                method: "call",
                params: {
                    args: [attachmentIds],
                    model: "ir.attachment",
                    method: "unlink",
                    kwargs: {}
                }
            };

            const res = await fetch('/web/dataset/call_kw/ir.attachment/unlink', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error.data.message);

            // Erfolg
            btnEl.innerHTML = '<i class="fa fa-check"></i>';
            btnEl.classList.add('is-success');

            // Verstecke den Button nach 1,5 Sekunden
            setTimeout(() => {
                btnEl.style.display = 'none';
            }, 1500);

            return true;
        } catch (error) {
            console.error(error);
            alert(`Fehler beim Löschen:\n\n${error.message}`);
            btnEl.innerHTML = originalHtml;
            btnEl.style.pointerEvents = 'auto';
            return false;
        }
    }

    // --- NEU: POD-MAIL VERSAND ---
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // --- NEU: TOAST-BENACHRICHTIGUNG (oben links) ---
    function showToast(message, { type = 'success', duration = 5000 } = {}) {
        let container = document.getElementById('sirum-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'sirum-toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        const iconMap = { success: 'check-circle', error: 'exclamation-triangle', info: 'info-circle' };
        toast.className = `sirum-toast is-${type}`;
        toast.innerHTML = `
            <i class="fa fa-${iconMap[type] || 'check-circle'}"></i>
            <span class="sirum-toast-msg"></span>
            <button class="sirum-toast-close" title="Schließen">&times;</button>
        `;
        toast.querySelector('.sirum-toast-msg').innerHTML = message; // message darf HTML enthalten (wird vom Caller gesanitized)
        container.appendChild(toast);

        // Einblenden (nächster Frame, damit CSS-Transition greift)
        requestAnimationFrame(() => { toast.classList.add('is-visible'); });

        const remove = () => {
            toast.classList.remove('is-visible');
            setTimeout(() => { toast.remove(); }, 350);
        };
        toast.querySelector('.sirum-toast-close').onclick = remove;
        setTimeout(remove, duration);
    }

    // Direkter Send-Flow: Daten laden, senden, Toast zeigen
    async function sendPodMailDirect(docNo, realId, files, mailBtnEl) {
        if (mailBtnEl) {
            mailBtnEl.innerHTML = '<i class="fa fa-spinner fa-spin-fast"></i>';
            mailBtnEl.style.pointerEvents = 'none';
        }

        // Anhänge entscheiden: POD zusammengeführt -> nur diese; sonst Originale
        const mergedFile = files.find(f => f.name.includes(`${docNo}_POD`));
        const originals = files.filter(f => !f.name.includes(`${docNo}_POD`));
        const attachmentsToSend = mergedFile ? [mergedFile] : originals;

        if (attachmentsToSend.length === 0) {
            showToast(`Keine Anhänge für Auftrag <b>${escapeHtml(docNo)}</b> vorhanden.`, { type: 'error' });
            if (mailBtnEl) {
                mailBtnEl.innerHTML = '<i class="fa fa-envelope"></i>';
                mailBtnEl.style.pointerEvents = 'auto';
            }
            return;
        }

        try {
            const tplData = await loadMailTemplateData(realId);
            const partnerIds = tplData.partnerIds || [];

            if (partnerIds.length === 0) {
                throw new Error('Keine Empfänger gefunden (Partner_IDs leer)');
            }

            // Empfängernamen für Toast-Meldung holen
            const partners = await fetchPartnerNames(partnerIds);
            const recipientNames = partners.length > 0
                ? partners.map(p => p.name).join(', ')
                : `${partnerIds.length} Empfänger`;

            await sendPodMail({
                resId: realId,
                subject: tplData.subject,
                bodyHtml: tplData.bodyHtml,
                partnerIds: partnerIds,
                emailFrom: tplData.emailFrom,
                replyTo: tplData.replyTo,
                attachmentIds: attachmentsToSend.map(a => a.id)
            });

            // Erfolg - Button als "gesendet" markieren (orange gefüllt, wiederklickbar)
            if (mailBtnEl) {
                mailBtnEl.classList.remove('is-success');
                mailBtnEl.classList.add('is-sent');
                mailBtnEl.innerHTML = '<i class="fa fa-envelope"></i>';
                mailBtnEl.title = 'POD-Benachrichtigung wurde gesendet. Klicken zum erneuten Senden.';
                mailBtnEl.style.pointerEvents = 'auto';
            }

            showToast(
                `PODs für Auftrag <b>${escapeHtml(docNo)}</b> mit <b>${attachmentsToSend.length}</b> Anhang/Anhängen an <b>${escapeHtml(recipientNames)}</b> versendet`,
                { type: 'success', duration: 5000 }
            );
        } catch (err) {
            console.error(err);
            showToast(
                `Fehler beim Senden für <b>${escapeHtml(docNo)}</b>: ${escapeHtml(err.message)}`,
                { type: 'error', duration: 7000 }
            );
            if (mailBtnEl) {
                mailBtnEl.innerHTML = '<i class="fa fa-envelope"></i>';
                mailBtnEl.style.pointerEvents = 'auto';
            }
        }
    }

    // Der echte Flow: erst action_order_completed_send (Button), dann onchange mit Template-ID
    // Gibt zurück: { subject, bodyHtml, partnerIds, emailFrom, replyTo, templateId }
    async function loadMailTemplateData(resId) {
        // 1) Server-Button aufrufen -> liefert action mit context.default_template_id, default_partner_ids, default_body_html, default_subject
        const btnPayload = {
            jsonrpc: "2.0",
            method: "call",
            params: {
                model: "tms.order",
                method: "action_order_completed_send",
                domain_id: null,
                context_id: 1,
                args: [[resId], { lang: "de_DE", tz: "Europe/Berlin", default_tms_order_state: "order" }]
            }
        };
        const btnRes = await fetch('/web/dataset/call_button', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(btnPayload)
        });
        const btnData = await btnRes.json();
        if (btnData.error) throw new Error(btnData.error.data ? btnData.error.data.message : 'action_order_completed_send fehlgeschlagen');

        const action = btnData.result || {};
        const actionCtx = action.context || {};

        const templateId = actionCtx.default_template_id || POD_MAIL_TEMPLATE_ID;
        let defaultPartnerIds = [];
        if (Array.isArray(actionCtx.default_partner_ids)) {
            if (actionCtx.default_partner_ids.length > 0 && Array.isArray(actionCtx.default_partner_ids[0])) {
                defaultPartnerIds = actionCtx.default_partner_ids[0][2] || [];
            } else {
                defaultPartnerIds = actionCtx.default_partner_ids;
            }
        }
        const defaultBody = actionCtx.default_body_html || '';
        const defaultSubject = actionCtx.default_subject || '';

        // 2) onchange aufrufen, damit das Template komplett aufgelöst wird (inkl. email_from, reply_to, attachments)
        const onchangeCtx = {
            lang: "de_DE",
            tz: "Europe/Berlin",
            active_model: "tms.order",
            active_id: resId,
            active_ids: [resId],
            default_model: "tms.order",
            default_res_id: resId,
            default_use_template: true,
            default_template_id: templateId,
            default_composition_mode: "comment",
            default_partner_ids: [[6, 0, defaultPartnerIds]],
            default_body_html: defaultBody,
            default_subject: defaultSubject,
            force_email: true,
            search_disable_custom_filters: true
        };

        const onchangePayload = {
            jsonrpc: "2.0",
            method: "call",
            params: {
                args: [
                    [],   // ids
                    {},   // values (leer -> Defaults aus Kontext greifen)
                    [],   // field_name (leeres Array = initial onchange / alles auflösen)
                    {     // field_onchange spec
                        composition_mode: "",
                        model: "",
                        res_id: "",
                        is_log: "",
                        parent_id: "",
                        mail_server_id: "",
                        active_domain: "",
                        hide_followers: "",
                        use_active_domain: "",
                        email_from: "",
                        partner_ids: "1",
                        autofollow_recipients: "",
                        subject: "",
                        notify: "",
                        no_auto_thread: "",
                        reply_to: "",
                        body: "",
                        attachment_ids: "",
                        can_attach_attachment: "",
                        object_attachment_ids: "",
                        template_id: "1"
                    }
                ],
                model: "mail.compose.message",
                method: "onchange",
                kwargs: { context: onchangeCtx }
            }
        };

        const ocRes = await fetch('/web/dataset/call_kw/mail.compose.message/onchange', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(onchangePayload)
        });
        const ocData = await ocRes.json();
        if (ocData.error) throw new Error(ocData.error.data ? ocData.error.data.message : 'onchange fehlgeschlagen');

        const ocValue = (ocData.result && ocData.result.value) ? ocData.result.value : {};

        // partner_ids aus onchange-Result extrahieren (kann verschiedene Formen haben)
        let partnerIds = defaultPartnerIds.slice();
        if (Array.isArray(ocValue.partner_ids)) {
            const extracted = [];
            ocValue.partner_ids.forEach(cmd => {
                if (Array.isArray(cmd)) {
                    // [6, 0, [ids]] oder [4, id] oder [1, id, {...}]
                    if (cmd[0] === 6 && Array.isArray(cmd[2])) {
                        extracted.push(...cmd[2]);
                    } else if ((cmd[0] === 4 || cmd[0] === 1) && typeof cmd[1] === 'number') {
                        extracted.push(cmd[1]);
                    } else if (cmd[0] === 0 && cmd[2] && typeof cmd[2] === 'object') {
                        // neuer Partner -> überspringen
                    }
                } else if (typeof cmd === 'number') {
                    extracted.push(cmd);
                }
            });
            if (extracted.length > 0) partnerIds = extracted;
        }

        return {
            subject: ocValue.subject || defaultSubject || '',
            bodyHtml: ocValue.body || defaultBody || '',
            partnerIds: partnerIds,
            emailFrom: ocValue.email_from || '',
            replyTo: ocValue.reply_to || '',
            templateId: templateId
        };
    }

    // Partner-Namen anhand der IDs nachladen
    async function fetchPartnerNames(partnerIds) {
        if (!partnerIds || partnerIds.length === 0) return [];
        const payload = {
            jsonrpc: "2.0",
            method: "call",
            params: {
                args: [partnerIds, ["id", "name", "email"]],
                model: "res.partner",
                method: "read",
                kwargs: {}
            }
        };
        const res = await fetch('/web/dataset/call_kw/res.partner/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error || !data.result) return [];
        return data.result;
    }

    // Öffnet das Vorschau-Modal, lädt Template + zeigt Anhänge, sendet bei Klick
    // Erstellt den mail.compose.message Record und löst den Versand aus
    async function sendPodMail({ resId, subject, bodyHtml, partnerIds, emailFrom, replyTo, attachmentIds }) {
        // 1) mail.compose.message erstellen (wie der cURL im manuellen Flow)
        const createPayload = {
            jsonrpc: "2.0",
            method: "call",
            params: {
                args: [{
                    composition_mode: "comment",
                    model: "tms.order",
                    res_id: resId,
                    is_log: false,
                    parent_id: false,
                    mail_server_id: false,
                    hide_followers: false,
                    use_active_domain: false,
                    email_from: emailFrom,
                    partner_ids: [[6, false, partnerIds]],
                    autofollow_recipients: false,
                    subject: subject,
                    notify: false,
                    no_auto_thread: false,
                    reply_to: replyTo,
                    body: bodyHtml,
                    // WICHTIG: attachment_ids statt object_attachment_ids -> diese werden wirklich mitgeschickt
                    attachment_ids: [[6, false, attachmentIds]],
                    can_attach_attachment: true,
                    object_attachment_ids: [[6, false, attachmentIds]],
                    template_id: POD_MAIL_TEMPLATE_ID
                }],
                model: "mail.compose.message",
                method: "create",
                kwargs: {
                    context: {
                        lang: "de_DE",
                        tz: "Europe/Berlin",
                        active_model: "tms.order",
                        active_id: resId,
                        active_ids: [resId],
                        default_model: "tms.order",
                        default_res_id: resId,
                        default_use_template: true,
                        default_template_id: POD_MAIL_TEMPLATE_ID,
                        default_composition_mode: "comment",
                        default_partner_ids: [[6, 0, partnerIds]],
                        force_email: true
                    }
                }
            }
        };

        const createRes = await fetch('/web/dataset/call_kw/mail.compose.message/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(createPayload)
        });
        const createData = await createRes.json();
        if (createData.error) throw new Error(createData.error.data ? createData.error.data.message : 'Compose-Record konnte nicht erstellt werden');

        const composeId = createData.result;
        if (!composeId) throw new Error('Keine Compose-ID zurückerhalten');

        // 2) Versand auslösen - Methode heißt je nach Odoo-Version "send_mail" (v11/12) oder "action_send_mail" (v13+)
        const sendMethods = ['send_mail', 'action_send_mail'];
        const sendContext = {
            lang: "de_DE",
            tz: "Europe/Berlin",
            active_model: "tms.order",
            active_id: resId,
            active_ids: [resId]
        };
        let lastSendError = null;

        for (const methodName of sendMethods) {
            const sendPayload = {
                jsonrpc: "2.0",
                method: "call",
                params: {
                    args: [[composeId]],
                    model: "mail.compose.message",
                    method: methodName,
                    kwargs: { context: sendContext }
                }
            };
            try {
                const sendRes = await fetch(`/web/dataset/call_kw/mail.compose.message/${methodName}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sendPayload)
                });
                const sendData = await sendRes.json();
                if (sendData.error) {
                    const msg = sendData.error.data ? sendData.error.data.message : `${methodName} fehlgeschlagen`;
                    // Wenn die Methode nicht existiert -> nächste probieren
                    if (msg.includes('has no attribute') || msg.includes('does not exist')) {
                        lastSendError = new Error(msg);
                        continue;
                    }
                    // Echter Fehler (z.B. Validierung) -> sofort abbrechen
                    throw new Error(msg);
                }
                return true; // Erfolg
            } catch (e) {
                lastSendError = e;
                // Nur weiterprobieren wenn's ein "Methode fehlt"-Fehler war
                if (!e.message || (!e.message.includes('has no attribute') && !e.message.includes('does not exist'))) {
                    throw e;
                }
            }
        }
        throw lastSendError || new Error('Versand fehlgeschlagen');
    }


    // --- EVENT HANDLER ---
    async function handlePreviewClick(docNo, attachments, previewBtnEl, existingMergedFile, referenceText) {
        const fileName = generateCleanFileName(docNo, referenceText);
        if (existingMergedFile) {
            showPdfPreview(`/web/content/${existingMergedFile.id}`, existingMergedFile.name);
            return;
        }

        const originalHtml = previewBtnEl.innerHTML;
        previewBtnEl.innerHTML = `<i class="fa fa-spinner fa-spin-fast"></i>`;
        previewBtnEl.style.pointerEvents = 'none';

        try {
            const mergedPdf = await createMergedPdfDocument(docNo, attachments);
            const mergedPdfBytes = await mergedPdf.save();
            const blob = new Blob([mergedPdfBytes], { type: "application/pdf" });
            showPdfPreview(blob, fileName);
        } catch (error) {
            alert(`Vorschau konnte nicht generiert werden:\n\n${error.message}`);
        } finally {
            previewBtnEl.innerHTML = originalHtml;
            previewBtnEl.style.pointerEvents = 'auto';
        }
    }

    async function handleBadgeClick(docNo, realId, attachments, badgeEl, referenceText, mailBtnEl) {
        if (badgeEl.dataset.downloadUrl) {
            triggerLocalDownload(badgeEl.dataset.downloadUrl, badgeEl.dataset.filename);
            return;
        }

        const originalHtml = badgeEl.innerHTML;
        badgeEl.className = 'tms-attachment-badge is-loading';
        badgeEl.innerHTML = `<i class="fa fa-spinner fa-spin-fast"></i> Zusammenführen...`;

        try {
            const mergedPdf = await createMergedPdfDocument(docNo, attachments);
            const fileName = generateCleanFileName(docNo, referenceText);

            badgeEl.className = 'tms-attachment-badge is-uploading';
            badgeEl.innerHTML = `<i class="fa fa-cloud-upload fa-spin-fast"></i> Hochladen...`;

            const mergedPdfBytes = await mergedPdf.save();
            const blob = new Blob([mergedPdfBytes], { type: "application/pdf" });

            const formData = new FormData();
            formData.append('csrf_token', getCSRFToken());
            formData.append('callback', 'oe_fileupload_auto');
            formData.append('ufile', blob, fileName);
            formData.append('model', 'tms.order');
            formData.append('id', realId);
            formData.append('directory_id', POD_ORDER_2_DIRECTORY_ID);

            const uploadRes = await fetch('/web/binary/upload_attachment', { method: 'POST', body: formData });
            if (!uploadRes.ok) throw new Error(`Upload fehlgeschlagen. Status: ${uploadRes.status}`);

            // Frisch die Dateien neu abfragen, damit der Mail-Button die neue POD-Datei kennt
            // (Die upload_attachment-Response liefert keine brauchbare ID zurück)
            try {
                const refreshRes = await fetch('/web/dataset/search_read', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: "2.0", method: "call",
                        params: { model: "ir.attachment", domain: [["res_model", "=", "tms.order"], ["res_id", "=", realId]], fields: ["id", "name", "mimetype"] }
                    })
                });
                const refreshData = await refreshRes.json();
                if (refreshData.result && refreshData.result.records) {
                    // In-place: das ursprüngliche Array ersetzen (gleiche Referenz!) - so sieht auch der Mail-Button das Update
                    attachments.length = 0;
                    refreshData.result.records.forEach(att => attachments.push({ id: att.id, name: att.name, mimetype: att.mimetype }));
                }
            } catch (refreshErr) {
                console.warn('Konnte Anhang-Liste nicht aktualisieren:', refreshErr);
            }

            badgeEl.className = 'tms-attachment-badge is-merged';
            badgeEl.innerHTML = `<i class="fa fa-download"></i> Laden`;
            badgeEl.title = "Upload erfolgreich! Klicken zum Herunterladen auf den PC.";
            badgeEl.dataset.downloadUrl = URL.createObjectURL(blob);
            badgeEl.dataset.filename = fileName;

            // Mail-Button-Tooltip aktualisieren, falls vorhanden
            if (mailBtnEl && !mailBtnEl.classList.contains('is-sent') && !mailBtnEl.classList.contains('is-disabled')) {
                mailBtnEl.title = 'POD-Benachrichtigung senden (zusammengeführte POD wird angehängt)';
            }

        } catch (error) {
            console.error("Fehler:", error);
            alert(`Ein Fehler ist aufgetreten:\n\n${error.message}`);
            badgeEl.className = 'tms-attachment-badge has-attachments';
            badgeEl.innerHTML = `<i class="fa fa-paperclip"></i> ${attachments.length}`;
        }
    }

    // --- UI BUILDERS (SKELETON & UPDATE) ---
    function createPlaceholderUI(isModal = false) {
        const container = document.createElement('span');
        container.className = 'tms-action-container' + (isModal ? ' in-modal' : '');

        const badge = document.createElement('span');
        badge.className = 'tms-attachment-badge is-fetching';
        badge.innerHTML = `<i class="fa fa-spinner fa-spin-fast"></i>`;

        const previewBtn = document.createElement('span');
        previewBtn.className = 'tms-action-btn tms-preview-btn is-fetching';
        previewBtn.innerHTML = '<i class="fa fa-circle-o-notch fa-spin-fast" style="font-size: 0.8em"></i>';

        const tagBtn = document.createElement('span');
        tagBtn.className = 'tms-action-btn tms-tag-btn is-fetching';
        tagBtn.innerHTML = '<i class="fa fa-circle-o-notch fa-spin-fast" style="font-size: 0.8em"></i>';

        // NEU: Platzhalter für den Mülleimer
        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'tms-action-btn tms-delete-btn is-fetching';
        deleteBtn.innerHTML = '<i class="fa fa-circle-o-notch fa-spin-fast" style="font-size: 0.8em"></i>';

        // NEU: Platzhalter für den POD-Brief-Button
        const mailBtn = document.createElement('span');
        mailBtn.className = 'tms-action-btn tms-mail-btn is-fetching';
        mailBtn.innerHTML = '<i class="fa fa-circle-o-notch fa-spin-fast" style="font-size: 0.8em"></i>';

        container.appendChild(badge);
        container.appendChild(previewBtn);
        if (!isModal) {
            container.appendChild(tagBtn);
            container.appendChild(deleteBtn);
            container.appendChild(mailBtn);
        }

        return { container, badge, previewBtn, tagBtn, deleteBtn, mailBtn };
    }

    function updatePlaceholderWithData(docNo, orderInfo, badge, previewBtn, tagBtn, deleteBtn, mailBtn, referenceText, row) {
        const files = orderInfo ? (orderInfo.files || []) : [];
        const realId = orderInfo ? orderInfo.realId : null;
        const tags = orderInfo ? (orderInfo.tags || []) : [];

        const count = files.length;
        const existingMergedFile = files.find(f => f.name.includes(`${docNo}_POD`));
        // Trenne Originaldateien von der bereits zusammengefügten Datei
        const originalFiles = files.filter(f => !f.name.includes(`${docNo}_POD`));

        badge.className = 'tms-attachment-badge';
        previewBtn.className = 'tms-action-btn tms-preview-btn';

        if (tagBtn) {
            tagBtn.className = 'tms-action-btn tms-tag-btn';
            tagBtn.innerHTML = '<i class="fa fa-check"></i>';

            if (tags.includes(DONE_TAG_ID)) {
                tagBtn.classList.add('is-success');
                tagBtn.title = "Lieferschein erledigt (bereits gesetzt)";
            } else if (realId) {
                tagBtn.title = "Tag 'Lieferschein erledigt' hinzufügen";
                tagBtn.onclick = (e) => {
                    e.stopPropagation(); e.preventDefault();
                    addQuickTag(realId, tagBtn, row);
                };
            } else {
                tagBtn.style.display = 'none';
            }
        }

        // NEU: Logik für den Löschen-Button
        if (deleteBtn) {
            deleteBtn.className = 'tms-action-btn tms-delete-btn';
            if (originalFiles.length > 0) {
                deleteBtn.innerHTML = '<i class="fa fa-trash"></i>';
                deleteBtn.title = `${originalFiles.length} Originaldatei(en) endgültig löschen`;
                deleteBtn.onclick = async (e) => {
                    e.stopPropagation(); e.preventDefault();
                    const idsToDelete = originalFiles.map(f => f.id);
                    await deleteOriginalAttachments(idsToDelete, deleteBtn);
                };
            } else {
                deleteBtn.style.display = 'none'; // Verstecken, wenn es keine Originale mehr gibt
            }
        }

        // NEU: Logik für den POD-Mail-Button
        if (mailBtn) {
            mailBtn.className = 'tms-action-btn tms-mail-btn';
            mailBtn.innerHTML = '<i class="fa fa-envelope"></i>';
            const podMailSent = orderInfo ? orderInfo.podMailSent : false;

            if (realId && count > 0) {
                const willSendMerged = !!existingMergedFile;
                const attachCountForSend = willSendMerged ? 1 : originalFiles.length;
                const baseTitle = willSendMerged
                    ? `zusammengeführte POD wird angehängt`
                    : `${originalFiles.length} Originaldatei(en) werden angehängt`;

                if (podMailSent) {
                    mailBtn.classList.add('is-sent');
                    mailBtn.title = `POD-Benachrichtigung wurde bereits gesendet. Klicken zum erneuten Senden (${baseTitle}).`;
                } else {
                    mailBtn.title = `POD-Benachrichtigung senden (${baseTitle})`;
                }

                mailBtn.onclick = (e) => {
                    e.stopPropagation(); e.preventDefault();
                    sendPodMailDirect(docNo, realId, files, mailBtn);
                };
            } else if (realId && podMailSent) {
                // Keine Anhänge mehr, aber Mail wurde trotzdem schon mal gesendet
                mailBtn.classList.add('is-sent', 'is-disabled');
                mailBtn.title = 'POD-Benachrichtigung bereits gesendet (keine Anhänge mehr vorhanden)';
            } else {
                mailBtn.classList.add('is-disabled');
                mailBtn.title = realId ? 'Keine Anhänge zum Versenden vorhanden' : 'Auftrag nicht gefunden';
            }
        }

        if (existingMergedFile) {
            badge.classList.add('is-merged');
            badge.innerHTML = `<i class="fa fa-download"></i> Laden`;
            badge.title = "Bereits verarbeitet. Klicken für Download auf den PC.";
            badge.dataset.downloadUrl = `/web/content/${existingMergedFile.id}?download=true`;
            badge.dataset.filename = existingMergedFile.name;
            badge.onclick = (e) => { e.stopPropagation(); e.preventDefault(); triggerLocalDownload(badge.dataset.downloadUrl, badge.dataset.filename); };

            previewBtn.innerHTML = '<i class="fa fa-search"></i>';
            previewBtn.title = "Zusammengeführte Datei anzeigen";
            previewBtn.onclick = (e) => { e.stopPropagation(); e.preventDefault(); handlePreviewClick(docNo, files, previewBtn, existingMergedFile, referenceText); };
        }
        else if (count > 0) {
            badge.classList.add('has-attachments');
            badge.innerHTML = `<i class="fa fa-paperclip"></i> ${count}`;
            badge.title = `Klicken, um ${count} Dateien zusammenzufügen & hochzuladen`;
            badge.onclick = (e) => { e.stopPropagation(); e.preventDefault(); handleBadgeClick(docNo, realId, files, badge, referenceText, mailBtn); };

            previewBtn.innerHTML = '<i class="fa fa-search"></i>';
            previewBtn.title = "Vorschau aller Dokumente generieren";
            previewBtn.onclick = (e) => { e.stopPropagation(); e.preventDefault(); handlePreviewClick(docNo, files, previewBtn, null, referenceText); };
        }
        else {
            badge.classList.add('zero-attachments');
            badge.innerHTML = `<i class="fa fa-paperclip"></i> 0`;
            badge.title = "Keine Anhänge vorhanden";

            previewBtn.classList.add('is-empty');
            previewBtn.innerHTML = '<i class="fa fa-search"></i>';
            previewBtn.title = "Hier gibt es leider nichts zu sehen...";
            previewBtn.onclick = (e) => {
                e.stopPropagation(); e.preventDefault();
                previewBtn.innerHTML = '<i class="fa fa-frown-o"></i>';
                setTimeout(() => { previewBtn.innerHTML = '<i class="fa fa-search"></i>'; }, 2000);
            };
        }
    }

    // --- MAIN OBSERVER LOGIC ---
    async function processRows() {
        if (isFetchingTable) return;
        const rows = document.querySelectorAll('tr.o_data_row:not(.attachment-processed)');
        if (rows.length === 0) return;

        isFetchingTable = true;
        const pendingUpdates = [];
        const docNosToFetch = [];

        rows.forEach(row => {
            const docNoEl = row.querySelector('span[name="document_no"]');
            const targetField = row.querySelector('span[name="partner_id"]');

            if (docNoEl && targetField) {
                const docNo = docNoEl.innerText.trim();
                if (docNo) {
                    const refField = row.querySelector('span[name="client_order_ref"]');
                    const referenceText = refField ? refField.innerText.trim() : "";

                    const { container, badge, previewBtn, tagBtn, deleteBtn, mailBtn } = createPlaceholderUI(false);
                    targetField.parentNode.insertBefore(container, targetField);

                    pendingUpdates.push({ docNo, badge, previewBtn, tagBtn, deleteBtn, mailBtn, referenceText, row });
                    if (!docNosToFetch.includes(docNo)) docNosToFetch.push(docNo);
                }
            }
            row.classList.add('attachment-processed');
        });

        if (docNosToFetch.length > 0) {
            const orderDataMap = await fetchAttachmentData(docNosToFetch);

            pendingUpdates.forEach(item => {
                const orderInfo = orderDataMap[item.docNo];
                updatePlaceholderWithData(item.docNo, orderInfo, item.badge, item.previewBtn, item.tagBtn, item.deleteBtn, item.mailBtn, item.referenceText, item.row);
            });
        }
        isFetchingTable = false;
    }

    async function processModal() {
        if (isFetchingModal) return;

        const formViews = document.querySelectorAll('.o_form_view:not(.attachment-processed-modal)');
        if (formViews.length === 0) return;

        isFetchingModal = true;

        for (const formView of formViews) {
            formView.classList.add('attachment-processed-modal');

            const docNoEl = formView.querySelector('span[name="document_no"]');
            if (!docNoEl) continue;

            const docNo = docNoEl.innerText.trim();
            if (!docNo) continue;

            const refSpan = formView.querySelector('span[name="client_order_ref"]');
            const refInput = formView.querySelector('input[name="client_order_ref"]');
            let referenceText = "";
            if (refSpan) referenceText = refSpan.innerText.trim();
            else if (refInput) referenceText = refInput.value.trim();

            const modalContent = formView.closest('.modal-content');
            if (!modalContent) continue;

            const modalFooter = modalContent.querySelector('.modal-footer');
            if (!modalFooter) continue;

            const { container, badge, previewBtn } = createPlaceholderUI(true);

            const buttons = Array.from(modalFooter.querySelectorAll('button.dropdown-toggle'));
            const attachBtn = buttons.find(b => b.innerText.includes('Anhänge'));

            if (attachBtn) {
                const dropupGroup = attachBtn.closest('.btn-group');
                if (dropupGroup && dropupGroup.parentNode) {
                    dropupGroup.parentNode.insertBefore(container, dropupGroup.nextSibling);
                }
            } else {
                modalFooter.appendChild(container);
            }

            const orderDataMap = await fetchAttachmentData([docNo]);
            const orderInfo = orderDataMap[docNo];
            updatePlaceholderWithData(docNo, orderInfo, badge, previewBtn, null, null, null, referenceText, null);
        }
        isFetchingModal = false;
    }

    let timeout;
    const observer = new MutationObserver(() => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            processRows();
            processModal();
        }, 150);
    });

    const start = () => {
        const target = document.querySelector('.o_content') || document.body;
        observer.observe(target, { childList: true, subtree: true });
        processRows();
        processModal();
    };

    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start);
})();
