
const assert = require('chai').assert,
      CheckingBalance = require('../lib/CheckingBalance'),
      config = require('config');

describe('Test checking balance class', function () {

    this.timeout(0);

    var checkingBalance = new CheckingBalance(config.get('qiwi'));

    it ('Test updater balance', (done) => {

        var countUpdate = 0;
        let cbUpdate = (err, balance, changed) => {
            if (err) {
                done(err);
            } else {
                countUpdate++;
                console.log('Update balance %s, typeof %s', balance, typeof balance);
            }
        };

        checkingBalance.updaterBalance(cbUpdate);

        setTimeout(() => {
            assert(countUpdate >= 2);
            done();
        }, (checkingBalance.intervalCheckBalance * 1000) * 2 + (20 * 1000));
    });

});
