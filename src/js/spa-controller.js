// Tambahkan 'export' di depan class
export class SPAController {
    constructor() {
        this.contentArea = document.getElementById('content-area');
        this.pageTitle = document.getElementById('page-title');
        this.navLinks = document.querySelectorAll('.nav-link');
        this.currentPage = null;
        this.cache = new Map();

        this.init();
    }

    init() {
        const initialLink = document.querySelector('.nav-link.active');
        const initialPage = initialLink?.getAttribute('data-page') || 'page_home.html';

        if (initialLink) {
            this.updateActiveLink(initialLink, false);
        }

        this.loadPage(initialPage, false);

        this.setupNavigation();

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
        // Ambil elemen sidebar dan overlay
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebar-overlay');

        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                const page = link.getAttribute('data-page');
                if (page && page !== this.currentPage) {
                    this.updateActiveLink(link, true);
                    this.loadPage(page, true);

                    // --- MODIFIKASI DI SINI ---
                    // Cek jika kita di layar mobile (lebar < 768px)
                    if (sidebar && sidebarOverlay && window.innerWidth < 768) { 
                        // Tutup sidebar secara otomatis setelah klik link
                        sidebar.classList.add('-translate-x-full');
                        sidebarOverlay.classList.add('hidden');
                    }
                    // --- AKHIR MODIFIKASI ---
                }
            });
        });
    }

    updateActiveLink(activeLink, pushState = true) {
        this.navLinks.forEach(link => link.classList.remove('active'));
        activeLink.classList.add('active');

        // Gunakan querySelector yang lebih aman untuk span
        const titleSpan = activeLink.querySelector('span:not(.material-symbols-outlined)');
        const title = titleSpan ? titleSpan.innerText : 'Dasbor';

        if (this.pageTitle) {
            this.pageTitle.innerText = title;
        }

        if (pushState) {
            const pageUrl = activeLink.getAttribute('data-page');
            history.pushState({ page: pageUrl }, title, `#${pageUrl.replace('.html', '')}`);
        }
    }

    async loadPage(pageUrl, pushState = true) {
        try {
            this.showLoading();

            // *** PERUBAHAN UTAMA DI SINI ***
            // Tambahkan path ke folder 'pages'
            const fetchUrl = `src/pages/${pageUrl}`; 

            let html;
            if (this.cache.has(fetchUrl)) {
                html = this.cache.get(fetchUrl);
            } else {
                // Gunakan URL yang sudah dimodifikasi
                const response = await fetch(fetchUrl); 
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                html = await response.text();
                this.cache.set(fetchUrl, html);
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const mainContent = doc.querySelector('main');

            if (mainContent) {
                this.contentArea.innerHTML = mainContent.innerHTML;
            } else {
                this.contentArea.innerHTML = doc.body.innerHTML;
                console.warn(`Page ${pageUrl} doesn't have a <main> tag.`);
            }

            this.currentPage = pageUrl;

            this.initPageScripts();
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
        // (Tidak perlu, konten baru otomatis menggantikan)
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
        // Tempat untuk inisialisasi chart, map, dll.
    }
}