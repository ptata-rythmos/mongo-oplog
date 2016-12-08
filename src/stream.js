'use strict'

import { Timestamp } from 'mongodb'

export default async ({ db, ns, since, coll }) => {
  if (!db) {
    throw new Error('Mongo db is missing.')
  }

  const cname = coll || 'oplog.rs'
  const query = {}
  coll = db.collection(cname)

  async function time() {
    const ts = since
    if (ts) {
      return ('number' !== typeof ts) ? ts : Timestamp(0, ts)
    }
    const doc = await coll.find({}, { ts: 1 }).sort({ $natural: -1 }).limit(1).nextObject()
    return doc ? doc.ts : Timestamp(0, (Date.now()/1000 | 0))
  }

  function regex(pattern) {
    pattern = pattern || '*';
    pattern = pattern.replace(/[*]/g, '(.*?)');
    return new RegExp(`^${pattern}`, 'i');
  }

  if (ns) query.ns = { $regex: regex(ns) }
  query.ts = { $gt: await time() }

  return (await coll.find(query, {
    tailable: true,
    awaitData: true,
    oplogReplay: true,
    noCursorTimeout: true,
    numberOfRetries: Number.MAX_VALUE
  })).stream()
}
