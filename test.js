const assert = require('assert');

const utils = require('./utils');
const TierTree = require('./TierTree');

const testSize = 250;

describe('TierTree', function() {

    it('can add items', function (done) {
        let data = utils.generateRandomDataset(testSize);
        let tree = new TierTree({valueHash: utils.sha1});

        for (let key in data) {
            if (data.hasOwnProperty(key)) {
                tree.add(key, data[key]);
            }
        }
        for (let key in data) {
            if (data.hasOwnProperty(key)) {
                assert.equal(tree.get(key), data[key]);
            }
        }

        done();
    });

    it('builds proof for item key', function (done) {
        let data = utils.generateRandomDataset(testSize);
        let tree = new TierTree({valueHash: utils.sha1});

        for (let key in data) {
            if (data.hasOwnProperty(key)) {
                tree.add(key, data[key]);
            }
        }

        let firstKey = Object.keys(data)[0];
        let proof = tree.getProof(firstKey);

        //console.log(proof);
        assert.equal(true, proof.found, 'was found');
        assert.equal(proof.key, firstKey, 'has key');
        assert.equal(true, proof.hasOwnProperty('path'), 'has path');
        assert.equal(true, proof.hasOwnProperty('crc'), 'has crc');
        assert.equal(true, proof.hasOwnProperty('hash'), 'has hash');
        done();
    });

    it('can remove items', function (done) {
        let data = utils.generateRandomDataset(testSize);

        let tree = new TierTree({valueHash: utils.sha1});

        for (let key in data) {
            if (data.hasOwnProperty(key)) {
                tree.add(key, data[key]);
            }
        }

        let before = tree.toString();

        let firstKey = Object.keys(data)[0];
        assert.equal(tree.get(firstKey), data[firstKey]);
        tree.remove(firstKey);
        assert.equal(tree.get(firstKey), null, 'failed to remove');

        let after = tree.toString();
        assert.notEqual(after, before);
        done();
    });

    it('can remove and restore items', function (done) {
        let data = utils.generateRandomDataset(testSize);

        let tree = new TierTree({valueHash: utils.sha1});

        for (let key in data) {
            if (data.hasOwnProperty(key)) {
                tree.add(key, data[key]);
            }
        }

        let before = tree.root.hash;

        let ix = 0;
        let keys = Object.keys(data);
        let mid = (keys.length / 2) | 0;
        for (ix = 0; ix <= mid; ix++) {
            tree.remove(keys[ix]);
        }
        for (ix = mid; ix >= 0; ix--) {
            tree.add(keys[ix], data[keys[ix]]);
        }
        assert.equal(tree.root.hash, before, 'failed to restore items');
        done();
    });

    it('can modify items', function (done) {
        let data = utils.generateRandomDataset(testSize);
        let tree = new TierTree({valueHash: utils.sha1});

        for (let key in data) {
            if (data.hasOwnProperty(key)) {
                tree.add(key, data[key]);
            }
        }

        let before = tree.root.hash;

        let firstKey = Object.keys(data)[0];
        assert.equal(tree.get(firstKey), data[firstKey]);
        tree.add(firstKey, 'Modified: ' + data[firstKey]);
        assert.equal(tree.get(firstKey), 'Modified: ' + data[firstKey], 'failed to update');
        assert.notEqual(tree.root.hash, before);
        //restore to previous state
        tree.add(firstKey, data[firstKey]);
        assert.equal(tree.get(firstKey), data[firstKey], 'failed to restore');
        assert.equal(tree.root.hash, before);
        done();
    });
});
