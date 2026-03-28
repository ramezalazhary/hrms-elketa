export const mockDelay = (data, delayMs = 250) =>
  new Promise((resolve) => {
    setTimeout(() => resolve(data), delayMs)
  })
