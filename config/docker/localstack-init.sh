#!/bin/bash

# LocalStack S3 bucket initialization script
# This script runs on LocalStack startup to create the S3 bucket

set -e

echo "Creating S3 bucket 'backend-accounting-documents'..."
awslocal s3 mb s3://backend-accounting-documents || echo "Bucket already exists"

echo "Enabling versioning on S3 bucket..."
awslocal s3api put-bucket-versioning \
  --bucket backend-accounting-documents \
  --versioning-configuration Status=Enabled

echo "S3 bucket 'backend-accounting-documents' created and configured successfully"
