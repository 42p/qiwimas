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
            console.log('Error qiwimas.login()', err);
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
        assert(transactions.length);
    });

    it ('Get history of week', () => {
        return QiwiMas.getHistoryWeek().then(transactions => {
            //console.log(transactions);
        });
    });

    it ('Custom path file to cookies', () => {

        let pathDir = path.join(__dirname, '../storage/testdir');

        fs.dir(pathDir);

        var QiwiMaster = new qiwiMaster(config.get('qiwi'), pathDir);

        return QiwiMaster.login().then(() => {
            fs.remove(pathDir);
        });
    });

    it ('Get current purse', () => {
        assert.equal(QiwiMas.currentPurse(), config.get('qiwi.phone'));
    });

    it ('Change purse', () => {

        QiwiMas.changePurse({
            phone: '11111',
            pass: '123'
        });

        assert.equal(QiwiMas.currentPurse(), '11111');

        QiwiMas.changePurse(config.get('qiwi'));
    });

});