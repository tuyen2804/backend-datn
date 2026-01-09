import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { Hash } from "@aws-sdk/hash-node"

/**
 * Custom signer để ép UNSIGNED-PAYLOAD
 * => client KHÔNG cần gửi x-amz-content-sha256
 */
class UnsignedPayloadHash extends Hash {
  update() {}
  digest() {
    return "UNSIGNED-PAYLOAD"
  }
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  },
  // 🔥 QUAN TRỌNG NHẤT
  sha256: UnsignedPayloadHash
})

export async function generatePresignedUploadUrl(
  bucket,
  key,
  contentType,
  expiresIn = 3600
) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType
  })

  const presignedUrl = await getSignedUrl(s3, command, {
    expiresIn
  })

  return presignedUrl
}

export function getPublicUrl(key) {
  return `https://${process.env.R2_PUBLIC_DOMAIN}/${key}`
}

export function generateObjectKey(prefix, fileName) {
  const timestamp = Date.now()
  return `${prefix}/${timestamp}-${fileName}`
}
