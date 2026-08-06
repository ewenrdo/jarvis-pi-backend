const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldReloadAtMidnight } = require('../src/services/frontendService');

test('shouldReloadAtMidnight triggers only at midnight', () => {
    const midnight = new Date('2026-08-06T00:00:00');
    const notMidnight = new Date('2026-08-06T00:00:10');
    const anotherTime = new Date('2026-08-06T12:34:56');

    assert.equal(shouldReloadAtMidnight(midnight), true);
    assert.equal(shouldReloadAtMidnight(notMidnight), false);
    assert.equal(shouldReloadAtMidnight(anotherTime), false);
});
