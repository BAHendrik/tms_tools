// ==UserScript==
// @name         Sirum: Quick Payment Button (Rechnungen)
// @namespace    https://github.com/BAHendrik/tms_tools
// @version      1.2
// @description  Fügt einen "Einzahlung erfassen"-Button direkt in die Rechnungsliste ein. Finale Auto-Fill Version.
// @author       BAHendrik
// @match        https://coolerulogistics-production-00220.dolphins.sirum.de/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/BAHendrik/tms_tools/main/QuickPayment.user.js
// @downloadURL  https://raw.githubusercontent.com/BAHendrik/tms_tools/main/QuickPayment.user.js
// ==/UserScript==

(function() {
    'use strict';

    console.log("[Sirum Payment] Script initialisiert.");

    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        .tms-payment-btn {
            display: inline-flex; align-items: center; justify-content: center;
            background: linear-gradient(135deg, #1cc88a 0%, #13855c 100%);
            color: #ffffff !important; border-radius: 50%;
            width: 26px; height: 26px; margin-left: 10px; font-size: 0.9em;
            cursor: pointer; transition: all 0.2s ease-in-out;
            border: 1px solid #13855c; box-shadow: 0 2px 5px rgba(0,0,0,0.15);
            vertical-align: middle; z-index: 999;
        }
        .tms-payment-btn:hover {
            transform: scale(1.15) translateY(-1px); box-shadow: 0 4px 10px rgba(28, 200, 138, 0.4);
            background: linear-gradient(135deg, #1ed895 0%, #169b6b 100%);
        }
        .tms-payment-btn.is-disabled {
            background: #cbd5e1; border-color: #94a3b8; color: #f8fafc !important;
            box-shadow: none; cursor: not-allowed; pointer-events: none;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .fa-spin-fast { animation: spin 1s linear infinite; }
    `;
    document.head.appendChild(styleSheet);

    function isInvoiceList() {
        const url = window.location.href;
        return url.includes('model=account.invoice') && (url.includes('view_type=list') || url.includes('view_type=tms_list'));
    }

    // Holt die echte Datenbank-ID der Rechnung via Odoo API
    async function fetchRealInvoiceId(invoiceNumber) {
        if (!invoiceNumber) return null;
        try {
            const payload = {
                jsonrpc: "2.0",
                method: "call",
                params: {
                    model: "account.invoice",
                    domain: [["number", "=", invoiceNumber]],
                    fields: ["id"]
                }
            };
            const res = await fetch('/web/dataset/search_read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.result && data.result.records && data.result.records.length > 0) {
                return data.result.records[0].id;
            }
        } catch (e) {
            console.error("[Sirum Payment] Fehler beim Fetch der ID:", e);
        }
        return null;
    }

    // Öffnet das Modal mit der echten ID über die Server-Aktion 256
    function openPaymentModal(invoiceId) {
        try {
            const odoo = window.odoo;
            if (!odoo || !odoo.__DEBUG__ || !odoo.__DEBUG__.services) return;
            const services = odoo.__DEBUG__.services;
            const candidateKeys = ['web.web_client', 'window_manager.action_manager', 'web.action_manager', 'web.ActionManager'];
            let actionTarget = null; let actionMethod = null;

            for (const key of candidateKeys) {
                const svc = services[key];
                if (!svc) continue;
                if (typeof svc.do_action === 'function') { actionTarget = svc; actionMethod = 'do_action'; break; }
                if (typeof svc.doAction === 'function') { actionTarget = svc; actionMethod = 'doAction'; break; }
                if (svc.action_manager) {
                    if (typeof svc.action_manager.do_action === 'function') { actionTarget = svc.action_manager; actionMethod = 'do_action'; break; }
                    if (typeof svc.action_manager.doAction === 'function') { actionTarget = svc.action_manager; actionMethod = 'doAction'; break; }
                }
            }

            if (actionTarget && actionMethod) {
                console.log(`[Sirum Payment] Führe Aktion 256 aus für Rechnungs-ID: ${invoiceId}`);

                // Wir rufen Aktion 256 auf UND zwingen Odoo den Kontext auf
                actionTarget[actionMethod](256, {
                    additional_context: {
                        active_model: 'account.invoice',
                        active_id: invoiceId,
                        active_ids: [invoiceId],
                        default_invoice_ids: [[4, invoiceId, false]],
                        type: 'out_invoice',
                        journal_type: 'sale'
                    }
                });
            }
        } catch (err) { console.error(err); }
    }

    function processInvoiceRows() {
        if (!isInvoiceList()) return;
        const rows = document.querySelectorAll('tr.o_data_row:not(.payment-btn-processed)');
        if (rows.length === 0) return;

        rows.forEach(row => {
            row.classList.add('payment-btn-processed');

            const cells = row.querySelectorAll('td');
            if (cells.length < 5) return;

            let targetCell = cells[cells.length - 1];
            let isOpen = false;

            cells.forEach(cell => {
                const text = cell.innerText.trim();
                if (text === 'Offen') { targetCell = cell; isOpen = true; }
                else if (text === 'Bezahlt' || text === 'Entwurf' || text === 'Storniert') { targetCell = cell; }
            });

            // Spalte 3 ist die Rechnungsnummer (KR...)
            let invoiceNumber = cells[3] ? cells[3].innerText.trim() : "";

            const paymentBtn = document.createElement('span');
            paymentBtn.innerHTML = '<i class="fa fa-money"></i>';

            if (isOpen && invoiceNumber) {
                paymentBtn.className = 'tms-payment-btn';
                paymentBtn.title = `Einzahlung erfassen für ${invoiceNumber}`;

                paymentBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    const originalHtml = paymentBtn.innerHTML;
                    paymentBtn.innerHTML = '<i class="fa fa-spinner fa-spin-fast"></i>';
                    paymentBtn.style.pointerEvents = 'none';

                    // API-Aufruf, um die interne ID zu bekommen
                    const realId = await fetchRealInvoiceId(invoiceNumber);

                    paymentBtn.innerHTML = originalHtml;
                    paymentBtn.style.pointerEvents = 'auto';

                    if (realId) {
                        openPaymentModal(realId);
                    } else {
                        alert(`Fehler: Konnte die interne ID für Rechnung ${invoiceNumber} nicht vom Server abrufen!`);
                    }
                });
            } else {
                paymentBtn.className = 'tms-payment-btn is-disabled';
                paymentBtn.title = isOpen ? 'Fehler: Rechnungsnummer nicht gefunden' : 'Nur bei offenen Rechnungen möglich';
            }

            targetCell.style.position = 'relative';
            targetCell.appendChild(paymentBtn);
        });
    }

    let timeout;
    const observer = new MutationObserver(() => {
        clearTimeout(timeout);
        timeout = setTimeout(() => { processInvoiceRows(); }, 300);
    });

    const start = () => {
        const target = document.querySelector('.o_content') || document.body;
        observer.observe(target, { childList: true, subtree: true });
        processInvoiceRows();
    };

    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start);
})();
