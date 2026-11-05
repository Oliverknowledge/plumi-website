/** Execute the shipped worker and WASM in a Node VM, without a browser or math substitute. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../public/calculator/', import.meta.url));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function bootFirmware({traceKeys=false}={}) {
  const timers = new Set();
  const trace=[];
  let Simulator;
  const context = {
    console: traceKeys ? {log: message=>{if(/Key push|KeyProcess \[|SimWrapper: Reset|StopType/.test(String(message)))trace.push(String(message));},error:console.error,warn:console.warn} : console, TextDecoder, TextEncoder, performance,
    // The bundled engine creates an unused XHR during initialization. Network
    // access stays disabled in this harness; ROM and WASM are loaded from disk.
    XMLHttpRequest: class { open() {} setRequestHeader() {} overrideMimeType() {} send() { throw new Error('Unexpected engine network request'); } },
    ImageData: class { constructor(width, height) { this.width=width; this.height=height; this.data=new Uint8ClampedArray(width*height*4); } },
    setTimeout: (fn, ms) => { const id=setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; },
    clearTimeout: id => { clearTimeout(id); timers.delete(id); },
    location: { href: 'https://calculator.test/lib/simwrapper.js' },
    fetch: async relative => {
      const url = new URL(relative, 'https://calculator.test/lib/simwrapper.js');
      const filename = path.resolve(root, `.${url.pathname}`);
      if (!filename.startsWith(root)) throw new Error('Unexpected runtime asset path');
      const bytes = fs.readFileSync(filename);
      return {ok:true,status:200,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),json:async()=>JSON.parse(bytes.toString())};
    },
  };
  context.self=context;
  vm.createContext(context);
  context.importScripts = (...files) => {
    for (const filename of files) {
      if (filename.includes('comlink')) {
        // Only the transport is omitted. All firmware/CPU and key logic remain unchanged.
        context.Comlink={expose: value => {Simulator=value;}, proxy: value=>value};
      } else {
        context.Module.wasmBinary=new Uint8Array(fs.readFileSync(path.join(root,'lib/simlib.wasm')));
        vm.runInContext(fs.readFileSync(path.join(root,'lib',filename.split('?')[0]),'utf8'),context,{filename});
      }
    }
  };
  const cleanup = () => { for (const id of timers) clearTimeout(id); timers.clear(); };
  try {
    vm.runInContext(fs.readFileSync(path.join(root,'lib/simwrapper.js'),'utf8'),context,{filename:'simwrapper.js'});
    if(traceKeys)vm.runInContext('_verbose=true',context);
    const sim = new Simulator();
    const result=await Promise.race([sim.Init('CY234','CY',false,false,null),new Promise((_,reject)=>{setTimeout(()=>reject(new Error('Firmware boot timed out')),10000).unref();})]);
    if(result!==0) throw new Error(`Firmware Init failed: ${result}`);
    const keyMap=JSON.parse(fs.readFileSync(path.join(root,'data/CY234/keylog.json'),'utf8'));
    const byName=Object.fromEntries(Object.entries(keyMap).map(([pair,value])=>[value[2].slice(1,-1),pair.split(',').map(Number)]));
    const frame=()=>sim.GetDisplayImageData(undefined,false);
    async function settle(timeout=4000) {
      const until=Date.now()+timeout;
      let previous='',stable=0;
      while(Date.now()<until) {
        await delay(35);
        const f=frame();
        const current=Buffer.from(f.data).toString('base64');
        if(sim.GetKeyQueueLength()===0 && current===previous) stable++; else stable=0;
        if(stable>=5) return f;
        previous=current;
      }
      throw new Error('Firmware display did not settle');
    }
    await settle();
    return {
      sim, frame, settle, trace,
      async keys(names) {
        for(const name of names) {
          const code=byName[name];
          if(!code) throw new Error(`Unknown key ${name}`);
          sim.SetKey(...code);
          await delay(30);
        }
        return settle();
      },
      close:()=>{sim.Stop();cleanup();},
    };
  } catch(error) { cleanup(); throw error; }
}
