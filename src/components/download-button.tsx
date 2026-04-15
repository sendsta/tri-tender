'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'

export function DownloadButton({ fileId, filename }: { fileId: string; filename: string }) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const res = await fetch(`/api/files/download?fileId=${fileId}`)
      const result = await res.json()

      if (result.ok && result.data?.downloadUrl) {
        // Open the signed URL in a new tab to trigger download
        window.open(result.data.downloadUrl, '_blank')
      } else {
        console.error('Download failed:', result.error?.message)
      }
    } catch (err) {
      console.error('Download error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDownload}
      disabled={loading}
      title={`Download ${filename}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
    </Button>
  )
}
