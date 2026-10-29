(function () {
  'use strict';

  const secao = document.getElementById('provador');
  if (!secao) return;

  const mesa = secao.querySelector('[data-provador-mesa]');
  const faixa = secao.querySelector('[data-provador-faixa]');
  const trilho = faixa.querySelector('.faixa__trilho');
  const dialogo = secao.querySelector('[data-mostruario]');
  const palco = dialogo.querySelector('[data-mostruario-palco]');
  const titulo = dialogo.querySelector('[data-mostruario-titulo]');
  const contador = dialogo.querySelector('[data-mostruario-contador]');
  const tira = dialogo.querySelector('[data-mostruario-tira]');
  const quero = dialogo.querySelector('[data-mostruario-quero]');
  const botaoAnterior = dialogo.querySelector('[data-mostruario-anterior]');
  const botaoProxima = dialogo.querySelector('[data-mostruario-proxima]');
  const botaoFechar = dialogo.querySelector('[data-mostruario-fechar]');

  const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)');
  const SUAVE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const DEEP_LINK = /^#provador\/([^/]+)\/(\d+)$/;

  const estado = { albuns: [], album: null, indice: 0, camada: null, retorno: null, fechando: false };

  const plural = (n) => `${n} ${n === 1 ? 'foto' : 'fotos'}`;
  const textoAlt = (album, n) => `${album.titulo} — foto ${n}`;

  function el(tag, atributos = {}, filhos = []) {
    const elemento = document.createElement(tag);
    for (const [nome, valor] of Object.entries(atributos)) {
      if (valor !== undefined && valor !== null) elemento.setAttribute(nome, valor);
    }
    elemento.append(...filhos);
    return elemento;
  }

  function imagem(foto, alt, extra = {}) {
    const img = el('img', {
      src: foto.mini,
      alt,
      width: foto.w,
      height: foto.h,
      loading: 'lazy',
      decoding: 'async',
      draggable: 'false',
      ...extra
    });
    return img;
  }

  const srcsetDe = (foto) => `${foto.mini} 480w, ${foto.src} ${foto.w}w`;

  function embaralhar(lista) {
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    return lista;
  }

  function montarPilha(album, posicao) {
    const total = album.fotos.length;
    const capa = album.fotos[album.capa] ? album.capa : 0;
    const outras = album.fotos.map((_, i) => i).filter((i) => i !== capa);
    const camadas = [
      { classe: 'polaroid--3', indice: outras[1] },
      { classe: 'polaroid--2', indice: outras[0] },
      { classe: 'polaroid--1', indice: capa }
    ];

    const monte = el('span', { class: 'pilha__monte' });
    let frente = null;

    for (const { classe, indice } of camadas) {
      const foto = album.fotos[indice];
      const quadro = el('span', { class: 'polaroid__foto' });
      if (foto) {
        quadro.style.backgroundColor = foto.cor;
        const extra = classe === 'polaroid--1'
          ? { srcset: srcsetDe(foto), sizes: '200px' }
          : {};
        quadro.append(imagem(foto, textoAlt(album, indice + 1), extra));
      }
      const legenda = el('span', { class: 'polaroid__legenda', 'aria-hidden': 'true' }, classe === 'polaroid--1' ? [album.titulo] : []);
      monte.append(el('span', { class: `polaroid ${classe}` }, [quadro, legenda]));
      if (classe === 'polaroid--1') frente = quadro;
    }

    const botao = el('button', {
      type: 'button',
      class: 'pilha',
      'data-slug': album.slug,
      'aria-label': `Abrir álbum ${album.titulo}, ${plural(total)}`
    }, [monte, el('span', { class: 'pilha__qtd', 'aria-hidden': 'true' }, [plural(total)])]);

    botao.style.setProperty('--i', posicao);
    botao.addEventListener('click', () => abrir(album, capa, botao, frente));
    return botao;
  }

  function itemFaixa({ album, foto, indice }, copia) {
    const largura = Math.round((120 * foto.w) / foto.h);
    const img = imagem(foto, copia ? '' : textoAlt(album, indice + 1), {
      srcset: srcsetDe(foto),
      sizes: `${largura}px`
    });
    const botao = el('button', {
      type: 'button',
      class: 'faixa__item',
      'aria-label': copia ? null : `Abrir álbum ${album.titulo} na foto ${indice + 1}`,
      'aria-hidden': copia ? 'true' : null,
      tabindex: copia ? '-1' : null,
      'data-copia': copia ? '' : null
    }, [img]);
    botao.style.backgroundColor = foto.cor;
    botao.addEventListener('click', () => {
      const pilha = mesa.querySelector(`[data-slug="${album.slug}"]`);
      abrir(album, indice, copia ? pilha : botao, img);
    });
    return botao;
  }

  function montarFaixa(albuns) {
    const todas = embaralhar(albuns.flatMap((album) => album.fotos.map((foto, indice) => ({ album, foto, indice }))));
    trilho.append(...todas.map((item) => itemFaixa(item, false)), ...todas.map((item) => itemFaixa(item, true)));
  }

  function animarQueda() {
    if (reduzir.matches || !('IntersectionObserver' in window)) return;

    mesa.dataset.cair = '';
    const observador = new IntersectionObserver((entradas) => {
      entradas
        .filter((entrada) => entrada.isIntersecting)
        .map((entrada) => entrada.target)
        .sort((a, b) => a.style.getPropertyValue('--i') - b.style.getPropertyValue('--i'))
        .forEach((pilha, ordem) => {
          observador.unobserve(pilha);
          pilha.style.setProperty('--atraso', `${ordem * 90}ms`);
          pilha.classList.add('caiu');
        });
    }, { rootMargin: '0px 0px -10% 0px' });

    mesa.querySelectorAll('.pilha').forEach((pilha) => observador.observe(pilha));
  }

  function medidas(foto) {
    const largura = Math.min(window.innerWidth * 0.92, palco.clientWidth);
    const altura = Math.min(window.innerHeight * 0.86, palco.clientHeight);
    const escala = Math.min(largura / foto.w, altura / foto.h);
    return { width: Math.round(foto.w * escala), height: Math.round(foto.h * escala) };
  }

  function ajustar(moldura, foto) {
    const { width, height } = medidas(foto);
    moldura.style.width = `${width}px`;
    moldura.style.height = `${height}px`;
  }

  function criarCamada(album, indice) {
    const foto = album.fotos[indice];
    const moldura = el('div', { class: 'mostruario__moldura' }, [
      el('img', {
        src: foto.src,
        alt: textoAlt(album, indice + 1),
        width: foto.w,
        height: foto.h,
        loading: 'lazy',
        decoding: 'async',
        draggable: 'false'
      })
    ]);
    moldura.style.backgroundColor = foto.cor;
    moldura.style.backgroundImage = `url("${foto.mini}")`;
    ajustar(moldura, foto);
    return el('div', { class: 'mostruario__camada' }, [moldura]);
  }

  function preCarregar(album, indice) {
    const total = album.fotos.length;
    if (total < 2) return;
    for (const passo of [-1, 1]) {
      const vizinha = new Image();
      vizinha.decoding = 'async';
      vizinha.src = album.fotos[(indice + passo + total) % total].src;
    }
  }

  function montarTira(album) {
    tira.replaceChildren(...album.fotos.map((foto, indice) => {
      const botao = el('button', {
        type: 'button',
        class: 'mostruario__mini',
        'aria-label': `Ver foto ${indice + 1}`
      }, [imagem(foto, '', { srcset: srcsetDe(foto), sizes: '64px' })]);
      botao.style.backgroundColor = foto.cor;
      botao.addEventListener('click', () => mostrar(indice, Math.sign(indice - estado.indice)));
      return botao;
    }));
    tira.hidden = album.fotos.length < 2;
  }

  function rolarTira(indice) {
    const ativo = tira.children[indice];
    if (!ativo) return;
    tira.scrollTo({
      left: ativo.offsetLeft - (tira.clientWidth - ativo.offsetWidth) / 2,
      behavior: reduzir.matches ? 'auto' : 'smooth'
    });
  }

  function mostrar(indice, direcao) {
    const { album } = estado;
    const total = album.fotos.length;
    indice = (indice + total) % total;
    if (estado.camada && indice === estado.indice) return;

    estado.indice = indice;
    const anterior = estado.camada;
    const camada = criarCamada(album, indice);
    estado.camada = camada;

    palco.querySelectorAll('.mostruario__camada').forEach((c) => {
      if (c !== anterior) c.remove();
    });
    palco.append(camada);

    if (anterior) {
      const distancia = reduzir.matches ? 0 : 24 * (direcao || 1);
      const opcoes = { duration: 350, easing: 'ease-out' };
      anterior.style.pointerEvents = 'none';
      anterior.firstElementChild.style.pointerEvents = 'none';
      anterior.animate(
        [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-distancia}px)` }],
        { ...opcoes, fill: 'forwards' }
      ).finished.then(() => anterior.remove(), () => anterior.remove());
      camada.animate(
        [{ opacity: 0, transform: `translateX(${distancia}px)` }, { opacity: 1, transform: 'none' }],
        opcoes
      );
    }

    const n = indice + 1;
    contador.textContent = `${n} / ${total}`;
    Array.from(tira.children).forEach((botao, i) => botao.setAttribute('aria-current', String(i === indice)));
    rolarTira(indice);
    quero.href = window.lunnaWhatsapp(
      `Olá! Vim pelo site e gostei da foto ${n} do álbum ${album.titulo}. Pode me passar tamanhos e valores?`
    );
    history.replaceState(null, '', `#provador/${album.slug}/${n}`);
    preCarregar(album, indice);
  }

  function voarDe(origem) {
    const moldura = estado.camada.firstElementChild;
    const de = origem.getBoundingClientRect();
    const para = moldura.getBoundingClientRect();
    if (!de.width || !para.width) return;

    const escala = de.width / para.width;
    const dx = de.left + de.width / 2 - (para.left + para.width / 2);
    const dy = de.top + de.height / 2 - (para.top + para.height / 2);

    estado.camada.animate(
      [{ transform: `translate(${dx}px, ${dy}px) scale(${escala})` }, { transform: 'none' }],
      { duration: 500, easing: SUAVE }
    );
  }

  function esmaecer(de, para, duracao) {
    const quadros = { opacity: [de, para] };
    const animacoes = [dialogo.animate(quadros, { duration: duracao, fill: 'forwards' })];
    try {
      animacoes.push(dialogo.animate(quadros, { duration: duracao, fill: 'forwards', pseudoElement: '::backdrop' }));
    } catch (_) {}
    return animacoes;
  }

  function abrir(album, indice, retorno, origem) {
    estado.album = album;
    estado.retorno = retorno;
    estado.camada = null;
    estado.fechando = false;
    palco.replaceChildren();

    dialogo.setAttribute('aria-label', album.titulo);
    titulo.textContent = album.titulo;
    const varias = album.fotos.length > 1;
    botaoAnterior.hidden = !varias;
    botaoProxima.hidden = !varias;
    montarTira(album);

    if (!dialogo.open) dialogo.showModal();
    mostrar(indice, 0);

    if (reduzir.matches || !origem) {
      esmaecer(0, 1, 250).forEach((a) => a.finished.then(() => a.cancel(), () => {}));
    } else {
      voarDe(origem);
    }
  }

  function navegar(passo) {
    if (!estado.album || estado.album.fotos.length < 2) return;
    mostrar(estado.indice + passo, passo);
  }

  function fechar() {
    if (!dialogo.open || estado.fechando) return;
    estado.fechando = true;
    const animacoes = esmaecer(1, 0, 200);
    Promise.all(animacoes.map((a) => a.finished)).catch(() => {}).then(() => {
      dialogo.close();
      animacoes.forEach((a) => a.cancel());
    });
  }

  function focaveis() {
    return Array.from(dialogo.querySelectorAll('button, a[href]'))
      .filter((elemento) => !elemento.closest('[hidden]') && elemento.getClientRects().length);
  }

  function ligarMostruario() {
    botaoFechar.addEventListener('click', fechar);
    botaoAnterior.addEventListener('click', () => navegar(-1));
    botaoProxima.addEventListener('click', () => navegar(1));

    dialogo.addEventListener('cancel', (evento) => {
      evento.preventDefault();
      fechar();
    });

    dialogo.addEventListener('close', () => {
      estado.fechando = false;
      estado.camada = null;
      palco.replaceChildren();
      history.replaceState(null, '', '#provador');
      if (estado.retorno && estado.retorno.isConnected) estado.retorno.focus();
    });

    dialogo.addEventListener('keydown', (evento) => {
      if (evento.key === 'ArrowLeft') {
        evento.preventDefault();
        navegar(-1);
      } else if (evento.key === 'ArrowRight') {
        evento.preventDefault();
        navegar(1);
      } else if (evento.key === 'Tab') {
        const lista = focaveis();
        if (!lista.length) return;
        const primeiro = lista[0];
        const ultimo = lista[lista.length - 1];
        if (evento.shiftKey && document.activeElement === primeiro) {
          evento.preventDefault();
          ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
          evento.preventDefault();
          primeiro.focus();
        }
      }
    });

    let toque = null;
    let deslizou = false;

    palco.addEventListener('pointerdown', (evento) => {
      if (!evento.isPrimary) return;
      toque = { id: evento.pointerId, x: evento.clientX, y: evento.clientY };
      deslizou = false;
    });

    palco.addEventListener('pointerup', (evento) => {
      if (!toque || evento.pointerId !== toque.id) return;
      const dx = evento.clientX - toque.x;
      const dy = evento.clientY - toque.y;
      toque = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        deslizou = true;
        navegar(dx < 0 ? 1 : -1);
      }
    });

    palco.addEventListener('pointercancel', () => { toque = null; });

    palco.addEventListener('click', (evento) => {
      if (deslizou) {
        deslizou = false;
        return;
      }
      const moldura = evento.target.closest('.mostruario__moldura');
      if (!moldura) return;
      const caixa = moldura.getBoundingClientRect();
      navegar(evento.clientX < caixa.left + caixa.width / 2 ? -1 : 1);
    });

    window.addEventListener('resize', () => {
      if (!dialogo.open || !estado.camada) return;
      ajustar(estado.camada.firstElementChild, estado.album.fotos[estado.indice]);
      rolarTira(estado.indice);
    });
  }

  function abrirDoEndereco() {
    const partes = location.hash.match(DEEP_LINK);
    if (!partes) return;
    const album = estado.albuns.find((a) => a.slug === decodeURIComponent(partes[1]));
    if (!album) return;
    const indice = Math.min(Math.max(parseInt(partes[2], 10) - 1, 0), album.fotos.length - 1);
    if (dialogo.open && estado.album === album && estado.indice === indice) return;
    secao.scrollIntoView({ block: 'start', behavior: 'instant' });
    abrir(album, indice, mesa.querySelector(`[data-slug="${album.slug}"]`), null);
  }

  function semAlbuns() {
    secao.classList.add('provador--vazio');
  }

  async function iniciar() {
    let albuns;
    try {
      const resposta = await fetch('assets/data/albuns.json');
      if (!resposta.ok) throw new Error(resposta.status);
      albuns = (await resposta.json()).filter((album) => album.fotos && album.fotos.length);
    } catch (_) {
      semAlbuns();
      return;
    }
    if (!albuns.length) {
      semAlbuns();
      return;
    }

    estado.albuns = albuns;
    mesa.append(...albuns.map(montarPilha));
    montarFaixa(albuns);
    mesa.hidden = false;
    faixa.hidden = false;

    animarQueda();
    ligarMostruario();
    abrirDoEndereco();
    window.addEventListener('hashchange', abrirDoEndereco);
  }

  iniciar();
})();
