import { readdir, rename } from 'fs/promises'
import path from 'path'

import { toc } from './toc.js'

const targetPath = 'c:\\Downloads\\temp2'

const validatePageNumber = async (folders) => {
  for (const folder of folders) {
    const [subject, grade] = folder.split('_')
    
    const subfolder = path.join(targetPath, folder)
    const files = await readdir(subfolder)
    const pageCount = files.length
    
    const chapters = toc[subject][grade]['chapters']
    
    for (const chapter of chapters) {
      if (chapter.firstPage > pageCount) {
        const errMsg = `

${toc[subject][grade]['title']} ${chapter.name} 的页数不正确
答案共有${pageCount}页，但记录的本章页码却是${chapter.firstPage}
`
        throw new Error(errMsg)
      }
    }
  }
}

const getSortedFiles = async (folder) => {
  const subfolder = path.join(targetPath, folder)
  const files = await readdir(subfolder)
  const sortedFiles = files.sort((a, b) => {
    return parseInt(path.parse(a).name) - parseInt(path.parse(b).name)
  })
  return sortedFiles
}

const calculateChaptersPageCount = async (folders) => {
  for (const folder of folders) {
    const [subject, grade] = folder.split('_')
    const chapters = toc[subject][grade]['chapters']

    const sortedFiles = await getSortedFiles(folder)
    const fileCount = sortedFiles.length

    for (let i = 0; i < chapters.length; i++) {
      if (i + 1 < chapters.length) {
        chapters[i].pageCount = chapters[i + 1].firstPage - chapters[i].firstPage
      } else {
        chapters[i].pageCount = fileCount + 1 - chapters[i].firstPage
      }
    }

    toc[subject][grade]['sortedFiles'] = sortedFiles
  }
}

const renameFiles = async (folders) => {
  for (const folder of folders) {
    const [subject, grade] = folder.split('_')
    const book = toc[subject][grade]
    const currDir = path.join(targetPath, folder)

    let fileIndex = 0
    for (let i = 0; i < book.chapters.length; i++) {
      for (let j = 0; j < book.chapters[i].pageCount; j++) {
        const oldPath = path.join(currDir, book.sortedFiles[fileIndex])
        const newPath = path.join(currDir, `${i + 1}_${j + 1}${path.extname(book.sortedFiles[fileIndex])}`)
        await rename(oldPath, newPath)
        fileIndex += 1
      }
    }
    console.log(`${folder} 已重命名`)
  }
}

const main = async () => {
  try {
    const folders = await readdir(targetPath)
    // 检查每本答案各章标题所在页码是否大于总页数
    validatePageNumber(folders)
    // 对答案的文件名按自然顺序升序排列
    // 并统计答案总页数
    await calculateChaptersPageCount(folders)
    // 按照各章序号和本章页数，重命名答案
    await renameFiles(folders)
  } catch (error) {
    console.error(error)
  }
}

main()

