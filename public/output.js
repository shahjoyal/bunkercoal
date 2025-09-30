// public/output.js
// Minimal robust script to fetch latest blend and populate GCV/cost/fields
(function () {
  const APIBASE = window.location.origin + '/api';
  let latestBlendId = null;

  // helpers
  function getTextOrValue(el) {
    if (!el) return '';
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return el.value ?? '';
    return el.innerText ?? '';
  }
  function setTextOrValue(el, txt) {
    if (!el) return;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') el.value = txt ?? '';
    else el.innerText = txt ?? '';
  }
  function setAllTextOrValue(selector, txt) {
    Array.from(document.querySelectorAll(selector)).forEach(el => setTextOrValue(el, txt));
  }
  function pickVisibleOrFirst(selector) {
    const els = Array.from(document.querySelectorAll(selector));
    if (!els.length) return null;
    // prefer inside active panel
    const active = document.querySelector('.tab-panel.active');
    if (active) {
      const inside = els.find(e => active.contains(e));
      if (inside) return inside;
    }
    const visible = els.find(e => e.offsetParent !== null);
    if (visible) return visible;
    return els[0];
  }

  // populate DOM from server blend object
  function populateBlendIntoDOM(data) {
    if (!data || !Array.isArray(data.rows)) return;
    data.rows.forEach((row, rIdx) => {
      const i = rIdx + 1;
      setAllTextOrValue(`#coalName${i}`, row.coal ?? '');
      (row.percentages || []).forEach((pct, mIdx) => {
        setAllTextOrValue(`.percentage-input[data-row='${i}'][data-mill='${mIdx}']`, (pct === null || pct === undefined) ? '' : String(pct));
      });
      const gcvTxt = (row.gcv !== undefined && row.gcv !== null && row.gcv !== '') ? Number(row.gcv).toFixed(2) : '';
      setAllTextOrValue(`#gcvBox${i}`, gcvTxt);
      const costTxt = (row.cost !== undefined && row.cost !== null && row.cost !== '') ? Number(row.cost).toFixed(2) : '';
      setAllTextOrValue(`#costBox${i}`, costTxt);
    });

    (data.flows || []).forEach((f, mIdx) => {
      setAllTextOrValue(`.flow-input[data-mill='${mIdx}']`, (f === null || f === undefined) ? '' : String(f));
    });

    setAllTextOrValue('#generation', (data.generation !== undefined && data.generation !== null) ? String(data.generation) : '');

    // small summary fields (if exist)
    if (data.totalFlow !== undefined && data.totalFlow !== null) setAllTextOrValue('#totalFlow', Number(data.totalFlow).toFixed(2));
    if (data.avgGCV !== undefined && data.avgGCV !== null && !isNaN(Number(data.avgGCV))) setAllTextOrValue('#avgGCV', Number(data.avgGCV).toFixed(2));
    if (data.avgAFT !== undefined && data.avgAFT !== null && !isNaN(Number(data.avgAFT))) setAllTextOrValue('#avgAFT', Number(data.avgAFT).toFixed(2));
    if (data.heatRate !== undefined && data.heatRate !== null && !isNaN(Number(data.heatRate))) setAllTextOrValue('#heatRate', Number(data.heatRate).toFixed(2));
    if (data.costRate !== undefined && data.costRate !== null && !isNaN(Number(data.costRate))) setAllTextOrValue('#COSTRATE', Number(data.costRate).toFixed(2));

    latestBlendId = data._id || data.id || latestBlendId;

    // run UI hooks if present (safe-guarded)
    try {
      const panels = Array.from(document.querySelectorAll('.tab-panel'));
      panels.forEach(panel => {
        if (typeof initPanel === 'function') initPanel(panel);
        if (typeof validateMillPercentages === 'function') validateMillPercentages(panel);
        if (typeof updateBunkerColors === 'function') updateBunkerColors(panel);
      });
    } catch (e) {
      console.warn('post-populate hook error', e);
    }
    console.log('Blend data loaded into DOM from server. GCVs:', data.rows.map(r => r.gcv));
  }

  async function fetchAndPopulateLatestBlend() {
    try {
      const r = await fetch(`${APIBASE}/blend/latest`);
      if (!r.ok) {
        console.warn('No latest blend (status ' + r.status + ')');
        return null;
      }
      const data = await r.json();
      populateBlendIntoDOM(data);
      return data;
    } catch (err) {
      console.error('fetchAndPopulateLatestBlend error', err);
      return null;
    }
  }

  // Save function (keeps your existing API)
  async function saveToServer(payload, method = 'POST', url = `${APIBASE}/blend`) {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Save failed: ' + res.status);
      const d = await res.json();
      latestBlendId = d.id || d._id || latestBlendId;
      return d;
    } catch (e) {
      console.error('saveToServer error', e);
      throw e;
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await fetchAndPopulateLatestBlend();
    // attach save button if present
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async (ev) => {
        try {
          // a minimal collectFormData so save button still works
          const rows = [];
          for (let r = 1; r <= 3; r++) {
            const coal = (pickVisibleOrFirst(`#coalName${r}`)?.value ?? pickVisibleOrFirst(`#coalName${r}`)?.innerText ?? '').trim();
            const percentages = [];
            for (let m = 0; m < 6; m++) {
              const pEl = pickVisibleOrFirst(`.percentage-input[data-row='${r}'][data-mill='${m}']`);
              const raw = pEl ? getTextOrValue(pEl).trim() : '';
              percentages.push(raw === '' ? 0 : (parseFloat(raw) || 0));
            }
            const gcvEl = pickVisibleOrFirst(`#gcvBox${r}`);
            const gcv = gcvEl ? (parseFloat(getTextOrValue(gcvEl)) || 0) : 0;
            const costEl = pickVisibleOrFirst(`#costBox${r}`);
            const cost = costEl ? (parseFloat(getTextOrValue(costEl)) || 0) : 0;
            rows.push({ coal, percentages, gcv, cost });
          }
          const flows = [];
          for (let m = 0; m < 6; m++) {
            const fEl = pickVisibleOrFirst(`.flow-input[data-mill='${m}']`);
            flows.push(fEl ? (parseFloat(getTextOrValue(fEl)) || 0) : 0);
          }
          const genEl = pickVisibleOrFirst('#generation');
          const generation = genEl ? (parseFloat(getTextOrValue(genEl)) || 0) : 0;
          const payload = { rows, flows, generation };
          const url = latestBlendId ? `${APIBASE}/blend/${latestBlendId}` : `${APIBASE}/blend`;
          const method = latestBlendId ? 'PUT' : 'POST';
          await saveToServer(payload, method, url);
          alert('Saved blend (id: ' + (latestBlendId || 'new') + ')');
        } catch (e) {
          alert('Save failed (see console)');
        }
      });
    }
  });

  // expose for debugging
  window.populateBlendIntoDOM = populateBlendIntoDOM;
  window.pickVisibleOrFirst = pickVisibleOrFirst;
})();
