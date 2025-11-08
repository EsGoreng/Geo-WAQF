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
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebar-overlay');

        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                const page = link.getAttribute('data-page');
                if (page && page !== this.currentPage) {
                    this.updateActiveLink(link, true);
                    this.loadPage(page, true);

                    if (sidebar && sidebarOverlay && window.innerWidth < 768) { 
                        sidebar.classList.add('-translate-x-full');
                        sidebarOverlay.classList.add('hidden');
                    }
                }
            });
        });
    }

    updateActiveLink(activeLink, pushState = true) {
        this.navLinks.forEach(link => link.classList.remove('active'));
        activeLink.classList.add('active');

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

            const fetchUrl = `src/pages/${pageUrl}`; 

            let html;
            if (this.cache.has(fetchUrl)) {
                html = this.cache.get(fetchUrl);
            } else {
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

            // --- PERUBAHAN UTAMA DI SINI ---
            // Setelah konten halaman utama dimuat,
            // panggil fungsi baru untuk memuat sub-komponen
            await this.loadSubComponents(this.contentArea);
            // --- AKHIR PERUBAHAN ---

            this.currentPage = pageUrl;

            this.initPageScripts();
            this.hideLoading();

        } catch (error) {
            console.error('Failed to load page:', error);
            this.showError(error.message);
        }
    }

    async loadSubComponents(container) {
        const placeholders = container.querySelectorAll('[data-component-src]');
        if (placeholders.length === 0) return;

        const fetchPromises = [];

        placeholders.forEach(placeholder => {
            let src = placeholder.getAttribute('data-component-src');
            placeholder.removeAttribute('data-component-src');

            // 1. Ambil "Props" dari atribut data-
            const props = {
                mapTitle: placeholder.getAttribute('data-map-title'),
                showSearch: placeholder.getAttribute('data-show-search') === 'true',
                
                // --- PROPS BARU UNTUK LANGKAH 4 ---
                legendSrc: placeholder.getAttribute('data-legend-src'),
                showZoom: placeholder.getAttribute('data-show-zoom') === 'true',
                showNav: placeholder.getAttribute('data-show-nav') === 'true'
            };

            // --- LOGIKA BARU UNTUK LANGKAH 4 ---
            // Cek apakah 'src' adalah placeholder (seperti {{LEGEND_SRC}})
            if (src === '{{LEGEND_SRC}}' && props.legendSrc) {
                src = props.legendSrc; // Ganti dengan nilai prop
            }
            // Jika tidak ada 'src' dinamis (misal, legenda tidak diset), jangan fetch
            else if (src === '{{LEGEND_SRC}}') {
                src = null;
            }
            // --- AKHIR LOGIKA BARU ---


            if (src) {
                const promise = fetch(src)
                    .then(response => {
                        if (!response.ok) throw new Error(`Gagal memuat: ${src}`);
                        return response.text();
                    })
                    .then(html => {
                        
                        let processedHtml = html;
                        
                        // 2. Proses "Props" (Penggantian Variabel)
                        if (props.mapTitle) {
                            processedHtml = processedHtml.replace(/{{MAP_TITLE}}/g, props.mapTitle);
                        }
                        
                        // Ganti {{LEGEND_SRC}} jika kebetulan ada di dalam HTML yang dimuat
                        if (props.legendSrc) {
                            processedHtml = processedHtml.replace(/{{LEGEND_SRC}}/g, props.legendSrc);
                        }

                        // 3. Proses "Props" (Logika Kondisional)
                        
                        // Handle Search
                        processedHtml = this.processConditional(processedHtml, 'IF_SHOW_SEARCH', props.showSearch);
                        
                        // --- LOGIKA BARU UNTUK LANGKAH 4 ---
                        // Handle Zoom
                        processedHtml = this.processConditional(processedHtml, 'IF_SHOW_ZOOM', props.showZoom);
                        
                        // Handle Nav
                        processedHtml = this.processConditional(processedHtml, 'IF_SHOW_NAV', props.showNav);
                        // --- AKHIR LOGIKA BARU ---


                        // 4. Masukkan HTML yang sudah diproses
                        placeholder.innerHTML = processedHtml;
                        
                        return this.loadSubComponents(placeholder); 
                    })
                    .catch(error => {
                        console.error(error);
                        placeholder.innerHTML = `<p class="text-red-400 p-4">Error: ${error.message}</p>`;
                    });
                fetchPromises.push(promise);
            }
        });

        await Promise.all(fetchPromises);
    }

    /**
     * --- FUNGSI HELPER BARU ---
     * Pindahkan logika IF/END_IF ke fungsi terpisah agar bersih.
     * Tempatkan ini di dalam class SPAController, setelah loadSubComponents.
     */
    processConditional(html, tag, condition) {
        const startTag = `{{${tag}}}`;
        const endTag = `{{END_${tag}}}`;
        const regex = new RegExp(`${startTag}[\\s\\S]*?${endTag}`, 'g');

        if (condition) {
            // Hapus tag, biarkan kontennya
            return html.replace(new RegExp(`${startTag}|${endTag}`, 'g'), '');
        } else {
            // Hapus tag DAN semua yang ada di antaranya
            return html.replace(regex, '');
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
        // Fungsi ini bisa dikosongkan karena 'showLoading' 
        // otomatis diganti oleh konten baru.
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