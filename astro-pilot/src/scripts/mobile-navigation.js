export function setupMobileNavigation(root = document, view = window) {
  const mobileNav = root.querySelector('[data-mobile-nav]');
  const mobileNavToggle = root.querySelector('[data-mobile-nav-toggle]');
  if (!mobileNav || !mobileNavToggle) return false;

  function syncMobileNav() {
    const expanded = mobileNav.open;
    mobileNavToggle.setAttribute('aria-expanded', String(expanded));
    mobileNavToggle.setAttribute('aria-label', expanded ? 'Close navigation menu' : 'Open navigation menu');
  }

  function closeMobileNav(returnFocus) {
    if (!mobileNav.open) return;
    mobileNav.open = false;
    syncMobileNav();
    if (returnFocus) mobileNavToggle.focus({ preventScroll: true });
  }

  mobileNav.addEventListener('toggle', syncMobileNav);
  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => closeMobileNav(true));
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mobileNav.open) {
      event.preventDefault();
      closeMobileNav(true);
    }
  });

  const desktopNavQuery = view.matchMedia('(min-width: 981px)');
  desktopNavQuery.addEventListener('change', (event) => {
    if (event.matches) closeMobileNav(false);
  });
  syncMobileNav();
  return true;
}
