export function uploadToSignedUrl(
  file: File,
  url: string,
  contentType: string,
  onProgress: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    let lastReportedProgress = -1
    request.open('PUT', url)
    request.setRequestHeader('Content-Type', contentType)
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100)
        if (progress !== lastReportedProgress) {
          lastReportedProgress = progress
          onProgress(progress)
        }
      }
    })
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) resolve()
      else reject(new Error(`S3 rechazó la carga (${request.status})`))
    })
    request.addEventListener('error', () => reject(new Error('Se perdió la conexión durante la carga')))
    request.addEventListener('abort', () => reject(new Error('La carga fue cancelada')))
    request.send(file)
  })
}
