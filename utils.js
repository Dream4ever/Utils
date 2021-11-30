const log = (...args) => console.log(...args)
const throwError = (msg) => { throw new Error(msg) }

export {
  log,
  throwError,
}
