const test = require('node:test');
const assert = require('assert');
const BackEnd = require('../BackEnd.js');

test('BackEnd emits "ready" event within 1500ms', async (t) => {
    const backend = new BackEnd();
    // Ensure start() is called
    backend.start();
    await new Promise((resolve, reject) => {
        backend.on('ready', resolve);
        setTimeout(() => reject(new Error('"ready" event not emitted in time')), 1500);
    });
    assert.ok(true, '"ready" event emitted correctly');
});
