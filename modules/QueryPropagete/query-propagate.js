function exec_propagateQuery() {
    const currentQuery = window.location.search;
    
    if (!currentQuery) return;
    
    const links = document.querySelectorAll('a[href]');
    
    links.forEach(link => {
        let href = link.getAttribute('href');
    
        if (href.startsWith('#') || href.startsWith('javascript:')) return;
    
        if (href.includes('?')) {
            href += '&' + currentQuery.slice(1);
        } else {
            href += currentQuery;
        }
    
        link.setAttribute('href', href);
    });
};
