import { spawn, spawnSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import readline from 'readline'

import { log, throwError } from './utils.js'
import * as paths from './paths.js'

const geInputPath = async () => {
  // 异步读取用户输入数据
  // https://nodejs.org/docs/latest-v14.x/api/readline.html#readline_readline
  // How to get synchronous readline, or "simulate" it using async, in nodejs?
  // https://stackoverflow.com/a/54269197/2667665
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  // 只读取输入的第一行
  // NodeJS ReadLine - Only read the first 2 lines
  // https://stackoverflow.com/questions/45556535/nodejs-readline-only-read-the-first-2-lines
  const it = rl[Symbol.asyncIterator]()
  const line = await it.next()

  // 读取完记得关闭
  rl.close()

  if (!line.value) {
    throwError('输入路径为空，或路径识别失败，请重新执行程序')
  }

  // 如果用户输入的路径不含空格且两侧还是有单引号
  // 则去除单引号，以便 Node.js API 可正常识别
  if (line.value.startsWith("'") && line.value.endsWith("'")) {
    line.value = line.value.substring(1, line.value.length - 1)
  }

  if (!fs.existsSync(line.value)) {
    throwError('该路径不存在，请检查后重新输入')
  }

  return line.value
}

async function getVideoListOld(inPath) {
  const videoFileNames = throughDirectory(inPath)
  log(videoFileNames)

  const buildVideoObject = (fileName) => {
    return {
      base: fileName,
      full: path.join(inPath, fileName),
    }
  }
  const videoList = {
    dir: inPath,
    videos: videoFileNames.map(buildVideoObject),
  }

  return videoList
}

// node js get all files in directory recursively
// https://stackoverflow.com/questions/41462606/get-all-files-recursively-in-directories-nodejs
let files = []
const throughDirectory = (Directory) => {
  fs.readdirSync(Directory).forEach(File => {
    const Absolute = path.join(Directory, File)
    if (fs.statSync(Absolute).isDirectory()) return throughDirectory(Absolute)
    return files.push(Absolute)
  })
  return files
}

async function getVideoList(inPath) {
  return throughDirectory(inPath)
}

const countStreamOld = (filePath, type) => {
  // 统计视频中有多少条视频流、音频流
  // https://superuser.com/questions/1381642/ffprobe-count-video-and-audio-streams-tracks
  const args = [
    // 只输出错误级别的日志，用户自己要输出的信息仍可正常输出
    '-v', 'error',
    // 只选择视频流或音频流，参数值为 'v' 和 'a'
    '-select_streams', type,
    // 输出 stream 段中的 index 信息
    // https://ffmpeg.org/ffprobe.html#Main-options
    '-show_entries', 'stream=index',
    // 用默认格式输出，不输出section header 和 footer
    // 也不输出 key，只输出值，以便统计
    // https://ffmpeg.org/ffprobe.html#toc-default
    '-of', 'default=nw=1:nk=1',
    filePath.full,
  ]

  const result = spawnSync(paths.ffprobe, args)
  return result.stdout.toString().split(/\r\n|\r|\n/).length - 1
}

const countStream = (filePath, type) => {
  const countTarget = type === 'v' ? 'VideoCount' : 'AudioCount'

  const args = [
    filePath,
    `--Inform=General;%${countTarget}%`,
  ]

  const result = spawnSync(paths.MediaInfo, args)

  return +result.stdout.toString().split(/\r\n|\r|\n/)[0]
}

const checkStreamsCount = (filePath) => {
  const videoStreamCount = countStream(filePath, 'v')
  if (videoStreamCount !== 1) {
    log(filePath)
    throwError(`该视频有${videoStreamCount}条视频流，请完善代码`)
  }

  const audioStreamCount = countStream(filePath, 'a')
  if (audioStreamCount !== 1) {
    log(filePath)
    throwError(`该视频有${audioStreamCount}条音频流，请完善代码`)
  }
}

const buildVideoProbeArgs = (videoPath) => {
  return [
    '--Inform=General',
    '--Output=JSON',
    videoPath,
  ]
  // return [
  //   // 加上下面这个选项，输出信息就在 stdout 里，否则就在 stderr 里
  //   '-v', 'error',
  //   '-show_streams',
  //   // '-select_streams', 'v', // 同时输出音频流和视频流的信息的话，这一行不要
  //   '-of', 'json',
  //   videoPath.full,
  // ]
}

const getVideoInfo = (videoPath) => {
  // 确保视频中的视频流和音频流都只有一条，否则就报错
  checkStreamsCount(videoPath)

  const videoArgs = buildVideoProbeArgs(videoPath)

  const result = spawnSync(paths.MediaInfo, videoArgs)
  const tracks = JSON.parse(result.stdout.toString()).media.track
  
  const videoStream = tracks.find(track => track['@type'] === 'Video')
  const audioStream = tracks.find(track => track['@type'] === 'Audio')

  if (!videoStream.Height || !videoStream.FrameRate || !videoStream.BitRate) {
    log(videoStream)
    throwError(`文件${videoPath.base}的视频流信息不完整，请解决`, '\n\n')
  }

  return [videoStream, audioStream]
}

const setGlobalOptions = () => {
  return [
    '-hide_banner',
  ]
}

const setAudioCodec = () => {
  return ['-c:a', 'aac']
}

const setAudioSampleRate = (audio) => {
  if (!audio.SamplingRate) {
    throwError('获取不到音频采样率，请完善代码')
  }

  return ['-ar', Math.min(audio.SamplingRate, 44100)]
}

const setAudioBitRate = (audio) => {
  return ['-b:a', `${Math.min(Math.floor(audio.BitRate / 1E3), 128) * 1E3}`]
}

const setVideoCodec = () => {
  return ['-c:v', 'libx264']
}

const setResolution = (video) => {
  // 有些编码器要求帧的尺寸是指定数字的整数倍，比如 x264 编码要求是 16 的整数倍
  // 如果原始视频的尺寸不满足要求，则编码器会将其补足/pad 到满足要求的尺寸
  // 并将原始尺寸保存为 coded_width/coded_height
  // 解码器在解码时，就可以根据所保存的根据原始尺寸和实际尺寸进行裁切/crop
  // What's the difference between coded width and width in FFprobe
  // https://superuser.com/a/1523946/432588
  const { Width: videoWidth, Height: videoHeight } = video

  // 让视频高度不要超过 720
  const videoHeightLimit = 720
  const targetHeight = Math.min(videoHeight, videoHeightLimit)
  // 设置 FFmpeg 维持视频分辨率比例
  // https://ottverse.com/change-resolution-resize-scale-video-using-ffmpeg/
  return ['-vf', `scale=-1:${targetHeight}`]
}

const setVideoBitRate = (video) => {
  // FFmpeg 获取不到比特率的情况
  // Determine video bitrate using ffmpeg
  // https://superuser.com/questions/1106343/determine-video-bitrate-using-ffmpeg
  // https://superuser.com/questions/694062/how-does-ffmpeg-determine-individual-stream-bitrates
  // https://superuser.com/questions/1247459/how-to-determine-video-stream-size
  if (!video.BitRate) {
    throwError('获取不到视频比特率，请检查视频并完善代码')
  }

  // 50m 宽带，即 51200 kb/s，如果视频总码率为 2000 kb/s，则可容纳 25.6 个用户同时观看
  // 2000 - 128（双声道音频）= 1872，四舍五入一下，取 1600 吧
  // Encoding for streaming sites
  // https://trac.ffmpeg.org/wiki/EncodingForStreamingSites

  // 考虑到分辨率的不同，不宜设定一个固定值
  // 720P 及以上视频码率设置为 1600
  // 480P 及以上设置为 1800，更低的设置为 500
  const videoBitRateLimit = video.Height >= 720 ? 1600 : (
    video.Height >= 480 ? 800 : 500
  )

  // 原始码率除以一万后取整，再把结果加上 00k，就是以 k 为单位的码率，可用于 bitrate 和 maxrate
  // 结果乘以2再加上 00k，就是 bufsize
  // 原来爱优腾等视频网站都是用这个来播放流媒体的
  // https://juejin.cn/post/6954761121727250439#heading-1
  const originalVideoBitRate = Math.floor(video.BitRate / 1E5)

  let targetBitRate = Math.min(originalVideoBitRate * 100, videoBitRateLimit)

  // 前两个参数是视频的目标码率，bufsize 设置为目标码率的两倍，
  // How to consider bitrate, -maxrate and -bufsize of a video for web
  // https://superuser.com/questions/945413/how-to-consider-bitrate-maxrate-and-bufsize-of-a-video-for-web
  return [
    '-b:v', `${targetBitRate}k`,
    '-maxrate', `${targetBitRate}k`,
    '-bufsize', `${targetBitRate * 2}k`,
  ]
}

const setQuality = () => {
  // profile 用 main，兼容性最好，适合流媒体
  // FFmpeg基础知识之-—— H264编码profile & level控制
  // https://blog.csdn.net/achang21/article/details/77824485
  return [
    '-profile:v', 'main',
    '-preset', 'medium',
  ]
}

const setFrameRate = (video) => {
  // https://video.stackexchange.com/questions/20789/ffmpeg-default-output-frame-rate/20790
  // https://blog.csdn.net/biezhihua/article/details/62260498

  const defaultFrameRate = 24
  
  // 获取帧率
  let frameRate = video.FrameRate
  
  // 没有的话，设置为默认值 24/1
  // 这里不能写成 24，因为下面要按照 24/1 这个格式进行解析
  // if (!frameRate) {
  //   frameRate = '24/1'
  // }
  
  // 解析帧率
  // const result = frameRate.match(/(\d+)\/(\d+)/)
  // const frames = +result[1]
  // const interval = +result[2]
  
  // https://www.techsmith.com/blog/frame-rate-beginners-guide/
  // https://www.agora.io/cn/community/blog/best/22427
  // https://trac.ffmpeg.org/wiki/ChangingFrameRate
  // if (!frames || !interval) {
  //   // 解析失败则设置为默认值
  //   frameRate = defaultFrameRate
  // } else {
    // 否则在实际帧率和默认值 24 之间选择较小值
  // frameRate = Math.min(Math.round(frames / interval), defaultFrameRate)
  // }

  frameRate = Math.min(Math.round(frameRate), defaultFrameRate)

  return ['-r', frameRate]
}

const setKeyFrames = (frameRate) => {
  // 这里设置为 FPS 的 10 倍，也就是每 10 秒生成一个关键帧
  // What is the correct way to fix keyframes in FFmpeg for DASH?
  // https://superuser.com/questions/908280/what-is-the-correct-way-to-fix-keyframes-in-ffmpeg-for-dash
  return [
    '-g', frameRate * 10,
    '-keyint_min', frameRate * 10,
    '-sc_threshold', 0,
    // FFmpeg libraries: Exactly constant segment duration for HLS
    // https://stackoverflow.com/questions/18308436/ffmpeg-libraries-exactly-constant-segment-duration-for-hls
    // '-force_key_frames', 'expr:gte(t,n_forced*10)',
    // '-strict', '-2',
  ]
}

const setMiscs = () => {
  return [
    '-threads', 0,
    '-muxpreload', 0,
    '-muxdelay', 0,
  ]
}

const setHls = () => {
  return [
    '-f', 'hls',
    // 设置 hls 片段时长为 10 秒
    '-hls_time', '10',
    '-hls_playlist_type', 'vod',
    // 输出一个 ts 文件，用 m3u8 标记时间段
    // 实现点播效果的同时，可有效避免在服务器存放大量小文件
    // https://ffmpeg.org/ffmpeg-formats.html#hls-2 hls_flags flags
    '-hls_flags', 'single_file',
  ]
}

const setOutputDirectory = (folder) => {
  return [path.join(paths.outPath, folder.toString(), 'video.m3u8')]
}

function setFormatArgs(videoInfo) {
  // 设置全局参数
  const globalOptions = setGlobalOptions()
  // 设置输入文件
  const inputVideo = ['-i', videoInfo.full]
  // 设置音频编码为 AAC
  const audioCodec = setAudioCodec()
  // 设置音频采样率不超过 44100
  const audioSampleRate = setAudioSampleRate(videoInfo.audioStream)
  // 设置音频码率不超过 128k
  const audioBitrate = setAudioBitRate(videoInfo.audioStream)
  // 设置视频编码为 X264
  const videoCodec = setVideoCodec()
  // 设置视频分辨率，高度不超过 720
  // const resolution = setResolution(video)
  // 根据视频分辨率设置合理码率
  const videoBitRate = setVideoBitRate(videoInfo.videoStream)
  // 设置压缩质量
  const quality = setQuality()
  // 设置视频合理帧率
  const frameRate = setFrameRate(videoInfo.videoStream)
  // 设置关键帧间隔
  const keyFrame = setKeyFrames(frameRate[1])
  // 设置其他选项
  const misc = setMiscs()
  // 设置 HLS 参数
  const hls = setHls()
  // 设置输出路径
  const outputDirectory = setOutputDirectory(videoInfo.base)

  return [
    ...globalOptions,
    ...inputVideo,
    ...audioCodec,
    ...audioSampleRate,
    ...audioBitrate,
    ...videoCodec,
    // ...resolution,
    ...videoBitRate,
    ...quality,
    ...frameRate,
    ...keyFrame,
    ...misc,
    ...hls,
    ...outputDirectory,
  ]
}

const tryCreateFolder = (value) => {
  const dir = path.parse(value).dir

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir)
  }
}

// node.js async spawn in loop
// https://stackoverflow.com/questions/22337446/how-to-wait-for-a-child-process-to-finish-in-node-js
// https://www.reddit.com/r/node/comments/avaap3/i_want_to_spawn_processes_in_a_for_loop_but_i/
const formatVideo = (args) => {
  tryCreateFolder(args[args.length - 1])

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(paths.ffmpeg, args)

    ffmpeg.stderr.on('data', (data) => {
      log(`${data.toString()}`)
    })

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        const err = new Error('文件转换失败')
        err.exitcode = code
        reject(err)
      }
    })
  })
}

async function main() {
  try {
    log('请输入待处理视频所在文件夹的完整路径，用单引号包裹，输入后回车确认：')    
    const inPath = await geInputPath()
    const videoList = await getVideoList(inPath)
    // log(videoList, videoList.length)
    const result = getVideoInfo(videoList[0])
    log(result)

    throwError('end')

    for (let i = 0; i < videoList.videos.length; i++) {
      [videoList.videos[i].videoStream, videoList.videos[i].audioStream] = await getVideoInfo(videoList.videos[i])
    }
    for (let i = 0; i < videoList.videos.length; i++) {
      [videoList.videos[i].videoStream, videoList.videos[i].audioStream] = await getVideoInfo(videoList.videos[i])
      const args = setFormatArgs(videoList.videos[i])
      await formatVideo(args)
        .catch((err) => {
          throwError(err)
        })
    }
  } catch (error) {
    log(error)
  }
}

main()

// Node.js 向 FFmpeg 和 FFprobe 传参的正确方式
// running ffmpeg via nodejs error
// https://stackoverflow.com/a/42030958/2667665

// 用 async/await 格式调用 spawn
// how to turn Child_process.spawn's "Promise" syntax to "async/await" syntax
// https://stackoverflow.com/a/58571306/2667665
