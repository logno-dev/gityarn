import { S3Client } from '@aws-sdk/client-s3'

import { getServerEnv } from '../env'

let r2Client: S3Client | null = null

export function getR2Client() {
  if (r2Client) {
    return r2Client
  }

  const env = getServerEnv()

  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  })

  return r2Client
}
