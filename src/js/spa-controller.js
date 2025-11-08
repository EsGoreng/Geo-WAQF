// Konten BARU (YANG DIPERBAIKI) untuk: src/js/spa-controller.js

export class SPAController {
    constructor() {
        this.contentArea = document.getElementById('content-area');
        this.pageTitle = document.getElementById('page-title');
        this.navLinks = document.querySelectorAll('.nav-link');
        this.currentPage = null;
        this.cache = new Map();
        
        // Properti Peta & Layer
        this.myMap = null; 
        
        // =================================
        // TAMBAHAN BARU (LANGKAH 6.2)
        // =================================
        this.layerControl = null; // Untuk menyimpan objek tombol toggle
        this.layer2019 = null;    // Untuk menyimpan layer NDVI 2019
        this.layer2024 = null;    // Untuk menyimpan layer NDVI 2024
        // =================================
        // AKHIR TAMBAHAN BARU
        // =================================

        this.init();
    }

    init() {
        // ... (Fungsi init() Anda tidak berubah) ...
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
        // ... (Fungsi setupNavigation() Anda tidak berubah) ...
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
        // ... (Fungsi updateActiveLink() Anda tidak berubah) ...
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
            // =================================
            // PERUBAHAN BARU (LANGKAH 6.2)
            // =================================
            // Hancurkan instance peta, kontrol, dan layer lama
            if (this.layerControl) {
                this.layerControl.remove();
                this.layerControl = null;
            }
            if (this.layer2019) {
                this.layer2019.remove();
                this.layer2019 = null;
            }
             if (this.layer2024) {
                this.layer2024.remove();
                this.layer2024 = null;
            }
            if (this.myMap) {
                this.myMap.remove();
                this.myMap = null;
            }
            // =================================
            // AKHIR PERUBAHAN BARU
            // =================================

            this.showLoading();

            // ... (Kode sisa loadPage() Anda tidak berubah) ...
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
            await this.loadSubComponents(this.contentArea);
            this.currentPage = pageUrl;
            this.initPageScripts();
            this.hideLoading();

        } catch (error) {
            console.error('Failed to load page:', error);
            this.showError(error.message);
        }
    }

    async loadSubComponents(container) {
        // ... (Fungsi loadSubComponents() Anda tidak berubah) ...
        const placeholders = container.querySelectorAll('[data-component-src]');
        if (placeholders.length === 0) return;
        const fetchPromises = [];
        placeholders.forEach(placeholder => {
            let src = placeholder.getAttribute('data-component-src');
            placeholder.removeAttribute('data-component-src');
            const props = {
                mapTitle: placeholder.getAttribute('data-map-title'),
                showSearch: placeholder.getAttribute('data-show-search') === 'true',
                legendSrc: placeholder.getAttribute('data-legend-src'),
                showZoom: placeholder.getAttribute('data-show-zoom') === 'true',
                showNav: placeholder.getAttribute('data-show-nav') === 'true'
            };
            if (src === '{{LEGEND_SRC}}' && props.legendSrc) {
                src = props.legendSrc;
            } else if (src === '{{LEGEND_SRC}}') {
                src = null;
            }
            if (src) {
                const promise = fetch(src)
                    .then(response => {
                        if (!response.ok) throw new Error(`Gagal memuat: ${src}`);
                        return response.text();
                    })
                    .then(html => {
                        let processedHtml = html;
                        if (props.mapTitle) {
                            processedHtml = processedHtml.replace(/{{MAP_TITLE}}/g, props.mapTitle);
                        }
                        if (props.legendSrc) {
                            processedHtml = processedHtml.replace(/{{LEGEND_SRC}}/g, props.legendSrc);
                        }
                        processedHtml = this.processConditional(processedHtml, 'IF_SHOW_SEARCH', props.showSearch);
                        processedHtml = this.processConditional(processedHtml, 'IF_SHOW_ZOOM', props.showZoom);
                        processedHtml = this.processConditional(processedHtml, 'IF_SHOW_NAV', props.showNav);
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

    processConditional(html, tag, condition) {
        // ... (Fungsi processConditional() Anda tidak berubah) ...
        const startTag = `{{${tag}}}`;
        const endTag = `{{END_${tag}}}`;
        const regex = new RegExp(`${startTag}[\\s\\S]*?${endTag}`, 'g');
        if (condition) {
            return html.replace(new RegExp(`${startTag}|${endTag}`, 'g'), '');
        } else {
            return html.replace(regex, '');
        }
    }

    showLoading() { /* ... */ }
    hideLoading() { /* ... */ }
    showError(message) { /* ... (Kode error Anda) ... */ }
    

    initPageScripts() {
        this.initializeMap();
    }

    // =================================
    // PERUBAHAN BARU (LANGKAH 6.2)
    // =================================
    initializeMap() {
        const mapElement = document.getElementById('map-canvas');
        if (!mapElement) {
            return; 
        }

        try {
            console.log("Inisialisasi Peta Leaflet...");
            this.myMap = L.map('map-canvas').setView([-2.5489, 118.0149], 5); 

            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https.www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                maxZoom: 19
            }).addTo(this.myMap);

            // Buat grup 'base layers' kosong (kita akan isi nanti)
            const baseLayers = {};
            
            // Buat 'layer control' (tombol toggle) dan tambahkan ke peta
            this.layerControl = L.control.layers(baseLayers, null, {
                position: 'topright',
                collapsed: false // Buat tidak tersembunyi
            }).addTo(this.myMap);
            
            // Panggil fungsi untuk memuat layer GEE
            this.loadGeeLayer();

        } catch (error) {
            console.error("Gagal menginisialisasi Leaflet:", error);
            mapElement.innerHTML = "<p class='text-red-400 p-4'>Gagal memuat peta. Apakah Leaflet.js sudah dimuat?</p>";
        }
    }

    /**
     * --- FUNGSI YANG DIPERBARUI (LANGKAH 6.2) ---
     * Menghubungi backend Flask untuk mendapatkan DUA URL layer GEE
     * dan menampilkannya di peta dengan tombol kontrol.
     */
    async loadGeeLayer() {
        if (!this.myMap || !this.layerControl) return; // Pastikan peta & kontrol ada

        console.log("Menghubungi backend di http://localhost:5000/api/get-ndvi-layer ...");
        
        try {
            const response = await fetch('/api/get-ndvi-layer');
            
            if (!response.ok) {
                throw new Error(`Gagal mengambil data dari server: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.status === 'success') {
                console.log("Data GEE 2019 & 2024 diterima. Menambahkan layer...");
                
                // 1. Buat layer untuk 2019 dan 2024
                this.layer2019 = L.tileLayer(data.url_2019, {
                    attribution: 'GEE NDVI 2019'
                });
                
                this.layer2024 = L.tileLayer(data.url_2024, {
                    attribution: 'GEE NDVI 2024'
                });

                // 2. Tambahkan layer ke 'layer control' (tombol toggle)
                this.layerControl.addBaseLayer(this.layer2019, "NDVI 2019");
                this.layerControl.addBaseLayer(this.layer2024, "NDVI 2024");
                
                // 3. Tambahkan salah satu layer (misal 2024) ke peta secara default
                this.layer2024.addTo(this.myMap);
            
            } else {
                throw new Error(`Error dari server GEE: ${data.message}`);
            }
        
        } catch (error) {
            console.error("Gagal memuat layer GEE:", error);
            if(document.getElementById('map-canvas')) {
                L.popup()
                 .setLatLng([-2.5489, 118.0149])
                 .setContent(`Gagal memuat layer GEE: ${error.message}. Pastikan server backend Anda berjalan.`)
                 .openOn(this.myMap);
            }
        }
    }
    // =================================
    // AKHIR PERUBAHAN BARU
    // =================================
}