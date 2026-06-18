import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

type Bucket = { count: number; resetAt: number };
type Lease = { next: number; end: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const leases = new Map<string, Lease>();
const pendingLeases = new Map<string, Promise<void>>();

async function reserveSharedBucket(key: string, windowMs: number, blockSize: number) {
  const resetAt = new Date(Date.now() + windowMs);
  const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, ${blockSize}, ${resetAt}, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW() THEN ${blockSize}
        ELSE "RateLimitBucket"."count" + ${blockSize}
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW() THEN ${resetAt}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = NOW()
    RETURNING "count", "resetAt"
  `;
  const row = rows[0]!;
  leases.set(key, {
    next: row.count - blockSize + 1,
    end: row.count,
    resetAt: row.resetAt.getTime()
  });
}

async function consumeSharedBucket(key: string, windowMs: number, blockSize: number): Promise<Bucket> {
  const now = Date.now();
  const current = leases.get(key);
  if (current && current.resetAt > now && current.next <= current.end) {
    const count = current.next;
    current.next += 1;
    return { count, resetAt: current.resetAt };
  }
  let pending = pendingLeases.get(key);
  if (!pending) {
    pending = reserveSharedBucket(key, windowMs, blockSize).finally(() => pendingLeases.delete(key));
    pendingLeases.set(key, pending);
  }
  await pending;
  return consumeSharedBucket(key, windowMs, blockSize);
}

function consumeMemoryBucket(key: string, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;
  bucket.count += 1;
  buckets.set(key, bucket);
  if (buckets.size > 10_000) {
    for (const [bucketKey, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(bucketKey);
    }
  }
  return bucket;
}

export async function cleanupRateLimitBuckets() {
  return prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 60 * 60_000) } } });
}

export function rateLimit(options: { windowMs: number; limit: number; namespace: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${options.namespace}:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const blockSize = Math.max(1, Math.min(20, Math.ceil(options.limit / 20)));
    void consumeSharedBucket(key, options.windowMs, blockSize)
      .catch(() => consumeMemoryBucket(key, options.windowMs))
      .then((bucket) => {
        res.setHeader("RateLimit-Limit", options.limit);
        res.setHeader("RateLimit-Remaining", Math.max(0, options.limit - bucket.count));
        res.setHeader("RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));
        if (bucket.count > options.limit) {
          next(new HttpError("Too many requests", 429));
          return;
        }
        next();
      })
      .catch(next);
  };
}
