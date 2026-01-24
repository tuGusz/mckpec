document.addEventListener("DOMContentLoaded", function() {
    const barra = document.getElementById('barra-controle');
    const sentinela = document.getElementById('sentinela-topo');

    if (barra && sentinela) {
        const observer = new IntersectionObserver((entries) => {
            if (!entries[0].isIntersecting) {
                barra.classList.add('gemini-sticky');
            } else {
                barra.classList.remove('gemini-sticky');
            }
        }, {
            threshold: 0,
            rootMargin: "-50px 0px 0px 0px" 
        });

        observer.observe(sentinela);
    }
});