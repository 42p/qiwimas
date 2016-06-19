const mockery = require('mockery');

const assert = require('chai').assert,
      CheckingBalance = require('../lib/CheckingBalance'),
      config = require('config');

describe('Test checking balance class', function () {

    this.timeout(0);

    var checkingBalance = new CheckingBalance({
        qiwi: config.get('qiwi'),
        database: config.get('database')
    });

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
            try {
                assert(countUpdate >= 2);
                done();
            } catch (e) {
                done(e);
            }
        }, (checkingBalance.intervalCheckBalance * 1000) * 2 + (20 * 1000));
    });

    it ('Test sopped updater', (done) => {
        var countUpdate = 0;
        let cbUpdate = (err, balance, changed) => {
            if (err) {
                done(err);
            } else {
                countUpdate++;
                console.log('Update balance %s, typeof %s', balance, typeof balance);
            }
        };

        checkingBalance.intervalCheckBalance = 10;
        checkingBalance.updaterBalance(cbUpdate);

        setTimeout(() => {
            checkingBalance.updaterBalanceDisable();

            setTimeout(() => {
                try {
                    assert.isFalse(checkingBalance.workUpdaterBalance);
                    done();
                } catch (e) {
                    done(e);
                }
            }, 15 * 1000);
        }, 15 * 1000);

    });

    it ('Add transaction', () => {
        return checkingBalance.addTransaction({
            qiwi_id: 12345,
            provider: 'Provider beeline',
            comment: null,
            amount: 1256.52,
            type: 1,
            qiwi_date: '13.06.2016'
        });
    });

    it ('Test check is exists transaction', () => {
        return checkingBalance.addTransaction({
            qiwi_id: 12345,
            provider: 'Provider beeline',
            comment: null,
            amount: 1256.52,
            type: 1,
            qiwi_date: '13.06.2016'
        }).then(results => {
            return checkingBalance.checkExistsTransaction(12345).then(exists => {
                if (!exists) throw new Error('The transaction is no exists');
            });
        }).then(() => {
            return checkingBalance.removeTransaction(12345);
        });
    });


    it ('Test updater transactions', () => {

        var qiwiMasterMock = class QiwiMaster {

            constructor(qiwiAuth) {

            }

            getHistoryWeek() {
                return new Promise((resolve, reject) => {
                    resolve([{
                        status: true,
                        date: '14.06.2016',
                        time: '14:45',
                        transaction: 1234,
                        provider: 'Provider provider',
                        comment: 'alexa',
                        amount: 1200,
                        income: 1200,
                        expenditure: false,
                        commission: 0,
                        error: false
                    },{
                        status: true,
                        date: '14.06.2016',
                        time: '14:45',
                        transaction: 12345,
                        provider: 'Provider provider',
                        comment: 'alexa',
                        amount: 1200,
                        income: 1200,
                        expenditure: false,
                        commission: 0,
                        error: false
                    },{
                        status: true,
                        date: '14.06.2016',
                        time: '14:45',
                        transaction: 123456,
                        provider: 'Provider provider',
                        comment: 'alexa',
                        amount: 1200,
                        income: 1200,
                        expenditure: false,
                        commission: 0,
                        error: false
                    },{
                        status: true,
                        date: '14.06.2016',
                        time: '14:45',
                        transaction: 1234567,
                        provider: 'Provider provider',
                        comment: 'alexa',
                        amount: 1200,
                        income: 1200,
                        expenditure: false,
                        commission: 0,
                        error: false
                    }]);
                });
            }
        };

        mockery.registerMock('./QiwiMaster', qiwiMasterMock);

        mockery.enable({
            useCleanCache: true,
            warnOnReplace: false,
            warnOnUnregistered: false
        });

        let CheckingBalance = require('../lib/CheckingBalance');
        let checkingBalance = new CheckingBalance({
            qiwi: config.get('qiwi'),
            database: config.get('database')
        });

        return checkingBalance.updaterTransactions().then(countAdded => {
            assert(countAdded > 0);

            return checkingBalance.removeAllTransactions();
        });
    });

});
