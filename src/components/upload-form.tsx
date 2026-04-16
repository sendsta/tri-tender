'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, FileUp, Loader2, X } from 'lucide-react'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
]

export function UploadForm() {
  const [title, setTitle] = useState('')
  const [deadline, setDeadline] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleFile = useCallback((f: File) => {
    if (f.size > MAX_FILE_SIZE) {
      setError('File size exceeds 50MB limit.')
      return
    }
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError('Unsupported file type. Please upload PDF, Word, Excel, or ZIP files.')
      return
    }
    setError(null)
    setFile(f)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !title) return
    setError(null)
    setUploading(true)

    try {
      const safeFileName = file.name.replace(/\s+/g, '_')
      const storagePath = `TEMP/${crypto.randomUUID()}/${safeFileName}`

      const { error: uploadError } = await supabase.storage
        .from('tender-inputs')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        setError('File upload failed. Please try again.')
        setUploading(false)
        return
      }

      const res = await fetch('/api/tenders/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          fileName: file.name,
          storagePath,
          mimeType: file.type,
          sizeBytes: file.size,
          deadline: deadline || undefined,
        }),
      })

      const result = await res.json()
      if (!result.ok) {
        setError(result.error?.message ?? 'Failed to create tender.')
        setUploading(false)
        return
      }

      router.push(`/tenders/${result.data.tenderId}`)
    } catch {
      setError('An unexpected error occurred.')
      setUploading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload New Tender</h1>
        <p className="text-muted-foreground">
          Upload your tender document and we will begin processing it immediately.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tender Details</CardTitle>
          <CardDescription>
            Provide the tender title and upload the document.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Tender Title</Label>
              <Input
                id="title"
                placeholder="e.g. City of Joburg ICT Infrastructure RFP"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">Submission Deadline (optional)</Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tender Document</Label>
              <div
                className={`relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors ${
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : file
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  const f = e.dataTransfer.files[0]
                  if (f) handleFile(f)
                }}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                {file ? (
                  <>
                    <FileUp className="h-8 w-8 text-emerald-600" />
                    <div className="text-center">
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFile(null)
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground/50" />
                    <div className="text-center">
                      <p className="text-sm font-medium">
                        Drop your tender document here
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PDF, Word, Excel, or ZIP &middot; Max 50MB
                      </p>
                    </div>
                  </>
                )}
                <input
                  id="file-input"
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.zip"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!file || !title || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Start Processing
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
