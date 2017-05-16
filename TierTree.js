'use strict';
/**
 * Created by rogerk on 4/30/17.
 */

module.exports = (function() {

    /**
     * @callback TierValueHash
     * @param {*} value - value to compute has upon
     * @param {*} combine - previous hash value to combine, or 0
     * @return {*} - a string or numeric hash value
     */

    /**
     * @callback TierKeyHash
     * @param {*} value - value to compute has upon
     * @param {number} combine - previous hash value to combine, or 0
     * @return {number} - an integer/long crc/hash value
     */

    /**
     * @constructor
     */
    function TierTreeOptions() {
        const crc32 = require('fast-crc32c').calculate;
        /** @type {number} */
        this.modulus = 7;
        /** @type {TierValueHash} */
        this.valueHash = function crcValueHash(value, combine) {
            return crc32(safeHashInput(value), combine);
        };
        /** @type {TierKeyHash} */
        this.keyHash = function crcKeyHash(value, combine) {
            return crc32(safeHashInput(value), combine);
        };

        this.computeKeyHash = function computeKeyHash(value, depth) {
            let hash;
            if (depth) {
                hash = this.keyHash(depth, value);
            } else {
                hash = this.keyHash(value);
            }

            hash = hash | 0;// force integer
            if (hash < 0) {
                hash = ~hash;
            }
            return hash;
        }
    }

    class TierTree {

        /** @param {TierTreeOptions} options */
        constructor(options) {
            this._options = Object.assign(new TierTreeOptions(), options);
            this.root = { items: {}, hash: 0 };
        }

        /**
         * Add a key and value to the tree
         * @param key - The unique key of the datum
         * @param value - The value (or hash) of the datum
         */
        add(key, value) {
            if (key === undefined || key == null) {
                throw new Error('Key can not be undefined.');
            }
            bucketAdd(this._options, this.root, 0, {
                crc: this._options.computeKeyHash(key),
                key: key,
                value: value,
                hash: this._options.valueHash(value)
            });
        }

        /**
         * Get a value by key
         * @param key - The unique key of the datum
         * @returns value - The value (or hash) of the datum
         */
        get(key) {
            if (key === undefined || key == null) {
                throw new Error('Key can not be undefined.');
            }
            return bucketGet(this._options, this.root, 0, {
                crc: this._options.computeKeyHash(key),
                key: key
            });
        }

        /**
         * Remove an entry by key from the tree
         * @param key - The unique key of the datum
         */
        remove(key) {
            bucketRemove(this._options, this.root, 0, {
                crc: this._options.computeKeyHash(key),
                key: key
            });
        }

        /**
         * Returns an object used to prove a single key's hash chain
         * @param key
         * @return {{crc: number, key: *, path: string, found: boolean, hash: *}}
         */
        getProof(key) {
            let result = {
                crc: this._options.computeKeyHash(key),
                key: key,
                path: [], // stringify later...
                found: false,
                hash: null
            };
            buildProof(this._options, this.root, 0, result);
            result.path = JSON.stringify(result.path);
            return result;
        }

        /**
         * returns a root hash that can be used to start a synchronization round
         * @returns {*} object to identify the current target
         */
        getRoot() {
            return [{hash: this.root.hash}];
        }

        /**
         *
         * @param {array} from
         * @param {function} fnVisitor
         */
        traverseDelta(from, fnVisitor) {

            if (!Array.isArray(from) || from.length <= 0) {
                throw new Error('From traversal must be an array.');
            }

            if (from[0].hash === this.root.hash) {
                return;// identical tree
            }

            bucketCompare(this._options, this.root, 0, {
                from: from,
                parent: [{hash: this.root.hash}],
                visitor: fnVisitor
            });
        }

        /**
         * Dumps the tree as a formatted debug string
         */
        toString() {
            return JSON.stringify(this.root, null, 2);
        }

        /**
         * Restore the tree state from a previous result of toString()
         * @param {string} strData - previous result of toString()
         */
        fromString(strData) {
            this.root = JSON.parse(strData);
        }
    }

    /*************************************************************************/
    /**  PRIVATE METHODS  ****************************************************/
    /*************************************************************************/

    /**
     * Returns a value that can be hashed, string, number, or buffer
     * @param {*} obj - The input object
     * @return {*}
     */
    function safeHashInput(obj) {
        if (obj === undefined) {
            throw new Error('Input can not be undefined.');
        }
        if (typeof obj === 'string' || typeof obj === 'number') {
            return obj;
        }
        return obj === null ? '' : JSON.stringify(obj);
    }

    /**
     * Returns a crc/hash for a given depth
     * @param {TierTreeOptions} options
     * @param {number} depth - combined to hash
     * @param {number} crc - existing crc/hash
     * @return {number}
     */
    function depthCrc(options, depth, crc) {
        return options.computeKeyHash(crc, depth);
    }

    /**
     * @param {TierTreeOptions} options
     * @param {object} self - current bucket
     * @param {number} depth - recursion depth
     * @param {{crc: number, key: *, value: *, hash: *}} entry
     * @return {boolean} - true if newly added, false if updated
     */
    function bucketAdd(options, self, depth, entry) {
        let rcrc = depthCrc(options, depth, entry.crc);
        let mod = rcrc % options.modulus;

        // add a new leaf entry if not present
        if (!self.hasOwnProperty(mod)) {
            self[mod] = {entry: entry};
            computeHash(options, self);
            return true;
        }

        let item = self[mod];
        // convert existing leaf?
        if (item.entry) {
            // replace existing key?
            if (item.entry.key === entry.key) {
                item.entry = entry;
                computeHash(options, self);
                return false;
            }

            // convert to a bucket
            let existing = item.entry;
            delete item.entry;
            bucketAdd(options, item, depth + 1, existing);
        }
        // add to existing child bucket
        let bAdded = bucketAdd(options, item, depth + 1, entry);
        computeHash(options, self);
        return bAdded;
    }

    /**
     * @param {TierTreeOptions} options
     * @param {object} self - current bucket
     * @param {number} depth - recursion depth
     * @param {{crc: number, key: *}} entry
     * @return {*} - value if found, null if not found
     */
    function bucketGet(options, self, depth, entry) {
        let rcrc = depthCrc(options, depth, entry.crc);
        let mod = rcrc % options.modulus;

        if (!self.hasOwnProperty(mod)) {
            return null;
        }

        let item = self[mod];
        // existing leaf?
        if (item.entry) {
            // is same key for delete
            if (item.entry.key === entry.key) {
                return item.entry.value;
            }
            return null;
        }

        return bucketGet(options, item, depth + 1, entry);
    }

    /**
     * @param {TierTreeOptions} options
     * @param {object} self - current bucket
     * @param {number} depth - recursion depth
     * @param {{crc: number, key: *}} entry
     * @return {boolean} - true if removed, false if not found
     */
    function bucketRemove(options, self, depth, entry) {
        let rcrc = depthCrc(options, depth, entry.crc);
        let mod = rcrc % options.modulus;

        if (!self.hasOwnProperty(mod)) {
            return false;
        }

        let item = self[mod];
        // existing leaf?
        if (item.entry) {
            // is same key for delete
            if (item.entry.key === entry.key) {
                delete self[mod];
                computeHash(options, self);
                return true;
            }
            return false;
        }

        if (!bucketRemove(options, item, depth + 1, entry)) {
            return false;
        }

        // collapse if bucket contains only one leaf
        let child = shouldCollapse(options, item);
        if (child) {
            self[mod] = {entry: child};
        }

        computeHash(options, self);
        return true;
    }

    /**
     * @param {TierTreeOptions} options
     * @param {object} self - current bucket
     * @param {number} depth - recursion depth
     * @param {{from: *, parent: array, visitor: function}} entry
     * @return {*} - value if found, null if not found
     */
    function bucketCompare(options, self, depth, entry) {

        let result = {
            action: '',
            parent: [].concat(entry.parent),
            children: []
        };

        let chIx = depth + 1;
        if (chIx >= entry.from.length) {
            result.action = 'compare';
            for (let mod = 0; mod < options.modulus; mod++) {
                if (!self.hasOwnProperty(mod))
                    continue;

                if (self[mod].entry) {
                    result.children.push({mod: mod, key: self[mod].entry.key, hash: self[mod].entry.hash});
                } else {
                    result.children.push({mod: mod, hash: self[mod].hash});
                }
            }
            return entry.visitor(null, result);
        }

        let child = entry.from[depth + 1];

        if (!self.hasOwnProperty(child.mod)) {
            result.action = 'missing';
            return entry.visitor(null, result);
        }

        let chitem = self[child.mod];
        let chhash = chitem.entry ? chitem.entry.hash : chitem.hash;

        if (chhash === child.hash) {
            return; // no-op, identical
        }

        if (chitem.entry) {
            result.action = 'changed';
            result.parent.push({mod: child.mod, key: chitem.entry.key, hash: chitem.entry.hash});
            return entry.visitor(null, result);
        }

        entry.parent.push({
            mod: child.mod,
            hash: chhash
        });

        return bucketCompare(options, chitem, depth + 1, entry);
    }

    /**
     * @param {TierTreeOptions} options
     * @param {object} self - current bucket
     */
    function shouldCollapse(options, self) {
        let child = null;
        for (let mod = 0; mod < options.modulus; mod++) {
            if (!self.hasOwnProperty(mod))
                continue;

            if (!child && self[mod].entry) {
                child = self[mod].entry;
            } else {
                return null;
            }
        }

        return child;
    }


    /**
     * @param {TierTreeOptions} options
     * @param {object} self - current bucket
     */
     function computeHash(options, self) {
        let hash = 0;
        for (let mod = 0; mod < options.modulus; mod++) {
            if (!self.hasOwnProperty(mod))
                continue;

            let item = self[mod];
            if (item.entry) {
                hash = options.valueHash(item.entry.hash, hash);
            } else {
                hash = options.valueHash(item.hash, hash);
            }
        }

        self.hash = hash;
    }

    /**
     * @param {TierTreeOptions} options
     * @param {object} self - current bucket
     * @param {number} depth - recursion depth
     * @param {{crc: number, key: *, path: string, found: boolean, hash: *}} proof
     */
    function buildProof(options, self, depth, proof) {
        let rcrc = depthCrc(options, depth, proof.crc);
        let mod = rcrc % options.modulus;

        if (!self.hasOwnProperty(mod)) {
            return false;
        }

        proof.path.push(self.hash);

        let item = self[mod];
        if (item.entry) { // existing leaf?
            if (item.entry.key !== proof.key) {
                return false;
            }

            proof.found = true;
            proof.hash = item.entry.hash;
            return true;
        }

        return buildProof(options, item, depth + 1, proof);
    }


    /*************************************************************************/
    return TierTree;
})();
