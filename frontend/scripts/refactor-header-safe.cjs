const fs = require('fs');
let text = fs.readFileSync('src/components/Header.astro', 'utf8');

// JS Selectors
text = text.replace(/'.monroe-global-nav__menu-toggle'/g, "'[data-nav-toggle]'");
text = text.replace(/'.monroe-global-nav__backdrop'/g, "'[data-nav-backdrop]'");
text = text.replace(/'.monroe-global-nav__item.is-open'/g, "'[data-nav-item].is-open'");
text = text.replace(/'.monroe-global-nav__trigger'/g, "'[data-nav-trigger]'");
text = text.replace(/'.monroe-global-nav__dropdown'/g, "'[data-nav-dropdown]'");
text = text.replace(/'.monroe-global-nav__link'/g, "'[data-nav-link]'");
text = text.replace(/'.monroe-global-nav__item.has-children'/g, "'[data-nav-item].has-children'");
text = text.replace(/':scope > .monroe-global-nav__item.is-open'/g, "':scope > [data-nav-item].is-open'");
text = text.replace(/dd.closest\('.monroe-global-nav__item'\)/g, "dd.closest('[data-nav-item]')");

// HTML Classes
text = text.replace(/class="monroe-global-nav /g, 'class="');
text = text.replace(/class="monroe-global-nav__backdrop /g, 'data-nav-backdrop class="');
text = text.replace(/class="monroe-global-nav__inner /g, 'class="');
text = text.replace(/class="monroe-global-nav__bar /g, 'class="');
text = text.replace(/class="monroe-global-nav__bar-cta /g, 'class="');
text = text.replace(/class="monroe-global-nav__bar-adopt /g, 'class="');
text = text.replace(/class="monroe-global-nav__bar-donate /g, 'class="');
text = text.replace(/class="monroe-global-nav__brand /g, 'class="');
text = text.replace(/class="monroe-global-nav__menu-toggle /g, 'data-nav-toggle class="');
text = text.replace(/class="monroe-global-nav__panel /g, 'class="');
text = text.replace(/class="monroe-global-nav__list /g, 'class="');
text = text.replace(/class:list=\{\['monroe-global-nav__item', 'has-children'/g, "data-nav-item class:list={['has-children'");
text = text.replace(/class="monroe-global-nav__trigger /g, 'data-nav-trigger class="');
text = text.replace(/class="monroe-global-nav__chevron /g, 'class="');
text = text.replace(/class="monroe-global-nav__dropdown /g, 'data-nav-dropdown class="');
text = text.replace(/class="monroe-global-nav__dropdown-link monroe-global-nav__dropdown-link--top /g, 'data-nav-link class="');
text = text.replace(/class="monroe-global-nav__dropdown-overview /g, 'class="');
text = text.replace(/class="monroe-global-nav__submenu /g, 'class="');
text = text.replace(/class="monroe-global-nav__item"/g, 'data-nav-item');
text = text.replace(/class="monroe-global-nav__link /g, 'data-nav-link class="');
text = text.replace(/class:list=\{\['monroe-global-nav__item', \{/g, "data-nav-item class:list={[{");
text = text.replace(/class="monroe-global-nav__cta-row /g, 'class="');
text = text.replace(/class="monroe-global-nav__donate /g, 'class="');
text = text.replace(/class="monroe-global-nav__call /g, 'class="');
text = text.replace(/class="monroe-global-nav__application /g, 'class="');

fs.writeFileSync('src/components/Header.astro', text, 'utf8');
console.log('Fixed Header.astro');