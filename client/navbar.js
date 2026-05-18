document.addEventListener('DOMContentLoaded', () => {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            // Toggle icon classes
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

    // Dynamic Global Footer Address Update from System Configuration API
    const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8000' : 'https://rs-enterprise-api.onrender.com';
    async function updateGlobalFooter() {
        try {
            const res = await fetch(`${API}/api/public/settings`);
            const data = await res.json();
            if (data.status === 'success' && data.settings && data.settings.physical_address) {
                const footerParagraph = document.querySelector('.glass-footer p');
                if (footerParagraph) {
                    footerParagraph.innerHTML = `&copy; 2026 RS Enterprise. All Rights Reserved. ${data.settings.physical_address}`;
                }
            }
        } catch (err) {
            console.error("Failed to load global footer details", err);
        }
    }
    updateGlobalFooter();
});
