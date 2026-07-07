// Telegram service is no longer used for image storage.
// Images are now uploaded to and served from Cloudflare R2.
// This file is kept as a placeholder for future Telegram features
// (e.g., notifications, announcements).

export async function sendPhoto(
  botToken: string,
  chatId: string,
  file: File,
  signal?: AbortSignal
): Promise<string> {
  const formData = new FormData()
  formData.append('chat_id', chatId)
  formData.append('photo', file)

  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/sendPhoto`,
    { method: 'POST', body: formData, signal }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Telegram sendPhoto failed: ${err}`)
  }

  const data: any = await res.json()
  const photos = data.result.photo
  return photos[photos.length - 1].file_id
}

export async function getFileInfo(
  botToken: string,
  fileId: string
): Promise<{ filePath: string; fileSize: number }> {
  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Telegram getFile failed: ${err}`)
  }

  const data: any = await res.json()
  return {
    filePath: data.result.file_path,
    fileSize: data.result.file_size ?? 0,
  }
}

export function getFileUrl(botToken: string, filePath: string): string {
  return `https://api.telegram.org/file/bot${botToken}/${filePath}`
}
