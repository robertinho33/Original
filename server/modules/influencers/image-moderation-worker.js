'use strict';
const {parentPort}=require('node:worker_threads');
const {analyzeLocally}=require('./image-moderation');
parentPort.on('message',async bytes=>parentPort.postMessage(await analyzeLocally(Buffer.from(bytes))));
