// SPA Controller untuk Geo-WAQF Dashboard
class SPAController {
    constructor() {
        this.contentArea = document.getElementById('content-area');
        this.navLinks = document.querySelectorAll('.nav-link');
        this.currentPage = null;
        this.cache = new Map();
        
        this.init();
    }
    
    init() {
        // Load halaman awal
        const initialLink = document.querySelector('.nav-link.active');
        const initialPage = initialLink?.getAttribute('data-page') || 'page_home.html';
        this.loadPage(initialPage);
        
        // Setup event listeners untuk navigasi
        this.setupNavigation();
        
        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) {
                this.loadPage(e.state.page, false);
            }
        });
    }
    
    setupNavigation() {
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                const page = link.getAttribute('data-page');
                if (page && page !== this.currentPage) {
                    // Update active state
                    this.updateActiveLink(link);
                    
                    // Load page
                    this.loadPage(page, true);
                }
            });
        });
    }
    
    updateActiveLink(activeLink) {
        this.navLinks.forEach(link => link.classList.remove('active'));
        activeLink.classList.add('active');
    }
    
    async loadPage(pageUrl, pushState = true) {
        try {
            // Show loading
            this.showLoading();
            
            // Check cache first
            let html;
            if (this.cache.has(pageUrl)) {
                html = this.cache.get(pageUrl);
            } else {
                // Fetch page
                const response = await fetch(pageUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                html = await response.text();
                // Cache the result
                this.cache.set(pageUrl, html);
            }
            
            // Parse HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Extract main content
            const mainContent = doc.querySelector('main');
            
            if (mainContent) {
                this.contentArea.innerHTML = mainContent.innerHTML;
            } else {
                // Fallback: load entire body if no main tag
                this.contentArea.innerHTML = doc.body.innerHTML;
                console.warn(`Page ${pageUrl} doesn't have a <main> tag. Loading entire body.`);
            }
            
            // Update browser history
            if (pushState) {
                history.pushState({ page: pageUrl }, '', `#${pageUrl.replace('.html', '')}`);
            }
            
            // Update current page
            this.currentPage = pageUrl;
            
            // Re-initialize any scripts needed for the loaded page
            this.initPageScripts();
            
            // Hide loading
            this.hideLoading();
            
        } catch (error) {
            console.error('Failed to load page:', error);
            this.showError(error.message);
        }
    }
    
    showLoading() {
        const spinner = this.contentArea.querySelector('.loading-spinner');
        if (spinner) {
            spinner.classList.remove('hidden');
        } else {
            this.contentArea.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>Memuat...</p>
                </div>
            `;
        }
    }
    
    hideLoading() {
        const spinner = this.contentArea.querySelector('.loading-spinner');
        if (spinner) {
            spinner.classList.add('hidden');
            setTimeout(() => spinner.remove(), 300);
        }
    }
    
    showError(message) {
        this.contentArea.innerHTML = `
            <div style="padding: 2rem; text-align: center;">
                <div style="color: #ef4444; font-size: 3rem; margin-bottom: 1rem;">
                    <span class="material-symbols-outlined" style="font-size: 3rem;">error</span>
                </div>
                <h2 style="color: var(--text-primary); margin-bottom: 0.5rem;">Gagal Memuat Halaman</h2>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">${message}</p>
                <button onclick="location.reload()" 
                        style="background-color: var(--accent); color: var(--bg-dark); 
                               padding: 0.75rem 1.5rem; border-radius: 0.5rem; 
                               border: none; cursor: pointer; font-weight: 600;">
                    Muat Ulang
                </button>
            </div>
        `;
    }
    
    initPageScripts() {
        // Initialize any interactive elements in the loaded page
        // For example: charts, maps, form handlers, etc.
        
        // Example: Re-attach event listeners for dynamic content
        const buttons = this.contentArea.querySelectorAll('button[data-action]');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.getAttribute('data-action');
                this.handleAction(action);
            });
        });
    }
    
    handleAction(action) {
        // Handle custom actions from loaded pages
        console.log('Action triggered:', action);
        // Add your custom action handlers here
    }
    
    clearCache() {
        this.cache.clear();
        console.log('Page cache cleared');
    }
}

// Initialize SPA when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.spaController = new SPAController();
});

// Utility function to get query parameters
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Utility function for smooth scroll
function smoothScrollTo(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
}