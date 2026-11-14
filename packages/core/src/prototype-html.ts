import { decodeRasterDataUrl, type PageId } from "@nodetto/ir";
import type { Editor } from "./editor.ts";
import { orderedTopLevelFrames } from "./frame-order.ts";
import { persistentLayerPairs, prototypeFlows } from "./prototype-links.ts";
import { prototypeScreen } from "./prototype.ts";
import { renderSelectionSvg } from "./svg-export/document.ts";
import { escapeXml } from "./svg-export/markup.ts";

/** SVG IDs are document-scoped once multiple fragments are embedded in HTML. */
function scopeSvgIds(svg: string, prefix: string): string {
  const ids = new Set(
    [...svg.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]),
  );
  return svg.replace(
    /(\sid=")([^"]+)(")|url\(#([^)]*)\)|(\s(?:xlink:)?href=")#([^"]+)(")/g,
    (match, idStart, id, idEnd, urlId, hrefStart, hrefId, hrefEnd) => {
      if (id !== undefined) return `${idStart}${prefix}${id}${idEnd}`;
      if (urlId !== undefined && ids.has(urlId))
        return `url(#${prefix}${urlId})`;
      if (hrefId !== undefined && ids.has(hrefId))
        return `${hrefStart}#${prefix}${hrefId}${hrefEnd}`;
      return match;
    },
  );
}

/** Export a deterministic, self-contained interactive presentation. */
export function exportPrototypeHtml(
  editor: Editor,
  options: {
    readonly pageId?: PageId;
    readonly flow?: string;
    readonly device: "none" | "frame";
    readonly resolveAsset?: (src: string) => string;
  },
): string {
  const page = options.pageId ?? editor.currentPageId;
  const context = editor.createShapeContext();
  const flows = prototypeFlows(editor.store, context).flows.filter(
    (flow) => editor.store.get(flow.startId)?.page === page,
  );
  const flow =
    options.flow === undefined
      ? flows[0]
      : flows.find((item) => item.name === options.flow);
  if (options.flow !== undefined && !flow)
    throw new Error(
      `unknown flow "${options.flow}"; flows: ${flows.map((item) => item.name).join(", ")}`,
    );
  const start =
    flow?.startId ?? orderedTopLevelFrames(editor.store, page, context)[0];
  if (!start) throw new Error("Create an artboard to export a prototype.");
  const queue = [start];
  const seen = new Set(queue);
  const screens: NonNullable<ReturnType<typeof prototypeScreen>>[] = [];
  for (const id of queue) {
    const screen = prototypeScreen(editor, id);
    if (!screen) continue;
    screens.push(screen);
    for (const link of screen.links)
      if (
        link.action !== "back" &&
        link.action !== "close-overlay" &&
        !seen.has(link.to)
      ) {
        seen.add(link.to);
        queue.push(link.to);
      }
  }
  const fixed = new Map<string, Set<string>>();
  for (const screen of screens)
    for (const link of screen.links) {
      if (link.action !== "navigate") continue;
      for (const pair of persistentLayerPairs(
        editor.store,
        context,
        screen.frame.id,
        link.to,
      )) {
        for (const [screenId, layerId] of [
          [screen.frame.id, pair.from],
          [link.to, pair.to],
        ] as const) {
          const ids = fixed.get(screenId) ?? new Set<string>();
          ids.add(layerId);
          fixed.set(screenId, ids);
        }
      }
    }
  const resolveAsset = (source: string): string => {
    const resolved =
      editor.assets.resolve(source) ?? options.resolveAsset?.(source);
    if (!resolved) throw new Error(`Cannot export missing image: ${source}`);
    if (!decodeRasterDataUrl(resolved))
      throw new Error(`Cannot decode image: ${source}`);
    return resolved;
  };
  const markup: string[] = [];
  const config = screens.map((screen, index) => {
    const { frame, bounds, links } = screen;
    const svg = editor.exportArtboardSvg(frame.id, {
      resolveAsset,
      excludeIds: fixed.get(frame.id),
    });
    if (!svg) throw new Error(`Cannot export screen: ${frame.id}`);
    const layers = [...(fixed.get(frame.id) ?? [])]
      .map((id, layerIndex) => {
        const box = context.boundsOf(id);
        const fragment = renderSelectionSvg(
          editor.store,
          editor.registry,
          frame.page,
          new Set([id]),
          { padding: 0, resolveAsset },
        );
        return box && fragment
          ? `<div class="fixed" style="left:${box.x - bounds.x}px;top:${box.y - bounds.y}px;width:${box.width}px;height:${box.height}px">${scopeSvgIds(fragment, `p${index}-f${layerIndex}-`)}</div>`
          : "";
      })
      .join("");
    const buttons = links
      .map(
        (link, i) =>
          `<button type="button" data-link="${i}" aria-label="${escapeXml(editor.store.get(link.from)?.visual.layerName?.trim() || link.label)}"${link.disabled ? " disabled" : ""} style="left:${link.box.x - bounds.x}px;top:${link.box.y - bounds.y}px;width:${link.box.width}px;height:${link.box.height}px;z-index:${link.from === frame.id ? 1 : 2}"></button>`,
      )
      .join("");
    markup.push(
      `<section class="screen" data-screen="${index}" style="width:${bounds.width}px;height:${bounds.height}px" hidden>${scopeSvgIds(svg, `p${index}-`)}${layers}${buttons}</section>`,
    );
    return { id: frame.id, width: bounds.width, height: bounds.height, links };
  });
  const json = JSON.stringify({ start, screens: config }).replace(
    /</g,
    "\\u003c",
  );
  const bezel = options.device === "frame" ? " bezel" : "";
  return [
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prototype</title><style>`,
    `*{box-sizing:border-box}body{margin:0;background:#ddd;display:grid;place-items:center;min-height:100vh;font-family:sans-serif}.viewport{position:relative;overflow:hidden;background:white}.bezel{border:12px solid #222;border-radius:48px}.bezel:after{content:"";position:absolute;z-index:30;bottom:7px;left:40%;width:20%;height:5px;border-radius:4px;background:#222;pointer-events:none}.screen{position:absolute;inset:0;overflow:hidden;background:white}.screen[hidden]{display:none}.screen>svg{width:100%;height:100%;display:block}.fixed{position:absolute;z-index:1;pointer-events:none}.fixed svg{width:100%;height:100%}button[data-link]{position:absolute;background:transparent;border:0;cursor:pointer}.hint button[data-link]{outline:2px solid #2788ff;background:#2788ff44}.backdrop{position:absolute;inset:0;background:#0006;z-index:10}.overlay{z-index:11}@media(prefers-reduced-motion:reduce){*{animation-duration:0s!important;transition-duration:0s!important}}</style></head><body><main class="viewport${bezel}" id="viewport">`,
    markup.join(""),
    `</main><script type="application/json" id="config">${json}</script><script>${SCRIPT}</script></body></html>\n`,
  ].join("");
}

const SCRIPT = `(()=>{const c=JSON.parse(document.getElementById('config').textContent),v=document.getElementById('viewport'),els=[...v.querySelectorAll('.screen')],byId=id=>c.screens.findIndex(s=>s.id===id);let current=byId(c.start),history=[],overlays=[],timers=[];function clear(){timers.forEach(clearTimeout);timers=[]}function show(){clear();els.forEach((e,i)=>{e.hidden=i!==current&&!overlays.some(o=>o.i===i);e.classList.toggle('overlay',overlays.some(o=>o.i===i));e.style.left='0';e.style.top='0'});v.querySelectorAll('.backdrop').forEach(e=>e.remove());const base=c.screens[current];const border=v.classList.contains('bezel')?24:0;v.style.width=(base.width+border)+'px';v.style.height=(base.height+border)+'px';overlays.forEach((o,n)=>{const e=els[o.i],s=c.screens[o.i];e.style.zIndex=11+n*2;e.style.left=(o.p==='manual'?o.x:o.p==='top-left'?0:(base.width-s.width)/2)+'px';e.style.top=(o.p==='manual'?o.y:o.p==='top-left'?0:o.p==='bottom-center'?base.height-s.height:(base.height-s.height)/2)+'px';if(o.backdrop){const b=document.createElement('div');b.className='backdrop';b.style.zIndex=10+n*2;v.appendChild(b);if(o.dismiss)b.onclick=()=>{overlays.pop();show()}}});const top=overlays.length?overlays[overlays.length-1].i:current;c.screens[top].links.forEach((l,i)=>{if(!l.disabled&&l.trigger==='after-delay')timers.push(setTimeout(()=>activate(top,i),l.delay))})}function back(){if(overlays.length)overlays.pop();else if(history.length)current=history.pop();show()}function activate(si,li){const l=c.screens[si].links[li];if(l.disabled)return;const target=byId(l.to);if(l.action==='back'){back();return}if(l.action==='close-overlay'){if(overlays.length)overlays.pop();show();return}if(target<0)return;if(l.action==='open-overlay'||l.action==='swap-overlay'){if(l.action==='swap-overlay')overlays.pop();overlays.push({i:target,p:l.overlayPosition,x:l.overlayX,y:l.overlayY,backdrop:l.overlayBackdrop,dismiss:l.overlayDismiss})}else if(l.action==='navigate'){history.push(current);current=target;overlays=[]}show();const e=els[target].querySelector('svg');if(l.transition!=='instant'&&e&&e.animate){const motion=matchMedia('(prefers-reduced-motion: reduce)').matches?0:l.duration;let from={opacity:0},to={opacity:1};if(l.transition.startsWith('slide-')){const d=l.transition.slice(6),x=d==='left'?'100%':d==='right'?'-100%':'0',y=d==='up'?'100%':d==='down'?'-100%':'0';from={transform:'translate('+x+','+y+')'};to={transform:'translate(0,0)'}}e.animate([from,to],{duration:motion,easing:'ease'})}}els.forEach((e,si)=>{e.querySelectorAll('button').forEach((b,li)=>{const l=c.screens[si].links[li];if(l.trigger==='hover')b.addEventListener('mouseenter',()=>activate(si,li));else if(l.trigger==='press')b.addEventListener('pointerdown',()=>activate(si,li));else if(l.trigger!=='after-delay')b.addEventListener('click',()=>activate(si,li))});e.addEventListener('click',ev=>{if(ev.target.closest('button'))return;e.classList.add('hint');setTimeout(()=>e.classList.remove('hint'),500)})});document.addEventListener('keydown',e=>{if(e.key==='Backspace'||e.key==='ArrowLeft'){e.preventDefault();back()}else if(e.key==='Escape'&&overlays.length){overlays.pop();show()}else if(e.key.toLowerCase()==='r'){current=byId(c.start);history=[];overlays=[];show()}});show()})();`;
