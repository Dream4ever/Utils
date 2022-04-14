import QRCode from 'qrcode'
import Jimp from 'jimp'
import QrCode from 'qrcode-reader'

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFile } from 'fs/promises'

import config from './config.js'

const buildSeperateUrls = () => {
  const urls = []

  config.ids.forEach(id => {
    urls.push({
      count: urls.length + 1,
      fileName: `${id}.png`,
      url: `${config.baseUrl}${id}`,
    })
  })

  return urls
}

const buildConsecutiveUrls = () => {
  const urls = []

  for (let i = config.startIndex; i < config.startIndex + config.count; i++) {
    urls.push({
      count: urls.length + 1,
      fileName: `${i}.png`,
      url: `${config.baseUrl}${i}`,
    })
  }

  return urls
}

const buildUrls = () => {
  if (config.mode === 'manual') {
    return buildSeperateUrls()
  } else if (config.mode === 'auto') {
    return buildConsecutiveUrls()
  }
}

const encodeQrcode = async (url) => {
  const opts = {
    errorCorrectionLevel: 'L', // 7%
    type: 'png',
    margin: 2,
    width: 260
  }
  // Why is __dirname not defined in node REPL?
  // https://stackoverflow.com/a/62892482/2667665
  url.imgPath = join(dirname(fileURLToPath(import.meta.url)), 'img', url.fileName)

  try {
    await QRCode.toFile(
      url.imgPath,
      url.url,
      opts,
    )
  } catch (error) {
    console.error(error)
  }
}

const decodeQrcode = async (url) => {
  const buffer = await readFile(url.imgPath)

  Jimp.read(buffer)
    .then(image => {
      const qr = new QrCode()

      qr.callback = (err, value) => {
        if (err) {
          console.error(`QrCode 解析 ${url.imgPath} 失败：`, err)
        } else if (value.result === url.url) {
          console.log(`第${url.count}个二维码已生成`)
        } else {
          console.error(`第${url.count}个二维码生成失败`)
        }
      }

      qr.decode(image.bitmap)
    })
    .catch(err => {
      console.log(`Jimp 解析 ${url.imgPath} 失败：`, err)
    })
}

(async () => {
  const urls = buildUrls()
  for (const url of urls) {
    await encodeQrcode(url)
    await decodeQrcode(url)
  }
})()
