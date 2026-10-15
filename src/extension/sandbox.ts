const iframe = document.querySelector<HTMLIFrameElement>("#content");

const tailwindFallback = `
.text-2xl{font-size:1.5rem;line-height:2rem}.text-5xl{font-size:3rem;line-height:1}.font-bold{font-weight:700}
.text-transparent{color:transparent}.bg-clip-text{background-clip:text;-webkit-background-clip:text}
.bg-gradient-to-r{background-image:linear-gradient(to right,var(--tw-gradient-from),var(--tw-gradient-to))}
.from-cyan-400{--tw-gradient-from:#22d3ee}.to-purple-500{--tw-gradient-to:#a855f7}
.text-slate-300{color:#cbd5e1}.text-red-500{color:#ef4444}.text-green-400{color:#4ade80}.text-white{color:#fff}
.mb-4{margin-bottom:1rem}.mb-8{margin-bottom:2rem}.px-4{padding-left:1rem;padding-right:1rem}
.text-center{text-align:center}.tracking-wider{letter-spacing:.05em}.drop-shadow-lg{filter:drop-shadow(0 10px 8px rgb(0 0 0/.04)) drop-shadow(0 4px 3px rgb(0 0 0/.1))}
@media (min-width:768px){.md\\:text-6xl{font-size:3.75rem;line-height:1}.md\\:text-7xl{font-size:4.5rem;line-height:1}}
`;

function removeRemoteScripts(source: string): string {
  const document = new DOMParser().parseFromString(source, "text/html");
  let removedTailwind = false;

  document.querySelectorAll<HTMLScriptElement>("script[src]").forEach((script) => {
    const sourceUrl = script.getAttribute("src") || "";
    if (!/^https?:\/\//i.test(sourceUrl)) return;
    removedTailwind ||= /cdn\.tailwindcss\.com/i.test(sourceUrl);
    script.remove();
  });

  if (removedTailwind) {
    const style = document.createElement("style");
    style.dataset.xyloTailwindFallback = "true";
    style.textContent = tailwindFallback;
    document.head.append(style);
  }

  return `<!doctype html>\n${document.documentElement.outerHTML}`;
}

window.addEventListener("message", (event) => {
  if (!iframe || event.data?.type !== "xylo:render-html") return;
  iframe.srcdoc = removeRemoteScripts(String(event.data.content || ""));
});
