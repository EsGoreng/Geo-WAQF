import { SPAController } from './spa-controller.js';

async function loadLayout() {
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
    const headerPlaceholder = document.getElementById('header-placeholder');

    // Jika placeholder tidak ada, hentikan
    if (!sidebarPlaceholder || !headerPlaceholder) {
        console.error('Placeholder untuk layout tidak ditemukan!');
        return;
    }

    try {
        // Ambil kedua komponen secara bersamaan (paralel)
        const [sidebarRes, headerRes] = await Promise.all([
            fetch('src/components/sidebar.html'),
            fetch('src/components/header.html')
        ]);

        // Cek jika salah satu gagal
        if (!sidebarRes.ok) throw new Error(`Gagal memuat sidebar: ${sidebarRes.statusText}`);
        if (!headerRes.ok) throw new Error(`Gagal memuat header: ${headerRes.statusText}`);

        // Ambil teks HTML-nya
        const sidebarHtml = await sidebarRes.text();
        const headerHtml = await headerRes.text();

        // Masukkan HTML ke dalam placeholder
        sidebarPlaceholder.innerHTML = sidebarHtml;
        headerPlaceholder.innerHTML = headerHtml;

    } catch (error) {
        console.error('Gagal memuat layout:', error);
        // Tampilkan error ke pengguna jika layout gagal
        document.body.innerHTML = `<div class="p-8 text-center text-red-400">
            <h1 class="text-2xl font-bold">Error Memuat Aplikasi</h1>
            <p>${error.message}</p>
        </div>`;
    }
}

/**
 * Fungsi init utama aplikasi
 */
async function main() {
    // 1. TUNGGU komponen layout (sidebar/header) selesai dimuat
    await loadLayout();
    
    // 2. SETELAH layout ada, baru inisialisasi SPA Controller
    //    (karena controller butuh elemen .nav-link, #page-title, dll)
    window.spaController = new SPAController();
    
    // 3. SETELAH layout ada, baru tambahkan event listener untuk mobile toggle
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menu-toggle');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (menuToggle && sidebar && sidebarOverlay) {
        
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('-translate-x-full');
            sidebarOverlay.classList.toggle('hidden');
        });

        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.add('-translate-x-full');
            sidebarOverlay.classList.add('hidden');
        });
    } else {
        // Debugging jika elemen tidak ditemukan
        console.warn('Elemen toggle sidebar tidak ditemukan. Cek ID di header.html dan sidebar.html.');
    }
}

// Jalankan fungsi main saat DOM siap
document.addEventListener('DOMContentLoaded', main);