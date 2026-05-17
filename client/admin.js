const API_BASE = 'https://rs-enterprise-api.onrender.com';

// ─── State ──────────────────────────────────────────────────────────
let authToken = sessionStorage.getItem('rs_admin_token') || null;
let editingMachineId = null;

// ─── DOM ────────────────────────────────────────────────────────────
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const tabs = document.querySelectorAll('.admin-tab');
const tabPanels = document.querySelectorAll('.tab-panel');
const machinesBody = document.getElementById('machines-tbody');
const leadsBody = document.getElementById('leads-tbody');
const machineForm = document.getElementById('machine-form');
const formTitle = document.getElementById('form-title');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const imagePreview = document.getElementById('image-preview');
const imageInput = document.getElementById('image-input');
const uploadZone = document.getElementById('upload-zone');
const settingsForm = document.getElementById('settings-form');

function authHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` };
}

// ─── Auto-login ─────────────────────────────────────────────────────
if (authToken) showDashboard();

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    try {
        const res = await fetch(`${API_BASE}/api/admin/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (data.status === 'success') {
            authToken = data.token;
            sessionStorage.setItem('rs_admin_token', authToken);
            showDashboard();
        } else { alert('Invalid admin credentials.'); }
    } catch (err) { alert('Cannot reach backend. Render may be cold-starting — retry in 30s.'); }
});

function showDashboard() {
    loginSection.style.display = 'none';
    dashboardSection.classList.remove('hidden');
    dashboardSection.style.display = 'block';
    loadAnalytics();
    loadMachines();
    loadLeads();
    loadSettings();
}

// ─── Tab Switching ──────────────────────────────────────────────────
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.getAttribute('data-tab');
        tabPanels.forEach(p => p.classList.toggle('hidden', p.id !== target));
    });
});

// ─── Quick Add Dropdown ─────────────────────────────────────────────
const quickAddBtn = document.getElementById('quick-add-btn');
const quickAddMenu = document.getElementById('quick-add-menu');
quickAddBtn.addEventListener('click', () => quickAddMenu.classList.toggle('hidden'));
document.addEventListener('click', (e) => {
    if (!e.target.closest('.quick-add-wrapper')) quickAddMenu.classList.add('hidden');
});
function quickAddMachine() {
    quickAddMenu.classList.add('hidden');
    // Switch to Add/Edit tab
    tabs.forEach(t => t.classList.remove('active'));
    document.querySelector('[data-tab="tab-add-machine"]').classList.add('active');
    tabPanels.forEach(p => p.classList.toggle('hidden', p.id !== 'tab-add-machine'));
    resetMachineForm();
}

// ─── Theme Toggle ───────────────────────────────────────────────────
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
let isLight = localStorage.getItem('rs_theme') === 'light';
if (isLight) applyLight();

themeToggle.addEventListener('click', () => {
    isLight = !isLight;
    localStorage.setItem('rs_theme', isLight ? 'light' : 'dark');
    if (isLight) applyLight(); else applyDark();
});

function applyLight() {
    document.body.classList.add('theme-light');
    themeIcon.className = 'fa-solid fa-sun';
}
function applyDark() {
    document.body.classList.remove('theme-light');
    themeIcon.className = 'fa-solid fa-moon';
}

// ─── Analytics ──────────────────────────────────────────────────────
async function loadAnalytics() {
    try {
        const res = await fetch(`${API_BASE}/api/analytics`, { headers: authHeaders() });
        const data = await res.json();
        if (data.status === 'success') {
            const a = data.analytics;
            document.getElementById('stat-machines').textContent = a.total_machines;
            document.getElementById('stat-leads').textContent = a.total_leads;
            document.getElementById('stat-pipeline').textContent = '$' + (a.pipeline_value_usd || 0).toLocaleString();
            document.getElementById('stat-popular').textContent = a.most_popular_config;

            const b = a.lead_status_breakdown || {};
            const total = Math.max(a.total_leads, 1);
            setPipelineBar('pipe-new', 'pipe-new-n', b.new || 0, total);
            setPipelineBar('pipe-contact', 'pipe-contact-n', b.in_contact || 0, total);
            setPipelineBar('pipe-quote', 'pipe-quote-n', b.quote_sent || 0, total);
            setPipelineBar('pipe-won', 'pipe-won-n', b.won || 0, total);
        }
    } catch (err) { console.error('Analytics error:', err); }
}

function setPipelineBar(barId, countId, count, total) {
    document.getElementById(barId).style.width = Math.max((count / total) * 100, 2) + '%';
    document.getElementById(countId).textContent = count;
}

// ─── Machines ───────────────────────────────────────────────────────
async function loadMachines() {
    try {
        const res = await fetch(`${API_BASE}/api/machines`);
        const data = await res.json();
        machinesBody.innerHTML = '';
        if (data.status === 'success' && data.machines.length > 0) {
            data.machines.forEach(m => {
                const bc = m.stock_status === 'in_stock' ? 'badge-instock' : m.stock_status === 'out_of_stock' ? 'badge-outofstock' : 'badge-special';
                const bt = m.stock_status === 'in_stock' ? 'In Stock' : m.stock_status === 'out_of_stock' ? 'Out of Stock' : 'Special Order';
                // Next stock state for toggle
                const nextStock = m.stock_status === 'in_stock' ? 'out_of_stock' : 'in_stock';
                const toggleIcon = m.stock_status === 'in_stock' ? 'fa-toggle-on' : 'fa-toggle-off';
                const toggleColor = m.stock_status === 'in_stock' ? 'color:#00e676' : 'color:#ff5252';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${m.name}</strong></td>
                    <td>${m.axis_config}</td>
                    <td>${(m.spindle_speed_rpm||0).toLocaleString()} RPM</td>
                    <td>$${(m.base_price_usd||0).toLocaleString()}</td>
                    <td><span class="badge ${bc}">${bt}</span></td>
                    <td class="action-cell">
                        <button class="action-btn edit-btn" onclick="editMachine('${m.machine_id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="action-btn" onclick="duplicateMachine('${m.machine_id}')" title="Duplicate"><i class="fa-solid fa-clone"></i></button>
                        <button class="action-btn" onclick="toggleStock('${m.machine_id}','${nextStock}')" title="Toggle Stock" style="${toggleColor}"><i class="fa-solid ${toggleIcon}"></i></button>
                        <button class="action-btn delete-btn" onclick="deleteMachine('${m.machine_id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </td>`;
                machinesBody.appendChild(tr);
            });
        } else {
            machinesBody.innerHTML = '<tr><td colspan="6" class="empty-state">No machines yet. Click "Quick Add" or go to the Add/Edit tab!</td></tr>';
        }
    } catch (err) { machinesBody.innerHTML = '<tr><td colspan="6" class="empty-state error-state">Error loading machines.</td></tr>'; }
}

machineForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById('m-name').value,
        description: document.getElementById('m-desc').value,
        axis_config: document.getElementById('m-axis').value,
        spindle_speed_rpm: parseInt(document.getElementById('m-spindle').value),
        max_footprint_sqft: parseInt(document.getElementById('m-footprint').value),
        base_price_usd: parseInt(document.getElementById('m-price').value),
        tooling_kit: document.getElementById('m-tooling').value,
        stock_status: document.getElementById('m-stock').value,
        image_data: imagePreview.src && !imagePreview.src.includes('data:,') && imagePreview.src.startsWith('data:') ? imagePreview.src : null
    };
    try {
        const url = editingMachineId ? `${API_BASE}/api/machines/${editingMachineId}` : `${API_BASE}/api/machines`;
        const method = editingMachineId ? 'PUT' : 'POST';
        const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.status === 'success') {
            resetMachineForm();
            loadMachines();
            loadAnalytics();
            // Switch to inventory
            document.querySelector('[data-tab="tab-inventory"]').click();
        } else { alert('Error: ' + (data.detail || data.message || 'Unknown')); }
    } catch (err) { alert('Failed to save machine.'); }
});

async function editMachine(machineId) {
    const res = await fetch(`${API_BASE}/api/machines`);
    const data = await res.json();
    const m = data.machines.find(x => x.machine_id === machineId);
    if (!m) return;
    editingMachineId = machineId;
    formTitle.textContent = 'Edit Machine';
    cancelEditBtn.classList.remove('hidden');
    document.getElementById('m-name').value = m.name || '';
    document.getElementById('m-desc').value = m.description || '';
    document.getElementById('m-axis').value = m.axis_config || '3-Axis Standard';
    document.getElementById('m-spindle').value = m.spindle_speed_rpm || 12000;
    document.getElementById('m-footprint').value = m.max_footprint_sqft || 100;
    document.getElementById('m-price').value = m.base_price_usd || 50000;
    document.getElementById('m-tooling').value = m.tooling_kit || '';
    document.getElementById('m-stock').value = m.stock_status || 'in_stock';
    if (m.image_data) { imagePreview.src = m.image_data; imagePreview.classList.remove('hidden'); }
    document.querySelector('[data-tab="tab-add-machine"]').click();
}

async function deleteMachine(id) {
    if (!confirm('Delete this machine permanently?')) return;
    await fetch(`${API_BASE}/api/machines/${id}`, { method: 'DELETE', headers: authHeaders() });
    loadMachines(); loadAnalytics();
}

async function duplicateMachine(id) {
    await fetch(`${API_BASE}/api/machines/${id}/duplicate`, { method: 'POST', headers: authHeaders() });
    loadMachines(); loadAnalytics();
}

async function toggleStock(id, newStatus) {
    await fetch(`${API_BASE}/api/machines/${id}/stock`, {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({ stock_status: newStatus })
    });
    loadMachines();
}

function resetMachineForm() {
    machineForm.reset();
    editingMachineId = null;
    formTitle.textContent = 'Add New Machine';
    cancelEditBtn.classList.add('hidden');
    imagePreview.src = ''; imagePreview.classList.add('hidden');
    if (uploadZone.querySelector('.upload-text')) uploadZone.querySelector('.upload-text').textContent = 'Drag & drop image here, or click to browse';
}
cancelEditBtn.addEventListener('click', resetMachineForm);

// ─── CSV Export ─────────────────────────────────────────────────────
async function exportCSV() {
    try {
        const res = await fetch(`${API_BASE}/api/machines/export`, { headers: authHeaders() });
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = 'rs_enterprise_inventory.csv'; a.click();
        window.URL.revokeObjectURL(url);
    } catch (err) { alert('Failed to export CSV.'); }
}

// ─── Image Upload ───────────────────────────────────────────────────
uploadZone.addEventListener('click', () => imageInput.click());
uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', (e) => { e.preventDefault(); uploadZone.classList.remove('dragover'); if (e.dataTransfer.files[0]) handleImageFile(e.dataTransfer.files[0]); });
imageInput.addEventListener('change', (e) => { if (e.target.files[0]) handleImageFile(e.target.files[0]); });

function handleImageFile(file) {
    if (!file.type.startsWith('image/')) { alert('Please upload an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.classList.remove('hidden');
        uploadZone.querySelector('.upload-text').textContent = file.name;
    };
    reader.readAsDataURL(file);
}

// ─── Leads CRM ──────────────────────────────────────────────────────
const STATUS_LABELS = { new: 'New Request', in_contact: 'In Contact', quote_sent: 'Quote Sent', won: 'Deal Won', rejected: 'Rejected' };
const STATUS_COLORS = { new: 'badge-special', in_contact: 'badge-instock', quote_sent: 'badge-instock', won: 'badge-instock', rejected: 'badge-outofstock' };

async function loadLeads() {
    try {
        const res = await fetch(`${API_BASE}/api/leads`, { headers: authHeaders() });
        const data = await res.json();
        leadsBody.innerHTML = '';
        if (data.status === 'success' && data.leads.length > 0) {
            data.leads.forEach(lead => {
                const tr = document.createElement('tr');
                const status = lead.status || 'new';
                const industry = lead.client_profile?.industry || 'N/A';
                const material = lead.technical_requirements?.material || 'N/A';
                const axes = lead.technical_requirements?.required_axes || 3;
                const footprint = lead.technical_requirements?.max_footprint_sqft || 'N/A';
                const cycle = lead.technical_requirements?.target_cycle_time_mins || 'N/A';
                const lid = lead._id;

                // Build mailto body
                const mailSubject = encodeURIComponent(`RS Enterprise CNC Configuration — ${industry}`);
                const mailBody = encodeURIComponent(`Dear Client,\n\nThank you for your interest in RS Enterprise CNC solutions.\n\nYour configuration:\n- Industry: ${industry}\n- Material: ${material}\n- Axes: ${axes}-Axis\n- Footprint: ${footprint} sq ft\n- Target Cycle Time: ${cycle} mins\n\nWe will reach out with a detailed quote shortly.\n\nBest regards,\nRS Enterprise Team\nLudhiana, Punjab`);

                tr.innerHTML = `
                    <td><strong>${industry}</strong></td>
                    <td>${material}</td>
                    <td><span style="color:var(--accent-orange);font-weight:600;">${axes}-Axis</span></td>
                    <td>${footprint} sq ft</td>
                    <td>${cycle} mins</td>
                    <td>
                        <select class="lead-status-select" onchange="updateLeadStatus('${lid}', this.value)">
                            <option value="new" ${status==='new'?'selected':''}>🟡 New</option>
                            <option value="in_contact" ${status==='in_contact'?'selected':''}>🔵 In Contact</option>
                            <option value="quote_sent" ${status==='quote_sent'?'selected':''}>🟢 Quote Sent</option>
                            <option value="won" ${status==='won'?'selected':''}>✅ Won</option>
                            <option value="rejected" ${status==='rejected'?'selected':''}>❌ Rejected</option>
                        </select>
                    </td>
                    <td class="action-cell">
                        <a href="mailto:?subject=${mailSubject}&body=${mailBody}" class="action-btn edit-btn" title="Email Client"><i class="fa-solid fa-envelope"></i></a>
                        <button class="action-btn delete-btn" onclick="deleteLead('${lid}')" title="Delete Lead"><i class="fa-solid fa-trash"></i></button>
                    </td>`;
                leadsBody.appendChild(tr);
            });
        } else {
            leadsBody.innerHTML = '<tr><td colspan="7" class="empty-state">No leads yet. Leads appear when clients use the Configurator.</td></tr>';
        }
    } catch (err) { leadsBody.innerHTML = '<tr><td colspan="7" class="empty-state error-state">Error fetching leads.</td></tr>'; }
}

async function updateLeadStatus(lid, newStatus) {
    await fetch(`${API_BASE}/api/leads/${lid}/status`, {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({ status: newStatus })
    });
    loadAnalytics();
}

async function deleteLead(lid) {
    if (!confirm('Delete this lead permanently?')) return;
    await fetch(`${API_BASE}/api/leads/${lid}`, { method: 'DELETE', headers: authHeaders() });
    loadLeads(); loadAnalytics();
}

// ─── ROI Settings ───────────────────────────────────────────────────
async function loadSettings() {
    try {
        const res = await fetch(`${API_BASE}/api/settings`, { headers: authHeaders() });
        const data = await res.json();
        if (data.status === 'success' && data.settings) {
            const s = data.settings;
            document.getElementById('s-payback').value = s.default_payback_months || 14;
            document.getElementById('s-savings').value = s.default_annual_savings_usd || 42000;
            document.getElementById('s-efficiency').value = s.efficiency_gain_percent || 18.5;
            document.getElementById('s-cycle').value = s.cycle_time_reduction_factor || 0.9;
            document.getElementById('s-electricity').value = s.electricity_cost_per_kwh || 8.5;
            document.getElementById('s-wage').value = s.operator_hourly_wage_inr || 350;
            document.getElementById('s-tooling-wear').value = s.tooling_wear_rate_percent || 2.5;
        }
    } catch (err) { console.error('Settings load error:', err); }
}

settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        default_payback_months: parseInt(document.getElementById('s-payback').value),
        default_annual_savings_usd: parseInt(document.getElementById('s-savings').value),
        efficiency_gain_percent: parseFloat(document.getElementById('s-efficiency').value),
        cycle_time_reduction_factor: parseFloat(document.getElementById('s-cycle').value),
        electricity_cost_per_kwh: parseFloat(document.getElementById('s-electricity').value),
        operator_hourly_wage_inr: parseFloat(document.getElementById('s-wage').value),
        tooling_wear_rate_percent: parseFloat(document.getElementById('s-tooling-wear').value)
    };
    try {
        const res = await fetch(`${API_BASE}/api/settings`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.status === 'success') alert('ROI settings saved & recalibrated!');
    } catch (err) { alert('Failed to save settings.'); }
});

// ─── Logout ─────────────────────────────────────────────────────────
function logout() {
    sessionStorage.removeItem('rs_admin_token');
    authToken = null;
    location.reload();
}
