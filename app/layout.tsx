import type { Metadata } from "next";
import { Assistant, Frank_Ruhl_Libre } from "next/font/google";
import "./globals.css";

/*
 * next/font self-hosts these at build time, so there is no runtime request to
 * Google (PLAN.md §2, §9). Both need the `hebrew` subset — the site is Hebrew
 * throughout, chrome included.
 */
const frank = Frank_Ruhl_Libre({
  variable: "--font-frank",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "600"],
  display: "swap",
});


/*
 * Deliberately a CLASSIC script in ES5 — no arrow functions, no template
 * literals, no optional chaining. If the app bundle fails to parse on an older
 * Safari, a modern probe would fail in exactly the same way and report
 * nothing. This has to survive whatever broke.
 *
 * Only rendered when AUTH_DEBUG=1.
 */
const CLIENT_PROBE = [
  "(function(){",
  "  function send(d){try{",
  "    d.ua=navigator.userAgent;",
  "    fetch('/api/client-error',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});",
  "  }catch(e){}}",
  // Bubbling listener: uncaught exceptions.
  "  window.addEventListener('error',function(e){",
  "    send({message:String(e.message),source:String(e.filename),line:e.lineno,col:e.colno,stack:e.error&&e.error.stack?String(e.error.stack):''});",
  "  });",
  // CAPTURE listener: resource load failures (a script that 404s or is blocked)
  // do not bubble, so without capture:true a missing chunk reports nothing at
  // all - which is indistinguishable from 'the JS simply never ran'.
  "  window.addEventListener('error',function(e){",
  "    var t=e.target;",
  "    if(t&&(t.tagName==='SCRIPT'||t.tagName==='LINK')){",
  "      send({message:'resource failed to load',source:String(t.src||t.href||'?'),line:0,col:0,stack:''});",
  "    }",
  "  },true);",
  "  window.addEventListener('unhandledrejection',function(e){",
  "    send({message:'unhandledrejection: '+String(e.reason&&e.reason.message?e.reason.message:e.reason),source:'-',line:0,col:0,stack:e.reason&&e.reason.stack?String(e.reason.stack):''});",
  "  });",
  "  send({message:'probe: script ran',source:'-',line:0,col:0,stack:''});",
  // Snapshot after hydration should have finished. Reports whether React
  // actually attached, which separates 'bundle threw' from 'bundle never
  // arrived' from 'hydrated but the UI is wrong'.
  "  setTimeout(function(){",
  "    var scripts=document.getElementsByTagName('script');",
  "    var btn=document.querySelector('button[type=submit]');",
  "    send({message:'probe: status after 8s'",
  "      +' readyState='+document.readyState",
  "      +' scripts='+scripts.length",
  "      +' reactRoot='+(document.querySelector('#__next,[data-reactroot]')?'yes':'n/a')",
  "      +' buttonDisabled='+(btn?String(btn.disabled):'no-button')",
  "      +' buttonText='+(btn?btn.textContent:'-'),",
  "      source:'-',line:0,col:0,stack:''});",
  "  },8000);",
  "})();",
].join("");

export const metadata: Metadata = {
  title: "בלומה שוורצברג קמין",
  description: "ארכיון הציורים של בלומה שוורצברג קמין — חמישים שנות עבודה, והסיפורים שמאחוריהם.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${frank.variable} ${assistant.variable}`}>
      <body>
        {process.env.AUTH_DEBUG === "1" && (
          // biome-ignore lint: deliberate classic script, see CLIENT_PROBE
          <script dangerouslySetInnerHTML={{ __html: CLIENT_PROBE }} />
        )}
        {children}
      </body>
    </html>
  );
}
