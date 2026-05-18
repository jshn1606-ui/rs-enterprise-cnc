const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8000' : 'https://rs-enterprise-api.onrender.com';

let authToken = sessionStorage.getItem('rs_admin_token') || null;
let editingMachineId = null;
let uploadedImages = []; // Array of base64 strings

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
const imageInput = document.getElementById('image-input');
const uploadZone = document.getElementById('upload-zone');
const thumbnailsGrid = document.getElementById('image-thumbnails');
const settingsForm = document.getElementById('settings-form');

function authHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` };
}

// ─── Auto-login ─────────────────────────────────────────────────────
if (authToken) showDashboard();

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const res = await fetch(`${API_BASE}/api/admin/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: document.getElementById('username').value, password: document.getElementById('password').value })
        });
        const data = await res.json();
        if (data.status === 'success') {
            authToken = data.token;
            sessionStorage.setItem('rs_admin_token', authToken);
            showDashboard();
        } else { alert('Invalid admin credentials.'); }
    } catch (err) { alert('Backend cold-starting — retry in 30s.'); }
});

function showDashboard() {
    loginSection.style.display = 'none';
    dashboardSection.classList.remove('hidden');
    dashboardSection.style.display = 'block';
    loadAnalytics(); loadMachines(); loadLeads(); loadSettings();
}

// ─── Tabs ───────────────────────────────────────────────────────────
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.getAttribute('data-tab');
        tabPanels.forEach(p => p.classList.toggle('hidden', p.id !== target));
    });
});

// ─── Quick Add ──────────────────────────────────────────────────────
const quickAddBtn = document.getElementById('quick-add-btn');
const quickAddMenu = document.getElementById('quick-add-menu');
quickAddBtn.addEventListener('click', () => quickAddMenu.classList.toggle('hidden'));
document.addEventListener('click', (e) => { if (!e.target.closest('.quick-add-wrapper')) quickAddMenu.classList.add('hidden'); });
function quickAddMachine() {
    quickAddMenu.classList.add('hidden');
    document.querySelector('[data-tab="tab-add-machine"]').click();
    resetMachineForm();
}

// ─── Theme ──────────────────────────────────────────────────────────
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
let isLight = localStorage.getItem('rs_theme') === 'light';
if (isLight) applyLight();
themeToggle.addEventListener('click', () => { isLight = !isLight; localStorage.setItem('rs_theme', isLight ? 'light' : 'dark'); isLight ? applyLight() : applyDark(); });
function applyLight() { document.body.classList.add('theme-light'); themeIcon.className = 'fa-solid fa-sun'; }
function applyDark() { document.body.classList.remove('theme-light'); themeIcon.className = 'fa-solid fa-moon'; }

// ─── Analytics ──────────────────────────────────────────────────────
async function loadAnalytics() {
    try {
        const res = await fetch(`${API_BASE}/api/analytics`, { headers: authHeaders() });
        const data = await res.json();
        if (data.status === 'success') {
            const a = data.analytics;
            document.getElementById('stat-machines').textContent = a.total_machines;
            document.getElementById('stat-leads').textContent = a.total_leads;
            document.getElementById('stat-pipeline').textContent = a.pipeline_value_usd || 0;
            document.getElementById('stat-popular').textContent = a.most_popular_config;
            const b = a.lead_status_breakdown || {};
            const total = Math.max(a.total_leads, 1);
            setPipelineBar('pipe-new', 'pipe-new-n', b.new || 0, total);
            setPipelineBar('pipe-contact', 'pipe-contact-n', b.in_contact || 0, total);
            setPipelineBar('pipe-quote', 'pipe-quote-n', b.quote_sent || 0, total);
            setPipelineBar('pipe-won', 'pipe-won-n', b.won || 0, total);
        }
    } catch (err) { console.error(err); }
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
                const nextStock = m.stock_status === 'in_stock' ? 'out_of_stock' : 'in_stock';
                const toggleIcon = m.stock_status === 'in_stock' ? 'fa-toggle-on' : 'fa-toggle-off';
                const toggleColor = m.stock_status === 'in_stock' ? 'color:#00e676' : 'color:#ff5252';
                const imgCount = (m.images && m.images.length) || (m.image_data ? 1 : 0);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${m.name}</strong><br><small style="color:var(--text-muted)">${imgCount} photo(s)</small></td>
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
            machinesBody.innerHTML = '<tr><td colspan="6" class="empty-state">No machines yet. Click "Quick Add"!</td></tr>';
        }
    } catch (err) { machinesBody.innerHTML = '<tr><td colspan="6" class="empty-state error-state">Error loading.</td></tr>'; }
}

// ─── Form Submit ────────────────────────────────────────────────────
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
        image_data: uploadedImages.length > 0 ? uploadedImages[0] : null,
        images: uploadedImages,
        // Extended specs
        work_radius_mm: parseInt(document.getElementById('m-radius').value) || null,
        table_size: document.getElementById('m-table').value || null,
        max_workpiece_weight_kg: parseInt(document.getElementById('m-weight').value) || null,
        rapid_traverse_rate: document.getElementById('m-traverse').value || null,
        positional_accuracy: document.getElementById('m-accuracy').value || null,
        controller_type: document.getElementById('m-controller').value || null,
        coolant_system: document.getElementById('m-coolant').value || null,
        power_rating_kw: parseFloat(document.getElementById('m-power').value) || null
    };
    try {
        const url = editingMachineId ? `${API_BASE}/api/machines/${editingMachineId}` : `${API_BASE}/api/machines`;
        const method = editingMachineId ? 'PUT' : 'POST';
        const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.status === 'success') {
            resetMachineForm(); loadMachines(); loadAnalytics();
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
    document.getElementById('m-spindle').value = m.spindle_speed_rpm || '';
    document.getElementById('m-footprint').value = m.max_footprint_sqft || '';
    document.getElementById('m-price').value = m.base_price_usd || '';
    document.getElementById('m-tooling').value = m.tooling_kit || '';
    document.getElementById('m-stock').value = m.stock_status || 'in_stock';
    // Extended specs
    document.getElementById('m-radius').value = m.work_radius_mm || '';
    document.getElementById('m-table').value = m.table_size || '';
    document.getElementById('m-weight').value = m.max_workpiece_weight_kg || '';
    document.getElementById('m-traverse').value = m.rapid_traverse_rate || '';
    document.getElementById('m-accuracy').value = m.positional_accuracy || '';
    document.getElementById('m-controller').value = m.controller_type || '';
    document.getElementById('m-coolant').value = m.coolant_system || '';
    document.getElementById('m-power').value = m.power_rating_kw || '';
    // Load existing images
    uploadedImages = m.images && m.images.length > 0 ? [...m.images] : (m.image_data ? [m.image_data] : []);
    renderThumbnails();
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
    await fetch(`${API_BASE}/api/machines/${id}/stock`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ stock_status: newStatus }) });
    loadMachines();
}

function resetMachineForm() {
    machineForm.reset();
    editingMachineId = null;
    formTitle.textContent = 'Add New Machine';
    cancelEditBtn.classList.add('hidden');
    uploadedImages = [];
    renderThumbnails();
    uploadZone.querySelector('.upload-text').textContent = 'Drag & drop images here, or click to browse';
}
cancelEditBtn.addEventListener('click', resetMachineForm);

// ─── Multi-Image Upload ─────────────────────────────────────────────
uploadZone.addEventListener('click', () => imageInput.click());
uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault(); uploadZone.classList.remove('dragover');
    handleMultipleFiles(e.dataTransfer.files);
});
imageInput.addEventListener('change', (e) => handleMultipleFiles(e.target.files));

function handleMultipleFiles(files) {
    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        if (file.size > 5 * 1024 * 1024) { alert(`${file.name} exceeds 5MB limit.`); return; }
        if (uploadedImages.length >= 10) { alert('Maximum 10 photos allowed.'); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedImages.push(e.target.result);
            renderThumbnails();
        };
        reader.readAsDataURL(file);
    });
}

function renderThumbnails() {
    thumbnailsGrid.innerHTML = '';
    uploadedImages.forEach((img, i) => {
        const thumb = document.createElement('div');
        thumb.className = 'thumb-item';
        thumb.innerHTML = `
            <img src="${img}" alt="Photo ${i + 1}">
            <button type="button" class="thumb-remove" onclick="removeImage(${i})"><i class="fa-solid fa-xmark"></i></button>
            <span class="thumb-index">${i + 1}</span>
        `;
        thumbnailsGrid.appendChild(thumb);
    });
    uploadZone.querySelector('.upload-text').textContent = uploadedImages.length > 0
        ? `${uploadedImages.length} photo(s) added — click to add more`
        : 'Drag & drop images here, or click to browse';
}

function removeImage(index) {
    uploadedImages.splice(index, 1);
    renderThumbnails();
}

// ─── CSV Export ─────────────────────────────────────────────────────
async function exportCSV() {
    try {
        const res = await fetch(`${API_BASE}/api/machines/export`, { headers: authHeaders() });
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'rs_enterprise_inventory.csv'; a.click();
        window.URL.revokeObjectURL(url);
    } catch (err) { alert('Failed to export CSV.'); }
}

// ─── Maintenance CRM ────────────────────────────────────────────────
let allTickets = [];

async function loadLeads() {
    try {
        const res = await fetch(`${API_BASE}/api/maintenance`, { headers: authHeaders() });
        const data = await res.json();
        leadsBody.innerHTML = '';
        if (data.status === 'success' && data.tickets.length > 0) {
            allTickets = data.tickets;
            data.tickets.forEach(ticket => {
                const tr = document.createElement('tr');
                const status = ticket.status || 'new';
                const clientName = ticket.client_name || 'N/A';
                const machineModel = ticket.machine_model || 'N/A';
                const issueCategory = ticket.issue_category || 'N/A';
                const urgency = ticket.urgency || 'Low';
                const tid = ticket._id;

                // Color urgency badges beautifully!
                const urgencyBadgeClass = urgency === 'High' ? 'badge-outofstock' : urgency === 'Medium' ? 'badge-special' : 'badge-instock';

                tr.innerHTML = `
                    <td><strong>${clientName}</strong></td>
                    <td>${machineModel}</td>
                    <td>${issueCategory}</td>
                    <td><span class="badge ${urgencyBadgeClass}">${urgency}</span></td>
                    <td>
                        <select class="lead-status-select" onchange="updateTicketStatus('${tid}', this.value)">
                            <option value="new" ${status==='new'?'selected':''}>🟡 New</option>
                            <option value="in_diagnostic" ${status==='in_diagnostic'?'selected':''}>🔵 Diagnostic</option>
                            <option value="in_progress" ${status==='in_progress'?'selected':''}>🟠 In Progress</option>
                            <option value="resolved" ${status==='resolved'?'selected':''}>🟢 Resolved</option>
                            <option value="rejected" ${status==='rejected'?'selected':''}>❌ Rejected</option>
                        </select>
                    </td>
                    <td class="action-cell">
                        <button class="action-btn edit-btn" onclick="viewTicketDetail('${tid}')" title="View Details"><i class="fa-solid fa-eye"></i></button>
                        <button class="action-btn delete-btn" onclick="deleteTicket('${tid}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </td>`;
                leadsBody.appendChild(tr);
            });
        } else { leadsBody.innerHTML = '<tr><td colspan="6" class="empty-state">No repair tickets yet.</td></tr>'; }
    } catch (err) { leadsBody.innerHTML = '<tr><td colspan="6" class="empty-state error-state">Error loading tickets.</td></tr>'; }
}

async function updateTicketStatus(tid, s) { 
    // Map custom option values to backend expectations if needed, but since our mapping works natively:
    await fetch(`${API_BASE}/api/maintenance/${tid}/status`, { 
        method: 'PATCH', 
        headers: authHeaders(), 
        body: JSON.stringify({ status: s }) 
    }); 
    loadAnalytics(); 
}

async function deleteTicket(tid) { 
    if (!confirm('Delete this repair ticket permanently?')) return; 
    await fetch(`${API_BASE}/api/maintenance/${tid}`, { 
        method: 'DELETE', 
        headers: authHeaders() 
    }); 
    loadLeads(); 
    loadAnalytics(); 
}

// Backward compatibility handlers
async function updateLeadStatus(lid, s) { await updateTicketStatus(lid, s); }
async function deleteLead(lid) { await deleteTicket(lid); }

function viewTicketDetail(tid) {
    const ticket = allTickets.find(t => t._id === tid);
    if (!ticket) return;

    document.getElementById('detail-client-name').textContent = ticket.client_name || 'N/A';
    
    // Add custom urgency color
    const urgency = ticket.urgency || 'Low';
    const urgencyEl = document.getElementById('detail-urgency');
    urgencyEl.textContent = urgency;
    urgencyEl.className = 'detail-value badge ' + (urgency === 'High' ? 'badge-outofstock' : urgency === 'Medium' ? 'badge-special' : 'badge-instock');
    urgencyEl.style.display = 'inline-block';
    urgencyEl.style.padding = '0.4rem 0.8rem';

    const emailEl = document.getElementById('detail-email');
    emailEl.textContent = ticket.contact_email || 'N/A';
    emailEl.href = `mailto:${ticket.contact_email}?subject=RS Enterprise CNC Repair Request`;
    
    document.getElementById('detail-phone').textContent = ticket.contact_phone || 'N/A';
    document.getElementById('detail-machine-model').textContent = ticket.machine_model || 'N/A';
    document.getElementById('detail-issue-category').textContent = ticket.issue_category || 'N/A';
    
    const errCodeContainer = document.getElementById('detail-error-code-container');
    if (ticket.error_code) {
        errCodeContainer.style.display = 'grid';
        document.getElementById('detail-error-code').textContent = ticket.error_code;
    } else {
        errCodeContainer.style.display = 'none';
    }

    document.getElementById('detail-description').textContent = ticket.description || 'No description provided.';

    // Attached Images
    const imgContainer = document.getElementById('detail-images-container');
    const imgGrid = document.getElementById('detail-images-grid');
    imgGrid.innerHTML = '';
    
    const images = ticket.images || [];
    if (images.length > 0) {
        imgContainer.style.display = 'block';
        images.forEach((imgBase64, idx) => {
            const card = document.createElement('div');
            card.className = 'detail-image-card';
            card.innerHTML = `<img src="${imgBase64}" alt="Issue Image ${idx + 1}" onclick="openLightbox('${imgBase64}')" style="cursor: zoom-in;">`;
            imgGrid.appendChild(card);
        });
    } else {
        imgContainer.style.display = 'none';
    }

    // Open Modal
    document.getElementById('ticket-detail-modal').classList.remove('hidden');
}

function closeTicketModal() {
    document.getElementById('ticket-detail-modal').classList.add('hidden');
}

function openLightbox(imgSrc) {
    const lightbox = document.getElementById('image-lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    lightboxImg.src = imgSrc;
    lightbox.classList.remove('hidden');
    lightbox.style.pointerEvents = 'auto';
    setTimeout(() => {
        lightbox.style.opacity = '1';
        lightboxImg.style.transform = 'scale(1)';
    }, 50);
}

function closeLightbox() {
    const lightbox = document.getElementById('image-lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    lightbox.style.opacity = '0';
    lightboxImg.style.transform = 'scale(0.92)';
    lightbox.style.pointerEvents = 'none';
    setTimeout(() => {
        lightbox.classList.add('hidden');
    }, 300);
}

// ─── Settings & Configurations ───────────────────────────────────────
let currentSettings = {};
const systemConfigForm = document.getElementById('system-config-form');

async function loadSettings() {
    try {
        const res = await fetch(`${API_BASE}/api/settings`, { headers: authHeaders() });
        const data = await res.json();
        if (data.status === 'success' && data.settings) {
            const s = data.settings;
            currentSettings = s;
            
            // ROI Defaults
            document.getElementById('s-payback').value = s.default_payback_months || 14;
            document.getElementById('s-savings').value = s.default_annual_savings_usd || 42000;
            document.getElementById('s-efficiency').value = s.efficiency_gain_percent || 18.5;
            document.getElementById('s-cycle').value = s.cycle_time_reduction_factor || 0.9;
            document.getElementById('s-electricity').value = s.electricity_cost_per_kwh || 8.5;
            document.getElementById('s-wage').value = s.operator_hourly_wage_inr || 350;
            document.getElementById('s-tooling-wear').value = s.tooling_wear_rate_percent || 2.5;

            // System Config Defaults
            document.getElementById('cfg-phone').value = s.phone_number || '';
            document.getElementById('cfg-whatsapp').value = s.whatsapp_number || '';
            document.getElementById('cfg-email').value = s.email_address || '';
            document.getElementById('cfg-address').value = s.physical_address || '';
            document.getElementById('cfg-instagram').value = s.instagram_link || '';
            document.getElementById('cfg-youtube').value = s.youtube_link || '';
            document.getElementById('cfg-facebook').value = s.facebook_link || '';
            document.getElementById('cfg-channel').value = s.channel_link || '';
        }
    } catch (err) { console.error(err); }
}

settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        ...currentSettings,
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
        const resData = await res.json();
        if (resData.status === 'success') {
            currentSettings = payload;
            alert('ROI parameters successfully saved and calibrated!');
        }
    } catch (err) { alert('Failed to save settings.'); }
});

if (systemConfigForm) {
    systemConfigForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            ...currentSettings,
            phone_number: document.getElementById('cfg-phone').value,
            whatsapp_number: document.getElementById('cfg-whatsapp').value,
            email_address: document.getElementById('cfg-email').value,
            physical_address: document.getElementById('cfg-address').value,
            instagram_link: document.getElementById('cfg-instagram').value,
            youtube_link: document.getElementById('cfg-youtube').value,
            facebook_link: document.getElementById('cfg-facebook').value,
            channel_link: document.getElementById('cfg-channel').value
        };
        try {
            const res = await fetch(`${API_BASE}/api/settings`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload) });
            const resData = await res.json();
            if (resData.status === 'success') {
                currentSettings = payload;
                alert('System contact configurations successfully saved and live!');
            }
        } catch (err) { alert('Failed to save configurations.'); }
    });
}


function logout() { sessionStorage.removeItem('rs_admin_token'); authToken = null; location.reload(); }
