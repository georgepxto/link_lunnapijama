(function () {
  'use strict';

  const raiz = document.documentElement;
  const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)');
  const LIMITE = 0.18;

  window.lunnaAnima = true;
  raiz.classList.add('js-anima');

  function revelar(secao) {
    if (secao.classList.contains('visivel')) return;
    secao.classList.add('visivel');
    secao.dispatchEvent(new CustomEvent('anima:visivel'));
  }

  function observarSecoes() {
    const secoes = document.querySelectorAll('.secao');

    if (!('IntersectionObserver' in window)) {
      secoes.forEach(revelar);
      return;
    }

    const observador = new IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        const alturaTela = entrada.rootBounds ? entrada.rootBounds.height : window.innerHeight;
        const suficiente = entrada.intersectionRatio >= LIMITE || entrada.intersectionRect.height >= alturaTela * LIMITE;
        if (!suficiente) return;
        observador.unobserve(entrada.target);
        revelar(entrada.target);
      });
    }, { threshold: [0, 0.05, 0.1, LIMITE], rootMargin: '0px 0px -10% 0px' });

    secoes.forEach((secao) => observador.observe(secao));
  }

  function liberarAoTerminar() {
    document.addEventListener('animationend', (evento) => {
      const elemento = evento.target;
      if (elemento.dataset && elemento.dataset.anima === evento.animationName) {
        elemento.setAttribute('data-animado', '');
      }
    });
  }

  function acompanharRolagem() {
    const foto = document.querySelector('.foto-hero__img img');
    const botao = document.querySelector('.wpp-flutuante');
    let agendado = false;

    function atualizar() {
      agendado = false;
      const y = window.scrollY;
      if (botao) botao.classList.toggle('wpp-flutuante--visivel', y > 300);
      if (foto && !reduzir.matches) foto.style.translate = `0 ${Math.min(40, y * 0.08).toFixed(1)}px`;
    }

    function prepararParallax() {
      if (!foto) return;
      foto.style.scale = reduzir.matches ? '' : '1.04';
      if (reduzir.matches) foto.style.translate = '';
    }

    window.addEventListener('scroll', () => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(atualizar);
    }, { passive: true });

    reduzir.addEventListener('change', () => {
      prepararParallax();
      atualizar();
    });

    prepararParallax();
    atualizar();
  }

  function revelarHero() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    hero.querySelectorAll('[data-anima]').forEach((elemento) => {
      if (!elemento.getClientRects().length) elemento.setAttribute('data-animado', '');
    });
    revelar(hero);
  }

  liberarAoTerminar();
  revelarHero();
  observarSecoes();
  acompanharRolagem();
})();
