(function() {
    // ─── Mobile Navbar Menu Toggle ───────────────────────────────────────
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            const icon = navToggle.querySelector('i');
            if (icon) {
                if (icon.classList.contains('fa-bars')) {
                    icon.classList.remove('fa-bars');
                    icon.classList.add('fa-xmark');
                } else {
                    icon.classList.remove('fa-xmark');
                    icon.classList.add('fa-bars');
                }
            }
        });
    }

    // ─── Dynamic Global Footer Address Update ───────────────────────────
    const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8000' : 'https://rs-enterprise-api.onrender.com';
    async function updateGlobalFooter() {
        try {
            const res = await fetch(`${API}/api/public/settings`);
            const data = await res.json();
            if (data.status === 'success' && data.settings && data.settings.physical_address) {
                const footerParagraph = document.querySelector('footer p');
                if (footerParagraph) {
                    footerParagraph.innerHTML = `&copy; 2026 RS Enterprise. All Rights Reserved. ${data.settings.physical_address}`;
                }
            }
        } catch (err) {
            console.error("Failed to load global footer details", err);
        }
    }
    updateGlobalFooter();

    // ─── FEATURE 1: Premium Toast Notification Engine ───────────────────
    const toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);

    window.showToast = function(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast-card toast-${type}`;
        
        let iconClass = 'fa-circle-check';
        if (type === 'info') iconClass = 'fa-circle-info';
        if (type === 'warning') iconClass = 'fa-triangle-exclamation';

        toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${message}</span>`;
        toastContainer.appendChild(toast);

        // Slide-in animation trigger
        setTimeout(() => toast.classList.add('show'), 50);

        // Remove after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    };

    // ─── FEATURE 2: Back to Top Floating Button ─────────────────────────
    const backToTopBtn = document.createElement('button');
    backToTopBtn.className = 'back-to-top-btn';
    backToTopBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
    backToTopBtn.setAttribute('title', 'Scroll to Top');
    document.body.appendChild(backToTopBtn);

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('show');
        } else {
            backToTopBtn.classList.remove('show');
        }
    });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // ─── FEATURE 3: Interactive B2B Copy-to-Clipboard Event Delegation ──
    // Annotate copy elements dynamically
    const phoneFooterNode = document.querySelector('footer, .footer-container');
    if (phoneFooterNode) {
        // Tag phone/email instances with trigger attributes for visual copywriting mouse indicators
        const mailNodes = document.querySelectorAll('a[href^="mailto:"], a[href^="tel:"]');
        mailNodes.forEach(node => node.setAttribute('data-copy-trigger', 'true'));
    }

    document.body.addEventListener('click', (e) => {
        const copyTarget = e.target.closest('[data-copy-trigger]');
        if (copyTarget) {
            // Prevent link execution if preferred, but for phone/email let's just trigger copy toast beautifully
            const href = copyTarget.getAttribute('href');
            if (href) {
                const cleanedInfo = href.replace(/(mailto:|tel:)/g, '');
                navigator.clipboard.writeText(cleanedInfo).then(() => {
                    window.showToast(`Copied to Clipboard: "${cleanedInfo}"`, 'info');
                });
            }
        }
    });

    // ─── FEATURE 4: Mobile Tap Haptic Vibrations ─────────────────────────
    const triggerHaptic = () => {
        if (navigator.vibrate) navigator.vibrate(12);
    };

    const interactiveSelectors = 'a, button, .axis-toggle, .industry-card, .btn-logout-bar, .admin-tab';
    document.body.addEventListener('click', (e) => {
        if (e.target.closest(interactiveSelectors)) {
            triggerHaptic();
        }
    });

    // ─── FEATURE 5: Form Submission Interceptors with Toast Feedback ─────
    document.body.addEventListener('submit', (e) => {
        const formId = e.target.id;
        if (formId === 'machine-form') {
            window.showToast("Catalog machine data successfully saved!", 'success');
        } else if (formId === 'system-config-form') {
            window.showToast("System configurations saved!", 'success');
        }
    });

    // ─── FEATURE 6: Counter values increment animations (Telemetry/ROI) ─
    window.animateCounter = function(element, start, end, duration) {
        if (!element) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const value = Math.floor(progress * (end - start) + start);
            element.textContent = value.toLocaleString();
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                element.textContent = end.toLocaleString();
            }
        };
        window.requestAnimationFrame(step);
    };
})();
