import { S3Client } from '@aws-sdk/client-s3'

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

/** Namespace every object under the authenticated user's prefix. */
export function userKey(userId: string, sub: string) {
  return `users/${userId}/${sub}`
}

export const FILES_PREFIX = 'files/'
export const DATA_KEY = 'data.json'
