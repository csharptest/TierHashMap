'use strict';
/**
 * Created by rogerk on 5/16/17.
 */
const crypto = require('crypto');

module.exports = {

    sha1: function sha1(data, more) {
        const hash = crypto.createHash('sha1');
        if (typeof data === 'number') {
            data = data.toString();
        }
        if (more) {
            hash.update(more);
        }
        hash.update(data);
        return hash.digest('base64').substr(0, 27);
    },

    generateRandomDataset: function generateRandomDataset(size) {
        let dataset = {};
        for (let ix = 0; ix < size; ix++) {
            const hash = crypto.createHash('sha1');
            hash.update(Math.random().toString());
            hash.update(Math.random().toString());
            let key = hash.digest('hex');
            dataset[key] = Math.random();
        }
        return dataset;
    }

};
