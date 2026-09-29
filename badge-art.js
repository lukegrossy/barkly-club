/* Barkly original vector achievement collection. Fixed artwork only; no user SVG. */
(function () {
  'use strict';
  const navy = '#102334', sage = '#8da995', cream = '#faf6eb';
  const dog = `<path d="M35 79V61C29 59 27 50 30 42C31 33 37 28 44 29C50 21 63 23 68 31C72 36 78 37 85 35L85 44C84 54 78 59 67 59L65 79" fill="${cream}"/><path d="M42 34C34 36 32 46 35 55C38 61 44 58 45 51L47 39" fill="${sage}"/><path d="M59 38q4 4 8 0M68 52q8 2 13-3"/><path d="M80 35l7-1v7q-8 3-7-6" fill="${navy}"/>`;
  const heart = `<path d="M0 5C-10-7-20 5-10 15L0 23L10 15C20 5 10-7 0 5Z" fill="${sage}"/>`;
  const star = `<path d="M0-10L3-3L11-2L5 3L7 11L0 7L-7 11L-5 3L-11-2L-3-3Z" fill="${sage}"/>`;
  const paw = `<path d="M-9 6Q0-6 9 6Q14 18 0 14Q-14 18-9 6Z" fill="${sage}"/><ellipse cx="-10" cy="-3" rx="3" ry="4"/><ellipse cx="-3" cy="-8" rx="3" ry="4"/><ellipse cx="5" cy="-8" rx="3" ry="4"/><ellipse cx="12" cy="-2" rx="3" ry="4"/>`;
  const defs = [
    ['connection','First Connection',0, dog+`<g transform="translate(80 66) scale(.65)">${heart}</g><path d="M23 25v8m-4-4h8"/>`],
    ['explorer','Curious Explorer',0,dog+`<path d="M72 81Q68 60 88 59Q91 77 72 81ZM72 81l11-15M25 71l-6-6m6 6l-7 3" fill="${sage}"/>`],
    ['recall','Recall Rookie',0,`<g transform="translate(-7 2)">${dog}</g><path d="M80 56q17-8 9-23m0 0l-1 8m1-8l-8 3M22 68h-8m10 8H13"/><g transform="translate(77 79) scale(.45)">${heart}</g>`],
    ['calm','Calm Beginnings',0,`<rect x="22" y="69" width="76" height="17" rx="8" fill="${sage}"/><path d="M33 70q-7-14 0-21q4-9 17-4q8-12 19-4l14 6q10 1 7 10q-2 7-17 6l-6 8Z" fill="${cream}"/><path d="M49 46q-9 2-7 16q6 7 11-3M63 49q3 3 6 0M37 76h31M79 29l5-5m-2 14h7"/>`],
    ['puppy-graduate','Puppy School Graduate',0,dog+`<path d="M31 27L56 16L81 27L56 36Z" fill="${sage}"/><path d="M37 31v9m43-12v17"/><circle cx="80" cy="48" r="3" fill="${sage}"/><path d="M42 74l13-7l12 7l-12 7Z" fill="${sage}"/>`],
    ['focus','Focus Finder',1,dog+`<circle cx="83" cy="69" r="13" fill="${cream}"/><circle cx="83" cy="69" r="6" fill="${sage}"/><path d="M83 50v4m0 30v4m-19-19h4m30 0h4"/>`],
    ['walking','Walking Buddy',1,`<path d="M25 62q-10 1-9-12M27 58h33l5-18q4-9 13-5l6 7h10v9q-4 8-16 7l-3 15v12h-9V72H42v13h-9V71q-10-1-6-13Z" fill="${cream}"/><path d="M68 38q-8 4-3 14q5 4 8-3V39" fill="${sage}"/><path d="M59 60Q41 38 34 31Q29 25 25 29q-5 5 2 10"/><circle cx="81" cy="44" r="1.5" fill="${navy}"/><path d="M20 91h77"/>`],
    ['polite','Polite Paws',1,`<g transform="translate(44 53) scale(1.35)">${paw}</g><path d="M68 72l6-9V47q0-7 6-5v15l6-11q4-5 7-1l-6 15q14-9 15-2l-9 15q-8 13-19 6Z" fill="${cream}"/><g transform="translate(76 28) scale(.5)">${heart}</g>`],
    ['next-graduate','Next Steps Graduate',1,`<path d="M36 72l-6 26l19-9l11 8l7-25" fill="${sage}"/><circle cx="60" cy="49" r="29" fill="${cream}"/><g transform="translate(60 44) scale(1.15)">${paw}</g><path d="M78 29l5 5l10-11"/>`],
    ['reconnected','Team Reconnected',2,`<path d="M47 48l-8-8q-14-10-21 3q-5 10 6 19l17 13q9 6 16-2l9-10M72 63l10 8q12 8 18-3q6-10-6-20L78 35q-10-6-17 3L50 51" fill="${cream}"/><g transform="translate(60 49) scale(.8)">${heart}</g>`],
    ['choices','Thoughtful Choices',2,`<path d="M28 80V30h39v50M33 80h-9m49 0h-9"/><path d="M35 36l25 6v34L35 81Z" fill="${sage}"/><circle cx="52" cy="60" r="2" fill="${navy}"/><g transform="translate(87 61) scale(.85)">${paw}</g><path d="M79 35l5 5l10-11"/>`],
    ['teammate','Everyday Teammate',2,`<path d="M20 80Q40 92 59 75T101 70"/><g transform="translate(40 47) rotate(-20)">${paw}</g><g transform="translate(78 43) rotate(15) scale(.8)">${paw}</g><path d="M25 27l5-6m65 31h7"/>`],
    ['together','Growing Together',2,`<path d="M59 86V52M59 70Q31 75 30 48Q55 43 59 70ZM60 58Q84 62 88 33Q61 30 60 58Z" fill="${sage}"/><g transform="translate(60 28) scale(.7)">${heart}</g><path d="M38 88h44"/>`]
  ];
  const aliases = {'First Session':'connection','Lead Walker':'walking','Social Star':'polite','Graduate':'puppy-graduate','Puppy Graduate':'puppy-graduate'};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(icon, name='') {
    const key = String(icon || '').replace(/^barkly-/, '');
    const d = defs.find(d => d[0] === key) || defs.find(d => d[1] === name || d[0] === aliases[name]);
    if (!d) return `<i data-lucide="${esc(icon || 'badge-check')}"></i>`;
    const [,label,group,scene]=d;
    const background=[cream,'#e6eee7',navy][group];
    const border=[sage,sage,'#a7bfae'][group];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" class="barkly-badge-art" role="img" aria-label="${esc(label)}"><circle cx="60" cy="60" r="56" fill="${background}" stroke="${border}" stroke-width="2"/><circle cx="60" cy="60" r="50" fill="none" stroke="${border}" stroke-width="1" stroke-dasharray="2 5"/><g stroke="${group===2?'#102334':navy}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none">${group===2?'<circle cx="60" cy="57" r="40" fill="#faf6eb" stroke="none"/>':''}${scene}</g><g fill="${border}"><circle cx="52" cy="102" r="2"/><circle cx="60" cy="102" r="2"/>${group>0?'<circle cx="68" cy="102" r="2"/>':''}</g></svg>`;
  }
  window.BarklyBadges = {render, choices: defs.map(([key,label,group])=>['barkly-'+key,label,group])};
  const style=document.createElement('style');
  style.textContent='.badge-icon .barkly-badge-art,.badge-mark .barkly-badge-art{width:100%;height:100%;max-width:96px;max-height:96px}.badge-icon:has(.barkly-badge-art){width:76px;height:76px;background:transparent}.icon-choice .barkly-badge-art{width:62px;height:62px}.icon-choice:has(.barkly-badge-art){min-height:104px;font-size:11px;line-height:1.2;padding:6px}.chip .barkly-badge-art{width:56px;height:56px;display:block;margin:0 auto 5px}.locked .barkly-badge-art{opacity:.5;filter:grayscale(.7)}';
  document.head.append(style);
})();
