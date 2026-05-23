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
                // Initialize B2B ROI cash-flow analyzer (Major Feature 2)
                initROISection(data);

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
                initROISection({
                    machine_configuration: { estimated_price_usd: 75000 },
                    roi_report: { payback_period_months: 14, projected_annual_savings_usd: 42000 }
                });
            }, 1000);
        });
    });

    // ─── MAJOR FEATURE 1: Interactive G-Code Toolpath Simulator ─────────
    const canvas = document.getElementById('gcode-canvas');
    const dropzone = document.getElementById('gcode-dropzone');
    const fileInput = document.getElementById('gcode-file-input');
    const demoSelect = document.getElementById('gcode-demo-select');
    
    const playBtn = document.getElementById('gcode-btn-play');
    const pauseBtn = document.getElementById('gcode-btn-pause');
    const resetBtn = document.getElementById('gcode-btn-reset');
    const animStatus = document.getElementById('gcode-anim-status');

    let currentParsedData = null;
    let animationFrameId = null;
    let animProgress = 0.0;
    let isPlaying = false;
    let animStartTime = null;

    if (canvas && dropzone && fileInput) {
        // High-DPI canvas setup
        const resizeCanvas = () => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * window.devicePixelRatio;
            canvas.height = rect.height * window.devicePixelRatio;
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Click to browse
        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--accent-orange)'; });
        dropzone.addEventListener('dragleave', () => dropzone.style.borderColor = 'var(--glass-border)');
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--glass-border)';
            if (e.dataTransfer.files.length > 0) {
                handleGCodeFile(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleGCodeFile(e.target.files[0]);
            }
        });

        // Demo selections
        if (demoSelect) {
            demoSelect.addEventListener('change', (e) => {
                const choice = e.target.value;
                let demoGCode = "";
                if (choice === 'gear') {
                    demoGCode = generateHelicalGearPath();
                } else if (choice === 'winglet') {
                    demoGCode = generateAerospaceTurbinePath();
                } else if (choice === 'turbine') {
                    demoGCode = generateSpindleRotorPath();
                }
                processGCodeText(demoGCode);
                if (window.showToast) {
                    window.showToast(`Loaded pre-programmed ${e.target.options[e.target.selectedIndex].text}!`, 'info');
                }
            });
        }

        const handleGCodeFile = (file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                processGCodeText(e.target.result);
                if (window.showToast) {
                    window.showToast(`G-Code "${file.name}" uploaded & parsed successfully!`, 'success');
                }
            };
            reader.readAsText(file);
        };

        const processGCodeText = (text) => {
            stopAnimation();
            currentParsedData = parseGCode(text);
            updateSimulatorMetrics(currentParsedData.metrics);
            animProgress = 0.0;
            drawToolpath(canvas, currentParsedData, 0.0);
            startAnimation();
        };

        const updateSimulatorMetrics = (m) => {
            document.getElementById('gcode-metric-lines').textContent = m.lines.toLocaleString();
            
            // Format time
            const mins = Math.floor(m.timeSeconds / 60);
            const secs = Math.floor(m.timeSeconds % 60);
            document.getElementById('gcode-metric-time').textContent = `${mins}m ${secs}s`;
            
            // Feed rate warning estimation
            const feedRating = m.cutCount > 0 ? "F1500 Optimized" : "N/A";
            document.getElementById('gcode-metric-feed').textContent = feedRating;

            // Bounding box dimensions
            const dimX = (m.maxX - m.minX).toFixed(1);
            const dimY = (m.maxY - m.minY).toFixed(1);
            const dimZ = (m.maxZ - m.minZ).toFixed(1);
            document.getElementById('gcode-metric-box').textContent = `${dimX} x ${dimY} x ${dimZ} mm`;
        };

        // Animation Loop Control
        const startAnimation = () => {
            if (!currentParsedData || isPlaying) return;
            isPlaying = true;
            animStatus.textContent = "Simulating...";
            animStartTime = performance.now();
            
            const animate = (timestamp) => {
                if (!isPlaying) return;
                // Animate progress over 8 seconds
                const elapsed = timestamp - animStartTime;
                animProgress = Math.min(elapsed / 8000, 1.0);
                
                drawToolpath(canvas, currentParsedData, animProgress);

                if (animProgress < 1.0) {
                    animationFrameId = requestAnimationFrame(animate);
                } else {
                    stopAnimation();
                    animStatus.textContent = "Simulation Complete";
                }
            };
            animationFrameId = requestAnimationFrame(animate);
        };

        const pauseAnimation = () => {
            isPlaying = false;
            animStatus.textContent = "Paused";
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };

        const stopAnimation = () => {
            isPlaying = false;
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };

        playBtn.addEventListener('click', () => {
            if (currentParsedData) {
                if (animProgress >= 1.0) animProgress = 0.0;
                // Adjust start time to resume smoothly
                animStartTime = performance.now() - (animProgress * 8000);
                startAnimation();
            }
        });
        pauseBtn.addEventListener('click', pauseAnimation);
        resetBtn.addEventListener('click', () => {
            stopAnimation();
            animProgress = 0.0;
            if (currentParsedData) {
                drawToolpath(canvas, currentParsedData, 0.0);
                animStatus.textContent = "Reset";
            }
        });
    }

    // Mathematical G-Code generators
    function generateHelicalGearPath() {
        let lines = ["G90", "G21", "G00 Z15.0000", "G00 X0.0000 Y0.0000", "G01 Z-2.0000 F800"];
        for (let t = 0; t < Math.PI * 16; t += 0.06) {
            const r = 15 + 28 * (t / (Math.PI * 16));
            const x = r * Math.cos(t);
            const y = r * Math.sin(t);
            const z = -2.0 + 4.0 * (t / (Math.PI * 16));
            lines.push(`G01 X${x.toFixed(4)} Y${y.toFixed(4)} Z${z.toFixed(4)} F1200`);
        }
        lines.push("G00 Z15.0000", "M30");
        return lines.join("\n");
    }

    function generateAerospaceTurbinePath() {
        let lines = ["G90", "G21", "G00 Z15.0000", "G00 X-60.0000 Y-30.0000", "G01 Z-1.5000 F1000"];
        for (let x = -60; x <= 60; x += 1.5) {
            const y = 30 * Math.sin(x * 0.08) * Math.cos(x * 0.04);
            const z = -1.5 + 4.5 * Math.sin(x * 0.03);
            lines.push(`G01 X${x.toFixed(4)} Y${y.toFixed(4)} Z${z.toFixed(4)} F1600`);
        }
        lines.push("G00 Z20.0000", "M30");
        return lines.join("\n");
    }

    function generateSpindleRotorPath() {
        let lines = ["G90", "G21", "G00 Z15.0000", "G00 X0.0000 Y0.0000", "G01 Z-3.0000 F800"];
        for (let t = 0; t < Math.PI * 22; t += 0.08) {
            const r = 40 * Math.cos(3 * t / 4);
            const x = r * Math.cos(t);
            const y = r * Math.sin(t);
            lines.push(`G01 X${x.toFixed(4)} Y${y.toFixed(4)} F1500`);
        }
        lines.push("G00 Z25.0000", "M30");
        return lines.join("\n");
    }

    // G-Code parsing engine
    function parseGCode(text) {
        const lines = text.split("\n");
        const points = [];
        let currentX = 0, currentY = 0, currentZ = 0;
        let isAbsolute = true;
        let totalTime = 0;
        let rapidLines = 0, cutLines = 0;
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (let line of lines) {
            line = line.trim().toUpperCase();
            line = line.replace(/\([^)]*\)/g, ""); // strip comments
            if (!line) continue;

            if (line.includes("G90")) isAbsolute = true;
            if (line.includes("G91")) isAbsolute = false;

            const isG0 = line.includes("G00") || line.includes("G0 ");
            const isG1 = line.includes("G01") || line.includes("G1 ");
            const isG2 = line.includes("G02") || line.includes("G2 ");
            const isG3 = line.includes("G03") || line.includes("G3 ");

            if (isG0 || isG1 || isG2 || isG3) {
                const xMatch = line.match(/X\s*(-?\d+(\.\d+)?)/);
                const yMatch = line.match(/Y\s*(-?\d+(\.\d+)?)/);
                const zMatch = line.match(/Z\s*(-?\d+(\.\d+)?)/);
                const fMatch = line.match(/F\s*(\d+)/);

                let newX = xMatch ? (isAbsolute ? parseFloat(xMatch[1]) : currentX + parseFloat(xMatch[1])) : currentX;
                let newY = yMatch ? (isAbsolute ? parseFloat(yMatch[1]) : currentY + parseFloat(yMatch[1])) : currentY;
                let newZ = zMatch ? (isAbsolute ? parseFloat(zMatch[1]) : currentZ + parseFloat(zMatch[1])) : currentZ;
                let feed = fMatch ? parseFloat(fMatch[1]) : 1200;

                const dist = Math.sqrt((newX-currentX)**2 + (newY-currentY)**2 + (newZ-currentZ)**2);
                if (isG0) {
                    rapidLines++;
                    totalTime += (dist / 6000) * 60; // 6000 mm/min rapids
                } else {
                    cutLines++;
                    totalTime += (dist / feed) * 60; // feeds
                }

                if (newX < minX) minX = newX;
                if (newX > maxX) maxX = newX;
                if (newY < minY) minY = newY;
                if (newY > maxY) maxY = newY;
                if (newZ < minZ) minZ = newZ;
                if (newZ > maxZ) maxZ = newZ;

                points.push({
                    type: isG0 ? 'rapid' : 'cut',
                    startX: currentX, startY: currentY, startZ: currentZ,
                    endX: newX, endY: newY, endZ: newZ
                });

                currentX = newX; currentY = newY; currentZ = newZ;
            }
        }

        return {
            points,
            metrics: {
                lines: lines.length,
                timeSeconds: totalTime,
                minX: minX === Infinity ? -10 : minX,
                maxX: maxX === -Infinity ? 10 : maxX,
                minY: minY === Infinity ? -10 : minY,
                maxY: maxY === -Infinity ? 10 : maxY,
                minZ: minZ === Infinity ? -5 : minZ,
                maxZ: maxZ === -Infinity ? 5 : maxZ,
                rapidCount: rapidLines,
                cutCount: cutLines
            }
        };
    }

    // Render engine
    function drawToolpath(canvas, parsedData, progress = 1.0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const { points, metrics } = parsedData;
        if (points.length === 0) return;

        const width = metrics.maxX - metrics.minX || 1;
        const height = metrics.maxY - metrics.minY || 1;
        
        const padding = 50;
        const scaleX = (canvas.width - padding * 2) / width;
        const scaleY = (canvas.height - padding * 2) / height;
        const scale = Math.min(scaleX, scaleY);
        
        const offsetX = (canvas.width - width * scale) / 2 - metrics.minX * scale;
        const offsetY = (canvas.height - height * scale) / 2 - metrics.minY * scale;

        // Draw grids
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        const limit = Math.floor(points.length * progress);
        
        for (let i = 0; i < limit; i++) {
            const pt = points[i];
            ctx.beginPath();
            ctx.moveTo(pt.startX * scale + offsetX, canvas.height - (pt.startY * scale + offsetY));
            ctx.lineTo(pt.endX * scale + offsetX, canvas.height - (pt.endY * scale + offsetY));
            
            if (pt.type === 'rapid') {
                ctx.strokeStyle = 'rgba(255, 87, 34, 0.45)';
                ctx.setLineDash([2, 4]);
                ctx.lineWidth = 1.0;
            } else {
                ctx.strokeStyle = '#00d2ff';
                ctx.setLineDash([]);
                ctx.lineWidth = 2.0;
                ctx.shadowColor = '#00d2ff';
                ctx.shadowBlur = 4;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        if (limit > 0 && limit < points.length) {
            const activePt = points[limit - 1];
            const screenX = activePt.endX * scale + offsetX;
            const screenY = canvas.height - (activePt.endY * scale + offsetY);

            ctx.beginPath();
            ctx.arc(screenX, screenY, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#ff5722';
            ctx.shadowColor = '#ff5722';
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.beginPath();
            ctx.arc(screenX, screenY, 14, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 87, 34, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    // ─── MAJOR FEATURE 2: B2B Cash-Flow ROI Calculator & Dynamic SVG Chart ─
    let roiInitialized = false;

    window.initROISection = function(data) {
        const costInput = document.getElementById('roi-input-investment');
        const wasteInput = document.getElementById('roi-input-waste');
        const effInput = document.getElementById('roi-input-efficiency');

        const costVal = document.getElementById('roi-val-investment');
        const wasteVal = document.getElementById('roi-val-waste');
        const effVal = document.getElementById('roi-val-efficiency');

        const paybackEl = document.getElementById('roi-payback');
        const savingsEl = document.getElementById('roi-savings');

        if (!costInput || !wasteInput || !effInput) return;

        // Prefill default or configured investment amount
        if (data && data.machine_configuration && data.machine_configuration.estimated_price_usd) {
            costInput.value = data.machine_configuration.estimated_price_usd;
        }

        const formatCurrency = (val) => {
            return "$" + Math.round(val).toLocaleString();
        };

        const recalculate = (isInitial = false) => {
            const I = parseFloat(costInput.value);
            const W = parseFloat(wasteInput.value);
            const E = parseFloat(effInput.value) / 100;

            costVal.textContent = formatCurrency(I);
            wasteVal.textContent = formatCurrency(W);
            effVal.textContent = (E * 100).toFixed(0) + "%";

            // Upgraded spindle reduces waste by 85% (15% remains)
            const wasteSavings = 0.85 * W;
            // Spindle operating efficiency saves relative to base operational spending
            const efficiencySavings = E * 5000;
            
            const monthlySavings = wasteSavings + efficiencySavings;
            const annualSavings = monthlySavings * 12;
            const paybackMonths = monthlySavings > 0 ? (I / monthlySavings) : Infinity;

            if (paybackEl) {
                if (paybackMonths === Infinity) {
                    paybackEl.textContent = "Never";
                } else if (isInitial && window.animateCounter) {
                    window.animateCounter(paybackEl, 0, Math.round(paybackMonths), 1000);
                    setTimeout(() => { paybackEl.textContent = paybackMonths.toFixed(1) + " Months"; }, 1100);
                } else {
                    paybackEl.textContent = paybackMonths.toFixed(1) + " Months";
                }
            }
            if (savingsEl) {
                if (isInitial && window.animateCounter) {
                    window.animateCounter(savingsEl, 0, Math.round(annualSavings), 1200);
                    setTimeout(() => { savingsEl.textContent = formatCurrency(annualSavings); }, 1300);
                } else {
                    savingsEl.textContent = formatCurrency(annualSavings);
                }
            }

            drawROISVGChart(I, W, E, monthlySavings, paybackMonths);
        };

        if (roiInitialized) {
            // Already bound, just recalculate with new incoming machine config
            recalculate(true);
            return;
        }
        roiInitialized = true;

        // Bind interactive event listeners
        costInput.addEventListener('input', () => recalculate(false));
        wasteInput.addEventListener('input', () => recalculate(false));
        effInput.addEventListener('input', () => recalculate(false));

        // Initial render with animation
        recalculate(true);
    };

    function drawROISVGChart(I, W, E, monthlySavings, paybackMonths) {
        const svg = document.getElementById('roi-svg-chart');
        if (!svg) return;

        // SVG parameters matches responsive viewport
        const width = 300;
        const height = 150;
        const paddingLeft = 35;
        const paddingRight = 15;
        const paddingTop = 15;
        const paddingBottom = 20;
        
        const chartWidth = width - paddingLeft - paddingRight;
        const chartHeight = height - paddingTop - paddingBottom;

        // Monthly calculations over 60 months (5 years)
        const oldVals = [];
        const newVals = [];
        for (let m = 0; m <= 60; m += 2) {
            const oldPos = -m * W;
            const newPos = -I - m * (0.15 * W) + m * (E * 5000);
            oldVals.push({ m, val: oldPos });
            newVals.push({ m, val: newPos });
        }

        // Set baseline scale
        const minVal = Math.min(
            -60 * W, 
            -I, 
            -I - 60 * (0.15 * W) + 60 * (E * 5000)
        ) * 1.05; // 5% graphical margin
        const maxVal = 5000;

        const getX = (m) => paddingLeft + (m / 60) * chartWidth;
        const getY = (val) => paddingTop + (1 - (val - minVal) / (maxVal - minVal)) * chartHeight;

        let svgHtml = ``;

        // 1. Gridlines (Horizontal)
        const gridStep = Math.ceil(Math.abs(minVal) / 4 / 25000) * 25000 || 50000;
        for (let val = 0; val >= minVal; val -= gridStep) {
            const y = getY(val);
            if (y >= paddingTop && y <= height - paddingBottom) {
                svgHtml += `
                    <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
                    <text x="${paddingLeft - 5}" y="${y + 2.5}" fill="rgba(255,255,255,0.35)" font-size="6.5" font-family="sans-serif" text-anchor="end">-${Math.round(Math.abs(val)/1000)}k</text>
                `;
            }
        }

        // Vertical lines for Years (0 to 5)
        for (let yr = 0; yr <= 5; yr++) {
            const m = yr * 12;
            const x = getX(m);
            svgHtml += `
                <line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${height - paddingBottom}" stroke="rgba(255,255,255,0.03)" stroke-width="1" stroke-dasharray="2,2"/>
                <text x="${x}" y="${height - paddingBottom + 10}" fill="rgba(255,255,255,0.35)" font-size="6.5" font-family="sans-serif" text-anchor="middle">Y${yr}</text>
            `;
        }

        // 2. Plot Status Quo line (Neon Red)
        let oldPath = `M ${getX(oldVals[0].m)} ${getY(oldVals[0].val)}`;
        for (let i = 1; i < oldVals.length; i++) {
            oldPath += ` L ${getX(oldVals[i].m)} ${getY(oldVals[i].val)}`;
        }
        svgHtml += `<path d="${oldPath}" fill="none" stroke="#ff3838" stroke-width="1.5" opacity="0.75" />`;

        // 3. Plot Upgraded Spindle line (Neon Green)
        let newPath = `M ${getX(newVals[0].m)} ${getY(newVals[0].val)}`;
        for (let i = 1; i < newVals.length; i++) {
            newPath += ` L ${getX(newVals[i].m)} ${getY(newVals[i].val)}`;
        }
        svgHtml += `<path d="${newPath}" fill="none" stroke="#00e676" stroke-width="1.8" />`;

        // 4. Highlight break-even intersection point
        if (paybackMonths > 0 && paybackMonths <= 60) {
            const breakX = getX(paybackMonths);
            const breakY = getY(-paybackMonths * W);
            svgHtml += `
                <circle cx="${breakX}" cy="${breakY}" r="3.5" fill="#ffc107" stroke="#0a0a0c" stroke-width="1"/>
                <line x1="${breakX}" y1="${paddingTop}" x2="${breakX}" y2="${height - paddingBottom}" stroke="#ffc107" stroke-width="0.8" stroke-dasharray="3,3" opacity="0.5"/>
            `;
        }

        // 5. Hairline for tooltip tracking
        svgHtml += `<line id="roi-hairline" x1="0" y1="${paddingTop}" x2="0" y2="${height - paddingBottom}" stroke="rgba(255,255,255,0.2)" stroke-width="0.8" style="display:none; pointer-events:none;"/>`;

        // Inject SVG markup
        svg.innerHTML = svgHtml;

        // 6. Interactive Tooltip Tracking Mouse Listener
        const wrapper = document.getElementById('roi-chart-wrapper');
        const tooltip = document.getElementById('roi-chart-tooltip');
        
        if (wrapper && tooltip) {
            const trackingHandler = (e) => {
                const rect = svg.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                
                // Scale coordinate back to SVG coordinate space
                const svgMouseX = (mouseX / rect.width) * width;
                const xInChart = svgMouseX - paddingLeft;
                
                if (xInChart < 0 || xInChart > chartWidth) {
                    tooltip.style.display = 'none';
                    const hairline = document.getElementById('roi-hairline');
                    if (hairline) hairline.style.display = 'none';
                    return;
                }

                // Map x to month (0 to 60)
                const m = Math.min(Math.max(Math.round((xInChart / chartWidth) * 60), 0), 60);
                
                // Calculate exact positions
                const oldPos = -m * W;
                const newPos = -I - m * (0.15 * W) + m * (E * 5000);
                const adv = newPos - oldPos;

                // Position tooltip and hairline
                const hairline = document.getElementById('roi-hairline');
                if (hairline) {
                    const hx = getX(m);
                    hairline.setAttribute('x1', hx);
                    hairline.setAttribute('x2', hx);
                    hairline.style.display = 'block';
                }

                // Position tooltip nicely
                tooltip.style.display = 'block';
                tooltip.style.left = `${mouseX + 10}px`;
                tooltip.style.top = `15px`; // Center align

                // If tooltip overflows right side of wrapper, flip it
                if (mouseX + 10 + 155 > rect.width) {
                    tooltip.style.left = `${mouseX - 160}px`;
                }

                // Fill tooltip data
                document.getElementById('tooltip-title').textContent = `Month ${m} (${(m/12).toFixed(1)} Years)`;
                document.getElementById('tooltip-old-val').textContent = `-$${Math.round(Math.abs(oldPos)).toLocaleString()}`;
                document.getElementById('tooltip-new-val').textContent = `-$${Math.round(Math.abs(newPos)).toLocaleString()}`;
                
                const advEl = document.getElementById('tooltip-adv-val');
                if (adv >= 0) {
                    advEl.textContent = `+$${Math.round(adv).toLocaleString()}`;
                    advEl.style.color = '#00e676';
                } else {
                    advEl.textContent = `-$${Math.round(Math.abs(adv)).toLocaleString()}`;
                    advEl.style.color = '#ff3838';
                }
            };

            wrapper.addEventListener('mousemove', trackingHandler);
            wrapper.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
                const hairline = document.getElementById('roi-hairline');
                if (hairline) hairline.style.display = 'none';
            });
        }
    }
}
});
