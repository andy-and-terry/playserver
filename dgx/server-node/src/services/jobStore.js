/**
 * jobStore.js — simple in-memory job store for PDF processing jobs.
 */

'use strict';

class JobStore {
  constructor() {
    /** @type {Map<string, Object>} */
    this._store = new Map();
  }

  create(jobId) {
    const job = {
      jobId,
      status: 'pending', // pending | running | done | error
      resultFile: null,
      error: null,
      createdAt: Date.now(),
    };
    this._store.set(jobId, job);
    return job;
  }

  get(jobId) {
    return this._store.get(jobId) || null;
  }

  update(jobId, updates) {
    const job = this._store.get(jobId);
    if (job) Object.assign(job, updates);
    return job;
  }

  delete(jobId) {
    return this._store.delete(jobId);
  }

  /** Return a snapshot of all jobs (used for TTL cleanup). */
  listAll() {
    return Array.from(this._store.values());
  }
}

const jobStore = new JobStore();
module.exports = { jobStore };
