'use strict';
/**
 * Created by rogerk on 4/30/17.
 */
const utils = require('./utils');
const TierTree = require('./TierTree');
const div = '*******************************************************************************';

const testSize = 20;
let data = utils.generateRandomDataset(testSize);
/*
data = {
    a: 1,
    b: 2,
    c: 3,
    d: 4,
    e: 5,
    f: 6,
    g: 7
};
// */

let tree = new TierTree({ valueHash: utils.sha1 });

for(let key in data) {
    if (data.hasOwnProperty(key)) {
        tree.add(key, data[key]);
    }
}

//console.log(tree.toString());

let copy = new TierTree({ valueHash: utils.sha1 });
copy.fromString(tree.toString());

let diff = utils.generateRandomDataset(2);
diff = {
    b: 4
};

for(let key in diff) {
    if (diff.hasOwnProperty(key)) {
        tree.add(key, diff[key]);
    }
}

function clientToServer(payload) {
    console.log('client => server:');
    console.log(JSON.stringify(payload.map(i => JSON.stringify(i)), null, 2));
    let results = [];
    for (let ix = 0; ix < payload.length; ix++) {
        let path = payload[ix];
        tree.traverseDelta(path, (err, next) => {
            if (err) {
                console.error(err);
                process.exit(1);
            }

            results.push(next);
        });
    }
    return results;
}

function serverToClient(payload) {
    console.log('server -> client:');
    console.log(JSON.stringify(payload, null, 2));

    let results = [];
    for (let ix = 0; ix < payload.length; ix++) {
        let resp = payload[ix];

        switch(resp.action) {
            case 'compare': {
                for(let ixch = 0; ixch < resp.children.length; ixch++) {
                    let child = resp.children[ixch];
                    let path = resp.parent.concat([child]);

                    copy.traverseDelta(path, (ex, data) => {
                        if (data.action === 'compare') {
                            for(let ixch2 = 0; ixch2 < data.children.length; ixch2++) {
                                let child = data.children[ixch2];
                                let path = data.parent.concat([child]);
                                results.push(path);
                            }
                        }
                        else if (data.action === 'missing') {
                            console.log('client missing: ' + JSON.stringify(data.parent));
                        }
                        else if (data.action === 'changed') {
                            console.log('client changed: ' + JSON.stringify(data));
                        }
                        else {
                            console.log('client unknown: ' + JSON.stringify(data));
                        }
                    });
                }
                break;
            }
            case 'missing': {
                console.log('server deleted: ' + JSON.stringify(resp.parent));
                break;
            }
            case 'changed': {
                console.log('server changed: ' + JSON.stringify(resp.parent));
                break;
            }
            default: {
                console.log('server unknown: ' + JSON.stringify(resp));
                break;
            }
        }

    }
    return results;
}

let response = [copy.getRoot()];

while(response.length > 0) {
    response = clientToServer(response);
    response = serverToClient(response);
}

