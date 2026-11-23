// ============================================================
// Paróquia Imaculado Coração de Maria — interações da home
// ============================================================

(() => {
  'use strict';

  const SESSION_KEY = 'isNewSession';
  const isNewSession = sessionStorage.getItem(SESSION_KEY);

  const ui = {};
  let resizeFrameId = null;

  // ------------------------------------------------------------
  // Inicialização
  // ------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', () => {
    ui.header = document.querySelector('.site-header');
    ui.hero = document.querySelector('.hero');
    ui.heroZoom = document.querySelector('.hero-zoom');
    ui.heroWrapper = document.querySelector('.hero-wrapper');
    ui.heroText = document.querySelector('.hero-container');
    ui.mary = document.querySelector('.mary-container');
    ui.logo = document.querySelector('.logo');
    ui.lockOverlay = document.querySelector('#lock-overlay');

    initializeHero();
    bindLinkHandler();
    bindBackToTop();
  });

  // ------------------------------------------------------------
  // Espera pelo carregamento/decodificação das imagens do hero
  // ------------------------------------------------------------

  function waitForImage(image) {
    if (!image) return Promise.resolve();

    if (image.complete) {
      return image.decode().catch(() => { });
    }

    return new Promise((resolve) => {
      image.addEventListener('load', () => {
        image.decode().catch(() => { }).finally(resolve);
      }, { once: true });

      image.addEventListener('error', resolve, { once: true });
    });
  }

  async function initializeHero() {
    // Imagens presentes no HTML do splash
    const htmlImages = Array.from(document.querySelectorAll('.mary-container img'));

    // Imagens usadas como background no CSS
    const backgroundImages = ['./sky.webp', './mary.webp'].map((src) => {
      const image = new Image();
      image.src = src;
      return image;
    });

    await Promise.all([...htmlImages, ...backgroundImages].map(waitForImage));

    requestAnimationFrame(() => {
      requestAnimationFrame(handleSplashScreen);
    });
  }

  // ------------------------------------------------------------
  // Splash / animação de abertura
  // ------------------------------------------------------------

  function handleSplashScreen() {
    // Sessão já iniciada → sem splash
    if (isNewSession === 'false') {
      if (ui.hero) {
        ui.hero.style.transform = 'scale(1)';
        ui.hero.style.willChange = 'auto';
      }

      if (ui.heroZoom) {
        ui.heroZoom.style.willChange = 'auto';
      }

      if (ui.logo) {
        ui.logo.style.willChange = 'auto';
        ui.logo.remove();
      }

      ui.lockOverlay?.remove();

      setupAfterInitialAnimation();
      return;
    }

    // Primeira visita na sessão: calcula geometria sem layout thrashing
    prepareHeroGeometry();

    ui.heroWrapper?.classList.add('shrink-anim');
    ui.heroZoom?.classList.add('hero-anim');
    ui.logo?.classList.add('decrease-opacity-anim');
    ui.header?.classList.add('increase-opacity-anim');
    ui.heroText?.classList.add('increase-opacity-anim');
    ui.lockOverlay?.classList.add('lock-overlay-anim');

    ui.heroZoom?.addEventListener('animationend', () => {
      setTimeout(setupAfterInitialAnimation, 3000);
    }, { once: true });

    setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, 'false');
    }, 5000);
  }

  // ------------------------------------------------------------
  // Pós-animação inicial
  // ------------------------------------------------------------

  function setupAfterInitialAnimation() {
    document.body.classList.remove('scroll-lock');
    setupHeaderObserver();

    if (ui.header && isNewSession) {
      ui.header.style.opacity = '1';
      ui.header.style.willChange = 'auto';
    }

    // Libera camadas pesadas da GPU após o término da abertura
    if (ui.hero) ui.hero.style.willChange = 'auto';
    if (ui.heroZoom) ui.heroZoom.style.willChange = 'auto';
    if (ui.heroText) ui.heroText.style.willChange = 'auto';

    if (ui.logo) {
      ui.logo.style.willChange = 'auto';
      ui.logo.remove();
    }

    ui.lockOverlay?.remove();
  }

  function setupHeaderObserver() {
    const chevronUpBtn = document.getElementById('chevron-up-btn');

    if (!ui.hero || !ui.header) return;

    const observer = new IntersectionObserver((entries) => {
      const heroVisible = entries[0].isIntersecting;

      ui.header.classList.toggle('is-scrolled', !heroVisible);
      if (chevronUpBtn) chevronUpBtn.hidden = heroVisible;
    }, { threshold: 0 });

    observer.observe(ui.hero);
  }

  // ------------------------------------------------------------
  // Geometria dinâmica do hero (leituras em lote antes das escritas)
  // ------------------------------------------------------------

  function prepareHeroGeometry() {
    if (!ui.logo || !ui.hero || !ui.heroZoom || !ui.heroWrapper || !ui.mary) return;

    // 1. Todas as leituras juntas antes de qualquer escrita
    const logoRect = ui.logo.getBoundingClientRect();
    const heroRect = ui.hero.getBoundingClientRect();
    const maryRect = ui.mary.getBoundingClientRect();
    const viewportCenter = window.innerWidth / 2;

    // 2. Calcula transform-origin relativo ao .hero
    const originX =
      ((logoRect.left + logoRect.width / 2) - heroRect.left) /
      heroRect.width * 100;

    const originY =
      ((logoRect.top + logoRect.height / 2) - heroRect.top) /
      heroRect.height * 105;

    const originValue = `${originX}% ${originY}%`;

    // 3. Como .hero está com scale(--hero-scale), a distância visual até o centro
    // precisa ser compensada pela escala atual para bater no centro da tela
    const scale = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--hero-scale')
    ) || 1;

    const maryCenter = maryRect.left + maryRect.width / 2;
    const rawDeltaX = viewportCenter - maryCenter;
    const compensatedOffsetX = `${rawDeltaX / scale}px`;

    // 4. Todas as escritas em lote
    ui.heroZoom.style.transformOrigin = originValue;
    document.documentElement.style.setProperty('--transform-origin', originValue);
    ui.heroWrapper.style.setProperty('--hero-offset-x', compensatedOffsetX);
  }

  window.addEventListener('resize', () => {
    if (isNewSession === 'false') return;
    if (resizeFrameId !== null) return;

    resizeFrameId = requestAnimationFrame(() => {
      resizeFrameId = null;
      prepareHeroGeometry();
    });
  }, { passive: true });

  // ------------------------------------------------------------
  // Interações globais
  // ------------------------------------------------------------

  function bindLinkHandler() {
    // Os links da home são placeholders (#). Cancela a navegação padrão
    // para não alterar URL ou rolagem.
    document.body.addEventListener('click', (event) => {
      if (event.target.closest('a')) event.preventDefault();
    });
  }

  function bindBackToTop() {
    const button = document.getElementById('chevron-up-btn');
    if (!button) return;

    button.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();