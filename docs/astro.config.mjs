// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://drag.0001.dev',
  outDir: '../docs-dist',
  vite: {
    server: {
      fs: {
        allow: ['..'],
      },
    },
  },
  integrations: [
    starlight({
      title: '@0001-labs/drag',
      description:
        'Framework-agnostic drag-and-drop primitives, Web Components, and accessibility helpers.',
      defaultLocale: 'root',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/0001-labs/drag',
        },
      ],
      components: {
        Head: './src/components/MyHead.astro',
        Header: './src/components/MyHeader.astro',
        Sidebar: './src/components/MySidebar.astro',
        PageFrame: './src/layouts/Layout.astro',
        h1: './src/components/Heading.astro',
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Start Here',
          items: [
            { label: 'Introduction', slug: '' },
            { label: 'Manual Setup', slug: 'start-here/manual-setup' },
          ],
        },
        {
          label: 'Examples',
          items: [
            { label: 'Live Demo', slug: 'examples/live-demo' },
            { label: 'Keyboard Reorder', slug: 'examples/keyboard-reorder' },
          ],
        },
        {
          label: 'API',
          items: [
            { label: 'Element Adapter', slug: 'api/element-adapter' },
            { label: 'Utilities', slug: 'api/utilities' },
          ],
        },
        {
          label: 'Guides',
          items: [{ label: 'Accessibility', slug: 'guides/accessibility' }],
        },
      ],
    }),
  ],
});
