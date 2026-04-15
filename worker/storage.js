/**
 * Supabase Storage <-> VPS filesystem bridge.
 *
 * Downloads tender input files to the correct client workspace,
 * uploads generated output files back to Supabase Storage.
 */

import fs from 'fs/promises'
import path from 'path'

/**
 * Download the tender input file from Supabase Storage to the VPS workspace.
 * Maps to: clients/<CLIENT_CODE>/inputs/tender_documents/<TENDER_SLUG>/
 *
 * @returns {string} Local file path
 */
export async function downloadTenderFile(supabase, job, trosDir) {
  const storagePath = job.payload?.storagePath
  const fileName = job.payload?.fileName
  if (!storagePath || !fileName) {
    throw new Error('Job payload missing storagePath or fileName')
  }

  // Get client code for folder mapping
  const { data: client } = await supabase
    .from('clients')
    .select('client_code, client_id_slug')
    .eq('id', job.client_id)
    .single()

  if (!client) throw new Error(`Client not found: ${job.client_id}`)
  const clientCode = client.client_code ?? client.client_id_slug

  // Get tender slug for folder mapping
  const { data: tender } = await supabase
    .from('tenders')
    .select('tender_id_slug')
    .eq('id', job.tender_id)
    .single()

  if (!tender) throw new Error(`Tender not found: ${job.tender_id}`)

  // Build local directory path
  const localDir = path.join(
    trosDir,
    'clients',
    clientCode,
    'inputs',
    'tender_documents',
    tender.tender_id_slug,
  )
  await fs.mkdir(localDir, { recursive: true })

  const localPath = path.join(localDir, fileName)

  // Download from Supabase Storage
  const { data, error } = await supabase.storage
    .from('tender-inputs')
    .download(storagePath)

  if (error || !data) {
    throw new Error(`Failed to download file from storage: ${error?.message ?? 'no data'}`)
  }

  // Write to local filesystem
  const buffer = Buffer.from(await data.arrayBuffer())
  await fs.writeFile(localPath, buffer)
  console.log(`[storage] Downloaded ${fileName} to ${localPath} (${buffer.length} bytes)`)

  return localPath
}

/**
 * Upload an output file from the VPS workspace to Supabase Storage.
 * Also registers the file in the tender_files table.
 *
 * @param {object} file - { localPath, filename, fileType, mimeType }
 */
export async function uploadOutputFile(supabase, job, file) {
  // Get client code
  const { data: client } = await supabase
    .from('clients')
    .select('client_code, client_id_slug')
    .eq('id', job.client_id)
    .single()

  if (!client) throw new Error(`Client not found: ${job.client_id}`)
  const clientCode = client.client_code ?? client.client_id_slug

  // Get tender slug
  const { data: tender } = await supabase
    .from('tenders')
    .select('tender_id_slug')
    .eq('id', job.tender_id)
    .single()

  if (!tender) throw new Error(`Tender not found: ${job.tender_id}`)

  // Build storage path
  const storagePath = `${clientCode}/${tender.tender_id_slug}/output/${file.filename}`

  // Read local file
  const buffer = await fs.readFile(file.localPath)

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('tender-outputs')
    .upload(storagePath, buffer, {
      contentType: file.mimeType ?? 'application/octet-stream',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(`Failed to upload output: ${uploadError.message}`)
  }

  // Register in tender_files
  const { error: insertError } = await supabase.from('tender_files').insert({
    tender_id: job.tender_id,
    client_id: job.client_id,
    file_type: file.fileType ?? 'output',
    filename: file.filename,
    storage_bucket: 'tender-outputs',
    storage_path: storagePath,
    mime_type: file.mimeType ?? 'application/octet-stream',
    file_size_bytes: buffer.length,
    uploaded_by: null, // Worker upload, not user
    phase: job.phase,
  })

  if (insertError) {
    console.error(`[storage] Failed to register file:`, insertError.message)
  }

  console.log(`[storage] Uploaded ${file.filename} to tender-outputs/${storagePath} (${buffer.length} bytes)`)
}
