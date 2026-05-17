document.addEventListener('DOMContentLoaded', () => {
    // State
    const payload = {
        client_profile: {},
        technical_requirements: {}
    };

    // Elements
    const stepIndustry = document.getElementById('step-industry');
    const stepMaterial = document.getElementById('step-material');
    const stepConstraints = document.getElementById('step-constraints');
    const stepLoading = document.getElementById('step-loading');
    const stepDashboard = document.getElementById('step-dashboard');

    const industryCards = document.querySelectorAll('.industry-card');
    const materialSelect = document.getElementById('material-select');
    const axisToggles = document.querySelectorAll('.axis-toggle');
    const btnNextMaterial = document.getElementById('btn-next-material');
    
    const footprintSlider = document.getElementById('footprint-slider');
    const footprintVal = document.getElementById('footprint-val');
    const cycleTimeInput = document.getElementById('cycle-time-input');
    const btnAnalyze = document.getElementById('btn-analyze');

    // Haptics Helper (Mobile only if supported)
    const triggerHaptic = () => {
        if (navigator.vibrate) navigator.vibrate(10);
    };

    // Transition Helper
    const transition = (currentStep, nextStep) => {
        currentStep.classList.remove('active');
        currentStep.classList.add('exit-up');
        
        setTimeout(() => {
            currentStep.classList.remove('exit-up');
            currentStep.classList.add('hidden');
            
            nextStep.classList.remove('hidden');
            // Small timeout to allow display:block to apply before animating opacity/transform
            setTimeout(() => {
                nextStep.classList.add('active');
            }, 50);
        }, 400); // Wait for exit animation
    };

    // Step 1: Industry
    industryCards.forEach(card => {
        card.addEventListener('click', () => {
            triggerHaptic();
            payload.client_profile.industry = card.getAttribute('data-industry');
            transition(stepIndustry, stepMaterial);
        });
    });

    // Step 2: Material & Axes
    axisToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            triggerHaptic();
            axisToggles.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            payload.technical_requirements.required_axes = parseInt(e.target.getAttribute('data-axes'));
        });
    });

    btnNextMaterial.addEventListener('click', () => {
        payload.technical_requirements.material = materialSelect.value;
        if (!payload.technical_requirements.material || !payload.technical_requirements.required_axes) {
            alert("Please select a material and axis configuration.");
            return;
        }
        transition(stepMaterial, stepConstraints);
    });

    // Step 3: Constraints
    footprintSlider.addEventListener('input', (e) => {
        footprintVal.textContent = e.target.value;
    });

    btnAnalyze.addEventListener('click', () => {
        triggerHaptic();
        payload.technical_requirements.max_footprint_sqft = parseInt(footprintSlider.value);
        payload.technical_requirements.target_cycle_time_mins = parseFloat(cycleTimeInput.value);
        
        console.log("Handoff Payload to Antigravity:", JSON.stringify(payload, null, 2));

        // Start Loading transition
        transition(stepConstraints, stepLoading);

        // Real API call to Render backend
        fetch('https://rs-enterprise-api.onrender.com/api/configure', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            // Morph into dashboard
            transition(stepLoading, stepDashboard);
            
            if (data.status === 'success') {
                document.getElementById('roi-payback').textContent = data.roi_report.payback_period_months + " Months";
                document.getElementById('roi-savings').textContent = "$" + data.roi_report.projected_annual_savings_usd.toLocaleString();
            } else {
                alert("Configuration failed. Please try again.");
            }
        })
        .catch(error => {
            console.error('Error:', error);
            // Fallback for demo if backend is offline
            setTimeout(() => {
                transition(stepLoading, stepDashboard);
                document.getElementById('roi-payback').textContent = "14 Months (Mocked)";
                document.getElementById('roi-savings').textContent = "$42,000 (Mocked)";
            }, 1000);
        });
    });
});
