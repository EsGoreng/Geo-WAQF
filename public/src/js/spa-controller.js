// Konten BARU (YANG DIPERBAIKI) untuk: src/js/spa-controller.js

export class SPAController {
    constructor() {
        this.contentArea = document.getElementById('content-area');
        this.pageTitle = document.getElementById('page-title');
        this.navLinks = document.querySelectorAll('.nav-link');
        this.currentPage = null;
        this.cache = new Map();
        
        this.apiBaseUrl = 'https://geo-waqf.vercel.app';
        
        // Properti Peta & Layer
        this.myMap = null; 
        this.layerControl = null; 
        
        // Layer Dinamis
        this.dnbrLayer = null;      
        this.ndwiLayer2019 = null;  
        this.ndwiLayer2024 = null;  
        this.mceLayer = null; 
        this.boundaryLayer = null; 

        this.init();
    }

    init() {
        // ... (Fungsi init() Anda tidak berubah) ...
        const initialLink = document.querySelector('.nav-link.active');
        const initialPage = initialLink?.getAttribute('data-page') || 'page_home.html';
        if (initialLink) {
            this.updateActiveLink(initialLink, false);
        }
        this.currentPage = initialPage;
        this.loadPage(initialPage, false);
        this.setupNavigation();
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) {
                const newLink = document.querySelector(`.nav-link[data-page="${e.state.page}"]`);
                if (newLink) {
                    this.updateActiveLink(newLink, false);
                }
                this.currentPage = e.state.page; 
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
                    this.currentPage = page; 
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
            this.currentPage = pageUrl;
            history.pushState({ page: pageUrl }, title, `#${pageUrl.replace('.html', '')}`);
        }
    }

    async loadPage(pageUrl, pushState = true) {
        try {
            // Bersihkan semua layer dan peta lama
            if (this.layerControl) {
                this.layerControl.remove();
                this.layerControl = null;
            }
            if (this.dnbrLayer) this.dnbrLayer.remove();
            if (this.ndwiLayer2019) this.ndwiLayer2019.remove();
            if (this.ndwiLayer2024) this.ndwiLayer2024.remove();
            if (this.mceLayer) this.mceLayer.remove();
            if (this.boundaryLayer) {
                this.boundaryLayer.remove();
                this.boundaryLayer = null;
            }
            if (this.myMap) {
                this.myMap.remove();
                this.myMap = null;
            }
            
            this.currentPage = pageUrl;
            this.showLoading(); // Tampilkan Spinner

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
            this.initPageScripts(); // Peta dasar & event
            this.hideLoading(); // Sembunyikan spinner
            this.loadPageData(); // Muat data GEE di latar belakang
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
        if (this.myMap) {
            if (this.currentPage === 'page_pilar1.html') {
                this.setupMceControls();
            }
        }
    }

    async loadPageData() {
        if (!this.myMap) return; 
        
        switch (this.currentPage) {
            case 'page_home.html':
            case 'page_pilar2.html': 
                await this.loadAnalysisLayers();
                break;
            case 'page_pilar1.html':
                break; // Layer MCE dimuat saat klik tombol
            case 'page_pilar3.html':
                break;
        }
        // Muat batas kabupaten di semua halaman
        await this.loadBoundaryLayer();
    }


    initializeMap() {
        // ... (Fungsi initializeMap() Anda tidak berubah) ...
        const mapElement = document.getElementById('map-canvas');
        if (!mapElement) {
            return; 
        }
        try {
            this.myMap = L.map('map-canvas').setView([1.47, 102.11], 10); 
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https.www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                maxZoom: 19
            }).addTo(this.myMap);
        } catch (error) {
            console.error("Gagal menginisialisasi Leaflet:", error);
            mapElement.innerHTML = "<p class='text-red-400 p-4'>Gagal memuat peta. Apakah Leaflet.js sudah dimuat?</p>";
        }
    }
    
    async fetchFromApi(endpoint) {
        console.log(`Menghubungi backend di: ${this.apiBaseUrl}${endpoint}`);
        try {
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`);
            if (!response.ok) {
                throw new Error(`Gagal mengambil data dari server: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.status === 'success') {
                return data; // Kembalikan data yang sukses
            } else {
                throw new Error(`Error dari server GEE: ${data.message}`);
            }
        } catch (error) {
            console.error(`Gagal memuat dari ${endpoint}:`, error);
            if (this.myMap) {
                L.popup().setLatLng([1.47, 102.11]).setContent(`Gagal memuat layer: ${error.message}.`).openOn(this.myMap);
            }
            throw error; 
        }
    }
    
    async loadAnalysisLayers() {
        if (!this.myMap) return; 
        
        try {
            const data = await this.fetchFromApi('/api/get-analysis-layers');
            
            if (!this.layerControl) {
                this.layerControl = L.control.layers({}, null, {
                    position: 'topright',
                    collapsed: false
                }).addTo(this.myMap);
            }
            
            this.dnbrLayer = L.tileLayer(data.url_dnbr, { attribution: 'GEE dNBR (Sentinel-2)' });
            this.ndwiLayer2019 = L.tileLayer(data.url_ndwi_2019, { attribution: 'GEE NDWI 2019 (Sentinel-2)' });
            this.ndwiLayer2024 = L.tileLayer(data.url_ndwi_2024, { attribution: 'GEE NDWI 2024 (Sentinel-2)' });

            this.layerControl.addBaseLayer(this.dnbrLayer, "dNBR (Perubahan)");
            this.layerControl.addBaseLayer(this.ndwiLayer2019, "NDWI 2019 (Basah)");
            this.layerControl.addBaseLayer(this.ndwiLayer2024, "NDWI 2024 (Basah)");
            
            this.dnbrLayer.addTo(this.myMap);

        } catch (error) {
            console.error("Gagal memuat layer analisis (loadAnalysisLayers).");
        }
    }
    
    setupMceControls() {
        // ... (Fungsi setupMceControls() Anda tidak berubah) ...
        const mceForm = document.getElementById('mce-form');
        const applyButton = document.getElementById('mce-apply-button');
        if (!mceForm || !applyButton) {
            return;
        }
        const sliders = mceForm.querySelectorAll('.mce-slider');
        sliders.forEach(slider => {
            const valueLabel = document.getElementById(slider.id.replace('slider', 'value'));
            if (valueLabel) {
                slider.addEventListener('input', (e) => {
                    valueLabel.textContent = `${e.target.value}%`;
                });
            }
        });
        applyButton.addEventListener('click', () => {
            const mceWeights = {
                degradasi: document.getElementById('mce-degradasi-slider').value,
                hidrologi: document.getElementById('mce-hidrologi-slider').value,
                gambut: document.getElementById('mce-gambut-slider').value,
                akses: document.getElementById('mce-akses-slider').value
            };
            this.loadMceLayer(mceWeights);
        });
    }

    // =================================
    // FUNGSI YANG DIPERBARUI (Perbaikan Bug)
    // =================================
    async loadMceLayer(mceWeights) {
        if (!this.myMap) return; 

        const applyButton = document.getElementById('mce-apply-button');
        // PERBAIKI TYPO: Tambahkan 'truncate'
        if (applyButton) applyButton.innerHTML = `<span class="truncate">Memuat...</span>`;

        try {
            const params = new URLSearchParams(mceWeights).toString();
            const data = await this.fetchFromApi(`/api/get-mce-layer?${params}`);

            // =================================
            // PERBAIKAN BUG UTAMA DI SINI
            // =================================
            // Hapus layer MCE lama dari PETA dan dari KONTROL
            if (this.mceLayer) {
                this.mceLayer.remove(); // Hapus dari peta
                if (this.layerControl) {
                    this.layerControl.removeLayer(this.mceLayer); // Hapus dari menu toggle
                }
            }
            // =================================
            // AKHIR PERBAIKAN BUG
            // =================================

            this.mceLayer = L.tileLayer(data.url, {
                attribution: 'Analisis MCE (Geo-WAQF)',
                opacity: 0.7 
            });

            this.mceLayer.addTo(this.myMap);
            
            // Buat layer control jika belum ada (saat di Pilar 1)
            if (!this.layerControl) {
                this.layerControl = L.control.layers({}, null, {
                    position: 'topright',
                    collapsed: false
                }).addTo(this.myMap);
            }
            
            // Tambahkan layer baru ke toggle
            this.layerControl.addOverlay(this.mceLayer, "Skor MCE");

        } catch (error) {
             console.error("Gagal memuat layer MCE (loadMceLayer).");
        } finally {
            // PERBAIKI TYPO: Tambahkan 'truncate'
            if (applyButton) applyButton.innerHTML = `<span class="truncate">Terapkan Filter</span>`;
        }
    }

    async loadBoundaryLayer() {
        if (!this.myMap) return; 
        
        try {
            const data = await this.fetchFromApi('/api/get-desa-bengkalis');

            this.boundaryLayer = L.geoJSON(data.geojson, { 
                style: {
                    color: "#11d411", 
                    weight: 1,
                    opacity: 0.5,
                    fillOpacity: 0.0 
                },
                onEachFeature: (feature, layer) => {
                    layer.on({
                        mouseover: (e) => this.highlightFeature(e),
                        mouseout: (e) => this.resetHighlight(e),
                        click: (e) => this.zoomToFeature(e)
                    });
                }
            }).addTo(this.myMap);
            
            if (this.layerControl) {
                this.layerControl.addOverlay(this.boundaryLayer, "Batas Kabupaten");
            } else {
                this.layerControl = L.control.layers({}, {"Batas Kabupaten": this.boundaryLayer}, {
                    position: 'topright',
                    collapsed: false
                }).addTo(this.myMap);
            }
        } catch (error) {
             console.error("Gagal memuat layer GeoJSON kabupaten (loadBoundaryLayer).");
        }
    }

    highlightFeature(e) {
        const layer = e.target;
        layer.setStyle({
            weight: 3,
            color: '#11d411', 
            opacity: 1.0,
            fillOpacity: 0.1 
        });
        layer.bringToFront();
    }
    resetHighlight(e) {
        if (this.boundaryLayer) {
            this.boundaryLayer.resetStyle(e.target);
        }
    }

    zoomToFeature(e) {
        const layer = e.target;
        const properties = layer.feature.properties;
        const namaKab = properties.ADM2_NAME || 'Area Terpilih';
        const namaProv = properties.ADM1_NAME || 'N/A';
        const kodeKab = properties.ADM2_CODE || 'N/A';
        L.popup()
         .setLatLng(e.latlng)
         .setContent(`<b>Kabupaten: ${namaKab}</b><br>Provinsi: ${namaProv}<br>ID: ${kodeKab}<br><br><button class="bg-primary text-background-dark px-3 py-1 rounded">Donasi (Waqf) untuk area ini</button>`)
         .openOn(this.myMap);
    }
}