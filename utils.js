import process from 'process'

const log = (...args) => console.log(...args)
const throwError = (msg) => { throw new Error(msg) }

const clearLine = () => {
  process.stdout.moveCursor(0, -1)
  process.stdout.clearLine(1)
}

export {
  log,
  throwError,
  clearLine,
}
