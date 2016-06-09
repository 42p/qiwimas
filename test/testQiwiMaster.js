'use strict';

const assert = require('chai').assert,
      config = require('config'),
      qiwiMaster = require('../lib/QiwiMaster'),
      fs = require('fs-jetpack'),
      path = require('path');

describe('Test QiwiMaster', function () {

    this.timeout(15000);

    var QiwiMas = new qiwiMaster(config.get('qiwi'));

    it ('Login to qiwi', () => {
        return QiwiMas.login().catch(err => {
            console.log(err);
            done(err);
        });
    });

    it ('Sso qiwi request', () => {
        return QiwiMas.ssoQiwi().then(response => {
            assert.isString(response);
        });
    });

    it ('Qiwi get balance', () => {
        return QiwiMas.getBalance().then(balanceRUb => {
            console.log('BalanceRub', balanceRUb);

            assert.isNumber(balanceRUb);
        });
    });

    it ('Parser transactions', () => {
        let transactions = QiwiMas.parseTransactions(fs.read(path.join(__dirname, 'resource/qiwi_history.html')));
        console.log(transactions);
        assert(transactions.length);
    });

    it ('Get history of week', () => {
        return QiwiMas.getHistoryWeek().then(transactions => {
            console.log(transactions.reverse());
        });
    });

});