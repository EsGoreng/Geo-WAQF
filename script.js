document.addEventListener('DOMContentLoaded', () => {
    const contentArea = document.getElementById('content-area');
    const navLinks = document.querySelectorAll('.sidebar-nav a');

    const loadContent = async (page) => {
        try {
            const response = await fetch(page);
            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const bodyContent = doc.body.innerHTML;
            contentArea.innerHTML = bodyContent;
        } catch (error) {
            console.error('Error loading page:', error);
            contentArea.innerHTML = '<p>Error loading content.</p>';
        }
    };

    // Load initial content
    loadContent('page_home.html');

    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();

            navLinks.forEach(link => link.classList.remove('active'));

            event.target.classList.add('active');

            const page = event.target.getAttribute('data-page');

            loadContent(page);
        });
    });
});