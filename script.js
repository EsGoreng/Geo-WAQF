document.addEventListener('DOMContentLoaded', () => {
    const contentArea = document.getElementById('content-area');
    const navLinks = document.querySelectorAll('.sidebar-nav a');

    // Fungsi cerdas untuk memuat konten
    const loadContent = async (pageUrl) => {
        // Tampilkan semacam loading spinner jika mau
        // contentArea.innerHTML = '<p>Loading...</p>'; 

        try {
            const response = await fetch(pageUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const text = await response.text();
            
            // Ubah teks HTML menjadi dokumen yang bisa kita 'query'
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            
            // --- INI ADALAH PERUBAHAN UTAMA ---
            // Ambil HANYA bagian <main> dari file HTML yang dimuat
            const mainContent = doc.querySelector('main');
            
            if (mainContent) {
                // Masukkan isi dari <main> tersebut ke #content-area
                contentArea.innerHTML = mainContent.innerHTML;
            } else {
                // Fallback jika halaman tidak memiliki tag <main>
                // Ini akan memuat seluruh body, seperti sebelumnya
                contentArea.innerHTML = doc.body.innerHTML;
                console.warn(`Halaman ${pageUrl} tidak memiliki tag <main>. Memuat seluruh body.`);
            }

        } catch (error) {
            console.error('Gagal memuat halaman:', error);
            contentArea.innerHTML = '<p style="color: red; padding: 2rem;">Gagal memuat konten. Periksa konsol (F12) untuk detail.</p>';
        }
    };

    // 1. Muat konten halaman utama (Dashboard) saat pertama kali dibuka
    const initialPage = document.querySelector('.sidebar-nav a.active').getAttribute('data-page');
    loadContent(initialPage || 'page_home.html');

    // 2. Tambahkan 'event listener' untuk semua link navigasi
    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault(); // Mencegah browser pindah halaman

            // Hapus kelas 'active' dari semua link
            navLinks.forEach(navLink => navLink.classList.remove('active'));

            // Tambahkan kelas 'active' ke link yang baru diklik
            link.classList.add('active');

            // Ambil URL halaman dari atribut 'data-page'
            const pageToLoad = link.getAttribute('data-page');

            // Muat konten baru
            if (pageToLoad) {
                loadContent(pageToLoad);
            } else {
                console.error("Link tidak memiliki atribut 'data-page':", link);
            }
        });
    });
});