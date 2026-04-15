import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/biddesk/responses'
import { requirePortalContext } from '@/lib/biddesk/server'

export async function GET(request: NextRequest) {
  try {
    const { supabase, clientId } = await requirePortalContext()

    const fileId = request.nextUrl.searchParams.get('fileId')
    if (!fileId) {
      return apiError('INVALID_INPUT', 'fileId is required', 400)
    }

    // Verify file belongs to user's client
    const { data: file, error: fileError } = await supabase
      .from('tender_files')
      .select('id, filename, storage_path, storage_bucket, file_type, tender_id')
      .eq('id', fileId)
      .eq('client_id', clientId)
      .single()

    if (fileError || !file) {
      return apiError('NOT_FOUND', 'File not found', 404)
    }

    // Check if output files are release-gated (balance required)
    if (file.file_type === 'output' || file.file_type === 'final') {
      const { data: tender } = await supabase
        .from('tenders')
        .select('payment_gate, balance_release_required')
        .eq('id', file.tender_id)
        .single()

      if (tender?.balance_release_required && tender?.payment_gate === 'balance_required') {
        return apiError('PAYMENT_REQUIRED', 'Final balance payment required before downloading outputs', 402)
      }
    }

    // Determine bucket from storage_bucket column or fall back to file_type
    const bucket = (file as Record<string, unknown>).storage_bucket as string
      ?? (file.file_type === 'input' ? 'tender-inputs' : 'tender-outputs')

    // Generate signed URL (1 hour expiry)
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(file.storage_path, 3600)

    if (urlError || !signedUrl) {
      return apiError('INTERNAL_ERROR', 'Failed to generate download link', 500)
    }

    return apiOk({
      fileId: file.id,
      filename: file.filename,
      downloadUrl: signedUrl.signedUrl,
      expiresIn: 3600,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return apiError('UNAUTHORIZED', 'Authentication required', 401)
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return apiError('FORBIDDEN', 'Client membership required', 403)
    }
    return apiError('INTERNAL_ERROR', 'Unexpected error', 500)
  }
}
