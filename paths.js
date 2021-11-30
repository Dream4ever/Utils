import path from 'path'

const basePath = 'c:\\Users\\HeWei.DESKTOP-4HDDQUK\\OneDrive\\10_Software\\ffmpeg-4.4-full_build\\'

const ffmpeg = path.join(basePath, 'bin', 'ffmpeg.exe')
const MediaInfo = path.join(basePath, 'MediaInfo', 'MediaInfo.exe')

const outPath = path.join(basePath, 'output', 'video')

export {
  ffmpeg,
  MediaInfo,
  outPath,
}
