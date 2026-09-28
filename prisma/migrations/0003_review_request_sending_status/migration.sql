-- Add an explicit lease state so a worker never reports SENT before provider
-- acceptance and concurrent workers cannot send the same request.
ALTER TYPE "ReviewRequestStatus" ADD VALUE IF NOT EXISTS 'SENDING';
