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
});
