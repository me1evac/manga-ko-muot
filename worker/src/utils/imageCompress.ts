import type { WebPModule, EncodeOptions } from '@jsquash/webp/codec/enc/webp_enc'
import type { MozJPEGModule } from '@jsquash/jpeg/codec/dec/mozjpeg_dec'

interface ImageData {
  data: Uint8ClampedArray
  width: number
  height: number
}
import webpEncFactory from '@jsquash/webp/codec/enc/webp_enc.js'
import jpegDecFactory from '@jsquash/jpeg/codec/dec/mozjpeg_dec.js'
import WEBP_ENC_WASM from '@jsquash/webp/codec/enc/webp_enc.wasm'
import JPEG_DEC_WASM from '@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm'

function initEmscriptenModule<T>(
  moduleFactory: (opts: any) => Promise<T>,
  wasmModule?: WebAssembly.Module,
): Promise<T> {
  let instantiateWasm: any
  if (wasmModule) {
    instantiateWasm = (imports: WebAssembly.Imports, callback: (instance: WebAssembly.Instance) => void) => {
      const instance = new WebAssembly.Instance(wasmModule, imports)
      callback(instance)
      return instance.exports
    }
  }
  return moduleFactory({
    noInitialRun: true,
    instantiateWasm,
  } as any)
}

let jpegDecoder: Promise<MozJPEGModule> | null = null
let webpEncoder: Promise<WebPModule> | null = null

async function getJpegDecoder(): Promise<MozJPEGModule> {
  if (!jpegDecoder) {
    jpegDecoder = initEmscriptenModule<MozJPEGModule>(jpegDecFactory, JPEG_DEC_WASM)
  }
  return jpegDecoder
}

async function getWebpEncoder(): Promise<WebPModule> {
  if (!webpEncoder) {
    webpEncoder = initEmscriptenModule<WebPModule>(webpEncFactory, WEBP_ENC_WASM)
  }
  return webpEncoder
}

const MAX_COMPRESS_SIZE = 10 * 1024 * 1024

const WEBP_BASE_OPTIONS: EncodeOptions = {
  quality: 80,
  target_size: 0,
  target_PSNR: 0,
  method: 4,
  sns_strength: 50,
  filter_strength: 60,
  filter_sharpness: 0,
  filter_type: 1,
  partitions: 0,
  segments: 4,
  pass: 1,
  show_compressed: 0,
  preprocessing: 0,
  autofilter: 0,
  partition_limit: 0,
  alpha_compression: 1,
  alpha_filtering: 1,
  alpha_quality: 100,
  lossless: 0,
  exact: 0,
  image_hint: 0,
  emulate_jpeg_size: 0,
  thread_level: 0,
  low_memory: 0,
  near_lossless: 100,
  use_delta_palette: 0,
  use_sharp_yuv: 0,
}

export async function decodeToImageData(
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<ImageData | null> {
  if (buffer.byteLength > MAX_COMPRESS_SIZE) return null
  if (mimeType === 'image/webp') return null

  if (mimeType === 'image/jpeg') {
    try {
      const decoder = await getJpegDecoder()
      return decoder.decode(buffer, false)
    } catch (e) {
      console.error('jpeg decode failed', e)
      return null
    }
  }

  return null
}

export async function encodeImageDataToWebp(
  imageData: ImageData,
  quality: number,
): Promise<ArrayBuffer | null> {
  try {
    const encoder = await getWebpEncoder()
    const options: EncodeOptions = { ...WEBP_BASE_OPTIONS, quality }
    const result = encoder.encode(imageData.data, imageData.width, imageData.height, options)
    if (!result) return null
    return result.buffer.slice(0, result.byteLength) as ArrayBuffer
  } catch (e) {
    console.error('webp encode failed', e, { quality })
    return null
  }
}

export async function compressToWebp(
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<ArrayBuffer | null> {
  const imageData = await decodeToImageData(buffer, mimeType)
  if (!imageData) return null
  return encodeImageDataToWebp(imageData, 80)
}
