(function () {
  'use strict';

  const WHATSAPP = '5586994124404';

  const MENSAGENS = {
    geral: () => 'Olá! Vim pelo site e gostaria de saber mais sobre os pijamas.',
    frete: () => 'Olá! Vim pelo site e quero saber o valor do frete para a minha cidade. Pode me ajudar?',
    produto: (nome) => `Olá! Vim pelo site e gostei do ${nome}. Pode me passar tamanhos e valores?`,
    categoria: (nome) => `Olá! Vim pelo site e quero ver os modelos de ${nome}.`
  };

  const linkWhatsapp = (mensagem) =>
    `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensagem)}`;

  window.lunnaWhatsapp = linkWhatsapp;

  function formatarTelefone(numero) {
    const local = numero.startsWith('55') ? numero.slice(2) : numero;
    if (local.length < 10) return numero;
    return `(${local.slice(0, 2)}) ${local.slice(2, local.length - 4)}-${local.slice(-4)}`;
  }

  function montarLinksWhatsapp() {
    document.querySelectorAll('[data-wa]').forEach((el) => {
      const tipo = el.dataset.wa;
      const montar = MENSAGENS[tipo];
      if (!montar) return;
      el.href = linkWhatsapp(montar(el.dataset.waNome));
    });

    document.querySelectorAll('[data-wa-telefone]').forEach((el) => {
      el.textContent = formatarTelefone(WHATSAPP);
    });
  }

  function iniciarCarrossel() {
    const lista = document.querySelector('[data-carrossel-lista]');
    if (!lista) return;

    const botaoAnterior = document.querySelector('[data-carrossel="anterior"]');
    const botaoProximo = document.querySelector('[data-carrossel="proximo"]');
    const largo = window.matchMedia('(min-width: 900px)');

    function renderizar() {
      const visiveis = largo.matches ? 2 : 1;
      Array.from(lista.children).forEach((item, i) => {
        item.hidden = i >= visiveis;
      });
    }

    botaoProximo.addEventListener('click', () => {
      lista.append(lista.firstElementChild);
      renderizar();
    });

    botaoAnterior.addEventListener('click', () => {
      lista.prepend(lista.lastElementChild);
      renderizar();
    });

    largo.addEventListener('change', renderizar);
    renderizar();
  }

  function iniciarEmojis() {
    const camada = document.querySelector('[data-emojis]');
    if (!camada) return;

    const EMOJIS = ['🐑', '☁️', '🌙', '💤', '✨'];
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)');
    let intervalo = null;
    let iniciais = [];

    function nascer() {
      if (document.hidden || reduzir.matches) return;

      const duracao = 12 + Math.random() * 8;
      const el = document.createElement('div');
      el.className = 'emoji';
      el.style.setProperty('--dur', `${duracao}s`);
      el.style.setProperty('--dx', `${(Math.random() - 0.5) * 60}px`);

      const simbolo = document.createElement('span');
      simbolo.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      simbolo.style.left = `${Math.random() * 96}%`;
      simbolo.style.fontSize = `${1 + Math.random() * 0.6}rem`;

      el.append(simbolo);
      el.addEventListener('animationend', (e) => {
        if (e.target === el) el.remove();
      });
      camada.append(el);
    }

    function parar() {
      clearInterval(intervalo);
      intervalo = null;
      iniciais.forEach(clearTimeout);
      iniciais = [];
      camada.replaceChildren();
    }

    function iniciar() {
      if (intervalo || document.hidden || reduzir.matches) return;
      for (let i = 0; i < 6; i++) iniciais.push(setTimeout(nascer, i * 500));
      intervalo = setInterval(nascer, 1800);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) parar();
      else iniciar();
    });

    reduzir.addEventListener('change', () => {
      if (reduzir.matches) parar();
      else iniciar();
    });

    iniciar();
  }

  function iniciarChat() {
    const chat = document.querySelector('[data-chat]');
    if (!chat) return;

    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduzir.matches || !('IntersectionObserver' in window)) return;

    const baloes = Array.from(chat.querySelectorAll('[data-chat-passo]'));
    const area = chat.querySelector('.chat__msgs');
    const status = chat.querySelector('.chat__status');
    const [foto, respostaLoja, cliente, fechamento] = baloes;
    const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    baloes.forEach((balao) => { balao.hidden = true; });
    status.textContent = 'online';

    function revelar(balao) {
      balao.hidden = false;
      balao.classList.add('balao--entra');
    }

    async function digitar(proximo) {
      const indicador = document.createElement('p');
      indicador.className = 'balao balao--loja balao--digitando balao--entra';
      indicador.append(...Array.from({ length: 3 }, () => document.createElement('span')));
      area.insertBefore(indicador, proximo);
      status.textContent = 'digitando…';
      await esperar(1700);
      indicador.remove();
      status.textContent = 'online';
      revelar(proximo);
    }

    async function contar() {
      await esperar(600);
      revelar(foto);
      await digitar(respostaLoja);
      await esperar(1100);
      revelar(cliente);
      await digitar(fechamento);
    }

    const observador = new IntersectionObserver((entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      observador.disconnect();
      contar();
    }, { threshold: 0.2 });

    observador.observe(chat);
  }

  montarLinksWhatsapp();
  iniciarCarrossel();
  iniciarEmojis();
  iniciarChat();
})();
