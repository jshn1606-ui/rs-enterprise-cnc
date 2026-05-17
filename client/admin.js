const API_BASE = 'https://rs-enterprise-api.onrender.com';

// ─── State ──────────────────────────────────────────────────────────
let authToken = sessionStorage.getItem('rs_admin_token') || null;
let editingMachineId = null;

// ─── DOM Elements ───────────────────────────────────────────────────
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

// ─── Auth ───────────────────────────────────────────────────────────

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };
}

// Auto-login if token exists in session
if (authToken) {
    showDashboard();
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_BASE}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (data.status === 'success') {
            authToken = data.token;
            sessionStorage.setItem('rs_admin_token', authToken);
            showDashboard();
        } else {
            alert('Invalid admin credentials.');
        }
    } catch (err) {
        console.error(err);
        alert('Cannot reach backend. Render may be waking up — retry in 30s.');
    }
});

function showDashboard() {
    loginSection.style.display = 'none';
    dashboardSection.classList.remove('hidden');
    dashboardSection.style.display = 'block';
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
        tabPanels.forEach(p => {
            p.classList.toggle('hidden', p.id !== target);
        });
    });
});

// ─── Machines CRUD ──────────────────────────────────────────────────

async function loadMachines() {
    try {
        const res = await fetch(`${API_BASE}/api/machines`);
        const data = await res.json();
        machinesBody.innerHTML = '';

        if (data.status === 'success' && data.machines.length > 0) {
            data.machines.forEach(m => {
                const badgeClass = m.stock_status === 'in_stock' ? 'badge-instock' :
                                   m.stock_status === 'out_of_stock' ? 'badge-outofstock' : 'badge-special';
                const badgeText = m.stock_status === 'in_stock' ? 'In Stock' :
                                  m.stock_status === 'out_of_stock' ? 'Out of Stock' : 'Special Order';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${m.name}</strong></td>
                    <td>${m.axis_config}</td>
                    <td>${m.spindle_speed_rpm?.toLocaleString()} RPM</td>
                    <td>$${m.base_price_usd?.toLocaleString()}</td>
                    <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                    <td class="action-cell">
                        <button class="action-btn edit-btn" onclick="editMachine('${m.machine_id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="action-btn delete-btn" onclick="deleteMachine('${m.machine_id}')"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                machinesBody.appendChild(tr);
            });
        } else {
            machinesBody.innerHTML = '<tr><td colspan="6" class="empty-state">No machines listed yet. Add your first CNC machine!</td></tr>';
        }
    } catch (err) {
        console.error(err);
        machinesBody.innerHTML = '<tr><td colspan="6" class="empty-state error-state">Error loading machines from API.</td></tr>';
    }
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
        image_data: imagePreview.src && !imagePreview.src.includes('data:,') ? imagePreview.src : null
    };

    try {
        let res;
        if (editingMachineId) {
            res = await fetch(`${API_BASE}/api/machines/${editingMachineId}`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify(payload)
            });
        } else {
            res = await fetch(`${API_BASE}/api/machines`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(payload)
            });
        }
        const data = await res.json();
        if (data.status === 'success') {
            resetMachineForm();
            loadMachines();
            // Switch to inventory tab
            tabs[0].click();
        } else {
            alert('Error saving machine: ' + (data.detail || data.message));
        }
    } catch (err) {
        console.error(err);
        alert('Failed to save machine.');
    }
});

async function editMachine(machineId) {
    try {
        const res = await fetch(`${API_BASE}/api/machines`);
        const data = await res.json();
        const machine = data.machines.find(m => m.machine_id === machineId);
        if (!machine) return;

        editingMachineId = machineId;
        formTitle.textContent = 'Edit Machine';
        cancelEditBtn.classList.remove('hidden');

        document.getElementById('m-name').value = machine.name || '';
        document.getElementById('m-desc').value = machine.description || '';
        document.getElementById('m-axis').value = machine.axis_config || '3-Axis Standard';
        document.getElementById('m-spindle').value = machine.spindle_speed_rpm || 12000;
        document.getElementById('m-footprint').value = machine.max_footprint_sqft || 100;
        document.getElementById('m-price').value = machine.base_price_usd || 50000;
        document.getElementById('m-tooling').value = machine.tooling_kit || '';
        document.getElementById('m-stock').value = machine.stock_status || 'in_stock';

        if (machine.image_data) {
            imagePreview.src = machine.image_data;
            imagePreview.classList.remove('hidden');
        }

        // Switch to Add/Edit tab
        tabs[1].click();
    } catch (err) {
        console.error(err);
    }
}

async function deleteMachine(machineId) {
    if (!confirm('Are you sure you want to delete this machine?')) return;
    try {
        const res = await fetch(`${API_BASE}/api/machines/${machineId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        const data = await res.json();
        if (data.status === 'success') {
            loadMachines();
        }
    } catch (err) {
        console.error(err);
    }
}

function resetMachineForm() {
    machineForm.reset();
    editingMachineId = null;
    formTitle.textContent = 'Add New Machine';
    cancelEditBtn.classList.add('hidden');
    imagePreview.src = '';
    imagePreview.classList.add('hidden');
}

cancelEditBtn.addEventListener('click', resetMachineForm);

// ─── Image Upload (Base64) ──────────────────────────────────────────

uploadZone.addEventListener('click', () => imageInput.click());

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
});

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImageFile(file);
});

function handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file.');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        alert('Image must be under 5MB.');
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.classList.remove('hidden');
        uploadZone.querySelector('.upload-text').textContent = file.name;
    };
    reader.readAsDataURL(file);
}

// ─── Leads ──────────────────────────────────────────────────────────

async function loadLeads() {
    try {
        const res = await fetch(`${API_BASE}/api/leads`, {
            headers: authHeaders()
        });
        const data = await res.json();
        leadsBody.innerHTML = '';

        if (data.status === 'success' && data.leads.length > 0) {
            data.leads.forEach(lead => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${lead.client_profile?.industry || 'N/A'}</strong></td>
                    <td>${lead.technical_requirements?.material || 'N/A'}</td>
                    <td><span style="color: var(--accent-orange); font-weight:600;">${lead.technical_requirements?.required_axes || 3}-Axis</span></td>
                    <td>${lead.technical_requirements?.max_footprint_sqft || 'N/A'} sq ft</td>
                    <td>${lead.technical_requirements?.target_cycle_time_mins || 'N/A'} mins</td>
                `;
                leadsBody.appendChild(tr);
            });
        } else {
            leadsBody.innerHTML = '<tr><td colspan="5" class="empty-state">No leads yet. Leads appear when clients use the Configurator.</td></tr>';
        }
    } catch (err) {
        console.error(err);
        leadsBody.innerHTML = '<tr><td colspan="5" class="empty-state error-state">Error fetching leads.</td></tr>';
    }
}

// ─── ROI Settings ───────────────────────────────────────────────────

async function loadSettings() {
    try {
        const res = await fetch(`${API_BASE}/api/settings`, {
            headers: authHeaders()
        });
        const data = await res.json();
        if (data.status === 'success' && data.settings) {
            document.getElementById('s-payback').value = data.settings.default_payback_months || 14;
            document.getElementById('s-savings').value = data.settings.default_annual_savings_usd || 42000;
            document.getElementById('s-efficiency').value = data.settings.efficiency_gain_percent || 18.5;
            document.getElementById('s-cycle').value = data.settings.cycle_time_reduction_factor || 0.9;
        }
    } catch (err) {
        console.error(err);
    }
}

settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        default_payback_months: parseInt(document.getElementById('s-payback').value),
        default_annual_savings_usd: parseInt(document.getElementById('s-savings').value),
        efficiency_gain_percent: parseFloat(document.getElementById('s-efficiency').value),
        cycle_time_reduction_factor: parseFloat(document.getElementById('s-cycle').value)
    };

    try {
        const res = await fetch(`${API_BASE}/api/settings`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.status === 'success') {
            alert('ROI settings saved successfully!');
        }
    } catch (err) {
        console.error(err);
        alert('Failed to save settings.');
    }
});

// ─── Logout ─────────────────────────────────────────────────────────

function logout() {
    sessionStorage.removeItem('rs_admin_token');
    authToken = null;
    location.reload();
}
