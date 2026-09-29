/* Barkly illustrated achievements. Artwork is generated from the approved concept.
 * Fixed atlas bounds keep saved icon IDs and existing badge awards compatible.
 */
(function () {
  'use strict';
  const atlases = {
    original: ['original-illustrated.webp',1536,1024],
    preschool: ['preschool-illustrated.webp',1536,1024],
    next: ['next-illustrated.webp',1254,1254],
    adolescent: ['adolescent-illustrated.webp',1254,1254]
  };
  // key, display name, collection, artwork bounds (not including a small clear margin)
  const definitions = [
    ['first-session','First Session','original',[63,35,514,487]],
    ['original-recall','Recall Rookie','original',[543,35,992,487]],
    ['lead-walker','Lead Walker','original',[1021,36,1472,487]],
    ['social-star','Social Star','original',[63,516,514,967]],
    ['graduate','Graduate','original',[543,516,993,967]],
    ['off-leash','Off Leash Ready','original',[1021,516,1473,967]],
    ['connection','First Connection','preschool',[29,27,506,499]],
    ['explorer','Curious Explorer','preschool',[528,27,1008,500]],
    ['recall','Recall Rookie','preschool',[1029,27,1507,499]],
    ['calm','Calm Beginnings','preschool',[29,525,509,989]],
    ['puppy-graduate','Puppy School Graduate','preschool',[534,525,1003,994]],
    ['focus','Focus Finder','next',[52,49,614,610]],
    ['walking','Walking Buddy','next',[639,49,1203,610]],
    ['polite','Polite Paws','next',[41,638,612,1199]],
    ['next-graduate','Next Steps Graduate','next',[638,638,1211,1200]],
    ['reconnected','Team Reconnected','adolescent',[38,36,605,589]],
    ['choices','Thoughtful Choices','adolescent',[647,36,1215,590]],
    ['teammate','Everyday Teammate','adolescent',[33,643,611,1204]],
    ['together','Growing Together','adolescent',[647,642,1220,1205]]
  ];
  const groups = [
    ['original','Original achievements'], ['preschool','Puppy Preschool'],
    ['next','Puppy Next Steps'], ['adolescent','Adolescent Foundations']
  ];
  const legacy = {
    'badge-check':'graduate',sparkles:'first-session',star:'social-star',radio:'original-recall',
    footprints:'lead-walker',leaf:'calm',target:'focus','graduation-cap':'puppy-graduate',
    heart:'connection','shield-check':'choices',lock:'off-leash'
  };
  const aliases = {'Puppy Graduate':'puppy-graduate'};
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function resolve(icon,name) {
    const key = String(icon || '').replace(/^barkly-/,'');
    return definitions.find(d=>d[0]===key) || definitions.find(d=>d[1]===name || d[0]===aliases[name]) || definitions.find(d=>d[0]===legacy[icon]) || definitions[0];
  }
  function render(icon,name='') {
    const d=resolve(icon,name);
    const [,label,group,[left,top,right,bottom]]=d;
    const [file,width,height]=atlases[group];
    const size=Math.max(right-left,bottom-top)+12;
    const x=(left+right-size)/2, y=(top+bottom-size)/2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${size} ${size}" class="barkly-badge-art" role="img" aria-label="${escape(name || label)}" overflow="hidden"><image href="assets/badges/${file}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none"/></svg>`;
  }
  window.BarklyBadges = {render,groups,choices:definitions.map(([key,label,group])=>['barkly-'+key,label,group])};
  const style=document.createElement('style');
  style.textContent=`
    .barkly-badge-art{display:block;flex-shrink:0;overflow:hidden;isolation:isolate}
    .badge-icon .barkly-badge-art,.badge-mark .barkly-badge-art{width:100%;height:100%;max-width:none;max-height:none}
    .badge-icon:has(.barkly-badge-art){width:88px;height:88px;background:transparent;border-radius:0}
    .badge-mark:has(.barkly-badge-art){width:88px;height:88px;background:transparent;border-radius:0;margin-inline:auto}
    .icon-choice .barkly-badge-art{width:76px;height:76px}
    .icon-choice:has(.barkly-badge-art){min-height:116px;font-size:11px;line-height:1.25;padding:7px 3px}
    .badge-preview-chip .barkly-badge-art{width:48px;height:48px}
    .chip .barkly-badge-art{width:72px;height:72px;display:block;margin:0 auto 6px}
    .locked .barkly-badge-art{opacity:.48;filter:grayscale(.75)}
    .icon-group-title{grid-column:1/-1;font-size:12px;color:#526459;margin:14px 0 2px;font-weight:750}
    @media(max-width:360px){.badge-icon:has(.barkly-badge-art){width:68px;height:68px}.icon-choice .barkly-badge-art{width:64px;height:64px}}
  `;
  document.head.append(style);
})();
