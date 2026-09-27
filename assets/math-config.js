window.MathJax = {
  loader: { load: ['[tex]/braket', '[tex]/cancel'] },
  tex: { packages: { '[+]': ['braket', 'cancel'] }, tags: 'ams', processEnvironments: true,
    inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']],
    macros: { oiint: '\\mathop{\\unicode{x222F}}', oiiint: '\\mathop{\\unicode{x2230}}' } },
  options: { ignoreHtmlClass: 'tex-unsupported' },
  startup: {
    elements: ['.tex-paper'],
    pageReady() {
      return MathJax.startup.defaultPageReady().then(() => {
        const status = document.querySelector('.math-status');
        if (status) status.textContent = 'LaTeX equations · rendered locally · original numbering preserved';
        // Revisit direct section links after typesetting changes document height.
        if (location.hash) {
          try { document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView(); } catch { /* malformed fragment */ }
        }
      }).catch(error => {
        const status = document.querySelector('.math-status');
        if (status) status.textContent = 'Equation rendering failed. Original LaTeX remains available in the source download.';
        console.error(error);
      });
    }
  }
};