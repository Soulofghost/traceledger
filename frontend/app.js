// TraceLedger Provenance Platform Client
const API_BASE = '/api/v1';

let activeBatchId = null;
let currentBatchData = null;

document.addEventListener('DOMContentLoaded', () => {
  setupUI();
  loadBatches();
});

function setupUI() {
  // Register Modal
  const modalReg = document.getElementById('registerModal');
  document.getElementById('btnOpenRegisterModal').addEventListener('click', () => modalReg.classList.remove('hidden'));
  document.getElementById('btnCloseRegister').addEventListener('click', () => modalReg.classList.add('hidden'));
  document.getElementById('btnCancelRegister').addEventListener('click', () => modalReg.classList.add('hidden'));

  // Toggle cold chain fields
  const chkCold = document.getElementById('regColdChain');
  const tempRow = document.getElementById('tempBoundsRow');
  chkCold.addEventListener('change', () => {
    tempRow.style.display = chkCold.checked ? 'grid' : 'none';
  });

  document.getElementById('registerForm').addEventListener('submit', handleRegisterBatch);

  // Transfer Modal
  const modalTr = document.getElementById('transferModal');
  document.getElementById('btnTransferCustody').addEventListener('click', () => {
    if (!currentBatchData) return;
    document.getElementById('trCurrentCustodian').value = currentBatchData.current_custodian;
    modalTr.classList.remove('hidden');
  });
  document.getElementById('btnCloseTransfer').addEventListener('click', () => modalTr.classList.add('hidden'));
  document.getElementById('btnCancelTransfer').addEventListener('click', () => modalTr.classList.add('hidden'));
  document.getElementById('transferForm').addEventListener('submit', handleTransferCustody);

  // Telematics Modal
  const modalTel = document.getElementById('telematicsModal');
  document.getElementById('btnSimulateTelematics').addEventListener('click', () => modalTel.classList.remove('hidden'));
  document.getElementById('btnCloseTelematics').addEventListener('click', () => modalTel.classList.add('hidden'));
  document.getElementById('btnCancelTelematics').addEventListener('click', () => modalTel.classList.add('hidden'));
  document.getElementById('telematicsForm').addEventListener('submit', handleLogTelematics);

  // Verification Modal
  const modalVer = document.getElementById('verifyModal');
  document.getElementById('btnOpenVerifyModal').addEventListener('click', openVerificationModal);
  document.getElementById('btnCloseVerify').addEventListener('click', () => modalVer.classList.add('hidden'));
}

async function loadBatches() {
  try {
    const res = await fetch(`${API_BASE}/batches`);
    const batches = await res.json();
    document.getElementById('batchesCount').textContent = `${batches.length} Tracked`;

    const list = document.getElementById('batchesList');
    list.innerHTML = batches.map(b => `
      <div class="batch-item ${b.id === activeBatchId ? 'active' : ''}" onclick="selectBatch('${b.id}')">
        <div class="item-head">
          <span class="item-id">${escapeHtml(b.id)}</span>
          <span class="status-pill status-${b.status}">${b.status}</span>
        </div>
        <div class="item-title">${escapeHtml(b.product_name)}</div>
        <div class="item-meta">
          <span>${b.transferCount} Custody Handoffs</span>
          <span>${formatAddress(b.current_custodian)}</span>
        </div>
      </div>
    `).join('');

    if (batches.length > 0 && !activeBatchId) {
      selectBatch(batches[0].id);
    }
  } catch (err) {
    console.error('Error fetching batches:', err);
  }
}

window.selectBatch = function(id) {
  activeBatchId = id;
  loadBatchDetails(id);
  loadBatches();
};

async function loadBatchDetails(id) {
  try {
    const res = await fetch(`${API_BASE}/batches/${id}`);
    const b = await res.json();
    currentBatchData = b;

    document.getElementById('emptyBatchView').classList.add('hidden');
    document.getElementById('batchContentCard').classList.remove('hidden');

    // Header Meta
    document.getElementById('batchIdLabel').textContent = b.id;
    document.getElementById('batchStatusPill').className = `status-pill status-${b.status}`;
    document.getElementById('batchStatusPill').textContent = b.status;
    document.getElementById('batchTitle').textContent = b.product_name;
    document.getElementById('batchOriginLabel').textContent = `Origin Facility: ${b.origin_location} (SKU: ${b.sku})`;

    const coldTag = document.getElementById('coldChainTag');
    if (b.is_cold_chain) {
      coldTag.classList.remove('hidden');
    } else {
      coldTag.classList.add('hidden');
    }

    // Compromise Banner
    const compBanner = document.getElementById('compromiseBanner');
    if (b.is_compromised) {
      compBanner.classList.remove('hidden');
      document.getElementById('compromiseReasonText').textContent = b.compromise_reason || 'Batch compromised';
    } else {
      compBanner.classList.add('hidden');
    }

    // Custody Cards
    document.getElementById('mfgAddressLabel').textContent = formatAddress(b.manufacturer_address);
    document.getElementById('custodianAddressLabel').textContent = formatAddress(b.current_custodian);

    let thermalText = 'Ambient Uncontrolled';
    if (b.is_cold_chain) {
      thermalText = `Cold Chain: ${b.min_temp_celsius}°C to ${b.max_temp_celsius}°C`;
    }
    document.getElementById('thermalBoundsLabel').textContent = thermalText;

    // Timeline
    renderTimeline(b.transfers);

    // Telematics
    renderTelematics(b.telematics, b);
  } catch (err) {
    console.error('Error fetching batch details:', err);
  }
}

function renderTimeline(transfers) {
  const container = document.getElementById('transfersTimeline');
  if (!transfers || transfers.length === 0) {
    container.innerHTML = '<p style="color:#64748b;font-size:0.85rem;padding:12px;">Consignment is at initial manufacturing facility. No transfer handoffs executed yet.</p>';
    return;
  }

  container.innerHTML = transfers.map((tr, idx) => `
    <div class="t-item">
      <div class="t-head">
        <span class="t-location">${idx + 1}. ${escapeHtml(tr.location)}</span>
        <span class="t-time">${new Date(tr.timestamp).toLocaleString()}</span>
      </div>
      <div class="t-custody">
        From: <code>${formatAddress(tr.from_custodian)}</code> &rarr; To: <code>${formatAddress(tr.to_custodian)}</code>
        ${tr.temperature_celsius !== null ? ` &middot; Handover Temp: <strong>${tr.temperature_celsius}°C</strong>` : ''}
      </div>
      <div class="t-proof">
        Proof Hash: ${tr.proof_hash}
      </div>
    </div>
  `).join('');
}

function renderTelematics(telematics, batch) {
  const tbody = document.getElementById('telematicsTableBody');
  if (!telematics || telematics.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#64748b;padding:16px;">No IoT telematics pings recorded.</td></tr>';
    return;
  }

  tbody.innerHTML = telematics.map(tel => {
    let tempClass = 'temp-normal';
    let statusText = 'SAFE BOUNDS';

    if (tel.is_alert || (batch.is_cold_chain && (tel.temperature_celsius < batch.min_temp_celsius || tel.temperature_celsius > batch.max_temp_celsius))) {
      tempClass = 'temp-alarm';
      statusText = 'EXCURSION DETECTED';
    }

    return `
      <tr>
        <td style="color:#64748b;font-size:0.8rem;">${new Date(tel.timestamp).toLocaleString()}</td>
        <td><strong>${escapeHtml(tel.location)}</strong></td>
        <td><span class="${tempClass}">${tel.temperature_celsius}°C</span></td>
        <td><span class="status-pill ${tel.is_alert ? 'status-COMPROMISED' : 'status-DELIVERED'}">${statusText}</span></td>
      </tr>
    `;
  }).join('');
}

async function handleRegisterBatch(e) {
  e.preventDefault();
  const id = document.getElementById('regLotId').value.trim();
  const sku = document.getElementById('regSku').value.trim();
  const productName = document.getElementById('regProductName').value.trim();
  const originLocation = document.getElementById('regOrigin').value.trim();
  const manufacturerAddress = document.getElementById('regMfgAddr').value.trim();
  const isColdChain = document.getElementById('regColdChain').checked;

  const payload = {
    id, sku, productName, originLocation, manufacturerAddress, isColdChain
  };

  if (isColdChain) {
    payload.minTempCelsius = parseFloat(document.getElementById('regMinTemp').value);
    payload.maxTempCelsius = parseFloat(document.getElementById('regMaxTemp').value);
  }

  try {
    const res = await fetch(`${API_BASE}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to register batch');

    document.getElementById('registerForm').reset();
    document.getElementById('registerModal').classList.add('hidden');
    loadBatches();
    selectBatch(data.id);
  } catch (err) {
    alert(err.message);
  }
}

async function handleTransferCustody(e) {
  e.preventDefault();
  const toCustodian = document.getElementById('trNextCustodian').value.trim();
  const location = document.getElementById('trLocation').value.trim();
  const tempInput = document.getElementById('trTemp').value;
  const recordedTemp = tempInput !== '' ? parseFloat(tempInput) : null;

  try {
    const res = await fetch(`${API_BASE}/batches/${activeBatchId}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caller_address: currentBatchData.current_custodian,
        to_custodian: toCustodian,
        location,
        temperature_celsius: recordedTemp
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Transfer failed');

    document.getElementById('transferForm').reset();
    document.getElementById('transferModal').classList.add('hidden');
    loadBatches();
    loadBatchDetails(activeBatchId);
  } catch (err) {
    alert(err.message);
  }
}

async function handleLogTelematics(e) {
  e.preventDefault();
  const temp = parseFloat(document.getElementById('telTemp').value);
  const location = document.getElementById('telLocation').value.trim();

  try {
    const res = await fetch(`${API_BASE}/batches/${activeBatchId}/telematics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caller_address: currentBatchData.current_custodian,
        temperature_celsius: temp,
        location
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to record telematics');

    document.getElementById('telematicsForm').reset();
    document.getElementById('telematicsModal').classList.add('hidden');
    loadBatches();
    loadBatchDetails(activeBatchId);
  } catch (err) {
    alert(err.message);
  }
}

async function openVerificationModal() {
  if (!activeBatchId) return;
  try {
    const res = await fetch(`${API_BASE}/batches/${activeBatchId}/verify`);
    const cert = await res.json();

    const certDetails = document.getElementById('certDetails');
    certDetails.innerHTML = `
      <div class="cert-head">
        <span class="cert-badge">${cert.isAuthentic ? 'CRYPTOGRAPHICALLY AUTHENTIC' : 'COMPROMISED CONSORTIUM RECORD'}</span>
        <h4 style="margin:6px 0 2px;">Batch Lot #${cert.batchId}</h4>
        <p style="font-size:0.8rem;color:#64748b;">${escapeHtml(cert.productName)} (SKU: ${escapeHtml(cert.sku)})</p>
      </div>
      <div style="font-size:0.82rem;display:flex;flex-direction:column;gap:8px;">
        <div><strong>Origin Facility:</strong> ${escapeHtml(cert.origin)}</div>
        <div><strong>Manufacturer:</strong> <code>${cert.manufacturer}</code></div>
        <div><strong>Current Custodian:</strong> <code>${cert.currentCustodian}</code></div>
        <div><strong>Chain-of-Custody Handoffs:</strong> ${cert.totalHandovers} Verified Checkpoints</div>
        <div><strong>Consortium Ledger Status:</strong> <span class="status-pill status-${cert.status}">${cert.status}</span></div>
      </div>
      <div class="cert-digest">
        <strong>Keccak-256 Provenance Digest:</strong><br>${cert.provenanceProofDigest}
      </div>
    `;

    document.getElementById('verifyModal').classList.remove('hidden');
  } catch (err) {
    alert('Verification error: ' + err.message);
  }
}

function formatAddress(addr) {
  if (!addr) return '0x0';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}
