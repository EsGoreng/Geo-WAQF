class SPAController {
    constructor() {
        this.contentArea = document.getElementById('content-area');
        this.pageTitle = document.getElementById('page-title'); // Target judul header
        this.navLinks = document.querySelectorAll('.nav-link');
        this.currentPage = null;
        this.cache = new Map();
        
        this.init();
    }
    
    init() {
        // Load halaman awal
        const initialLink = document.querySelector('.nav-link.active');
        const initialPage = initialLink?.getAttribute('data-page') || 'page_home.html';
        
        // Set judul awal
        if (initialLink) {
            this.updateActiveLink(initialLink, false); // Update link tanpa push state
        }
        
        this.loadPage(initialPage, false);
        
        // Setup event listeners untuk navigasi
        this.setupNavigation();
        
        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) {
                const newLink = document.querySelector(`.nav-link[data-page="${e.state.page}"]`);
                if (newLink) {
                    this.updateActiveLink(newLink, false);
                }
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
                    // Update active state dan judul
                    this.updateActiveLink(link, true);
                    
                    // Load page
                    this.loadPage(page, true);
                }
            });
        });
    }
    
    updateActiveLink(activeLink, pushState = true) {
        // Update status 'active' di sidebar
        this.navLinks.forEach(link => link.classList.remove('active'));
        activeLink.classList.add('active');
        
        // Update judul di header
        const title = activeLink.querySelector('span:last-child').innerText;
        if (this.pageTitle) {
            this.pageTitle.innerText = title;
        }

        // Update browser history (jika bukan dari popstate)
        if (pushState) {
            const pageUrl = activeLink.getAttribute('data-page');
            history.pushState({ page: pageUrl }, title, `#${pageUrl.replace('.html', '')}`);
        }
    }
    
    async loadPage(pageUrl, pushState = true) {
        try {
            // Show loading
            this.showLoading();
            
            let html;
            if (this.cache.has(pageUrl)) {
                html = this.cache.get(pageUrl);
            } else {
                const response = await fetch(pageUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                html = await response.text();
                this.cache.set(pageUrl, html);
            }
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Ekstrak konten <main> dari file fragmen
            const mainContent = doc.querySelector('main');
            
            if (mainContent) {
                this.contentArea.innerHTML = mainContent.innerHTML;
            } else {
                // Fallback jika tidak ada tag <main>
                this.contentArea.innerHTML = doc.body.innerHTML;
                console.warn(`Page ${pageUrl} doesn't have a <main> tag.`);
            }
            
            this.currentPage = pageUrl;
            
            // Inisialisasi skrip spesifik halaman jika ada
            this.initPageScripts();
            
            // Sembunyikan loading setelah konten dimuat
            this.hideLoading();
            
        } catch (error) {
            console.error('Failed to load page:', error);
            this.showError(error.message);
        }
    }
    
    showLoading() {
        this.contentArea.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Memuat...</p>
            </div>
        `;
    }
    
    hideLoading() {
        // Konten baru akan otomatis menggantikan spinner
        // Fungsi ini bisa dikosongkan jika 'showLoading' menggantikan innerHTML
    }
    
    showError(message) {
        this.contentArea.innerHTML = `
            <div class="p-6 md:p-8 text-center">
                <div class="text-red-500 mb-4">
                    <span class="material-symbols-outlined" style="font-size: 48px;">error</span>
                </div>
                <h2 class="text-xl font-semibold text-text-primary mb-2">Gagal Memuat Halaman</h2>
                <p class="text-text-secondary mb-6">${message}</p>
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
        // Tempat untuk inisialisasi chart, map, dll. setelah halaman dimuat
    }
    
    handleAction(action) {
        console.log('Action triggered:', action);
    }
    
    clearCache() {
        this.cache.clear();
        console.log('Page cache cleared');
    }
}

// Inisialisasi SPA ketika DOM siap
document.addEventListener('DOMContentLoaded', () => {
    window.spaController = new SPAController();
});