const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
require("dotenv").config();

const imageBucketName = process.env.AWS_BUCKET_NAME_PRODUCT;
const region = process.env.AWS_BUCKET_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;

const s3 = new S3Client({
  region: region,
  credentials: { accessKeyId: accessKeyId, secretAccessKey: secretAccessKey },
});

module.exports = { s3, PutObjectCommand, GetObjectCommand };
