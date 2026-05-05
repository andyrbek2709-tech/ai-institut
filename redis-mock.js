// Простой Redis Streams Mock для локального тестирования
const EventEmitter = require('events');

class RedisStreamsMock extends EventEmitter {
  constructor() {
    super();
    this.streams = new Map(); // stream_name -> { id -> entry }
    this.consumerGroups = new Map(); // stream_name -> { group_name -> { consumers } }
    this.pendingEntries = new Map(); // stream_name -> Map(entry_id -> count)
  }

  // XADD stream_name * field value [field value ...]
  xadd(streamName, id, ...args) {
    if (!this.streams.has(streamName)) {
      this.streams.set(streamName, new Map());
    }

    const stream = this.streams.get(streamName);
    const entry = {};

    for (let i = 0; i < args.length; i += 2) {
      entry[args[i]] = args[i + 1];
    }

    const timestamp = Date.now();
    let finalId;

    if (id === '*') {
      // Auto-generate ID with sequence number
      let seq = 0;
      const baseId = `${timestamp}`;
      finalId = `${baseId}-${seq}`;

      while (stream.has(finalId)) {
        seq++;
        finalId = `${baseId}-${seq}`;
      }
    } else {
      finalId = id;
    }

    stream.set(finalId, { ...entry, _timestamp: timestamp });
    return finalId;
  }

  // XLEN stream_name
  xlen(streamName) {
    return this.streams.has(streamName) ? this.streams.get(streamName).size : 0;
  }

  // XGROUP CREATE stream_name group_name $ [MKSTREAM]
  xgroupCreate(streamName, groupName, id = '$', mkstream = false) {
    if (!this.streams.has(streamName) && !mkstream) {
      throw new Error(`NOGROUP No such stream: ${streamName}`);
    }
    if (!this.streams.has(streamName)) {
      this.streams.set(streamName, new Map());
    }
    if (!this.consumerGroups.has(streamName)) {
      this.consumerGroups.set(streamName, new Map());
    }

    const groups = this.consumerGroups.get(streamName);
    if (groups.has(groupName)) {
      throw new Error(`BUSYGROUP Consumer group '${groupName}' already exists`);
    }

    groups.set(groupName, { consumers: new Map(), lastId: id });
    return 'OK';
  }

  // XREADGROUP GROUP group_name consumer_name STREAMS stream_name id [BLOCK ms] [COUNT n]
  xreadgroup(groupName, consumerName, streamName, id, options = {}) {
    if (!this.consumerGroups.has(streamName)) {
      throw new Error(`NOGROUP No consumer group '${groupName}'`);
    }

    const groups = this.consumerGroups.get(streamName);
    if (!groups.has(groupName)) {
      throw new Error(`NOGROUP Consumer group '${groupName}' not found`);
    }

    const group = groups.get(groupName);
    if (!group.consumers.has(consumerName)) {
      group.consumers.set(consumerName, { lastId: '0' });
    }

    const stream = this.streams.get(streamName) || new Map();
    const results = [];
    const count = options.count || 10;

    for (const [entryId, entry] of stream.entries()) {
      if (entryId > id || id === '>') {
        results.push([entryId, Object.entries(entry).filter(([k]) => k !== '_timestamp')]);
        if (results.length >= count) break;
      }
    }

    return results.length > 0 ? [[streamName, results]] : null;
  }

  // XACK stream_name group_name entry_id [entry_id ...]
  xack(streamName, groupName, ...ids) {
    if (!this.consumerGroups.has(streamName)) {
      throw new Error(`NOGROUP No such stream: ${streamName}`);
    }
    return ids.length;
  }

  // GET
  get(key) {
    const store = this.streams.get('_strings') || new Map();
    return store.get(key);
  }

  // SET
  set(key, value) {
    if (!this.streams.has('_strings')) {
      this.streams.set('_strings', new Map());
    }
    this.streams.get('_strings').set(key, value);
    return 'OK';
  }

  // INFO
  info(section = '') {
    return `
# Server
redis_version:7.0.0-mock
os:mock
uptime_in_seconds:${Math.floor(process.uptime())}

# Clients
connected_clients:1

# Stats
total_connections_received:1
total_commands_processed:1
    `;
  }

  // getAllStreams для отладки
  getAllStreams() {
    return Array.from(this.streams.keys()).filter(k => k !== '_strings');
  }

  getStreamEntries(streamName) {
    if (!this.streams.has(streamName)) return [];
    const stream = this.streams.get(streamName);
    return Array.from(stream.entries()).map(([id, entry]) => [id, Object.entries(entry).filter(([k]) => k !== '_timestamp')]);
  }
}

module.exports = RedisStreamsMock;
