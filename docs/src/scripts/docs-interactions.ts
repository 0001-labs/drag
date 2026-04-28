export function setupDocsInteractions(): void {
  setupSidebar();
  setupDragStatus();
}

function setupSidebar(): void {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const menuButton = document.getElementById('mobile-menu-btn');
  const closeButton = document.getElementById('sidebar-close-btn');

  const openSidebar = (): void => {
    sidebar?.classList.add('open');
    overlay?.classList.add('active');
    menuButton?.classList.add('active');
    document.body.classList.add('sidebar-open');
  };

  const closeSidebar = (): void => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('active');
    menuButton?.classList.remove('active');
    document.body.classList.remove('sidebar-open');
  };

  menuButton?.addEventListener('click', () => {
    if (sidebar?.classList.contains('open')) {
      closeSidebar();
      return;
    }

    openSidebar();
  });

  closeButton?.addEventListener('click', closeSidebar);
  overlay?.addEventListener('click', closeSidebar);

  sidebar?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    });
  });
}

function setupDragStatus(): void {
  document.querySelectorAll('drag-list[data-docs-demo]').forEach((list) => {
    list.addEventListener('0001-drag-reorder', (event) => {
      const values = getReorderValues(event);
      const statusId = list.getAttribute('data-status-target');
      const mirrorId = list.getAttribute('data-announcement-target');
      const status = statusId ? document.getElementById(statusId) : null;
      const mirror = mirrorId ? document.getElementById(mirrorId) : null;

      if (status) {
        status.textContent = `Order: ${values.join(' -> ')}`;
      }

      const liveRegion = list.querySelector('[data-0001-drag-live-region]');

      if (mirror && liveRegion?.textContent) {
        mirror.textContent = liveRegion.textContent;
      }
    });
  });
}

function getReorderValues(event: Event): string[] {
  if (!(event instanceof CustomEvent)) {
    return ['updated'];
  }

  const detail: unknown = event.detail;

  if (!isReorderDetail(detail)) {
    return ['updated'];
  }

  return detail.values;
}

function isReorderDetail(value: unknown): value is { values: string[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'values' in value &&
    Array.isArray(value.values) &&
    value.values.every((item) => typeof item === 'string')
  );
}
