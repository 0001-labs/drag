// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://drag.0001.dev',
  outDir: '../docs-dist',
  publicDir: '../play/ds1',
  devToolbar: { enabled: false },
  // Play lived on a page of its own; it is the front page now.
  redirects: { '/playground': '/' },
  vite: { server: { fs: { allow: ['..'] } } },
  integrations: [starlight({
    title: 'Drag',
    pagefind: false,
    favicon: '/icons/handle.svg',
    description: 'Drag and drop for lists, boards and grids. TypeScript, React and Web Components.',
    expressiveCode: {
      defaultProps: { wrap: true },
      plugins: [{ name: 'Not prose', hooks: {
        postprocessRenderedBlock: ({ renderData }) => { renderData.blockAst.properties.dataDsNotProse = ''; },
      } }],
    },
    social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/0001-labs/Drag' }],
    components: {
      Head: './src/components/MyHead.astro',
      Header: './src/components/MyHeader.astro',
      Sidebar: './src/components/MySidebar.astro',
      PageFrame: './src/components/PageFrame.astro',
      TwoColumnContent: './src/components/TwoColumnContent.astro',
      MarkdownContent: './src/components/MarkdownContent.astro',
      PageTitle: './src/components/Heading.astro',
    },
    customCss: ['./src/styles/custom.css'],
    sidebar: [
      { label: 'Play', slug: '' },
      { label: 'Overview', slug: 'overview' },
      { label: 'Start here', items: [
        { label: 'Install', slug: 'start-here/install' },
        { label: 'Sortable lists', slug: 'start-here/sortable' },
        { label: 'React', slug: 'start-here/react' },
        { label: 'Web Components', slug: 'start-here/web-components' },
        { label: 'Native drag', slug: 'start-here/manual-setup' },
      ] },
      { label: 'Examples', items: [
        { label: 'Sortable demo', slug: 'examples/sortable' },
        { label: 'Grid demo', slug: 'examples/grid' },
        { label: 'HTML lists', slug: 'examples/live-demo' },
        { label: 'Keyboard reorder', slug: 'examples/keyboard-reorder' },
      ] },
      { label: 'API', items: [
        { label: 'Sortable', slug: 'api/sortable' },
        { label: 'Grid', slug: 'api/grid' },
        { label: 'Tiles', slug: 'api/tiles' },
        { label: 'Element adapter', slug: 'api/element-adapter' },
        { label: 'Utilities', slug: 'api/utilities' },
      ] },
      { label: 'Guides', items: [
        { label: 'Accessibility', slug: 'guides/accessibility' },
        { label: 'Styling', slug: 'guides/styling' },
        { label: 'Lifecycle and cleanup', slug: 'guides/lifecycle' },
      ] },
    ],
  })],
});
