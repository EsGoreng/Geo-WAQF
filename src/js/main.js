// Impor controller Anda (ini seharusnya sudah ada)
import { SPAController } from './spa-controller.js';

document.addEventListener('DOMContentLoaded', () => {
    // Inisialisasi SPA (ini seharusnya sudah ada)
    window.spaController = new SPAController();
    
    // --- TAMBAHKAN KODE DI BAWAH INI ---
    
    // Logika untuk Toggle Sidebar Mobile
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menu-toggle');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (menuToggle && sidebar && sidebarOverlay) {
        
        // Klik tombol menu
        menuToggle.addEventListener('click', () => {
            // Toggle sidebar (tampilkan/sembunyikan)
            sidebar.classList.toggle('-translate-x-full');
            // Toggle overlay
            sidebarOverlay.classList.toggle('hidden');
        });

        // Klik overlay (area gelap)
        sidebarOverlay.addEventListener('click', () => {
            // Selalu sembunyikan sidebar
            sidebar.classList.add('-translate-x-full');
            sidebarOverlay.classList.add('hidden');
        });
    }
    
    // --- AKHIR KODE TAMBAHAN ---
});