import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

export interface CatalogEntry {
  id: string
  name: string
  size: number
  metadata: unknown
  createdAt: number
  uploadedBy?: string
}

let _client: S3Client | undefined

export function getR2Client() {
  if (!_client) {
    const accountId = process.env.R2_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('R2 credentials are not configured')
    }
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    })
  }
  return _client
}

export function getR2Bucket() {
  const bucket = process.env.R2_BUCKET
  if (!bucket) throw new Error('R2_BUCKET is not configured')
  return bucket
}

// Shared community library: book files + catalog are shared across all users.
export const SHARED_FILES = 'shared/files/'
export const SHARED_CATALOG = 'shared/catalog.json'

/** A user's private reading-progress object key. */
export function userProgressKey(userId: string) {
  return `users/${userId}/progress.json`
}

function isNotFound(e: any) {
  return e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404
}

/** Read the shared book catalog (empty array if it doesn't exist yet). */
export async function readCatalog(): Promise<CatalogEntry[]> {
  try {
    const out = await getR2Client().send(
      new GetObjectCommand({ Bucket: getR2Bucket(), Key: SHARED_CATALOG }),
    )
    const text = await out.Body?.transformToString()
    return text ? JSON.parse(text) : []
  } catch (e) {
    if (isNotFound(e)) return []
    throw e
  }
}

/** Overwrite the shared book catalog. */
export async function writeCatalog(catalog: CatalogEntry[]) {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: SHARED_CATALOG,
      Body: JSON.stringify(catalog),
      ContentType: 'application/json',
    }),
  )
}
