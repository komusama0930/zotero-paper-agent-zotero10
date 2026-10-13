# Math dependency provenance

KaTeX **0.16.22**, licensed **MIT**, by Khan Academy and other contributors.

- Exact source: https://github.com/KaTeX/KaTeX/tree/v0.16.22
- Official npm tarball: https://registry.npmjs.org/katex/-/katex-0.16.22.tgz
- Version and verified npm integrity: compatibility/vendor/katex/provenance.json
- Original copyright and license: compatibility/vendor/katex/LICENSE

Official distribution JS, CSS and fonts are vendored without editing. Their MIT
license is retained and is not replaced by the project's AGPL license. The builder
includes that notice in LICENSES/KaTeX-MIT.txt and keeps dependency files and provenance
in the package. Integration sources are assets/math.js and patches/y_math.py.

Rendering happens offline; no remote script, font or CDN is used. The renderer uses
trust:false, bounded expansion and size, and preserves unparseable source instead
of inserting raw model-generated HTML. KaTeX implements a subset of LaTeX math,
not arbitrary TeX documents/packages. Inline and fenced code are not rendered as math.
