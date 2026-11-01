// Anti-bruit renforcé (Speex) : @sapphi-red/web-noise-suppressor (MIT)
import { SpeexWorkletNode, loadSpeex } from '@sapphi-red/web-noise-suppressor'
import workletUrl from '@sapphi-red/web-noise-suppressor/speexWorklet.js?url'
import wasmUrl from '@sapphi-red/web-noise-suppressor/speex.wasm?url'

let ready = null

export async function antiBruit(ctx, raw) {
  ready ||= Promise.all([loadSpeex({ url: wasmUrl }), ctx.audioWorklet.addModule(workletUrl)])
    .then(([wasm]) => wasm)
    .catch(e => { ready = null; throw e })
  const wasmBinary = await ready
  const src = ctx.createMediaStreamSource(raw)
  const node = new SpeexWorkletNode(ctx, { wasmBinary, maxChannels: 2 })
  const dest = ctx.createMediaStreamDestination()
  src.connect(node)
  node.connect(dest)
  return {
    stream: dest.stream,
    stop: () => { src.disconnect(); node.disconnect(); node.destroy?.() },
  }
}
  
