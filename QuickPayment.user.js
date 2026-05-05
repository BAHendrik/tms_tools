// ==UserScript==
// @name         Sirum: Quick Payment Button (Rechnungen)
// @namespace    https://github.com/BAHendrik/tms_tools
// @version      1.4
// @description  Fügt einen "Einzahlung erfassen"-Button direkt in die Rechnungsliste ein.
// @author       BAHendrik
// @match        https://coolerulogistics-production-00220.dolphins.sirum.de/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log("[Sirum Payment] Script initialisiert.");

    // CSS für den neuen Payment-Button (Grün für Offen, Grau für andere)
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        .tms-payment-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #1cc88a 0%, #13855c 100%);
            color: #ffffff !important;
            border-radius: 50%;
            width: 26px;
            height: 26px;
            margin-left: 10px;
            font-size: 0.9em;
            cursor: pointer;
            transition: all 0.2s ease-in-out;
            border: 1px solid #13855c;
            box-shadow: 0 2px 5px rgba(0,0,0,0.15);
            vertical-align: middle;
            z-index: 999;
        }
        .tms-payment-btn:hover {
            transform: scale(1.15) translateY(-1px);
            box-shadow: 0 4px 10px rgba(28, 200, 138, 0.4);
            background: linear-gradient(135deg, #1ed895 0%, #169b6b 100%);
        }
        .tms-payment-btn:active {
            transform: scale(0.95);
        }
        .tms-payment-btn.is-disabled {
            background: #cbd5e1;
            border-color: #94a3b8;
            color: #f8fafc !important;
            box-shadow: none;
            cursor: not-allowed;
        }
        .tms-payment-btn.is-disabled:hover {
            transform: none;
            background: #cbd5e1;
        }
    `;
    document.head.appendChild(styleSheet);

    function isInvoiceList() {
        const url = window.location.href;
        return url.includes('model=account.invoice') && (url.includes('view_type=list') || url.includes('view_type=tms_list'));
    }

    // Odoo Action Manager aufrufen (Aktion 256)
    function openPaymentModal(invoiceId) {
        try {
            const odoo = window.odoo;
            if (!odoo || !odoo.__DEBUG__ || !odoo.__DEBUG__.services) {
                alert('Odoo-Services nicht erreichbar. Bitte Seite neu laden.');
                return;
            }

            const services = odoo.__DEBUG__.services;
            const candidateKeys = ['web.web_client', 'window_manager.action_manager', 'web.action_manager', 'web.ActionManager'];
            let actionTarget = null;
            let actionMethod = null;

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
                console.log(`[Sirum Payment] Öffne Modal für Rechnung ID: ${invoiceId}`);
                actionTarget[actionMethod](256, {
                    additional_context: {
                        active_ids: [invoiceId],
                        active_id: invoiceId,
                        active_model: 'account.invoice'
                    }
                });
            } else {
                alert('Action-Method nicht gefunden.');
            }
        } catch (err) {
            console.error('[Sirum Payment] Fehler beim Öffnen des Payment-Modals:', err);
        }
    }

    // Zeilen verarbeiten
    function processInvoiceRows() {
        if (!isInvoiceList()) return;

        const rows = document.querySelectorAll('tr.o_data_row:not(.payment-btn-processed)');
        if (rows.length === 0) return;

        rows.forEach(row => {
            row.classList.add('payment-btn-processed');

            const cells = row.querySelectorAll('td.o_data_cell');
            if (cells.length === 0) return;

            let targetCell = cells[cells.length - 1];
            let isOpen = false;

            // Suche die Zelle, in der der Status "Offen" steht
            cells.forEach(cell => {
                const text = cell.innerText.trim();
                if (text === 'Offen') {
                    targetCell = cell;
                    isOpen = true;
                } else if (text === 'Bezahlt' || text === 'Entwurf' || text === 'Storniert') {
                    targetCell = cell;
                }
            });

            // Versuch, die ID zu fischen (Jetzt mit jQuery)
            let recordId = null;

            // 1. Odoo-jQuery Cache (sehr oft verwendet, wenn data-id im HTML fehlt)
            if (window.jQuery) {
                const jqId = window.jQuery(row).data('id');
                if (jqId) {
                    // Falls Odoo z.B. "datapoint_123" liefert, extrahieren wir nur die Zahl
                    const match = String(jqId).match(/\d+/);
                    if (match) recordId = parseInt(match[0], 10);
                }
            }

            // 2. Normales Dataset als Fallback
            if (!recordId && row.dataset.id) {
                const match = String(row.dataset.id).match(/\d+/);
                if (match) recordId = parseInt(match[0], 10);
            }

            // Button bauen
            const paymentBtn = document.createElement('span');
            paymentBtn.innerHTML = '<i class="fa fa-money"></i>';

            if (isOpen && recordId && !isNaN(recordId)) {
                // Rechnung ist offen und wir haben die ID -> Klickbar machen!
                paymentBtn.className = 'tms-payment-btn';
                paymentBtn.title = `Einzahlung erfassen`;
                paymentBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    openPaymentModal(recordId);
                });
            } else {
                // Rechnung ist nicht offen oder ID fehlt immer noch
                paymentBtn.className = 'tms-payment-btn is-disabled';
                paymentBtn.title = isOpen ? 'Fehler: Konnte ID trotz jQuery nicht lesen' : 'Nur bei offenen Rechnungen möglich';
                paymentBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                });
            }

            // Rein in die Zelle damit
            targetCell.style.position = 'relative';
            targetCell.appendChild(paymentBtn);
        });
    }

    let timeout;
    const observer = new MutationObserver(() => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            processInvoiceRows();
        }, 300);
    });

    const start = () => {
        const target = document.querySelector('.o_content') || document.body;
        observer.observe(target, { childList: true, subtree: true });
        processInvoiceRows();
    };

    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start);
})();
