window.MathJax = {
  loader: { load: ['[tex]/braket', '[tex]/cancel'] },
  tex: { packages: { '[+]': ['braket', 'cancel'] }, tags: 'ams', processEnvironments: true,
    inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']],
    macros: { oiint: '\\mathop{\\unicode{x222F}}', oiiint: '\\mathop{\\unicode{x2230}}', Tr: '\\operatorname{Tr}', Tilde: '\\tilde' } },
  options: { ignoreHtmlClass: 'tex-unsupported' },
  startup: {
    elements: ['.tex-paper'],
    pageReady() {
      return MathJax.startup.defaultPageReady().then(() => {
        const status = document.querySelector('.math-status');
        const failures = document.querySelectorAll('.tex-paper mjx-merror, .tex-paper [data-mjx-error]');
        const undefinedCommands = [...document.querySelectorAll('.tex-paper mjx-mtext')]
          .filter(node => node.style.color === 'red' || node.getAttribute('mathcolor') === 'red');
        if (status) status.textContent = failures.length || undefinedCommands.length
          ? 'Equations rendered locally · some formulas need source review'
          : 'LaTeX equations · rendered locally · numbered in reader order';
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