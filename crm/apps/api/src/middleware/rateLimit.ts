import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http.js";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(options: { windowMs: number; limit: number; namespace: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${options.namespace}:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    res.setHeader("RateLimit-Limit", options.limit);
    res.setHeader("RateLimit-Remaining", Math.max(0, options.limit - bucket.count));
    res.setHeader("RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));
    if (bucket.count > options.limit) {
      next(new HttpError("Too many requests", 429));
      return;
    }
    if (buckets.size > 10_000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    next();
  };
}
