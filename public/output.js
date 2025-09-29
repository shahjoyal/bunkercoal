const APIBASE = window.location.origin + '/api';
let latestBlendId = null;

function collectFormData() {
  const rows = [];
  for (let r = 1; r <= 3; r++) {
    const coalNameInput = document.getElementById(`coalName${r}`);
    const coalName = coalNameInput ? coalNameInput.value.trim() : '';

    const percentages = [];
    for (let m = 0; m <= 6; m++) {
      const p = document.querySelector(`.percentage-input[data-row='${r}'][data-mill='${m}']`);
      const v = p ? parseFloat(p.value) || 0 : 0;
      percentages.push(v);
    }

    const gcvBox = document.getElementById(`gcvBox${r}`);
    const costBox = document.getElementById(`costBox${r}`);

    const gcv = gcvBox ? parseFloat(gcvBox.innerText) || 0 : 0;
    const cost = costBox ? parseFloat(costBox.value) || 0 : 0;

    rows.push({ coal: coalName, percentages, gcv, cost });
  }

  const flows = [];
  document.querySelectorAll('.flow-input').forEach((el) => {
    flows.push(parseFloat(el.value) || 0);
  });

  const generationInput = document.getElementById('generation');
  const generation = generationInput ? parseFloat(generationInput.value) || 0 : 0;

  return { rows, flows, generation };
}

async function fetchAndPopulateLatestBlend() {
  try {
    const res = await fetch(`${APIBASE}/blend/latest`);
    if (!res.ok) {
      console.log('No saved blend data found or error fetching');
      return null;
    }
    const data = await res.json();
    latestBlendId = data._id || data.id || null;

    if (!data.rows) return null;

    data.rows.forEach((row, rIdx) => {
      const coalNameInput = document.getElementById(`coalName${rIdx + 1}`);
      if (coalNameInput) coalNameInput.value = row.coal;

      row.percentages.forEach((pct, mIdx) => {
        const pctInput = document.querySelector(`.percentage-input[data-row='${rIdx + 1}'][data-mill='${mIdx}']`);
        if (pctInput) pctInput.value = pct;
      });

      const gcvInput = document.getElementById(`gcvBox${rIdx + 1}`);
      if (gcvInput) gcvInput.innerText = row.gcv.toFixed(2);

      const costInput = document.getElementById(`costBox${rIdx + 1}`);
      if (costInput) costInput.value = row.cost.toFixed(2);
    });

    data.flows.forEach((flowVal, mIdx) => {
      const flowInput = document.querySelector(`.flow-input[data-mill='${mIdx}']`);
      if (flowInput) flowInput.value = flowVal;
    });

    const genInput = document.getElementById('generation');
    if (genInput) genInput.value = data.generation;

    if (typeof calculateBlended === 'function') {
      const overviewPanel = document.getElementById('overviewTab');
      if (overviewPanel) calculateBlended(overviewPanel);
    }

    return data;
  } catch (error) {
    console.error('Error fetching blend data:', error);
    return null;
  }
}

async function saveToServer() {
  const payload = collectFormData();
  const url = latestBlendId ? `${APIBASE}/blend/${latestBlendId}` : `${APIBASE}/blend`;
  const method = latestBlendId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || res.status);
    }
    const data = await res.json();
    latestBlendId = data.id || data._id || latestBlendId;
    alert('Saved to database with id: ' + latestBlendId);

    await fetchAndPopulateLatestBlend();
  } catch (err) {
    console.error('Network error saving data', err);
    alert('Network error saving data: ' + err.message);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await fetchAndPopulateLatestBlend();

  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveToServer);
  } else {
    console.warn("Save button with id 'saveBtn' not found.");
  }
});
