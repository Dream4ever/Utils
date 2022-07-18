import process from 'process'

const log = (...args) => console.log(...args)
const throwError = (msg) => { throw new Error(msg) }

const clearLine = () => {
  process.stdout.moveCursor(0, -1)
  process.stdout.clearLine(1)
}

const isVideoOrAudio = (file) => {
  const videoExts = [
    'asf',
    'flv',
    'mp4',
    'mpeg',
    'mpg',
    'ts',
    'vob',
    'wmv',
    'mov',
  ]
  const audioExts = [
    'mp3',
    'wav',
    'm4a',
    'flac',
  ]
  const ext = file.split('.').pop().toLowerCase()
  if (videoExts.includes(ext)) return 1
  if (audioExts.includes(ext)) return 2
  return 0
}

export {
  log,
  throwError,
  clearLine,
  isVideoOrAudio,
}
