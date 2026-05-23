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
        
        const company = document.getElementById('company-name').value;
        const name = document.getElementById('contact-name').value;
        const email = document.getElementById('contact-email').value;
        const phone = document.getElementById('contact-phone').value;
        
        if (!company || !name || !email || !phone) {
            alert("Please fill in all B2B Corporate Handoff Details.");
            return;
        }

        payload.client_profile.company_name = company;
        payload.client_profile.contact_name = name;
        payload.client_profile.contact_email = email;
        payload.client_profile.contact_phone = phone;

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
                // Counter animations for the ROI statistics (UX feature 8)
                const paybackVal = data.roi_report.payback_period_months;
                const savingsVal = data.roi_report.projected_annual_savings_usd;
                
                // Animate payback months
                const paybackEl = document.getElementById('roi-payback');
                if (paybackEl) {
                    window.animateCounter(paybackEl, 0, paybackVal, 1200);
                    setTimeout(() => { paybackEl.textContent = paybackEl.textContent + " Months"; }, 1300);
                }

                // Animate savings dollar amount
                const savingsEl = document.getElementById('roi-savings');
                if (savingsEl) {
                    window.animateCounter(savingsEl, 0, savingsVal, 1500);
                    setTimeout(() => { savingsEl.textContent = "$" + savingsEl.textContent; }, 1600);
                }

                // Tag the export button click listener (UX feature 7)
                const exportBtn = document.getElementById('btn-export-spec');
                if (exportBtn) {
                    exportBtn.addEventListener('click', () => {
                        const fileContent = `====================================================
RS ENTERPRISE CNC - AI SIMULATION CALIBRATION SPEC SHEET
====================================================
Generated: ${new Date().toLocaleString()}
Company Profile:
- Company Name: ${payload.client_profile.company_name}
- Contact Person: ${payload.client_profile.contact_name}
- Email: ${payload.client_profile.contact_email}
- Phone: ${payload.client_profile.contact_phone}

Simulated Technical Requirements:
- Chosen Industry: ${payload.client_profile.industry}
- Kinematic Axes: ${payload.technical_requirements.required_axes}-Axis
- Workpiece Material: ${payload.technical_requirements.material}
- Max Gantry Footprint: ${payload.technical_requirements.max_footprint_sqft} sq ft
- Target Cycle Time Constraint: ${payload.technical_requirements.target_cycle_time_mins} minutes

Optimized Geometry Results:
- Recommended Base Model: ${data.machine_configuration.base_model}
- Spindle Kinematic Speed: ${data.machine_configuration.spindle_speed_rpm.toLocaleString()} RPM
- Travel Geometry: Fully Calibrated
- Controller Module: Siemens 840D (Stress-fitted)
- Calibration Rating: Certified to <0.01mm tolerance

B2B Financial Payback Forecast:
- Amortized Payback Period: ${data.roi_report.payback_period_months} Months
- Projected Annual Savings: $${data.roi_report.projected_annual_savings_usd.toLocaleString()} USD
====================================================
Certified and Inspected in Ludhiana, Punjab.
====================================================`;
                        
                        const blob = new Blob([fileContent], { type: 'text/plain' });
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = `RS_CNC_AI_SpecSheet_${payload.client_profile.company_name.replace(/\\s+/g, '_')}.txt`;
                        link.click();
                        
                        if (window.showToast) {
                            window.showToast("B2B Calibration Spec Sheet downloaded successfully!", "success");
                        }
                    });
                }

                // Secure Frontend Email Dispatch (Bypasses Render firewall blocks completely!)
                const emailSubject = `🚨 New CNC Sale & Configuration Query from ${payload.client_profile.company_name || 'N/A'}`;
                const emailBody = `
========================================
CNC Sale & Configuration Query
========================================
Company Name: ${payload.client_profile.company_name || 'N/A'}
Contact Person: ${payload.client_profile.contact_name || 'N/A'}
Email Address: ${payload.client_profile.contact_email || 'N/A'}
Phone Number: ${payload.client_profile.contact_phone || 'N/A'}

Technical Specifications:
- Required Axes: ${payload.technical_requirements.required_axes}-Axis
- Target Cycle Time: ${payload.technical_requirements.target_cycle_time_mins} mins
- Workpiece Material: ${payload.technical_requirements.workpiece_material || 'N/A'}
- Monthly Production Volume: ${payload.technical_requirements.monthly_volume || 'N/A'} units/month
- Base Model: ${data.machine_configuration.base_model}
- Spindle Speed: ${data.machine_configuration.spindle_speed_rpm} RPM
- Recommended Tooling: ${data.machine_configuration.recommended_tooling_kit}
- Estimated Price: $${data.machine_configuration.estimated_price_usd.toLocaleString()}
========================================
Notification automatically dispatched by RS Enterprise CNC Portal.
                `;

                fetch('https://formsubmit.co/ajax/jashansohal2008@gmail.com', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        _subject: emailSubject,
                        email: payload.client_profile.contact_email,
                        message: emailBody,
                        _template: 'box'
                    })
                }).then(r => r.json())
                  .then(d => console.log('Frontend sales email alert dispatched:', d))
                  .catch(e => console.error('Frontend sales email dispatch failed:', e));
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
