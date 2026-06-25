// ==UserScript==
// @name         Sirum: Ladestellen in Dispoliste
// @namespace    https://github.com/BAHendrik/tms_tools
// @version      1.3
// @description  Zeigt in der Dispositions-Liste zusätzlich zum Ort den Namen der Ladestelle (z.B. "Kaufland Dortmund") an.
// @author       BAHendrik
// @match        https://coolerulogistics-production-00220.dolphins.sirum.de/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/BAHendrik/tms_tools/main/Dispo_Ladestellen.user.js
// @downloadURL  https://raw.githubusercontent.com/BAHendrik/tms_tools/main/Dispo_Ladestellen.user.js
// @supportURL   https://github.com/BAHendrik/tms_tools/issues
// ==/UserScript==

(function () {
    'use strict';

    // ===================================================================
    // KONFIGURATION
    //   Anker = data-sub-ref der Zeile = ID der ERSTEN tms.action.group.set.
    //   Auflösung des kompletten Transports:
    //     set -> action_group_ids[0] -> tms.action.group.tms_transport_id
    //         -> tms.transport.action_group_set_ids -> name/city je Stopp
    // ===================================================================
    const CFG = {
        SET_MODEL:        'tms.action.group.set',
        GROUP_MODEL:      'tms.action.group',
        TRANSPORT_MODEL:  'tms.transport',
        TRANSPORT_FIELD:  'action_group_set_ids',
        GROUP_TRANSPORT_FIELD: 'tms_transport_id',

        // true = Name nur anzeigen, wenn Stopp-Anzahl exakt zur Adresszeilen-Anzahl passt
        STRICT_COUNT: true,
        DEBUG: true,
    };

    const log  = (...a) => CFG.DEBUG && console.log('%c[Ladestelle]', 'color:#4e73df;font-weight:bold', ...a);
    const warn = (...a) => CFG.DEBUG && console.warn('[Ladestelle]', ...a);

    // ===================================================================
    // STYLES
    // ===================================================================
    const style = document.createElement('style');
    style.textContent = `
        .lst-name { font-size: 0.82em; font-weight: 400; color: #8a94a6; }
        .lst-name i { font-size: 0.9em; color: #4e73df; margin-right: 4px; opacity: 0.85; }
        .lst-addr { font-weight: 600; color: #2c3e50; }
    `;
    document.head.appendChild(style);

    // ===================================================================
    // JSON-RPC
    // ===================================================================
    async function searchRead(model, domain, fields) {
        const res = await fetch('/web/dataset/search_read', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, domain, fields } })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.data?.message || 'search_read fehlgeschlagen');
        return (data.result && data.result.records) || [];
    }

    const m2oId = (v) => Array.isArray(v) ? v[0] : v;

    // ===================================================================
    // DOM
    // ===================================================================
    function getFirstSetId(row) {
        const raw = row.getAttribute('data-sub-ref') || '';
        const id = parseInt(raw, 10);
        return Number.isFinite(id) ? id : null;
    }
    function getAddressCell(row) { return row.querySelector('td.tmsNodeList'); }
    function getAddressSpans(cell) { return [...cell.querySelectorAll(':scope > span.text-nowrap.show-compressed')]; }
    const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // ===================================================================
    // AUFLÖSUNG: erstes Set -> alle Stopp-Namen des Transports
    // ===================================================================
    async function resolveNames(firstSetIds) {
        // A) erstes Set -> erste action_group
        const setsA = await searchRead(CFG.SET_MODEL, [['id', 'in', firstSetIds]], ['id', 'action_group_ids']);
        const setToAg = {};
        const agIds = [];
        setsA.forEach(s => {
            const ag = (Array.isArray(s.action_group_ids) && s.action_group_ids.length) ? s.action_group_ids[0] : null;
            if (ag != null) { setToAg[s.id] = ag; agIds.push(ag); }
        });

        // B) action_group -> Transport
        const agToTransport = {};
        if (agIds.length) {
            const ags = await searchRead(CFG.GROUP_MODEL, [['id', 'in', agIds]], ['id', CFG.GROUP_TRANSPORT_FIELD]);
            ags.forEach(a => {
                const t = m2oId(a[CFG.GROUP_TRANSPORT_FIELD]);
                if (t) agToTransport[a.id] = t;
            });
        }

        // C) Transport -> geordnete Set-IDs
        const transportToSets = {};
        const allSetIds = new Set();
        const transportIds = [...new Set(Object.values(agToTransport))];
        if (transportIds.length) {
            const trs = await searchRead(CFG.TRANSPORT_MODEL, [['id', 'in', transportIds]], ['id', CFG.TRANSPORT_FIELD]);
            trs.forEach(t => {
                const sets = Array.isArray(t[CFG.TRANSPORT_FIELD]) ? t[CFG.TRANSPORT_FIELD] : [];
                transportToSets[t.id] = sets;
                sets.forEach(id => allSetIds.add(id));
            });
        }

        // D) Set-Details (Name/Ort/Reihenfolge)
        const setMap = {};
        if (allSetIds.size) {
            const sets = await searchRead(CFG.SET_MODEL, [['id', 'in', [...allSetIds]]], ['id', 'name', 'city', 'zip', 'sequence']);
            sets.forEach(s => { setMap[s.id] = s; });
        }

        // Zusammenführen: firstSetId -> [Name, Name, ...]
        const out = {};
        firstSetIds.forEach(fid => {
            const ag  = setToAg[fid];
            const tid = ag != null ? agToTransport[ag] : null;
            const setIds = tid != null ? (transportToSets[tid] || []) : [];
            const sets = setIds.map(id => setMap[id]).filter(Boolean);
            sets.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
            out[fid] = sets.map(s => (s.name || '').trim());
        });
        return out;
    }

    // ===================================================================
    // ANWENDEN
    // ===================================================================
    function applyNames(cell, names) {
        const spans = getAddressSpans(cell);
        if (!spans.length) return;
        if (CFG.STRICT_COUNT && names.length !== spans.length) {
            warn(`Anzahl passt nicht (Stopps: ${names.length}, Zeilen: ${spans.length}) – übersprungen.`);
            return;
        }
        const n = Math.min(spans.length, names.length);
        for (let i = 0; i < n; i++) {
            const name = names[i];
            if (!name) continue;
            const addr = spans[i].textContent.trim();
            spans[i].innerHTML =
                `<span class="lst-name"><i class="fas fa-map-marker-alt"></i>${esc(name)}</span>` +
                `<br><span class="lst-addr">${esc(addr)}</span>`;
        }
    }

    // ===================================================================
    // HAUPTSCHLEIFE
    // ===================================================================
    let busy = false;
    async function processRows() {
        if (busy) return;

        const pending = [];
        document.querySelectorAll('tr.o_data_row').forEach(row => {
            const cell = getAddressCell(row);
            if (!cell || cell.dataset.lstDone) return;
            const firstSetId = getFirstSetId(row);
            if (firstSetId == null) return;
            pending.push({ firstSetId, cell });
        });
        if (!pending.length) return;

        busy = true;
        try {
            pending.forEach(p => { p.cell.dataset.lstDone = '1'; });

            const firstSetIds = [...new Set(pending.map(p => p.firstSetId))];
            const namesByFirstSet = await resolveNames(firstSetIds);

            pending.forEach(({ firstSetId, cell }) => {
                const names = namesByFirstSet[firstSetId];
                if (names && names.length) applyNames(cell, names);
            });
        } catch (e) {
            warn('processRows-Fehler:', e.message);
            pending.forEach(p => { delete p.cell.dataset.lstDone; });
        }
        busy = false;
    }

    // ===================================================================
    // START + OBSERVER
    // ===================================================================
    let debounce;
    const observer = new MutationObserver(() => {
        clearTimeout(debounce);
        debounce = setTimeout(processRows, 150);
    });
    const start = () => {
        const target = document.querySelector('.o_content') || document.body;
        observer.observe(target, { childList: true, subtree: true });
        processRows();
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start);
})();
