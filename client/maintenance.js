const API_BASE = 'https://rs-enterprise-api.onrender.com';

let currentStep = 1;
let selectedUrgency = 'Low';
let attachedImages = []; // Array of base64 strings

// DOM Elements
const portalWorkspace = document.getElementById('portal-workspace');
const successScreen = document.getElementById('portal-success-screen');
const successTicketId = document.getElementById('success-ticket-id');
const ticketForm = document.getElementById('maintenance-ticket-form');
const mModelSelect = document.getElementById('m-model');

const portalImageInput = document.getElementById('portal-image-input');
const portalUploadZone = document.getElementById('portal-upload-zone');
const portalThumbnailsGrid = document.getElementById('portal-thumbnails-grid');

const scannerBeam = document.getElementById('scanner-beam');
const scannerOverlay = document.getElementById('scanner-overlay');
const scannerText = document.getElementById('scanner-text');
const btnPreDiagnose = document.getElementById('btn-pre-diagnose');
const aiReportPanel = document.getElementById('ai-report-panel');
const reportTypeBadge = document.getElementById('report-type-badge');
const reportTitle = document.getElementById('report-title');
const reportDesc = document.getElementById('report-desc');
const healthValuePercent = document.getElementById('health-value-percent');
const healthMetricBar = document.getElementById('health-metric-bar');

// ─── Initialize Portal ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    fetchMachines();
    handleURLQuery();
    setupImageHandlers();
});

// ─── Fetch Machines ──────────────────────────────────────────────────
async function fetchMachines() {
    try {
        const res = await fetch(`${API_BASE}/api/machines`);
        const data = await res.json();
        if (data.status === 'success' && data.machines.length > 0) {
            // Keep existing options and add dynamic ones
            const existingOptions = Array.from(mModelSelect.options).map(o => o.value);
            data.machines.forEach(m => {
                if (!existingOptions.includes(m.name)) {
                    const opt = document.createElement('option');
                    opt.value = m.name;
                    opt.textContent = `${m.name} (${m.axis_config})`;
                    // Insert before the last option ("Other / Custom CNC")
                    mModelSelect.insertBefore(opt, mModelSelect.options[mModelSelect.options.length - 1]);
                }
            });
            // Re-run URL query handling to ensure pre-selection works on loaded machines!
            handleURLQuery();
        }
    } catch (err) {
        console.warn("Could not fetch machines from backend, using default list.", err);
    }
}

// ─── URL Query Pre-selection ─────────────────────────────────────────
function handleURLQuery() {
    const params = new URLSearchParams(window.location.search);
    const preselectedMachine = params.get('machine');
    if (preselectedMachine) {
        // Try to match value exactly
        for (let opt of mModelSelect.options) {
            if (opt.value.toLowerCase() === preselectedMachine.toLowerCase()) {
                mModelSelect.value = opt.value;
                break;
            }
        }
    }
}

// ─── Multi-step Navigation ───────────────────────────────────────────
function changeStep(step) {
    // Validate current step before going forward
    if (step > currentStep) {
        if (!validateStep(currentStep)) return;
    }

    // Hide all step sections
    document.querySelectorAll('.form-step-section').forEach(sec => sec.classList.add('hidden'));
    
    // Show target step section
    document.getElementById(`section-step-${step}`).classList.remove('hidden');

    // Update indicators
    document.querySelectorAll('.step-indicator-item').forEach((ind, idx) => {
        const indStep = idx + 1;
        ind.className = 'step-indicator-item';
        if (indStep === step) {
            ind.classList.add('active');
        } else if (indStep < step) {
            ind.classList.add('completed');
            ind.innerHTML = '<i class="fa-solid fa-check"></i>';
        } else {
            ind.textContent = indStep;
        }
    });

    currentStep = step;
}

function validateStep(step) {
    if (step === 1) {
        const company = document.getElementById('c-company').value.trim();
        const name = document.getElementById('c-name').value.trim();
        const email = document.getElementById('c-email').value.trim();
        const phone = document.getElementById('c-phone').value.trim();
        if (!company || !name || !email || !phone) {
            alert('Please fill out all contact information fields.');
            return false;
        }
        // Basic email check
        if (!email.includes('@')) {
            alert('Please enter a valid email address.');
            return false;
        }
    } else if (step === 2) {
        const model = mModelSelect.value;
        if (!model) {
            alert('Please select a CNC machine model.');
            return false;
        }
    } else if (step === 3) {
        const cat = document.getElementById('i-category').value;
        const desc = document.getElementById('i-desc').value.trim();
        if (!cat || !desc) {
            alert('Please select an issue category and write a description of the problem.');
            return false;
        }
    }
    return true;
}

// ─── Urgency Selector ────────────────────────────────────────────────
function selectUrgency(level) {
    selectedUrgency = level;
    document.querySelectorAll('.urgency-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-urgency') === level);
    });
}

// ─── Drag & Drop Image Handlers ─────────────────────────────────────
function setupImageHandlers() {
    portalUploadZone.addEventListener('click', () => portalImageInput.click());
    portalUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        portalUploadZone.style.background = "rgba(0, 230, 242, 0.05)";
    });
    portalUploadZone.addEventListener('dragleave', () => {
        portalUploadZone.style.background = "rgba(255,255,255,0.01)";
    });
    portalUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        portalUploadZone.style.background = "rgba(255,255,255,0.01)";
        handleFiles(e.dataTransfer.files);
    });
    portalImageInput.addEventListener('change', (e) => handleFiles(e.target.files));
}

function handleFiles(files) {
    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        if (file.size > 5 * 1024 * 1024) {
            alert(`File ${file.name} is too large. 5MB limit.`);
            return;
        }
        if (attachedImages.length >= 5) {
            alert('Maximum 5 photos allowed.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            attachedImages.push(e.target.result);
            renderThumbnails();
        };
        reader.readAsDataURL(file);
    });
}

function renderThumbnails() {
    portalThumbnailsGrid.innerHTML = '';
    attachedImages.forEach((img, index) => {
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.style.borderRadius = '6px';
        div.style.overflow = 'hidden';
        div.style.height = '80px';
        div.style.border = '1px solid var(--glass-border)';
        div.innerHTML = `
            <img src="${img}" style="width:100%; height:100%; object-fit:cover;">
            <button type="button" onclick="removeThumbnail(${index})" style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.75rem;"><i class="fa-solid fa-xmark"></i></button>
        `;
        portalThumbnailsGrid.appendChild(div);
    });
}

function removeThumbnail(index) {
    attachedImages.splice(index, 1);
    renderThumbnails();
}

// ─── Gemini AI Pre-Diagnosis Simulation ──────────────────────────────
function runAIDiagnosis() {
    const category = document.getElementById('i-category').value;
    const model = mModelSelect.value;
    const desc = document.getElementById('i-desc').value.trim();

    if (!model) {
        alert('Please go back to Step 2 and select a Machine Model first.');
        return;
    }
    if (!category || !desc) {
        alert('Please fill out the Issue Category and Description in Step 3 first.');
        return;
    }

    // Trigger scanning animation
    scannerBeam.style.display = 'block';
    scannerOverlay.style.color = 'var(--accent-orange)';
    scannerText.textContent = "SCANNING G-CODE & CALIBRATION PATHS...";
    btnPreDiagnose.disabled = true;

    // Simulate AI computing
    setTimeout(() => {
        scannerBeam.style.display = 'none';
        scannerOverlay.style.color = '#00e676';
        scannerText.textContent = "AI PRE-DIAGNOSIS COMPLETE!";
        btnPreDiagnose.disabled = false;

        // Generate response based on category
        let badgeText = "System Check";
        let badgeIcon = "fa-circle-check";
        let titleText = "Advisory Report";
        let reportText = "";
        let healthPercent = 90;

        if (category.includes('Spindle')) {
            badgeText = "Spindle Check";
            badgeIcon = "fa-arrows-spin";
            titleText = "Spindle Overheat/Torque Advisory";
            reportText = `Gemini AI detects spindle thermal expand parameters near threshold limit. In Ludhiana's hot humid environment, standard cooling pressure can drop. Ensure the secondary coolant chiller temperature reads exactly 20°C and check the spindle drive phase balance before technician arrives.`;
            healthPercent = 54;
        } else if (category.includes('Precision')) {
            badgeText = "Axis Geometry";
            badgeIcon = "fa-compass";
            titleText = "Z-Axis Recalibration Recommendation";
            reportText = `Axis inaccuracy usually results from ball screw backlash or liner guide wear. We recommend reviewing your controller backlash compensation settings (G121 on FANUC) and ensuring lubrication pump pressure sits at 15 Bar.`;
            healthPercent = 68;
        } else if (category.includes('Electrical')) {
            badgeText = "Controller Core";
            badgeIcon = "fa-network-wired";
            titleText = "FANUC/Siemens Bus Communication Diagnostic";
            reportText = `Electrical fault code detected. This typically suggests communication delay on the Profibus/EtherCAT line. Turn off the main circuit breaker for 3 minutes to reset the capacitor bank and inspect the Z-axis brake resistor line.`;
            healthPercent = 42;
        } else if (category.includes('Coolant')) {
            badgeText = "Fluid Dynamics";
            badgeIcon = "fa-droplet";
            titleText = "Coolant Pressure Check";
            reportText = `Pressure fluctuations standardly trace back to chip filter clogs in the primary recovery tank. Flush the micron mesh screen and inspect the solenoid flow valve.`;
            healthPercent = 75;
        } else {
            badgeText = "Mechanical Integrity";
            badgeIcon = "fa-screwdriver-wrench";
            titleText = "Mechanical Calibration Check";
            reportText = `Static frame check: Ensure anchor bolts at the base of your CNC cast bed are torqued to 150 Nm. Vibration dampening pad checks are advised to reduce axis chatter during high-feed milling.`;
            healthPercent = 81;
        }

        // Render Report Card
        reportTypeBadge.innerHTML = `<i class="fa-solid ${badgeIcon}"></i> ${badgeText}`;
        reportTitle.textContent = titleText;
        reportDesc.textContent = reportText;
        healthValuePercent.textContent = `${healthPercent}%`;
        healthValuePercent.style.color = healthPercent < 50 ? '#ff5252' : healthPercent < 80 ? 'var(--accent-orange)' : '#00e676';
        
        healthMetricBar.style.width = `${healthPercent}%`;
        healthMetricBar.style.background = healthPercent < 50 ? '#ff5252' : healthPercent < 80 ? 'var(--accent-orange)' : '#00e676';

        aiReportPanel.style.display = 'block';
    }, 2000);
}

// ─── Submit Form to Backend ──────────────────────────────────────────
ticketForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
        return;
    }

    const payload = {
        client_name: document.getElementById('c-company').value.trim(),
        contact_email: document.getElementById('c-email').value.trim(),
        contact_phone: document.getElementById('c-phone').value.trim(),
        machine_model: mModelSelect.value,
        issue_category: document.getElementById('i-category').value,
        urgency: selectedUrgency,
        description: document.getElementById('i-desc').value.trim(),
        error_code: document.getElementById('i-error-code').value.trim() || null,
        images: attachedImages
    };

    try {
        const res = await fetch(`${API_BASE}/api/maintenance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.status === 'success') {
            // Generate beautiful Ticket ID
            const hex = Math.floor(Math.random()*65535).toString(16).toUpperCase();
            const rand = Math.floor(1000 + Math.random()*9000);
            successTicketId.textContent = `TKT-${hex}-${rand}`;

            // Show Success portal Screen
            portalWorkspace.classList.add('hidden');
            successScreen.classList.remove('hidden');
        } else {
            alert('Failed to submit: ' + (data.message || 'Unknown error'));
        }
    } catch (err) {
        alert('Server cold-starting — please retry in 30 seconds.');
    }
});

// ─── Reset Portal Form ──────────────────────────────────────────────
function resetPortalForm() {
    ticketForm.reset();
    attachedImages = [];
    renderThumbnails();
    selectedUrgency = 'Low';
    selectUrgency('Low');
    aiReportPanel.style.display = 'none';
    scannerOverlay.style.color = 'var(--accent-blue)';
    scannerText.textContent = "Awaiting input fields...";
    
    successScreen.classList.add('hidden');
    portalWorkspace.classList.remove('hidden');
    
    changeStep(1);
}
