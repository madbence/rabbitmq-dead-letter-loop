'use strict';

var amqp = require('amqp');
var co = require('co');
var conn = amqp.createConnection('amqp://localhost');

function once(emitter, event) {
  return new Promise(function(resolve) {
    emitter.once(event, resolve);
  });
}

function exchange(conn, name, opts) {
  return new Promise(function(resolve) {
    var ex = conn.exchange(name, opts, function() {
      resolve(ex);
    });
  });
}

function queue(conn, name, opts) {
  return new Promise(function(resolve) {
    conn.queue(name, opts, function(q) {
      resolve(q);
    });
  });
}

function bind(queue, exchange, route) {
  return new Promise(function(resolve) {
    queue.bind(exchange, route, resolve);
  });
}

conn.on('error', function(err) {
  console.log(err.stack);
});

co(function* () {
  yield once(conn, 'ready');

  /**
   * Declare clock exchange, in confirm mode
   */
  var ex = yield exchange(conn, 'clock-ex', {
    type: 'direct',
    durable: true,
    autoDelete: false,
    confirm: true,
  });

  /**
   * Declare clock queue, with message TTL
   */
  var clock = yield queue(conn, 'clock', {
    durable: true,
    autoDelete: false,
    arguments: {
      'x-dead-letter-exchange': 'clock-ex',
      'x-dead-letter-routing-key': 'tick',
      'x-message-ttl': 10000,
    }
  });

  /**
   * Declare tick queue, it pumps messages back to clock
   */
  var tick = yield queue(conn, 'tick', {
    durable: true,
    autoDelete: false,
  });

  /**
   * Declare consumer queue
   */
  var consumer = yield queue(conn, 'consumer', {
    durable: true,
    autoDelete: false,
  });

  /**
   * Do the bindings
   *
   * clock -> (tick; consumer)
   * tick -> clock
   */
  yield bind(clock, 'clock-ex', 'clock');
  yield bind(tick, 'clock-ex', 'tick');
  yield bind(consumer, 'clock-ex', 'tick');

  /**
   * Internal pump
   */
  co(function* () {
    tick.subscribe(function(message, headers) {
      delete headers['x-death'];
      console.log('tick', headers);
      ex.publish('clock', message, {
        deliveryMode: 2,
        headers: headers,
      }, function(err) {
        console.log('tick republished (err: %j)', err);
      });
    });
    console.log('initial tick');
    ex.publish('clock', {
      foo: 'bar',
    }, {
      deliveryMode: 2,
    }, function(err) {
      console.log('initial tick published (err: %j)', err);
    });
  });

  /**
   * Consumer pump
   */
  co(function* () {
    yield bind(consumer, 'amq.direct', 'tick');
    consumer.subscribe(function(message) {
      console.log(message);
    });
  });
});
